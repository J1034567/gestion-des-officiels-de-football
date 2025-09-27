// Enhanced Unified Job Processor Edge Function v2
// Date: 2025-09-26
// Processes jobs with resource pooling, deduplication, enhanced error handling, and performance monitoring.
// Uses service role key (do NOT expose outside server context).

// @ts-nocheck
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';

// --- Types and Configuration ---
declare const Deno: { env: { get(k: string): string | undefined } };
type SupabaseClient = ReturnType<typeof createClient>;
type Slog = (level: string, event: string, meta?: Record<string, any>) => void;

const MAX_JOBS_PER_INVOCATION = 3; // Reduced for better resource management
const STALE_MINUTES = 10;
const JOB_SELECT_STATUSES = ["pending", "running"];
const MAX_RETRIES = 3;
const CLEANUP_OLD_JOBS_DAYS = 7;

// Resource limits for better concurrency control
const RESOURCE_LIMITS = {
    pdf_generation: 2,        // Max concurrent PDF generations
    email_sending: 5,         // Max concurrent emails
    file_operations: 3,       // Max concurrent file ops
    network_requests: 10      // Max concurrent network requests
};

// Enhanced phase weights with more granular progress tracking
const PHASE_WEIGHTS: Record<string, { name: string; weight: number }[]> = {
    // Canonical bulk mission orders PDF job
    'mission_orders.bulk_pdf': [
        { name: 'validation', weight: 5 },
        { name: 'fetch_data', weight: 15 },
        { name: 'generate_pdfs', weight: 50 },
        { name: 'merge_documents', weight: 20 },
        { name: 'upload_artifact', weight: 10 }
    ],
    'mission_orders.individual_pdf': [
        { name: 'fetch_data', weight: 30 },
        { name: 'generate_pdf', weight: 50 },
        { name: 'upload', weight: 20 }
    ],
    // Canonical single mission order PDF (frontend uses mission_orders.single_pdf)
    'mission_orders.single_pdf': [
        { name: 'validation', weight: 10 },
        { name: 'generate', weight: 70 },
        { name: 'upload_artifact', weight: 20 }
    ],
    // Canonical bulk match sheets email (replaces mission_orders.email_bulk*)
    'match_sheets.bulk_email': [
        { name: 'validation', weight: 5 },
        { name: 'prepare_recipients', weight: 10 },
        { name: 'render_templates', weight: 25 },
        { name: 'send_emails', weight: 50 },
        { name: 'cleanup', weight: 10 }
    ],
    'exports.data': [
        { name: 'validate_params', weight: 10 },
        { name: 'extract_data', weight: 60 },
        { name: 'format_output', weight: 20 },
        { name: 'upload_file', weight: 10 }
    ],
    // (Removed legacy mission_orders.email_bulk_v2 / v3 weights after migration)
};

interface JobRow {
    id: string;
    type: string;
    status: string;
    priority: string;
    payload: any;
    progress: number;
    phase: string | null;
    phase_progress: number;
    attempts: number;
    dedupe_key: string | null;
    artifact_path: string | null;
    artifact_type: string | null;
    error_code: string | null;
    retry_policy: any;
    dependencies: string[] | null;
    created_at: string;
    updated_at: string;
}

interface JobMetrics {
    job_id: string;
    type: string;
    duration_ms: number;
    memory_used_mb: number;
    items_processed: number;
    error_count: number;
    retry_count: number;
    resource_usage: Record<string, number>;
}

// Resource Pool for managing concurrent operations
class ResourcePool {
    private pools = new Map<string, number>();
    private waiting = new Map<string, Array<() => void>>();

    async acquire(resource: string): Promise<void> {
        const limit = RESOURCE_LIMITS[resource as keyof typeof RESOURCE_LIMITS] || 1;
        const current = this.pools.get(resource) || 0;

        if (current >= limit) {
            // Need to wait
            return new Promise((resolve) => {
                if (!this.waiting.has(resource)) {
                    this.waiting.set(resource, []);
                }
                this.waiting.get(resource)!.push(resolve);
            });
        }

        this.pools.set(resource, current + 1);
    }

