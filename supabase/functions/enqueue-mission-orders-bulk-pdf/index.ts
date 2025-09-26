// Enqueue Mission Orders Bulk PDF Job
// Inserts (or reuses) a unified jobs row for mission_orders.bulk_pdf_v2
// Request body: { orders: [{ matchId, officialId }], dedupe?: boolean }
// Response: { jobId, reused, status, progress?, artifactPath? }
// Auth: requires valid user session (anon key + JWT)
// @ts-nocheck

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface OrderInput { matchId: string; officialId: string; }
// ADDED: Type for our structured logger function for better type safety.
type Slog = (level: string, event: string, meta?: Record<string, any>) => void;


// --- Utility Functions ---

function sha256Base64(input: string): Promise<string> {
    const data = new TextEncoder().encode(input);
    return crypto.subtle.digest('SHA-256', data).then(buf => {
        const bytes = new Uint8Array(buf);
        const bin = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
        return btoa(bin).replace(/=+$/, '');
    });
}

function getClient(req: Request) {
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !anon) throw new Error('Missing SUPABASE environment variables');
    const authHeader = req.headers.get('Authorization') || '';
    return createClient(url, anon, {
        global: { headers: { Authorization: authHeader } }
    });
}

function cors() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
    };
}

// MODIFIED: The json helper now accepts the slog function to log every response.
function json(slog: Slog, obj: any, status = 200) {
    // ADDED: Log the final response being sent to the client.
    slog('info', 'response.sent', { status, body: obj });
    return new Response(JSON.stringify(obj), {
        status,
        headers: { 'Content-Type': 'application/json', ...cors() }
    });
}


// --- Main Server Logic ---

