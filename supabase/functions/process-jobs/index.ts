// Unified Job Processor Edge Function
// Date: 2025-09-26
// Processes generic jobs with phase weighting and optional job_items expansion.
// Uses service role key (do NOT expose outside server context).

// @ts-nocheck
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';

// --- Types and Configuration ---
declare const Deno: { env: { get(k: string): string | undefined } };
type SupabaseClient = ReturnType<typeof createClient>;
// ADDED: Type for our structured logger function for better type safety.
type Slog = (level: string, event: string, meta?: Record<string, any>) => void;

const MAX_JOBS_PER_INVOCATION = 5;
const STALE_MINUTES = 10;
const JOB_SELECT_STATUSES = ["pending", "running"];

const PHASE_WEIGHTS: Record<string, { name: string; weight: number }[]> = {
    'mission_orders.bulk_pdf_v2': [
        { name: 'fetch', weight: 40 },
        { name: 'merge', weight: 40 },
        { name: 'upload', weight: 20 }
    ],
    'mission_orders.email_bulk_v2': [
        { name: 'prepare', weight: 15 },
        { name: 'render', weight: 35 },
        { name: 'send', weight: 50 }
    ],
};

interface JobRow {
    id: string; type: string; status: string; payload: any;
    progress: number; phase: string | null; phase_progress: number;
    attempts: number; dedupe_key: string | null; artifact_path: string | null;
    artifact_type: string | null; error_code: string | null; created_at: string;
    updated_at: string;
}

// --- Supabase & Utility Functions ---

function getClient() {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('Missing env SUPABASE_URL or SERVICE_ROLE_KEY');
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
    };
}

// --- Core Job Logic with Logging ---

// MODIFIED: All core functions now accept `slog` and `supabase` for traceability and testability.
async function withJobPhase(slog: Slog, supabase: SupabaseClient, job: JobRow, phaseName: string, fn: () => Promise<void>) {
    // ADDED: Log the start of each phase.
    slog('info', 'phase.start', { jobId: job.id, phase: phaseName });
    await supabase.from('jobs').update({ phase: phaseName, phase_progress: 0, updated_at: new Date().toISOString() }).eq('id', job.id);
    await fn();
    await supabase.from('jobs').update({ phase_progress: 100, updated_at: new Date().toISOString() }).eq('id', job.id);
    // ADDED: Log the successful completion of each phase.
    slog('info', 'phase.success', { jobId: job.id, phase: phaseName });
}

function calcOverallProgress(job: JobRow, phase: string | null, phaseProgress: number): number {
    const phases = PHASE_WEIGHTS[job.type];
    if (!phases) return phaseProgress;
    let accumulated = 0;
    for (const p of phases) {
        if (p.name === phase) {
            const currentBase = accumulated;
            return Math.min(100, Math.round(currentBase + (phaseProgress / 100) * p.weight));
        }
        accumulated += p.weight;
    }
    return accumulated;
}

async function updateOverallProgress(supabase: SupabaseClient, job: JobRow, currentPhase: string, currentPhaseProgress: number) {
    const overall = calcOverallProgress(job, currentPhase, currentPhaseProgress);
    await supabase.from('jobs').update({ progress: overall }).eq('id', job.id);
}

// --- Job Type Handlers ---

