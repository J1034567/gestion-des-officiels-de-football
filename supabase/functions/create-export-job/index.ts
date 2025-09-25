// supabase/functions/create-export-job/index.ts
// Creates an export job (status=pending) that will later be processed
// by the process-export-jobs edge function.

// deno-lint-ignore-file no-explicit-any
// @ts-ignore Deno remote import types resolved at deploy time
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore Deno remote import types resolved at deploy time
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Deno env declaration
declare const Deno: { env: { get: (k: string) => string | undefined } };

const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_TYPES = new Set([
    'payments_monthly',
    'game_day_summary',
    'monthly_accounting_summary',
    'individual_statement',
]);

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function getSupabaseClient(req: Request) {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    return createClient(url, anon, {
        global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });
}

serve(async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }
    if (req.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    try {
        const supabase = getSupabaseClient(req);
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) return jsonResponse({ error: 'Authentification requise.' }, 401);

        const body = await req.json();
        const { type, params } = body || {};
        if (!type || !ALLOWED_TYPES.has(type)) {
            return jsonResponse({ error: 'Type de job invalide.' }, 400);
        }
        if (typeof params !== 'object' || params == null) {
            return jsonResponse({ error: 'Paramètres manquants ou invalides.' }, 400);
        }

        const insertPayload = {
            type,
            params,
            requested_by: user.id,
            status: 'pending',
        } as const;

        const { data, error } = await supabase.from('export_jobs').insert(insertPayload).select('id').single();
        if (error) return jsonResponse({ error: error.message }, 400);

        return jsonResponse({ success: true, jobId: data.id });
    } catch (e) {
        console.error('create-export-job error', e);
        return jsonResponse({ error: (e as Error).message }, 500);
    }
});
