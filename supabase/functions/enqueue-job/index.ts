// supabase/functions/enqueue-job/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// Use the new, corrected client helper
import { createSupabaseClient } from '../_shared/supabaseClient.ts';
// We still need an admin client for inserting into the DB, bypassing RLS
// @ts-ignore - Deno edge function (types resolved in Deno runtime, not frontend build)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createCorsResponse } from '../_shared/cors.ts';

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return createCorsResponse();
    }

    try {
        // 1. Create a client scoped to the user's request to check authentication
        const supabaseClient = createSupabaseClient(req);
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

        // If there's an error or no user, the token is invalid or missing
        if (userError || !user) {
            console.warn('Auth error:', userError?.message || 'No user found');
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // 2. The user is authenticated. Now, use an ADMIN client to perform the database insertion.
        // This is a secure pattern: verify user, then act on their behalf with elevated privileges.
        const supabaseAdmin = createClient(
            // @ts-ignore Deno global
            Deno.env.get('SUPABASE_URL')!,
            // @ts-ignore Deno global
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const { type, label, payload, total, dedupe_key } = await req.json();

        // We now use the authenticated user's ID
        const jobToInsert: Record<string, any> = { user_id: user.id, type, label, payload, total, status: 'pending' };
        if (dedupe_key) jobToInsert.dedupe_key = dedupe_key;

        const { data: job, error: insertError } = await supabaseAdmin
            .from('jobs')
            .insert(jobToInsert)
            .select()
            .single();

        if (insertError) {
            console.error('Job insertion error:', insertError);
            return new Response(JSON.stringify({ error: insertError.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ job }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});