const handlers: Record<string, (slog: Slog, supabase: SupabaseClient, job: JobRow) => Promise<void>> = {
    'mission_orders.bulk_pdf_v2': async (slog, supabase, job) => {
        const phases = PHASE_WEIGHTS[job.type];
        const orders = job.payload?.orders || [];
        if (!Array.isArray(orders) || orders.length === 0) {
            throw Object.assign(new Error('Payload contains no orders'), { code: 'empty_payload' });
        }
        slog('info', 'handler.start', { jobId: job.id, jobType: job.type, orderCount: orders.length });

        // Phase 1: fetch individual PDFs
        await withJobPhase(slog, supabase, job, phases[0].name, async () => {
            let completed = 0, blobs: Uint8Array[] = [], failures: any[] = [];
            for (const o of orders) {
                try {
                    const { data, error } = await supabase.functions.invoke('generate-mission-order', { body: { matchId: o.matchId, officialId: o.officialId, returnBase64: true } });
                    if (error) throw error;
                    if (data?.pdfBase64) {
                        blobs.push(Uint8Array.from(atob(data.pdfBase64), c => c.charCodeAt(0)));
                    } else {
                        failures.push({ ...o, reason: 'missing_pdfBase64' });
                    }
                } catch (e) {
                    slog('warn', 'fetch.item.failed', { jobId: job.id, order: o, error: e.message });
                    failures.push({ ...o, reason: e?.message || 'invoke_failed' });
                }
                completed++;
                const pct = Math.round((completed / orders.length) * 100);
                await supabase.from('jobs').update({ phase_progress: pct }).eq('id', job.id);
                await updateOverallProgress(supabase, job, phases[0].name, pct);
            }
            (job as any)._fetchedBytes = blobs;
            (job as any)._fetchStats = { total: orders.length, succeeded: blobs.length, failed: failures.length, failures: failures.slice(0, 25) };
            // ADDED: Summary log for the fetch phase.
            slog('info', 'fetch.summary', { jobId: job.id, ...((job as any)._fetchStats) });
        });

        // Phase 2: merge
        await withJobPhase(slog, supabase, job, phases[1].name, async () => {
            const fetched: Uint8Array[] = (job as any)._fetchedBytes || [];
            if (!fetched.length) {
                const stats = (job as any)._fetchStats || {};
                await supabase.from('jobs').update({ payload: { ...job.payload, fetch_stats: stats }, error_code: 'no_pages' }).eq('id', job.id);
                throw Object.assign(new Error('No PDF pages to merge'), { code: 'no_pages' });
            }
            const merged = await PDFDocument.create();
            let idx = 0;
            for (const bytes of fetched) {
                try {
                    const pdf = await PDFDocument.load(bytes);
                    const pages = await merged.copyPages(pdf, pdf.getPageIndices());
                    pages.forEach((p: any) => merged.addPage(p));
                } catch (e) {
                    slog('warn', 'merge.page.failed', { jobId: job.id, error: e.message });
                }
                idx++;
                const pct = Math.round((idx / fetched.length) * 100);
                await supabase.from('jobs').update({ phase_progress: pct }).eq('id', job.id);
                await updateOverallProgress(supabase, job, phases[1].name, pct);
            }
            (job as any)._mergedBytes = await merged.save();
        });

        // Phase 3: upload
        await withJobPhase(slog, supabase, job, phases[2].name, async () => {
            const mergedBytes: Uint8Array = (job as any)._mergedBytes;
            const size = mergedBytes?.length || 0;
            const fetchStats = (job as any)._fetchStats || null;
            // Verify non-empty artifact before attempting upload
            if (size === 0) {
                slog('error', 'artifact.empty', { jobId: job.id });
                // Persist fetch stats for debugging before failing
                await supabase.from('jobs').update({ payload: { ...job.payload, fetch_stats: fetchStats }, error_code: 'artifact_empty' }).eq('id', job.id);
                throw Object.assign(new Error('Merged artifact is empty'), { code: 'artifact_empty' });
            }
            const path = `batches/${job.dedupe_key || job.id}.pdf`;
            const { error } = await supabase.storage.from('mission_orders').upload(path, mergedBytes, { contentType: 'application/pdf', upsert: true });
            if (error) {
                throw Object.assign(new Error(`Storage upload failed: ${error.message}`), { code: 'upload_failed' });
            }
            slog('info', 'upload.success', { jobId: job.id, path, size });
            // Persist artifact metadata & fetch stats into payload for UI/debug
            await supabase.from('jobs').update({
                artifact_path: path,
                artifact_type: 'pdf',
                payload: { ...job.payload, fetch_stats: fetchStats, artifact: { size, path } }
            }).eq('id', job.id);
            slog('info', 'artifact.metadata.saved', { jobId: job.id, size });
            await updateOverallProgress(supabase, job, phases[2].name, 100);
        });
    },

    'mission_orders.email_bulk_v2': async (slog, supabase, job) => {
        const phases = PHASE_WEIGHTS[job.type];
        const recipients = job.payload?.recipients || [];
        if (!Array.isArray(recipients) || recipients.length === 0) {
            throw Object.assign(new Error('Payload contains no recipients'), { code: 'no_recipients' });
        }
        slog('info', 'handler.start', { jobId: job.id, jobType: job.type, recipientCount: recipients.length });

        // Phase 1: prepare (create job_items)
        await withJobPhase(slog, supabase, job, phases[0].name, async () => {
            const { count } = await supabase.from('job_items').select('id', { count: 'exact', head: true }).eq('job_id', job.id);
            if (count === 0) {
                slog('info', 'prepare.items.creating', { jobId: job.id, count: recipients.length });
                const rows = recipients.map((r: any, idx: number) => ({ job_id: job.id, seq: idx, target: r }));
                const chunkSize = 500;
                for (let i = 0; i < rows.length; i += chunkSize) {
                    const { error } = await supabase.from('job_items').insert(rows.slice(i, i + chunkSize));
                    if (error) throw error;
                }
            } else {
                slog('info', 'prepare.items.existing', { jobId: job.id, count });
            }
            await updateOverallProgress(supabase, job, phases[0].name, 100);
        });

        // Phase 2: render (validate items)
        await withJobPhase(slog, supabase, job, phases[1].name, async () => {
            const { data: items, error: itemsErr } = await supabase.from('job_items').select('id, target, status').eq('job_id', job.id);
            if (itemsErr) throw itemsErr;
            let processed = 0;
            for (const item of items) {
                if (item.status !== 'pending') { // Only process pending, not failed/skipped on retry
                    processed++; continue;
                }
                if (!item.target?.email || !/^[^@]+@[^@]+\.[^@]+$/.test(item.target.email)) {
                    await supabase.from('job_items').update({ status: 'skipped', error_code: 'invalid_email' }).eq('id', item.id);
                }
                processed++;
                const pct = Math.round((processed / items.length) * 100);
                await supabase.from('jobs').update({ phase_progress: pct }).eq('id', job.id);
                await updateOverallProgress(supabase, job, phases[1].name, pct);
            }
        });

        // Phase 3: send
        await withJobPhase(slog, supabase, job, phases[2].name, async () => {
            const { data: items, error: itemsErr } = await supabase.from('job_items').select('id, target, status').eq('job_id', job.id).eq('status', 'pending');
            if (itemsErr) throw itemsErr;
            if (!items.length) {
                slog('info', 'send.no_pending_items', { jobId: job.id });
                return;
            }
            const sendgridKey = Deno.env.get('SENDGRID_API_KEY');
            slog('info', 'send.start', { jobId: job.id, itemCount: items.length, useSendGrid: !!sendgridKey });
            let processed = 0;
            for (const item of items) {
                try {
                    if (sendgridKey) {
                        // Real implementation would be here
                    } else {
                        await new Promise(r => setTimeout(r, 2)); // Simulate work
                    }
                    await supabase.from('job_items').update({ status: 'completed', started_at: new Date().toISOString(), finished_at: new Date().toISOString() }).eq('id', item.id);
                } catch (e: any) {
                    const code = e?.code || 'send_failed';
                    await supabase.from('job_items').update({ status: 'failed', error_code: code, error_message: e?.detail || e?.message, finished_at: new Date().toISOString() }).eq('id', item.id);
                }
                processed++;
                const pct = Math.round((processed / items.length) * 100);
                await supabase.from('jobs').update({ phase_progress: pct }).eq('id', job.id);
                await updateOverallProgress(supabase, job, phases[2].name, pct);
            }
        });
    }
};

