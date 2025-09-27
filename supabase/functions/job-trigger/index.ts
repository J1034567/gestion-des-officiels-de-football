import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseAdminClient, createJsonResponse } from '../_shared/supabaseAdmin.ts';

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
            case 'mission_orders.bulk_pdf':
                supabase.functions.invoke('worker-bulk-pdf', { body: { job } });
                break;
            case 'mission_orders.email_bulk':
                supabase.functions.invoke('worker-bulk-email', { body: { job } });
                break;

            default:
                console.warn(`No worker found for job type: ${job.type}`);
                // Optionally update the job to failed status here
                await supabase.from('jobs').update({
                    status: 'failed',
                    error_message: `Unknown job type: ${job.type}`
                }).eq('id', job.id);
        }

        return createJsonResponse({ received: true, jobId: job.id });

    } catch (error) {
        console.error('Error invoking worker function:', error);
        // Update the job to failed status if invocation fails
        await supabase.from('jobs').update({
            status: 'failed',
            error_message: `Failed to invoke worker: ${error.message}`
        }).eq('id', job.id);

        return createJsonResponse({ error: 'Failed to trigger job worker' }, 500);
    }
});