// Email Bulk Enqueue Edge Function
// Inserts (or reuses) a unified job row for mission_orders.email_bulk_v2
// Request body: { recipients: [{ id?, email, name? }], template?: string, dedupe?: boolean }
// Response: { jobId, reused, status }
// Auth: requires a valid user session (anon key with JWT)
// @ts-nocheck

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RecipientInput { id?: string | number; email: string; name?: string; }
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
        // This structured log format is great for log ingestion and analysis.
        try {
            console.log(JSON.stringify({
                ts: new Date().toISOString(),
                cid,
                fn: 'enqueue-email-bulk',
                level,
                event,
                ...meta
            }));
        } catch { }
    };

    slog('info', 'request.start', { method: req.method });

    // Handle CORS preflight
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

        const recipients: RecipientInput[] = Array.isArray(body.recipients) ? body.recipients : [];
        if (!recipients.length) {
            // ADDED: Log missing recipients error.
            slog('warn', 'request.validation.failed', { reason: 'no_recipients' });
            return json(slog, { error: 'no_recipients' }, 400);
        }
        const template = typeof body.template === 'string' ? body.template : 'default';
        const enableDedupe = body.dedupe !== false; // default true

        // ADDED: Log the validated parameters the function will use.
        slog('info', 'request.params.validated', { recipientCount: recipients.length, template, dedupe: enableDedupe });

        // 3. Normalization & Dedupe Key Generation
        const normRecipients = recipients.map(r => ({
            id: r.id ?? null,
            email: String(r.email || '').trim().toLowerCase(),
            name: r.name?.trim() || null
        }));

        let dedupeKey: string | null = null;
        if (enableDedupe) {
            const sortedEmails = [...normRecipients].map(r => r.email).sort();
            dedupeKey = await sha256Base64(JSON.stringify({ t: template, e: sortedEmails }));
            // ADDED: Log the generated key, crucial for debugging deduplication.
            slog('debug', 'dedupe.key_generated', { key: dedupeKey });
        }

        // 4. Check for Existing Job (Reuse Logic)
        if (dedupeKey) {
            slog('debug', 'reuse.check.attempt', { dedupeKey });
            const { data: existing, error: existingErr } = await supabase
                .from('jobs')
                .select('id,status,artifact_path,progress')
                .eq('type', 'mission_orders.email_bulk_v2')
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

        // 5. Insert New Job
        const payload = { recipients: normRecipients, template, requestedBy: user.id };
        const insertPatch = {
            type: 'mission_orders.email_bulk_v2',
            status: 'pending' as const,
            payload,
            priority: 100,
            dedupe_key: dedupeKey,
            progress: 0,
            phase_progress: 0
        };

        slog('info', 'job.insert.attempt');
        const { data: jobRow, error: jobErr } = await supabase
            .from('jobs')
            .insert(insertPatch)
            .select('id,status')
            .single();

        if (jobErr) {
            // Handle unique constraint violation (race condition)
            if (dedupeKey && jobErr.message?.includes('jobs_type_dedupe_key_idx')) {
                slog('warn', 'job.insert.race_condition', { dedupeKey });
                const { data: raceExisting } = await supabase
                    .from('jobs')
                    .select('id,status,progress,artifact_path')
                    .eq('type', 'mission_orders.email_bulk_v2')
                    .eq('dedupe_key', dedupeKey)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (raceExisting) {
                    slog('info', 'job.insert.race_reuse', { jobId: raceExisting.id });
                    return json(slog, { jobId: raceExisting.id, reused: true, status: raceExisting.status, progress: raceExisting.progress, artifactPath: raceExisting.artifact_path || null });
                }
            }
            slog('error', 'job.insert.failed', { error: jobErr.message });
            return json(slog, { error: 'insert_failed', detail: jobErr.message }, 500);
        }

        slog('info', 'job.insert.success', { jobId: jobRow.id });
        return json(slog, { jobId: jobRow.id, reused: false, status: jobRow.status });

    } catch (e: any) {
        // MODIFIED: Use slog for unhandled exceptions for consistent log format.
        slog('error', 'unhandled.exception', { error: e?.message, stack: e?.stack });
        return json(slog, { error: 'internal_error', detail: e?.message }, 500);
    }
});