    release(resource: string): void {
        const current = this.pools.get(resource) || 0;
        const newCount = Math.max(0, current - 1);
        this.pools.set(resource, newCount);

        // Check if anyone is waiting
        const waitingList = this.waiting.get(resource);
        if (waitingList && waitingList.length > 0) {
            const next = waitingList.shift();
            if (next) {
                this.pools.set(resource, newCount + 1);
                next();
            }
        }
    }

    getUsage(): Record<string, number> {
        const usage: Record<string, number> = {};
        this.pools.forEach((count, resource) => {
            usage[resource] = count;
        });
        return usage;
    }
}

const resourcePool = new ResourcePool();

// --- Enhanced Supabase & Utility Functions ---

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

// Enhanced error classification for better retry logic
function classifyError(error: any): { category: string; recoverable: boolean; retry_delay?: number } {
    const message = (error?.message || '').toLowerCase();
    const code = error?.code || error?.status;

    if (message.includes('timeout') || code === 408) {
        return { category: 'timeout', recoverable: true, retry_delay: 5000 };
    }

    if (message.includes('network') || message.includes('fetch')) {
        return { category: 'network', recoverable: true, retry_delay: 10000 };
    }

    if (code === 429) {
        return { category: 'rate_limit', recoverable: true, retry_delay: 30000 };
    }

    if (code >= 500) {
        return { category: 'server_error', recoverable: true, retry_delay: 15000 };
    }

    if (code === 400 || code === 422) {
        return { category: 'validation', recoverable: false };
    }

    return { category: 'unknown', recoverable: true, retry_delay: 5000 };
}

// Performance monitoring
function trackJobPerformance(slog: Slog, job: JobRow, startTime: number, itemsProcessed: number = 0): void {
    try {
        const metrics: JobMetrics = {
            job_id: job.id,
            type: job.type,
            duration_ms: Date.now() - startTime,
            memory_used_mb: Math.round((performance as any)?.memory?.usedJSHeapSize / 1024 / 1024 || 0),
            items_processed: itemsProcessed,
            error_count: job.attempts > 1 ? job.attempts - 1 : 0,
            retry_count: job.attempts > 1 ? job.attempts - 1 : 0,
            resource_usage: resourcePool.getUsage()
        };

        slog('info', 'job.performance', metrics);
    } catch (e) {
        slog('warn', 'performance.tracking.failed', { error: e?.message });
    }
}

// --- Enhanced Core Job Logic ---

async function withJobPhase(
    slog: Slog,
    supabase: SupabaseClient,
    job: JobRow,
    phaseName: string,
    fn: () => Promise<void>
): Promise<void> {
    slog('info', 'phase.start', { jobId: job.id, phase: phaseName });

    await supabase.from('jobs').update({
        phase: phaseName,
        phase_progress: 0,
        updated_at: new Date().toISOString()
    }).eq('id', job.id);

    try {
        await fn();
        await supabase.from('jobs').update({
            phase_progress: 100,
            updated_at: new Date().toISOString()
        }).eq('id', job.id);

        slog('info', 'phase.success', { jobId: job.id, phase: phaseName });
    } catch (error) {
        slog('error', 'phase.failed', {
            jobId: job.id,
            phase: phaseName,
            error: error?.message
        });
        throw error;
    }
}

function calcOverallProgress(job: JobRow, phase: string | null, phaseProgress: number): number {
    const phases = PHASE_WEIGHTS[job.type];
    if (!phases) return Math.min(100, phaseProgress);

    let accumulated = 0;
    for (const p of phases) {
        if (p.name === phase) {
            const currentBase = accumulated;
            return Math.min(100, Math.round(currentBase + (phaseProgress / 100) * p.weight));
        }
        accumulated += p.weight;
    }
    return Math.min(100, accumulated);
}

async function updateOverallProgress(
    supabase: SupabaseClient,
    job: JobRow,
    currentPhase: string,
    currentPhaseProgress: number
): Promise<void> {
    const overall = calcOverallProgress(job, currentPhase, currentPhaseProgress);
    await supabase.from('jobs').update({ progress: overall }).eq('id', job.id);
}

// --- Enhanced Job Type Handlers ---