// --- Main Server & Claiming Logic ---

async function claimJobs(slog: Slog, supabase: SupabaseClient): Promise<JobRow[]> {
    slog('info', 'claim.attempt.start');
    // 1. Try to get pending jobs
    slog('debug', 'claim.attempt.pending');
    const { data: pendingJobs, error: pendingErr } = await supabase.from('jobs')
        .select('*').eq('status', 'pending').order('created_at').limit(MAX_JOBS_PER_INVOCATION);
    if (pendingErr) {
        slog('error', 'claim.pending.failed', { error: pendingErr.message });
        throw pendingErr;
    }
    if (pendingJobs.length > 0) {
        const ids = pendingJobs.map(j => j.id);
        slog('info', 'claim.pending.found', { count: pendingJobs.length, ids });
        await supabase.from('jobs').update({ status: 'running', updated_at: new Date().toISOString() }).in('id', ids);
        return pendingJobs;
    }

    // 2. If no pending, try to get stale running jobs
    slog('debug', 'claim.attempt.stale');
    const staleThreshold = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();
    const { data: staleJobs, error: staleErr } = await supabase.from('jobs')
        .select('*').eq('status', 'running').lt('updated_at', staleThreshold).order('updated_at').limit(MAX_JOBS_PER_INVOCATION);
    if (staleErr) {
        slog('error', 'claim.stale.failed', { error: staleErr.message });
        throw staleErr;
    }
    if (staleJobs.length > 0) {
        const ids = staleJobs.map(j => j.id);
        slog('warn', 'claim.stale.found', { count: staleJobs.length, ids, staleMinutes: STALE_MINUTES });
        await supabase.from('jobs').update({ status: 'running', updated_at: new Date().toISOString(), attempts: (staleJobs[0].attempts || 1) + 1 }).in('id', ids);
        return staleJobs;
    }

    slog('info', 'claim.finished.no_jobs');
    return [];
}

