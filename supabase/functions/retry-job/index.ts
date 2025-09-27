import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseAdminClient } from '../_shared/supabaseAdmin.ts';
import { corsHeaders, createCorsResponse } from '../_shared/cors.ts'

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return createCorsResponse();
    }


    const { jobId } = await req.json();
    const supabase = createSupabaseAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }, });

    const { data, error } = await supabase
        .from('jobs')
        .update({
            status: 'pending',
            progress: 0,
            error_message: null,
            result: null,
        })
        .match({ id: jobId, user_id: user.id }) // Ensure user owns the job
        .select()
        .single();

    if (error) {
        return new Response(JSON.stringify({ error: 'Job not found or failed to update' }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }, });
    }

    return new Response(JSON.stringify({ success: true, job: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
});