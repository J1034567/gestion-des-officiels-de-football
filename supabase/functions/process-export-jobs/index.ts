// supabase/functions/process-export-jobs/index.ts
// Picks the oldest pending export job, marks it processing, generates artifact (placeholder), uploads to storage.
// This is a minimal MVP implementation; extend per export type logic.

// deno-lint-ignore-file no-explicit-any
// @ts-ignore Remote Deno types resolved at runtime
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: { env: { get: (k: string) => string | undefined } };

const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function getServiceClient() {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    return createClient(url, serviceKey);
}

async function claimNextJob(supabase: any) {
    // Fetch pending
    const { data: job } = await supabase
        .from('export_jobs')
        .select('id, type, params')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
    if (!job) return null;
    const { error: startErr } = await supabase.rpc('start_export_job', { p_id: job.id });
    if (startErr) return null; // another worker may have grabbed
    return job;
}

async function processJob(supabase: any, job: any) {
    // Dispatch by type. For now we just create a placeholder file.
    // In production, replicate logic from existing worker / server side generation.
    const now = new Date().toISOString();
    const content = `Export Job ${job.id}\nType: ${job.type}\nGenerated At: ${now}\nParams: ${JSON.stringify(job.params, null, 2)}\n`;
    const bytes = new TextEncoder().encode(content);
    const path = `exports/${job.id}.txt`;
    const { error: uploadErr } = await supabase.storage.from('exports').upload(path, bytes, { contentType: 'text/plain', upsert: true });
    if (uploadErr) {
        await supabase.rpc('fail_export_job', { p_id: job.id, p_error: uploadErr.message });
        return { error: uploadErr.message };
    }
    await supabase.rpc('complete_export_job', { p_id: job.id, p_file_path: path, p_file_size: bytes.length });
    return { success: true, path };
}

serve(async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    try {
        const supabase = getServiceClient();
        const job = await claimNextJob(supabase);
        if (!job) return json({ success: true, message: 'No pending job' });
        const result = await processJob(supabase, job);
        return json(result);
    } catch (e) {
        console.error('process-export-jobs error', e);
        return json({ error: (e as Error).message }, 500);
    }
});
