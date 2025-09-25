// get-mission-order-batch
// Returns status (and signed artifact URL if completed) for a mission_order_batches hash.

// deno-lint-ignore-file no-explicit-any
// @ts-ignore
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

        const { hash } = await req.json();
        if (!hash) return json({ error: 'Missing hash' }, 400);

        const { data: rec, error: selErr } = await supabase
            .from('mission_order_batches')
            .select('hash,status,artifact_path,error')
            .eq('hash', hash)
            .maybeSingle();
        if (selErr) return json({ error: selErr.message }, 400);
        if (!rec) return json({ status: 'not_found' });

        if (rec.status === 'completed' && rec.artifact_path) {
            const { data: signed, error: urlErr } = await supabase.storage.from('mission_orders').createSignedUrl(rec.artifact_path, 3600);
            if (urlErr) return json({ error: urlErr.message }, 400);
            return json({ status: 'completed', artifactUrl: signed.signedUrl });
        }
        return json({ status: rec.status, error: rec.error || null });
    } catch (e) {
        console.error('get-mission-order-batch error', e);
        return json({ error: (e as Error).message }, 500);
    }
});
