// process-mission-order-batches
// Scans pending mission_order_batches, generates merged PDF for each, uploads to storage, marks completed.
// Should be invoked on a cron schedule or manually.

// deno-lint-ignore-file no-explicit-any
// @ts-ignore
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';

// Using existing single mission order function for reuse
// @ts-ignore
const generateFnUrl = 'generate-mission-order';

// deno-lint-ignore no-var no-explicit-any
declare const Deno: any;

const cors: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

function getClient(serviceRole = false) {
    const url = Deno.env.get('SUPABASE_URL')!;
    const key = serviceRole ? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! : Deno.env.get('SUPABASE_ANON_KEY')!;
    return createClient(url, key);
}

async function fetchSingleOrder(supabase: any, matchId: string, officialId: string): Promise<Uint8Array | null> {
    // Invoke existing edge function for single PDF
    const { data, error } = await supabase.functions.invoke(generateFnUrl, { body: { matchId, officialId } });
    if (error || !data?.pdfBase64) return null;
    try {
        const binary = atob(data.pdfBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    } catch {
        return null;
    }
}

serve(async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    // Only service role should call this ideally (secured via deploy config / headers)
    const supabase = getClient(true);

    try {
        // Fetch a small batch of pending jobs
        const { data: pending, error: pendErr } = await supabase
            .from('mission_order_batches')
            .select('hash,orders_json')
            .eq('status', 'pending')
            .limit(5);
        if (pendErr) return json({ error: pendErr.message }, 400);
        if (!pending || pending.length === 0) return json({ processed: 0, message: 'No pending jobs' });

        let processed = 0;
        for (const job of pending) {
            const { hash, orders_json } = job;
            await supabase.from('mission_order_batches').update({ status: 'processing' }).eq('hash', hash);
            try {
                const merged = await PDFDocument.create();
                for (const order of orders_json) {
                    const bytes = await fetchSingleOrder(supabase, order.matchId, order.officialId);
                    if (!bytes) continue;
                    const single = await PDFDocument.load(bytes);
                    const pages = await merged.copyPages(single, single.getPageIndices());
                    pages.forEach(p => merged.addPage(p));
                }
                if (merged.getPageCount() === 0) {
                    await supabase.from('mission_order_batches').update({ status: 'failed', error: 'no_pages' }).eq('hash', hash);
                    continue;
                }
                const mergedBytes = await merged.save();
                const path = `batches/${hash}.pdf`;
                const { error: uploadErr } = await supabase.storage.from('mission_orders').upload(path, mergedBytes, {
                    contentType: 'application/pdf',
                    upsert: true,
                });
                if (uploadErr) {
                    await supabase.from('mission_order_batches').update({ status: 'failed', error: uploadErr.message }).eq('hash', hash);
                    continue;
                }
                await supabase.from('mission_order_batches').update({ status: 'completed', artifact_path: path }).eq('hash', hash);
                processed++;
            } catch (e) {
                await supabase.from('mission_order_batches').update({ status: 'failed', error: (e as Error).message }).eq('hash', hash);
            }
        }
        return json({ processed });
    } catch (e) {
        console.error('process-mission-order-batches error', e);
        return json({ error: (e as Error).message }, 500);
    }
});