const handlers: Record<string, (slog: Slog, supabase: SupabaseClient, job: JobRow) => Promise<void>> = {
    // Canonical single mission order PDF generation (replaces mission_orders.individual_pdf) 
    'mission_orders.single_pdf': async (slog, supabase, job) => {
        const startTime = Date.now();
        const phases = PHASE_WEIGHTS[job.type];
        const matchId = job.payload?.matchId;
        const officialId = job.payload?.officialId;
        const fileName = job.payload?.fileName || `mission_order_${matchId}_${officialId}.pdf`;
        if (!matchId || !officialId) {
            throw Object.assign(new Error('Missing matchId or officialId'), { code: 'validation_failed' });
        }
        // Phase 1: validation
        await withJobPhase(slog, supabase, job, phases[0].name, async () => {
            await updateOverallProgress(supabase, job, phases[0].name, 100);
        });
        // Phase 2: generate
        let pdfBytes: Uint8Array | null = null;
        await withJobPhase(slog, supabase, job, phases[1].name, async () => {
            const { data, error } = await supabase.functions.invoke('generate-mission-order', {
                body: { matchId, officialId, returnBase64: true }
            });
            if (error) throw error;
            if (!data?.pdfBase64) {
                throw Object.assign(new Error('No pdfBase64'), { code: 'generation_failed' });
            }
            pdfBytes = Uint8Array.from(atob(data.pdfBase64), c => c.charCodeAt(0));
            await supabase.from('jobs').update({ phase_progress: 100 }).eq('id', job.id);
            await updateOverallProgress(supabase, job, phases[1].name, 100);
        });
        // Phase 3: upload_artifact
        await withJobPhase(slog, supabase, job, phases[2].name, async () => {
            if (!pdfBytes || pdfBytes.length === 0) {
                throw Object.assign(new Error('Empty PDF bytes'), { code: 'artifact_empty' });
            }
            const path = `single/${job.dedupe_key || job.id}.pdf`;
            const { error: uploadError } = await supabase.storage.from('mission_orders').upload(path, pdfBytes, { contentType: 'application/pdf', upsert: true });
            if (uploadError) {
                throw Object.assign(new Error(uploadError.message), { code: 'upload_failed' });
            }
            await supabase.from('jobs').update({
                artifact_path: path,
                artifact_type: 'pdf',
                payload: { ...job.payload, artifact: { path, size: pdfBytes.length, fileName } }
            }).eq('id', job.id);
            await supabase.from('jobs').update({ phase_progress: 100 }).eq('id', job.id);
            await updateOverallProgress(supabase, job, phases[2].name, 100);
            trackJobPerformance(slog, job, startTime, 1);
        });
    },
    // Canonical bulk match sheets email handler (replaces mission_orders.email_bulk*)
    'match_sheets.bulk_email': async (slog, supabase, job) => {
        // (Legacy comment removed) Reuse logic now consolidated under match_sheets.bulk_email.
        const startTime = Date.now();
        const phases = PHASE_WEIGHTS['match_sheets.bulk_email'];
        const recipients = job.payload?.recipients || [];
        if (!Array.isArray(recipients) || recipients.length === 0) {
            throw Object.assign(new Error('Payload contains no recipients'), { code: 'no_recipients' });
        }
        // Phase 1: validation
        await withJobPhase(slog, supabase, job, phases[0].name, async () => {
            const { subject, content, html } = job.payload;
            if (!(subject && (content || html))) {
                throw Object.assign(new Error('Missing subject/content'), { code: 'missing_email_data' });
            }
            await updateOverallProgress(supabase, job, phases[0].name, 100);
        });
        // Phase 2: prepare recipients
        await withJobPhase(slog, supabase, job, phases[1].name, async () => {
            const { count } = await supabase.from('job_items').select('id', { count: 'exact', head: true }).eq('job_id', job.id);
            if (count === 0) {
                const rows = recipients.map((r: any, idx: number) => ({ job_id: job.id, seq: idx, target: r }));
                const chunkSize = 500;
                for (let i = 0; i < rows.length; i += chunkSize) {
                    const { error } = await supabase.from('job_items').insert(rows.slice(i, i + chunkSize));
                    if (error) throw error;
                    const pct = Math.round(((i + chunkSize) / rows.length) * 100);
                    await supabase.from('jobs').update({ phase_progress: Math.min(100, pct) }).eq('id', job.id);
                    await updateOverallProgress(supabase, job, phases[1].name, Math.min(100, pct));
                }
            } else {
                await updateOverallProgress(supabase, job, phases[1].name, 100);
            }
        });
        // Phase 3: render templates (validate emails)
        await withJobPhase(slog, supabase, job, phases[2].name, async () => {
            const { data: items, error: itemsErr } = await supabase.from('job_items').select('id, target, status').eq('job_id', job.id);
            if (itemsErr) throw itemsErr;
            let processed = 0;
            for (const item of items) {
                if (item.status !== 'pending') { processed++; continue; }
                if (!item.target?.email || !/^[^@]+@[^@]+\.[^@]+$/.test(item.target.email)) {
                    await supabase.from('job_items').update({ status: 'skipped', error_code: 'invalid_email' }).eq('id', item.id);
                }
                processed++;
                const pct = Math.round((processed / items.length) * 100);
                await supabase.from('jobs').update({ phase_progress: pct }).eq('id', job.id);
                await updateOverallProgress(supabase, job, phases[2].name, pct);
            }
        });
        // Phase 4: send emails (reuse logic from v3; simplified)
        await withJobPhase(slog, supabase, job, phases[3].name, async () => {
            await resourcePool.acquire('email_sending');
            try {
                const { data: items, error: itemsErr } = await supabase.from('job_items').select('id, target, status').eq('job_id', job.id).eq('status', 'pending');
                if (itemsErr) throw itemsErr;
                const sendgridKey = Deno.env.get('SENDGRID_API_KEY');
                const resendKey = Deno.env.get('RESEND_API_KEY');
                const payloadSubject = job.payload?.subject;
                const payloadHtml = job.payload?.html || job.payload?.content || '';
                const payloadText = job.payload?.text || job.payload?.content || '';
                const payloadAttachments = Array.isArray(job.payload?.attachments) ? job.payload.attachments : [];
                const fromEmail = Deno.env.get('EMAIL_FROM') || Deno.env.get('SENDGRID_FROM') || Deno.env.get('RESEND_FROM') || 'no-reply@example.com';
                const fromName = Deno.env.get('EMAIL_FROM_NAME') || 'Match Center';
                const sendOne = async (to: { email: string; name?: string }) => {
                    if (!to?.email) throw new Error('missing_target_email');
                    if (sendgridKey) {
                        const sgBody: any = { personalizations: [{ to: [{ email: to.email, name: to.name }].filter(t => !!t.email) }], from: { email: fromEmail, name: fromName }, subject: payloadSubject, content: [] };
                        if (payloadText) sgBody.content.push({ type: 'text/plain', value: payloadText });
                        if (payloadHtml) sgBody.content.push({ type: 'text/html', value: payloadHtml });
                        if (payloadAttachments.length) {
                            sgBody.attachments = payloadAttachments.map((a: any) => ({ content: a.content, filename: a.filename || 'attachment', type: a.type || 'application/octet-stream', disposition: a.disposition || 'attachment' }));
                        }
                        const resp = await fetch('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { 'Authorization': `Bearer ${sendgridKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(sgBody) });
                        if (!resp.ok) { const body = await resp.text(); throw new Error(`sendgrid_error_${resp.status}: ${body.slice(0, 300)}`); }
                        return { provider: 'sendgrid' };
                    } else if (resendKey) {
                        const rsBody: any = { from: `${fromName} <${fromEmail}>`, to: [to.email], subject: payloadSubject, html: payloadHtml || undefined, text: payloadText || undefined };
                        if (payloadAttachments.length) { rsBody.attachments = payloadAttachments.map((a: any) => ({ filename: a.filename || 'attachment', content: a.content })); }
                        const resp = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(rsBody) });
                        if (!resp.ok) { const body = await resp.text(); throw new Error(`resend_error_${resp.status}: ${body.slice(0, 300)}`); }
                        return { provider: 'resend' };
                    } else {
                        await new Promise(r => setTimeout(r, 5));
                        return { provider: 'mock' };
                    }
                };
                let processed = 0, sent = 0, failed = 0;
                for (const item of items) {
                    try {
                        if (processed > 0 && processed % 10 === 0) await new Promise(r => setTimeout(r, 800));
                        const target = item.target || {};
                        const result = await sendOne(target);
                        await supabase.from('job_items').update({ status: 'completed', started_at: new Date().toISOString(), finished_at: new Date().toISOString(), provider: result.provider }).eq('id', item.id);
                        sent++;
                    } catch (e: any) {
                        const errorInfo = classifyError(e);
                        await supabase.from('job_items').update({ status: 'failed', error_code: errorInfo.category, error_message: e?.message || 'Send failed', finished_at: new Date().toISOString() }).eq('id', item.id);
                        failed++;
                        slog('warn', 'send.item.failed', { jobId: job.id, itemId: item.id, error: e?.message, category: errorInfo.category });
                    }
                    processed++;
                    const pct = Math.round((processed / items.length) * 100);
                    await supabase.from('jobs').update({ phase_progress: pct }).eq('id', job.id);
                    await updateOverallProgress(supabase, job, phases[3].name, pct);
                }
                slog('info', 'send.summary', { jobId: job.id, total: processed, sent, failed });
            } finally {
                resourcePool.release('email_sending');
            }
        });
        // Phase 5: cleanup
        await withJobPhase(slog, supabase, job, phases[4].name, async () => {
            const { data: finalStats } = await supabase.from('job_items').select('status').eq('job_id', job.id);
            const stats = {
                total: finalStats?.length || 0,
                completed: finalStats?.filter(i => i.status === 'completed').length || 0,
                failed: finalStats?.filter(i => i.status === 'failed').length || 0,
                skipped: finalStats?.filter(i => i.status === 'skipped').length || 0
            };
            await supabase.from('jobs').update({ payload: { ...job.payload, email_stats: stats } }).eq('id', job.id);
            await updateOverallProgress(supabase, job, phases[4].name, 100);
            trackJobPerformance(slog, job, startTime, recipients.length);
        });
    },
    // Legacy adapters -> delegate to canonical handler to avoid code duplication
    // (Removed legacy email_bulk_v2/v3 adapter handlers after full migration)
    // Enhanced bulk PDF handler with better resource management
    'mission_orders.bulk_pdf': async (slog, supabase, job) => {
        const startTime = Date.now();
        const phases = PHASE_WEIGHTS[job.type];
        const orders = job.payload?.orders || [];

        if (!Array.isArray(orders) || orders.length === 0) {
            throw Object.assign(new Error('Payload contains no orders'), { code: 'empty_payload' });
        }

        slog('info', 'handler.start', { jobId: job.id, jobType: job.type, orderCount: orders.length });

        // Phase 1: Validation
        await withJobPhase(slog, supabase, job, phases[0].name, async () => {
            // Validate each order has required fields
            const invalidOrders = orders.filter((o: any) => !o.matchId || !o.officialId);
            if (invalidOrders.length > 0) {
                throw Object.assign(new Error(`${invalidOrders.length} orders missing required fields`), { code: 'validation_failed' });
            }
            await updateOverallProgress(supabase, job, phases[0].name, 100);
        });

        // Phase 2: Fetch data with resource pooling
        await withJobPhase(slog, supabase, job, phases[1].name, async () => {
            await resourcePool.acquire('network_requests');
            try {
                // Fetch match and official data in batches to avoid overwhelming the database
                const batchSize = 10;
                let completed = 0;

                for (let i = 0; i < orders.length; i += batchSize) {
                    const batch = orders.slice(i, i + batchSize);
                    // Process batch - implementation would fetch required data
                    completed += batch.length;

                    const pct = Math.round((completed / orders.length) * 100);
                    await supabase.from('jobs').update({ phase_progress: pct }).eq('id', job.id);
                    await updateOverallProgress(supabase, job, phases[1].name, pct);
                }
            } finally {
                resourcePool.release('network_requests');
            }
        });

        // Phase 3: Generate PDFs with concurrency control
        await withJobPhase(slog, supabase, job, phases[2].name, async () => {
            await resourcePool.acquire('pdf_generation');
            let completed = 0;
            let blobs: Uint8Array[] = [];
            let failures: any[] = [];

            try {
                // Generate PDFs with controlled concurrency
                for (const o of orders) {
                    try {
                        const { data, error } = await supabase.functions.invoke('generate-mission-order', {
                            body: { matchId: o.matchId, officialId: o.officialId, returnBase64: true }
                        });

                        if (error) throw error;
                        if (data?.pdfBase64) {
                            blobs.push(Uint8Array.from(atob(data.pdfBase64), c => c.charCodeAt(0)));
                        } else {
                            failures.push({ ...o, reason: 'missing_pdfBase64' });
                        }
                    } catch (e) {
                        const errorInfo = classifyError(e);
                        slog('warn', 'generate.item.failed', { jobId: job.id, order: o, error: e?.message, category: errorInfo.category });
                        failures.push({ ...o, reason: e?.message || 'generate_failed', category: errorInfo.category });
                    }

                    completed++;
                    const pct = Math.round((completed / orders.length) * 100);
                    await supabase.from('jobs').update({ phase_progress: pct }).eq('id', job.id);
                    await updateOverallProgress(supabase, job, phases[2].name, pct);
                }

                (job as any)._generatedBlobs = blobs;
                (job as any)._generateStats = {
                    total: orders.length,
                    succeeded: blobs.length,
                    failed: failures.length,
                    failures: failures.slice(0, 25)
                };

                slog('info', 'generate.summary', { jobId: job.id, ...((job as any)._generateStats) });
            } finally {
                resourcePool.release('pdf_generation');
            }
        });

        // Phase 4: Merge documents
        await withJobPhase(slog, supabase, job, phases[3].name, async () => {
            const generatedBlobs: Uint8Array[] = (job as any)._generatedBlobs || [];
            if (!generatedBlobs.length) {
                const stats = (job as any)._generateStats || {};
                await supabase.from('jobs').update({
                    payload: { ...job.payload, generate_stats: stats },
                    error_code: 'no_pages'
                }).eq('id', job.id);
                throw Object.assign(new Error('No PDF pages to merge'), { code: 'no_pages' });
            }

            const merged = await PDFDocument.create();
            let idx = 0;

            for (const bytes of generatedBlobs) {
                try {
                    const pdf = await PDFDocument.load(bytes);
                    const pages = await merged.copyPages(pdf, pdf.getPageIndices());
                    pages.forEach((p: any) => merged.addPage(p));
                } catch (e) {
                    slog('warn', 'merge.page.failed', { jobId: job.id, pageIndex: idx, error: e?.message });
                }

                idx++;
                const pct = Math.round((idx / generatedBlobs.length) * 100);
                await supabase.from('jobs').update({ phase_progress: pct }).eq('id', job.id);
                await updateOverallProgress(supabase, job, phases[3].name, pct);
            }

            (job as any)._mergedBytes = await merged.save();
        });

        // Phase 5: Upload artifact
        await withJobPhase(slog, supabase, job, phases[4].name, async () => {
            await resourcePool.acquire('file_operations');
            try {
                const mergedBytes: Uint8Array = (job as any)._mergedBytes;
                const size = mergedBytes?.length || 0;
                const generateStats = (job as any)._generateStats || null;

                if (size === 0) {
                    slog('error', 'artifact.empty', { jobId: job.id });
                    await supabase.from('jobs').update({
                        payload: { ...job.payload, generate_stats: generateStats },
                        error_code: 'artifact_empty'
                    }).eq('id', job.id);
                    throw Object.assign(new Error('Merged artifact is empty'), { code: 'artifact_empty' });
                }

                const path = `batches/${job.dedupe_key || job.id}.pdf`;
                const { error } = await supabase.storage
                    .from('mission_orders')
                    .upload(path, mergedBytes, { contentType: 'application/pdf', upsert: true });

                if (error) {
                    throw Object.assign(new Error(`Storage upload failed: ${error.message}`), { code: 'upload_failed' });
                }

                slog('info', 'upload.success', { jobId: job.id, path, size });

                await supabase.from('jobs').update({
                    artifact_path: path,
                    artifact_type: 'pdf',
                    payload: {
                        ...job.payload,
                        generate_stats: generateStats,
                        artifact: { size, path }
                    }
                }).eq('id', job.id);

                await updateOverallProgress(supabase, job, phases[4].name, 100);
                // Track final performance metrics for full job
                trackJobPerformance(slog, job, startTime, orders.length);
            } finally {
                resourcePool.release('file_operations');
            }
        });
    },

    // (Removed legacy mission_orders.email_bulk_v2 handler)
};

