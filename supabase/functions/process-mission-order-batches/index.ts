// Import dependencies with explicit versions for stability.
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';

// --- Configuration ---
// Centralize configuration for easier management.
const GENERATE_ORDER_FUNCTION_NAME = 'generate-mission-order';
const BATCH_PROCESSING_LIMIT = 5; // Number of batches to process per invocation.
const STALE_PROCESSING_THRESHOLD_MINUTES = 5; // Mark jobs as stale after this period.

// --- Types ---
// Define types for better code clarity, type safety, and autocompletion.
interface MissionOrder {
    matchId: string;
    officialId: string;
}

interface MissionOrderBatch {
    hash: string;
    orders_json: MissionOrder[];
}

// --- CORS Headers ---
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Creates and returns a Supabase client instance.
 * It's best practice to use the service role key for server-side operations.
 */
function getSupabaseClient(): SupabaseClient {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Supabase environment variables are not set.');
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            // Functions are invoked as the service_role, so auto-refreshing the token is not needed.
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

/**
 * Fetches a single mission order PDF by invoking another Edge Function.
 * @param supabase - The Supabase client.
 * @param order - The mission order details.
 * @returns A promise that resolves to a Uint8Array of the PDF bytes or null on failure.
 */
async function fetchSingleOrderPdf(
    supabase: SupabaseClient,
    order: MissionOrder
): Promise<Uint8Array | null> {
    try {
        const { data, error } = await supabase.functions.invoke(GENERATE_ORDER_FUNCTION_NAME, {
            body: { matchId: order.matchId, officialId: order.officialId },
        });

        if (error) {
            console.error(`Error invoking generate function for match ${order.matchId}:`, error.message);
            return null;
        }

        // The modern and correct way to decode base64 in Deno.
        return data?.pdfBase64 ? Uint8Array.from(atob(data.pdfBase64), c => c.charCodeAt(0)) : null;
    } catch (err) {
        console.error(`Exception fetching PDF for match ${order.matchId}:`, err.message);
        return null;
    }
}

/**
 * Processes a single mission order batch job.
 * @param supabase - The Supabase client.
 * @param job - The mission order batch to process.
 */
async function processJob(supabase: SupabaseClient, job: MissionOrderBatch): Promise<void> {
    const { hash, orders_json } = job;

    // Set status to 'processing' to prevent other workers from picking it up.
    await supabase.from('mission_order_batches').update({ status: 'processing', updated_at: new Date().toISOString() }).eq('hash', hash);

    try {
        // --- Parallel PDF Fetching ---
        // Fetch all individual PDFs concurrently for a significant performance boost.
        const pdfPromises = orders_json.map(order => fetchSingleOrderPdf(supabase, order));
        const pdfBytesArray = await Promise.all(pdfPromises);

        const validPdfBytes = pdfBytesArray.filter((bytes): bytes is Uint8Array => bytes !== null);

        if (validPdfBytes.length === 0) {
            await supabase.from('mission_order_batches').update({ status: 'failed', error: 'No individual PDFs could be generated.' }).eq('hash', hash);
            return;
        }

        // --- PDF Merging ---
        const mergedPdf = await PDFDocument.create();
        for (const pdfBytes of validPdfBytes) {
            const pdf = await PDFDocument.load(pdfBytes);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach(page => mergedPdf.addPage(page));
        }

        const mergedPdfBytes = await mergedPdf.save();
        const filePath = `batches/${hash}.pdf`;

        // --- Upload to Storage ---
        const { error: uploadError } = await supabase.storage.from('mission_orders').upload(filePath, mergedPdfBytes, {
            contentType: 'application/pdf',
            upsert: true,
        });

        if (uploadError) {
            throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        // --- Final Status Update ---
        await supabase.from('mission_order_batches').update({
            status: 'completed',
            artifact_path: filePath,
            error: null, // Clear any previous errors.
        }).eq('hash', hash);

        console.log(`Successfully processed batch ${hash}.`);

    } catch (e) {
        console.error(`Failed to process batch ${hash}:`, e.message);
        await supabase.from('mission_order_batches').update({ status: 'failed', error: e.message }).eq('hash', hash);
    }
}

// --- Main Server Handler ---
serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: CORS_HEADERS });
    }
    // The function is triggered by a cron job, which uses a POST request.
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
    }

    try {
        const supabase = getSupabaseClient();

        // --- Idempotent Job Selection ---
        // Select 'pending' jobs OR jobs that have been 'processing' for too long (stale).
        const staleThreshold = new Date(Date.now() - STALE_PROCESSING_THRESHOLD_MINUTES * 60 * 1000).toISOString();

        const { data: jobs, error } = await supabase
            .from('mission_order_batches')
            .select('hash,orders_json')
            .or(`status.eq.pending,and(status.eq.processing,updated_at.lt.${staleThreshold})`)
            .limit(BATCH_PROCESSING_LIMIT);

        if (error) {
            console.error('Error fetching pending jobs:', error);
            throw new Error(`Failed to fetch jobs: ${error.message}`);
        }

        if (!jobs || jobs.length === 0) {
            return new Response(JSON.stringify({ processed: 0, message: 'No pending jobs found.' }), {
                status: 200,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        }

        // --- Parallel Job Processing ---
        // Process all fetched jobs concurrently.
        await Promise.all(jobs.map(job => processJob(supabase, job as MissionOrderBatch)));

        return new Response(JSON.stringify({ processed: jobs.length }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });

    } catch (e) {
        console.error('Critical error in process-mission-order-batches:', e.message);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
    }
});