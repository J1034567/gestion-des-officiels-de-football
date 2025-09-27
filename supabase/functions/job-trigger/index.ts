import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseAdminClient, createJsonResponse } from '../_shared/supabaseAdmin.ts';
import { JobKinds, isMatchSheetsBulkEmail } from '../_shared/jobKinds.ts';

serve(async (req) => {
    const payload = await req.json();
    const job = payload.record;

    if (!job) {
        return createJsonResponse({ error: 'Invalid payload' }, 400);
    }

    const supabase = createSupabaseAdminClient();

    try {
        // Asynchronously invoke the correct worker based on job type
        // We don't `await` this, so the webhook responds immediately.
        switch (job.type) {
            // Mission orders PDF (bulk & single)
            case JobKinds.MissionOrdersBulkPdf:
            case JobKinds.MissionOrdersSinglePdf:
                supabase.functions.invoke('worker-bulk-pdf', { body: { job } });
                break;
            // Match sheets bulk email (canonical) + legacy alias
            case JobKinds.MatchSheetsBulkEmail:
                supabase.functions.invoke('worker-bulk-email', { body: { job } });
                break;
            // Mission order single email (mission order pdf for one official + match sheet email)
            case JobKinds.MissionOrdersSingleEmail:
                supabase.functions.invoke('worker-bulk-email', { body: { job } });
                break;
            // Messaging bulk email (simple broadcast)
            case JobKinds.MessagingBulkEmail:
                supabase.functions.invoke('worker-bulk-email', { body: { job } });
                break;
            default:
                console.warn(`[job-trigger] No worker found for job type: ${job.type}`);
                await supabase.from('jobs').update({
                    status: 'failed',
                    error_message: `Unknown job type: ${job.type}`
                }).eq('id', job.id);
        }

        return createJsonResponse({ received: true, jobId: job.id });

    } catch (error) {
        console.error('Error invoking worker function:', error);
        const message = (error as any)?.message || 'Unknown error';
        await supabase.from('jobs').update({
            status: 'failed',
            error_message: `Failed to invoke worker: ${message}`
        }).eq('id', job.id);
        return createJsonResponse({ error: 'Failed to trigger job worker' }, 500);
    }
});