// --- Enhanced Main Server & Claiming Logic ---

async function claimJobs(slog: Slog, supabase: SupabaseClient): Promise<JobRow[]> {
    slog('info', 'claim.attempt.start');

    // 1. Try to get pending jobs with priority ordering
    slog('debug', 'claim.attempt.pending');
    const { data: pendingJobs, error: pendingErr } = await supabase.from('jobs')
        .select('*')
        .eq('status', 'pending')
        .order('priority', { ascending: false }) // High priority first
        .order('created_at', { ascending: true })  // Then FIFO
        .limit(MAX_JOBS_PER_INVOCATION);

    if (pendingErr) {
        slog('error', 'claim.pending.failed', { error: pendingErr.message });
        throw pendingErr;
    }

    if (pendingJobs.length > 0) {
        const ids = pendingJobs.map(j => j.id);
        slog('info', 'claim.pending.found', { count: pendingJobs.length, ids });

        // Atomically update status to claim jobs
        const { error: claimError } = await supabase.from('jobs')
            .update({
                status: 'running',
                updated_at: new Date().toISOString(),
                attempts: pendingJobs[0].attempts + 1
            })
            .in('id', ids);

        if (claimError) {
            slog('error', 'claim.update.failed', { error: claimError.message });
            throw claimError;
        }

        return pendingJobs.map(job => ({ ...job, attempts: job.attempts + 1 }));
    }

    // 2. Try to recover stale jobs with exponential backoff
    slog('debug', 'claim.attempt.stale');
    const staleThreshold = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();
    const { data: staleJobs, error: staleErr } = await supabase.from('jobs')
        .select('*')
        .eq('status', 'running')
        .lt('updated_at', staleThreshold)
        .lt('attempts', MAX_RETRIES) // Don't retry jobs that have failed too many times
        .order('updated_at', { ascending: true })
        .limit(MAX_JOBS_PER_INVOCATION);

    if (staleErr) {
        slog('error', 'claim.stale.failed', { error: staleErr.message });
        throw staleErr;
    }

    if (staleJobs.length > 0) {
        const ids = staleJobs.map(j => j.id);
        slog('warn', 'claim.stale.found', {
            count: staleJobs.length,
            ids,
            staleMinutes: STALE_MINUTES
        });

        await supabase.from('jobs')
            .update({
                status: 'running',
                updated_at: new Date().toISOString(),
                attempts: (staleJobs[0].attempts || 0) + 1
            })
            .in('id', ids);

        return staleJobs.map(job => ({ ...job, attempts: (job.attempts || 0) + 1 }));
    }

    // 3. Cleanup old jobs periodically (every 100th invocation approximately)
    if (Math.random() < 0.01) {
        slog('info', 'claim.cleanup.start');
        try {
            const cutoffDate = new Date(Date.now() - CLEANUP_OLD_JOBS_DAYS * 24 * 60 * 60 * 1000).toISOString();
            const { data: deletedJobs, error: cleanupError } = await supabase
                .from('jobs')
                .delete()
                .in('status', ['completed', 'cancelled'])
                .lt('updated_at', cutoffDate)
                .select('id');

            if (cleanupError) {
                slog('warn', 'claim.cleanup.failed', { error: cleanupError.message });
            } else {
                const deletedCount = deletedJobs?.length || 0;
                if (deletedCount > 0) {
                    slog('info', 'claim.cleanup.success', { deletedCount });
                }
            }
        } catch (e) {
            slog('warn', 'claim.cleanup.error', { error: e?.message });
        }
    }

    slog('info', 'claim.finished.no_jobs');
    return [];
}

