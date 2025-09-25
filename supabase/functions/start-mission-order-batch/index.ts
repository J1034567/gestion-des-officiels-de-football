// start-mission-order-batch
// Idempotent initiation of mission order batch generation based on a content hash.
// If a completed artifact already exists, returns its signed URL immediately.
// Otherwise ensures a job record (status=pending or processing) exists.
// Expects a table mission_order_batches (schema to be added separately):
// columns: hash (pk), status, orders_json, artifact_path, error, created_at, updated_at
// status enum: pending | processing | completed | failed

// deno-lint-ignore-file no-explicit-any
// @ts-ignore Deno types provided at deploy
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-ignore pdf-lib types not resolved in Edge runtime bundler
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';

// Deno env
// deno-lint-ignore no-var no-explicit-any
declare const Deno: any;

const cors: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

function getClient(req: Request) {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    return createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
}

serve(async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    try {
        const supabase = getClient(req);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return json({ error: 'Unauthorized' }, 401);

        const { hash, orders } = await req.json();
        if (!hash || !Array.isArray(orders) || orders.length === 0) {
            return json({ error: 'Invalid payload' }, 400);
        }

        // Check existing
        const { data: existing, error: selErr } = await supabase
            .from('mission_order_batches')
            .select('hash,status,artifact_path,error')
            .eq('hash', hash)
            .maybeSingle();
        if (selErr) return json({ error: selErr.message }, 400);

        if (existing) {
            if (existing.status === 'completed' && existing.artifact_path) {
                const { data: signed, error: urlErr } = await supabase.storage.from('mission_orders').createSignedUrl(existing.artifact_path, 60 * 60);
                if (urlErr) return json({ error: urlErr.message }, 400);
                return json({ status: 'completed', artifactUrl: signed.signedUrl });
            }
            return json({ status: existing.status, error: existing.error || null });
        }

        // Inline small batch generation optimization (Option D)
        const INLINE_THRESHOLD = 6; // tuneable; keep modest to avoid timeouts
        if (orders.length <= INLINE_THRESHOLD) {
            try {
                // Create job row in 'processing' immediately to reflect inline work
                const { error: inlineInsErr } = await supabase.from('mission_order_batches').insert({
                    hash,
                    status: 'processing',
                    orders_json: orders,
                    artifact_path: null,
                    error: null
                });
                if (inlineInsErr) return json({ error: inlineInsErr.message }, 400);

                const merged = await PDFDocument.create();
                // Reuse existing single generation edge function for each order
                const singleFn = 'generate-mission-order';
                for (const o of orders) {
                    const { data: singleData, error: singleErr } = await supabase.functions.invoke(singleFn, { body: { matchId: o.matchId, officialId: o.officialId } });
                    if (singleErr || !singleData?.pdfBase64) continue; // skip silently
                    try {
                        const binary = atob(singleData.pdfBase64);
                        const bytes = new Uint8Array(binary.length);
                        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                        const singlePdf = await PDFDocument.load(bytes);
                        const pages = await merged.copyPages(singlePdf, singlePdf.getPageIndices());
                        pages.forEach((p: any) => merged.addPage(p));
                    } catch {/* skip malformed */ }
                }
                if (merged.getPageCount() === 0) {
                    await supabase.from('mission_order_batches').update({ status: 'failed', error: 'no_pages' }).eq('hash', hash);
                    return json({ status: 'failed', error: 'no_pages' });
                }
                const mergedBytes = await merged.save();
                const path = `batches/${hash}.pdf`;
                const { error: uploadErr } = await supabase.storage.from('mission_orders').upload(path, mergedBytes, {
                    contentType: 'application/pdf',
                    upsert: true,
                });
                if (uploadErr) {
                    await supabase.from('mission_order_batches').update({ status: 'failed', error: uploadErr.message }).eq('hash', hash);
                    return json({ status: 'failed', error: uploadErr.message });
                }
                await supabase.from('mission_order_batches').update({ status: 'completed', artifact_path: path }).eq('hash', hash);
                const { data: signed, error: signErr } = await supabase.storage.from('mission_orders').createSignedUrl(path, 60 * 60);
                if (signErr) return json({ status: 'completed', error: signErr.message });
                return json({ status: 'completed', artifactUrl: signed.signedUrl, inline: true });
            } catch (inlineE) {
                console.error('Inline small-batch generation failed, falling back to queued pending job', inlineE);
                // Fall through to pending insertion below
            }
        }

        // Insert new pending job (queued path)
        const insertPayload = {
            hash,
            status: 'pending',
            orders_json: orders,
            artifact_path: null,
            error: null
        };
        const { error: insErr } = await supabase.from('mission_order_batches').insert(insertPayload);
        if (insErr) return json({ error: insErr.message }, 400);
        return json({ status: 'pending' });
    } catch (e) {
        console.error('start-mission-order-batch error', e);
        return json({ error: (e as Error).message }, 500);
    }
});
