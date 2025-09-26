import { PDFDocument } from 'pdf-lib';
import { generateMissionOrderPDF } from './pdfService';
import { supabase } from '../lib/supabaseClient';
import { hashMissionOrders } from '../utils/hash';

/**
 * Mission Order Service (Phase 1)
 * - Adds an in-memory LRU cache for individual mission order PDFs to avoid regenerating during a session.
 * - Provides bulk fetch & merge with progress callback.
 * - Keeps existing pdfService functions untouched for backward compatibility.
 */

export interface MissionOrderRequest {
    matchId: string;
    officialId: string;
}

export interface BulkMissionOrderProgress {
    total: number;
    completed: number;
    current?: MissionOrderRequest;
}

// Simple LRU cache for Blobs keyed by `${matchId}:${officialId}`
interface CacheEntry {
    key: string;
    blob: Blob;
    ts: number;
}

const MAX_ENTRIES = 100; // heuristic; adjust later if needed
const cacheMap = new Map<string, CacheEntry>();

function touch(entry: CacheEntry) {
    entry.ts = Date.now();
}

function evictIfNeeded() {
    if (cacheMap.size <= MAX_ENTRIES) return;
    // Evict the oldest (least recently used)
    const oldest = [...cacheMap.values()].sort((a, b) => a.ts - b.ts)[0];
    if (oldest) cacheMap.delete(oldest.key);
}

function cacheKey(matchId: string, officialId: string) {
    return `${matchId}:${officialId}`;
}

/**
 * Returns a mission order PDF for a given match/official pair.
 * Uses in-memory LRU cache to avoid redundant edge function calls within the same session.
 * @param matchId
 * @param officialId
 * @param options.forceRefresh bypasses cache if true
 */
export async function getMissionOrderPdf(matchId: string, officialId: string, options?: { forceRefresh?: boolean }): Promise<Blob> {
    const key = cacheKey(matchId, officialId);
    if (!options?.forceRefresh && cacheMap.has(key)) {
        const entry = cacheMap.get(key)!;
        touch(entry);
        return entry.blob;
    }
    const blob = await generateMissionOrderPDF(matchId, officialId);
    cacheMap.set(key, { key, blob, ts: Date.now() });
    evictIfNeeded();
    return blob;
}

/**
 * Merges multiple mission order PDFs into a single document.
 * Leverages the single-order cache; progress callback is invoked before and after each order.
 * Any failed order is skipped (logged) so remaining orders can still be produced.
 * @returns Combined PDF Blob or null if no pages produced.
 */