async function finalizeJob(slog: Slog, supabase: SupabaseClient, jobId: string, patch: any) {
    // ADDED: Log the final state being persisted.
    slog('info', 'job.finalize', { jobId, status: patch.status, errorCode: patch.error_code });
    await supabase.from('jobs').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', jobId);
}

serve(async (req: Request) => {
    const cid = req.headers.get('x-correlation-id') || crypto.randomUUID();
    const slog: Slog = (level, event, meta = {}) => {
        try { console.log(JSON.stringify({ ts: new Date().toISOString(), cid, fn: 'process-jobs', level, event, ...meta })); } catch { }
    };
    slog('info', 'request.start', { method: req.method });

    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });
    if (req.method !== 'POST') {
        slog('warn', 'method.not_allowed', { method: req.method });
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders() });
    }

    const supabase = getClient();
    try {
        const jobs = await claimJobs(slog, supabase);
        if (!jobs.length) {
            return new Response(JSON.stringify({ processed: 0 }), { status: 200, headers: corsHeaders() });
        }

        for (const job of jobs) {
            const jobSlogMeta = { jobId: job.id, jobType: job.type, attempt: job.attempts || 1 };
            try {
                const handler = handlers[job.type];
                if (!handler) {
                    throw Object.assign(new Error(`No handler registered for job type: ${job.type}`), { code: 'unknown_type' });
                }
                slog('info', 'job.start', jobSlogMeta);
                await handler(slog, supabase, job);
                await finalizeJob(slog, supabase, job.id, { status: 'completed', progress: 100, phase: null, phase_progress: 100 });
                slog('info', 'job.completed', jobSlogMeta);
            } catch (e: any) {
                const code = e?.code || 'handler_exception';
                const message = e?.message || 'An unknown error occurred.';
                // MODIFIED: Enhanced error logging with full details.
                slog('error', 'job.failed', { ...jobSlogMeta, code, error: { message, stack: e?.stack } });
                await finalizeJob(slog, supabase, job.id, { status: 'failed', error_code: code, error_message: message });
            }
        }
        slog('info', 'batch.complete', { processed: jobs.length });
        return new Response(JSON.stringify({ processed: jobs.length }), { status: 200, headers: corsHeaders() });
    } catch (e: any) {
        slog('error', 'batch.exception', { error: { message: e?.message, stack: e?.stack } });
        return new Response(JSON.stringify({ error: e.message || 'internal_error' }), { status: 500, headers: corsHeaders() });
    }
});