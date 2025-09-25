import { supabase } from '../lib/supabaseClient';
import { PDFDocument } from 'pdf-lib';

/**
 * Generates a mission order PDF for a specific official and match.
 * It calls a Supabase Edge Function that handles all logic, including
 * checking for existing orders to avoid unnecessary regeneration.
 * @param {string} matchId - The ID of the match.
 * @param {string} officialId - The ID of the official.
 * @returns {Promise<Blob>} A promise that resolves to the PDF file as a Blob.
 */
export const generateMissionOrderPDF = async (matchId: string, officialId: string): Promise<Blob> => {
    if (!matchId || !officialId) throw new Error('Match ID and Official ID are required to generate a mission order.');
    try {
        const { data, error } = await supabase.functions.invoke('generate-mission-order', {
            body: { matchId, officialId },
        });
        if (error) throw error;
        // supabase.functions.invoke returns JSON by default; our function returns PDF bytes.
        // So we fallback to manual fetch if invoke did not give us a Blob (Edge functions currently return Response).
        // We attempt a direct call only if data is not a Blob-like (heuristic).
        if (data instanceof Blob) return data;
        // Fallback direct fetch (for compatibility if invoke wrapper changes)
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) throw new Error('No authentication session found');
        const url = `${(supabase as any).supabaseUrl || ''}/functions/v1/generate-mission-order`;
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ matchId, officialId })
        });
        if (!resp.ok) throw new Error(`Failed to generate PDF (fallback): ${await resp.text()}`);
        return await resp.blob();
    } catch (e) {
        console.error('Error generating mission order:', e);
        throw e;
    }
};

/**
 * Generates a single PDF containing mission orders for multiple officials and matches.
 * @param {Array<{matchId: string, officialId: string}>} orders - An array of match and official IDs.
 * @returns {Promise<Blob|null>} A promise that resolves to the merged PDF file as a Blob, or null if no orders are provided.
 */
export const generateBulkMissionOrdersPDF = async (
    orders: { matchId: string; officialId: string }[]
): Promise<Blob | null> => {
    if (!orders || orders.length === 0) {
        return null;
    }

    try {
        // 1. Fetch all individual PDFs in parallel
        const pdfPromises = orders.map(order =>
            generateMissionOrderPDF(order.matchId, order.officialId)
        );
        const pdfBlobs = await Promise.all(pdfPromises);

        // 2. Create a new PDF document for merging
        const mergedPdf = await PDFDocument.create();

        // 3. Loop through each fetched PDF, load it, and copy its pages
        for (const pdfBlob of pdfBlobs) {
            if (pdfBlob.size > 0) {
                const pdfBytes = await pdfBlob.arrayBuffer();
                const pdfToMerge = await PDFDocument.load(pdfBytes);
                const copiedPages = await mergedPdf.copyPages(pdfToMerge, pdfToMerge.getPageIndices());
                copiedPages.forEach(page => mergedPdf.addPage(page));
            }
        }

        if (mergedPdf.getPageCount() === 0) {
            throw new Error("No pages were generated for the selected orders.");
        }

        // 4. Save the merged PDF and return it as a Blob
        const mergedPdfBytes = await mergedPdf.save();
        const arrayBuffer = (mergedPdfBytes instanceof Uint8Array ? mergedPdfBytes : new Uint8Array(mergedPdfBytes)).slice().buffer;
        return new Blob([arrayBuffer], { type: 'application/pdf' });

    } catch (error) {
        console.error('Error generating bulk mission orders:', error);
        throw error; // Re-throw to be caught by the UI
    }
};

/**
 * Triggers a browser download for a given Blob.
 * @param {Blob} blob - The Blob to download.
 * @param {string} fileName - The desired name for the downloaded file.
 */
export const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};