export async function getBulkMissionOrdersPdf(
    orders: MissionOrderRequest[],
    onProgress?: (p: BulkMissionOrderProgress) => void,
    options?: {
        /** Called once a deterministic batch hash is computed (before remote call). */
        onJobHash?: (hash: string) => void;
        /** Optional abort signal for caller-side cancellation (only affects client merge & polling loops). */
        signal?: AbortSignal;
    }
): Promise<Blob | null> {
    if (!orders || orders.length === 0) return null;
    const LARGE_THRESHOLD = 12; // above this, prefer server bulk merge
    // Deduplicate orders in case caller passed duplicates
    const unique = Array.from(new Map(orders.map(o => [`${o.matchId}:${o.officialId}`, o])).values());

    // Emit an initial zero progress so UI shows 0% immediately (for client merge fallback scenario)
    if (onProgress) {
        try { onProgress({ total: unique.length, completed: 0 }); } catch {/* ignore */ }
    }

    // Attempt unified jobs system path (replaces legacy mission_order_batches) before any legacy/server/client fallback
    const classifyError = (e: any): { category: string; message: string } => {
        const status = e?.status || e?.code || e?.response?.status;
        const msg = (e?.message || '').toLowerCase();
        if (msg === 'aborted') return { category: 'aborted', message: 'Opération annulée' };
        if (msg.includes('no active session')) return { category: 'auth', message: 'Session absente ou expirée.' };
        if (status === 401) return { category: 'auth', message: 'Non authentifié (401) pour la génération idempotente.' };
        if (status === 403) return { category: 'forbidden', message: 'Accès refusé (403) sur la génération.' };
        if (status === 404) return { category: 'not_found', message: 'Ressource de lot introuvable (404).' };
        if (status === 400) return { category: 'bad_request', message: e?.message || 'Requête invalide (400).' };
        if (status >= 500) return { category: 'server', message: e?.message || 'Erreur serveur génération lot.' };
        if (e?.name === 'TypeError' && /fetch/i.test(e?.message || ''))
            return { category: 'network', message: 'Erreur réseau lors de la récupération de l\'artefact.' };
        return { category: 'unknown', message: e?.message || 'Erreur inconnue lors de la génération.' };
    };

    try {
        const batchHash = await hashMissionOrders(unique);
        options?.onJobHash?.(batchHash);
        const job = await enqueueUnifiedBulkPdf(batchHash, unique);
        if (job.status === 'completed' && job.artifactUrl) {
            const resp = await fetch(job.artifactUrl);
            if (resp.ok) return await resp.blob();
        } else if (job.status === 'pending' || job.status === 'running') {
            // Poll jobs table via lightweight RPC (select) instead of legacy batch endpoints
            const deadline = Date.now() + 60_000;
            const initialWaitKick = Date.now() + 1_500; // first possible kick
            let kicked = false;
            while (Date.now() < deadline) {
                if (options?.signal?.aborted) throw new Error('Aborted');
                await new Promise(r => setTimeout(r, 1500));
                const latest = await fetchUnifiedJob(job.id);
                if (latest.status === 'completed' && latest.artifactUrl) {
                    const resp = await fetch(latest.artifactUrl);
                    if (resp.ok) return await resp.blob();
                    break;
                }
                if (latest.status === 'failed') {
                    console.warn('[MissionOrders][unified-job] failed; fallback to client merge', latest.error_code);
                    break;
                }
                if (!kicked && Date.now() > initialWaitKick && (latest.status === 'pending' || latest.status === 'running') && latest.progress < 5) {
                    kicked = true;
                    // Fire & forget unified processor
                    supabase.functions.invoke('process-jobs', { body: {} })
                        .catch(err => console.debug('[MissionOrders][unified-job] processor kick failed (non-fatal)', err?.message || err));
                }
            }
        }
    } catch (e: any) {
        const info = classifyError(e);
        console.warn('[MissionOrders][unified-job] path error', info, e);
    }

    // Legacy server bulk path retained temporarily only if large set and unified jobs path didn't produce
    if (unique.length > LARGE_THRESHOLD) {
        // Attempt server-side generation first
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    console.warn('[MissionOrders][server-bulk] skip: no session (using client merge)');
                    // passer direct à la fusion client ou tenter uniquement path idempotent si accessible
                }
                if (!session) throw new Error('No active session');
                const { data, error } = await supabase.functions.invoke('generate-bulk-mission-orders', {
                    body: { orders: unique }
                });
                if (error) {
                    const info = classifyError(error);
                    throw Object.assign(new Error(info.message), { category: info.category, cause: error });
                }
                // If signed URL returned, fetch the PDF
                if (data?.url) {
                    const resp = await fetch(data.url);
                    if (!resp.ok) throw new Error('Failed to download merged PDF');
                    const blob = await resp.blob();
                    if (blob.size > 0) return blob;
                }
                // Fallback: if not url, attempt direct download via storage path if provided
                if (data?.path) {
                    const { data: file, error: dlError } = await supabase.storage.from('mission_orders').download(data.path);
                    if (dlError) throw dlError;
                    if (file.size > 0) return file;
                }
                throw new Error('Bulk function returned no usable artifact');
            } catch (err: any) {
                const info = classifyError(err);
                if (attempt === 2) {
                    console.warn('[MissionOrders][server-bulk] échec définitif après retries -> fallback client merge', info);
                } else {
                    console.warn('[MissionOrders][server-bulk] tentative échouée, retry...', { attempt, info });
                    await new Promise(r => setTimeout(r, 300 * attempt));
                    continue; // retry
                }
            }
        }
    }

    // Client-side merge (existing Phase 1 logic) for small sets or fallback
    const mergedPdf = await PDFDocument.create();
    let completed = 0;
    for (const order of unique) {
        if (options?.signal?.aborted) throw new Error('Aborted');
        onProgress?.({ total: unique.length, completed, current: order });
        try {
            const blob = await getMissionOrderPdf(order.matchId, order.officialId);
            const bytes = await blob.arrayBuffer();
            const single = await PDFDocument.load(bytes);
            const pages = await mergedPdf.copyPages(single, single.getPageIndices());
            pages.forEach(p => mergedPdf.addPage(p));
        } catch (e: any) {
            const info = classifyError(e);
            console.error('[MissionOrders][client-merge] échec ordre individuel', { order, info, raw: e });
        }
        completed++;
        onProgress?.({ total: unique.length, completed });
    }
    if (mergedPdf.getPageCount() === 0) return null;
    const mergedBytes = await mergedPdf.save();
    const arrayBuffer = (mergedBytes instanceof Uint8Array ? mergedBytes : new Uint8Array(mergedBytes)).slice().buffer;
    return new Blob([arrayBuffer], { type: 'application/pdf' });
}

/** Clears all cached mission order PDFs. */
export function clearMissionOrderCache() {
    cacheMap.clear();
}

// ---------------------------
// Unified Jobs helpers (replacement for legacy mission_order_batches)
// ---------------------------

interface UnifiedJobRow {
    id: string;
    type: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    artifact_path: string | null;
    artifact_type: string | null;
    error_code: string | null;
}

async function enqueueUnifiedBulkPdf(hash: string, orders: MissionOrderRequest[]) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No active session');
    // Use new enqueue edge function with dedupe key generated from hash to ensure reuse
    const { data, error } = await supabase.functions.invoke('enqueue-mission-orders-bulk-pdf', {
        body: { orders, dedupe: true }
    });
    if (error) throw error;
    // We can't map hash directly but dedupe ensures reuse; return job id & initial status
    const jobId = data.jobId;
    const latest = await fetchUnifiedJob(jobId);
    return { id: jobId, status: latest.status, artifactUrl: latest.artifactUrl, progress: latest.progress };
}

async function fetchUnifiedJob(id: string): Promise<{ status: UnifiedJobRow['status']; artifactUrl?: string | null; error_code?: string | null; progress: number; }> {
    // Query jobs row & if artifact present sign URL
    const { data: row, error } = await supabase.from('jobs').select('id,status,artifact_path,artifact_type,error_code,progress').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!row) throw new Error('not_found');
    let artifactUrl: string | null = null;
    if (row.artifact_path && row.artifact_type === 'pdf') {
        const { data: signed, error: signErr } = await supabase.storage.from('mission_orders').createSignedUrl(row.artifact_path, 60 * 60);
        if (!signErr) artifactUrl = signed?.signedUrl || null;
    }
    return { status: row.status, artifactUrl, error_code: row.error_code, progress: row.progress };
}

export const missionOrdersJob = {
    enqueue: enqueueUnifiedBulkPdf,
    fetch: fetchUnifiedJob,
};
