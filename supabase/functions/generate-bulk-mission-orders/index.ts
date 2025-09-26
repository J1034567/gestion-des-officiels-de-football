import { serve } from 'std/http/server.ts';
import { PDFDocument } from "pdf-lib";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Basic CORS (can be tightened later)
const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderInput { matchId: string; officialId: string; }
interface GenerateResult { path: string; pageCount: number; url?: string }

// Helper to invoke existing single mission order logic by calling the edge function
async function fetchSinglePdf(matchId: string, officialId: string, token: string, baseUrl: string): Promise<Uint8Array> {
    const resp = await fetch(`${baseUrl}/functions/v1/generate-mission-order`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ matchId, officialId })
    });
    if (!resp.ok) {
        throw new Error(`generate-mission-order failed (${resp.status})`);
    }
    const buf = new Uint8Array(await resp.arrayBuffer());
    return buf;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: cors });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { headers: { ...cors, 'Content-Type': 'application/json' }, status: 401 });
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
        const adminClient = createClient(supabaseUrl, serviceKey);

        let body: any;
        try { body = await req.json(); } catch { body = null; }
        const orders: OrderInput[] = body?.orders || [];
        if (!Array.isArray(orders) || orders.length === 0) {
            return new Response(JSON.stringify({ error: 'orders array required' }), { headers: { ...cors, 'Content-Type': 'application/json' }, status: 400 });
        }

        // de-duplicate
        const unique = Array.from(new Map(orders.map(o => [`${o.matchId}:${o.officialId}`, o])).values());

        const { data: { session } } = await userClient.auth.getSession();
        if (!session) {
            return new Response(JSON.stringify({ error: 'No session' }), { headers: { ...cors, 'Content-Type': 'application/json' }, status: 401 });
        }

        const mergedPdf = await PDFDocument.create();
        let processed = 0;
        for (const o of unique) {
            try {
                const singleBytes = await fetchSinglePdf(o.matchId, o.officialId, session.access_token, supabaseUrl);
                const src = await PDFDocument.load(singleBytes);
                const pages = await mergedPdf.copyPages(src, src.getPageIndices());
                pages.forEach(p => mergedPdf.addPage(p));
            } catch (e) {
                console.error('Failed order', o, e);
            }
            processed++;
        }

        if (mergedPdf.getPageCount() === 0) {
            return new Response(JSON.stringify({ error: 'No pages generated' }), { headers: { ...cors, 'Content-Type': 'application/json' }, status: 422 });
        }

        const bytes = await mergedPdf.save();
        const fileName = `bulk_${Date.now()}_${unique.length}.pdf`;
        const storagePath = `mission_orders/bulk/${fileName}`;

        const { error: uploadError } = await adminClient.storage.from('mission_orders').upload(storagePath, bytes, {
            contentType: 'application/pdf', upsert: true
        });
        if (uploadError) {
            console.error('Upload failed', uploadError);
            return new Response(JSON.stringify({ error: 'Upload failed' }), { headers: { ...cors, 'Content-Type': 'application/json' }, status: 500 });
        }

        // Create signed URL (1 hour) for convenience
        const { data: signed, error: signedErr } = await adminClient.storage.from('mission_orders').createSignedUrl(storagePath, 3600);
        if (signedErr) {
            console.error('Signed URL failed', signedErr);
        }

        const result: GenerateResult = { path: storagePath, pageCount: mergedPdf.getPageCount(), url: signed?.signedUrl };

        return new Response(JSON.stringify(result), { headers: { ...cors, 'Content-Type': 'application/json' }, status: 200 });

    } catch (e: any) {
        console.error('bulk generation error', e);
        return new Response(JSON.stringify({ error: e.message || 'Internal error' }), { headers: { ...cors, 'Content-Type': 'application/json' }, status: 500 });
    }
});