serve(async (req: Request) => {
    // Setup correlation ID and structured logger
    const cid = req.headers.get('x-correlation-id') || crypto.randomUUID();
    const slog: Slog = (level, event, meta = {}) => {
        try {
            console.log(JSON.stringify({
                ts: new Date().toISOString(),
                cid,
                fn: 'enqueue-mission-orders-bulk-pdf',
                level,
                event,
                ...meta
            }));
        } catch {}
    };

    slog('info', 'request.start', { method: req.method });

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: cors() });
    }
    if (req.method !== 'POST') {
        return json(slog, { error: 'method_not_allowed' }, 405);
    }

    try {
        // 1. Authentication
        const supabase = getClient(req);
        const { data: { user }, error: userErr } = await supabase.auth.getUser();

        if (userErr || !user) {
            // ADDED: Log authentication failures.
            slog('warn', 'auth.failed', { error: userErr?.message || 'No user session' });
            return json(slog, { error: 'unauthorized' }, 401);
        }
        // ADDED: Log successful authentication with the user ID for traceability.
        slog('info', 'auth.success', { userId: user.id });

        // 2. Body Parsing & Validation
        let body: any = {};
        try {
            body = await req.json();
        } catch {
            // ADDED: Log invalid JSON body error.
            slog('warn', 'request.body.invalid_json');
            return json(slog, { error: 'invalid_json' }, 400);
        }

        const ordersRaw: any[] = Array.isArray(body.orders) ? body.orders : [];
        if (!ordersRaw.length) {
            // ADDED: Log missing orders error.
            slog('warn', 'request.validation.failed', { reason: 'no_orders' });
            return json(slog, { error: 'no_orders' }, 400);
        }

        // 3. Input Normalization & Internal Deduplication
        const dedupMap = new Map<string, OrderInput>();
        for (const o of ordersRaw) {
            if (!o || typeof o.matchId !== 'string' || typeof o.officialId !== 'string') continue;
            const key = `${o.matchId}:${o.officialId}`;
            if (!dedupMap.has(key)) dedupMap.set(key, { matchId: o.matchId, officialId: o.officialId });
        }
        const orders = Array.from(dedupMap.values());
        slog('info', 'orders.processed', { rawCount: ordersRaw.length, validCount: orders.length });
        if (!orders.length) {
            // ADDED: Log no valid orders after filtering.
            slog('warn', 'request.validation.failed', { reason: 'no_valid_orders' });
            return json(slog, { error: 'no_valid_orders' }, 400);
        }

        const enableDedupe = body.dedupe !== false; // default true
        // ADDED: Log the final validated parameters the function will use.
        slog('info', 'request.params.validated', { orderCount: orders.length, dedupe: enableDedupe });

        // 4. Job Deduplication Key Generation
        let dedupeKey: string | null = null;
        if (enableDedupe) {
            const sortedKeys = orders.map(o => `${o.matchId}:${o.officialId}`).sort();
            dedupeKey = await sha256Base64(JSON.stringify({ k: sortedKeys }));
            // ADDED: Log the generated key, crucial for debugging job reuse.
            slog('debug', 'dedupe.key_generated', { key: dedupeKey });
        }

        // 5. Check for Existing Job (Reuse Logic)
        if (dedupeKey) {
            slog('debug', 'reuse.check.attempt', { dedupeKey });
            const { data: existing, error: existingErr } = await supabase
                .from('jobs')
                .select('id,status,progress,artifact_path')
                .eq('type', 'mission_orders.bulk_pdf_v2')
                .eq('dedupe_key', dedupeKey)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (existingErr) {
                // ADDED: Log database errors during the reuse check.
                slog('error', 'reuse.check.failed', { error: existingErr.message });
            } else if (existing && ['pending', 'running', 'completed'].includes(existing.status)) {
                slog('info', 'reuse.existing_job', { jobId: existing.id, status: existing.status });
                return json(slog, { jobId: existing.id, reused: true, status: existing.status, progress: existing.progress, artifactPath: existing.artifact_path || null });
            } else {
                // ADDED: Log when no reusable job is found.
                slog('info', 'reuse.check.not_found');
            }
        }

        // 6. Insert New Job
        const payload = { orders, requestedBy: user.id };
        const insertPatch = {
            type: 'mission_orders.bulk_pdf_v2',
            status: 'pending' as const,
            payload,
            priority: 90,
            dedupe_key: dedupeKey,
            progress: 0,
            phase_progress: 0
        };

        slog('info', 'job.insert.attempt');
        let jobRowRes = await supabase
            .from('jobs')
            .insert(insertPatch)
            .select('id,status')
            .single();

        if (jobRowRes.error) {
            const jobErr = jobRowRes.error;
            // Handle unique constraint violation (race condition)
            if (dedupeKey && jobErr.message?.includes('jobs_type_dedupe_key_idx')) {
                slog('warn', 'job.insert.race_condition', { dedupeKey });
                const { data: raceExisting } = await supabase
                    .from('jobs')
                    .select('id,status,progress,artifact_path')
                    .eq('type', 'mission_orders.bulk_pdf_v2')
                    .eq('dedupe_key', dedupeKey)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (raceExisting) {
                    slog('info', 'job.insert.race_reuse', { jobId: raceExisting.id });
                    return json(slog, { jobId: raceExisting.id, reused: true, status: raceExisting.status, progress: raceExisting.progress, artifactPath: raceExisting.artifact_path || null });
                }
            }
            // Fallback: try minimal column set (for backward compatibility during migrations)
            else if (/column .* does not exist/i.test(jobErr.message)) {
                slog('warn', 'job.insert.fallback_minimal', { reason: jobErr.message });
                const minimalPatch = { type: insertPatch.type, status: insertPatch.status, payload, progress: 0 };
                const retryRes = await supabase.from('jobs').insert(minimalPatch).select('id,status').single();

                if (retryRes.data && !retryRes.error) {
                    // ADDED: Log the success of the fallback insert.
                    slog('info', 'job.insert.fallback_success', { jobId: retryRes.data.id });
                    jobRowRes = retryRes; // Overwrite the failed response with the successful one
                } else {
                    slog('error', 'job.insert.fallback_failed', { error: retryRes.error?.message });
                    return json(slog, { error: 'insert_failed', detail: jobErr.message }, 500);
                }
            } else {
                // For any other unhandled insert error
                slog('error', 'job.insert.failed', { error: jobErr.message });
                return json(slog, { error: 'insert_failed', detail: jobErr.message }, 500);
            }
        }

        slog('info', 'job.insert.success', { jobId: jobRowRes.data.id });
        return json(slog, { jobId: jobRowRes.data.id, reused: false, status: jobRowRes.data.status });

    } catch (e: any) {
        // MODIFIED: Use slog for unhandled exceptions for consistent log format.
        slog('error', 'unhandled.exception', { error: e?.message, stack: e?.stack });
        return json(slog, { error: 'internal_error', detail: e?.message }, 500);
    }
});