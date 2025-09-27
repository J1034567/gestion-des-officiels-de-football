// supabase/functions/worker-bulk-pdf/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { PDFDocument } from 'pdf-lib';
import { createSupabaseAdminClient, createJsonResponse } from '../_shared/supabaseAdmin.ts';
import { generateSingleMissionOrderPdf } from '../_shared/pdf-generation.ts';
import { JobKinds } from '../_shared/jobKinds.ts';

// --- NEW: Helper function to clean the filename ---
const sanitizeFileName = (name: string): string => {
    const sanitized = name
        .normalize('NFD') // Step 1: Decompose accented characters (e.g., 'é' -> 'e' + '´')
        .replace(/[\u0300-\u036f]/g, '') // Step 2: Remove the accent marks
        .replace(/[^\w.-]/g, '_') // Step 3: Replace any character that is NOT a word char, a dot, or a hyphen with an underscore
        .replace(/__+/g, '_'); // Step 4: Collapse multiple underscores into a single one
    return sanitized;
};

serve(async (req) => {
    const { job } = await req.json();
    const supabase = createSupabaseAdminClient();

    const updateJobProgress = async (progress: number, status: 'processing' | 'completed' = 'processing') => {
        await supabase.from('jobs').update({ progress, status }).eq('id', job.id);
    };

    const failJob = async (errorMessage: string) => {
        await supabase.from('jobs').update({ status: 'failed', error_message: errorMessage }).eq('id', job.id);
    };

    try {
        await supabase.from('jobs').update({ status: 'processing' }).eq('id', job.id);

        if (job.type === JobKinds.MissionOrdersSinglePdf) {
            // Single mission order PDF generation
            const { matchId, officialId } = job.payload;
            if (!matchId || !officialId) {
                await failJob('Missing matchId or officialId for single PDF job');
                return createJsonResponse({ error: 'Invalid payload' }, 400);
            }
            const originalFileName = job.payload.fileName || `mission-order-${matchId}-${officialId}.pdf`;
            const fileName = sanitizeFileName(originalFileName);
            try {
                const pdfBytes = await generateSingleMissionOrderPdf(supabase, matchId, officialId);
                const filePath = `${job.user_id}/${job.id}/${fileName}`;
                const { error: uploadError } = await supabase.storage
                    .from('mission_orders')
                    .upload(filePath, pdfBytes, {
                        contentType: 'application/pdf',
                        upsert: true,
                    });
                if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}. Path: ${filePath}`);
                const { data: urlData, error: urlError } = await supabase.storage
                    .from('mission_orders')
                    .createSignedUrl(filePath, 60 * 60 * 24 * 7);
                if (urlError) throw new Error(`Failed to create signed URL: ${urlError.message}`);
                await supabase.from('jobs').update({
                    status: 'completed',
                    progress: 1,
                    result: { artifactUrl: urlData.signedUrl },
                }).eq('id', job.id);
                return createJsonResponse({ success: true, url: urlData.signedUrl });
            } catch (e) {
                console.error('[worker-bulk-pdf] Failed single PDF generation', e);
                await failJob((e as any)?.message || 'Single PDF failure');
                return createJsonResponse({ error: (e as any)?.message || 'Error' }, 500);
            }
        } else {
            // Bulk mission orders PDF generation (existing logic)
            const orders = job.payload.orders;
            const originalFileName = job.payload.fileName || `mission-orders-${job.id}.pdf`;
            const fileName = sanitizeFileName(originalFileName);
            if (!orders || orders.length === 0) {
                await failJob('No mission orders provided in the job payload.');
                return createJsonResponse({ error: 'No orders' }, 400);
            }
            const mergedPdf = await PDFDocument.create();
            let completedCount = 0;
            for (const order of orders) {
                try {
                    const pdfBytes = await generateSingleMissionOrderPdf(supabase, order.matchId, order.officialId);
                    const singlePdf = await PDFDocument.load(pdfBytes);
                    const copiedPages = await mergedPdf.copyPages(singlePdf, singlePdf.getPageIndices());
                    copiedPages.forEach((page) => mergedPdf.addPage(page));
                } catch (e) {
                    console.error(`Failed to generate PDF for order: match ${order.matchId}, official ${order.officialId}`, e);
                }
                completedCount++;
                await updateJobProgress(completedCount);
            }
            if (mergedPdf.getPageCount() === 0) {
                await failJob('All individual PDF generations failed. The final document is empty.');
                return createJsonResponse({ error: 'Empty PDF' }, 500);
            }
            const mergedPdfBytes = await mergedPdf.save();
            const filePath = `${job.user_id}/${job.id}/${fileName}`;
            const { error: uploadError } = await supabase.storage
                .from('mission_orders')
                .upload(filePath, mergedPdfBytes, {
                    contentType: 'application/pdf',
                    upsert: true,
                });
            if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}. Path: ${filePath}`);
            const { data: urlData, error: urlError } = await supabase.storage
                .from('mission_orders')
                .createSignedUrl(filePath, 60 * 60 * 24 * 7);
            if (urlError) throw new Error(`Failed to create signed URL: ${urlError.message}`);
            await supabase.from('jobs').update({
                status: 'completed',
                progress: completedCount,
                result: { artifactUrl: urlData.signedUrl },
            }).eq('id', job.id);
            return createJsonResponse({ success: true, url: urlData.signedUrl });
        }

    } catch (error) {
        console.error(`[worker-bulk-pdf] Error processing job ${job.id}:`, error);
        const message = (error as any)?.message || 'Unknown error';
        await failJob(message);
        return createJsonResponse({ error: message }, 500);
    }
});