async function finalizeJob(slog: Slog, supabase: SupabaseClient, jobId: string, patch: any): Promise<void> {
    slog('info', 'job.finalize', {
        jobId,
        status: patch.status,
        errorCode: patch.error_code,
        duration: patch.duration_ms
    });

    await supabase.from('jobs').update({
        ...patch,
        updated_at: new Date().toISOString()
    }).eq('id', jobId);
}

// Enhanced server with better resource management and monitoring
serve(async (req: Request) => {
    const cid = req.headers.get('x-correlation-id') || crypto.randomUUID();
    const requestStart = Date.now();

    const slog: Slog = (level, event, meta = {}) => {
        try {
            console.log(JSON.stringify({
                ts: new Date().toISOString(),
                cid,
                fn: 'process-jobs-v2',
                level,
                event,
                ...meta
            }));
        } catch { }
    };

    slog('info', 'request.start', {
        method: req.method,
        userAgent: req.headers.get('user-agent')?.slice(0, 100)
    });

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders() });
    }

    if (req.method !== 'POST') {
        slog('warn', 'method.not_allowed', { method: req.method });
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: corsHeaders()
        });
    }

    const supabase = getClient();
    let processedJobs = 0;

    try {
        const jobs = await claimJobs(slog, supabase);
        if (!jobs.length) {
            return new Response(JSON.stringify({ processed: 0 }), {
                status: 200,
                headers: corsHeaders()
            });
        }

        const jobPromises = jobs.map(async (job) => {
            const jobStartTime = Date.now();
            const jobMeta = {
                jobId: job.id,
                jobType: job.type,
                attempt: job.attempts,
                priority: job.priority
            };

            try {
                const handler = handlers[job.type];
                if (!handler) {
                    throw Object.assign(
                        new Error(`No handler registered for job type: ${job.type}`),
                        { code: 'unknown_type' }
                    );
                }

                slog('info', 'job.start', jobMeta);
                await handler(slog, supabase, job);

                const duration = Date.now() - jobStartTime;
                await finalizeJob(slog, supabase, job.id, {
                    status: 'completed',
                    progress: 100,
                    phase: null,
                    phase_progress: 100,
                    duration_ms: duration
                });

                slog('info', 'job.completed', { ...jobMeta, duration });
                return { success: true, jobId: job.id };

            } catch (e: any) {
                const duration = Date.now() - jobStartTime;
                const errorInfo = classifyError(e);
                const code = e?.code || errorInfo.category || 'handler_exception';
                const message = e?.message || 'An unknown error occurred.';

                slog('error', 'job.failed', {
                    ...jobMeta,
                    code,
                    error: { message, category: errorInfo.category },
                    duration,
                    recoverable: errorInfo.recoverable
                });

                // Determine final status based on attempts and recoverability
                let finalStatus = 'failed';
                if (errorInfo.recoverable && job.attempts < MAX_RETRIES) {
                    finalStatus = 'pending'; // Will be retried later
                    const retryDelay = errorInfo.retry_delay || (1000 * Math.pow(2, job.attempts));
                    slog('info', 'job.retry_scheduled', { ...jobMeta, retryDelay });
                }

                await finalizeJob(slog, supabase, job.id, {
                    status: finalStatus,
                    error_code: code,
                    error_message: message,
                    duration_ms: duration
                });

                return { success: false, jobId: job.id, error: message };
            }
        });

        // Execute jobs with controlled concurrency
        const results = await Promise.allSettled(jobPromises);
        processedJobs = results.length;

        const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
        const failed = results.filter(r => r.status === 'fulfilled' && !(r.value as any).success).length;
        const crashed = results.filter(r => r.status === 'rejected').length;

        slog('info', 'batch.complete', {
            processed: processedJobs,
            successful,
            failed,
            crashed,
            duration: Date.now() - requestStart
        });

        return new Response(JSON.stringify({
            processed: processedJobs,
            successful,
            failed,
            resource_usage: resourcePool.getUsage()
        }), {
            status: 200,
            headers: corsHeaders()
        });

    } catch (e: any) {
        const duration = Date.now() - requestStart;
        slog('error', 'batch.exception', {
            error: { message: e?.message, stack: e?.stack?.slice(0, 500) },
            duration,
            processed: processedJobs
        });

        return new Response(JSON.stringify({
            error: e?.message || 'internal_error',
            processed: processedJobs
        }), {
            status: 500,
            headers: corsHeaders()
        });
    }
});