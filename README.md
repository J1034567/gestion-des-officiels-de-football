# gestion-des-officiels-de-football

![Banner](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

## Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: <https://ai.studio/apps/drive/1Tsy_MAQ3WXIXGLcxF376pA2Ibm0c07k6>

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
 
## Mission Orders Bulk PDF (Unified Jobs)

Mission order bulk PDF generation now leverages the unified `jobs` system (`mission_orders.bulk_pdf_v2`) instead of the legacy `mission_order_batches` flow.

### Current Unified Flow

1. Client computes a stable SHA-256 hash of the requested mission order set (matchId + officialId pairs canonicalized and sorted) for UI correlation / optional dedupe hint.
2. Client calls `enqueue-mission-orders-bulk-pdf` with `{ orders, dedupe: true }`.
   - If a reusable job (same dedupe key) exists in `pending|running|completed`, it is returned (`reused=true`).
   - Otherwise a new `jobs` row is created with `type=mission_orders.bulk_pdf_v2`.
3. Background/cron triggers `process-jobs` which claims pending jobs and processes phases:
   - `fetch` (40%) generate each single PDF via `generate-mission-order` edge function.
   - `merge` (40%) assemble pages into one document.
   - `upload` (20%) store artifact to `mission_orders/batches/<dedupe_key or job_id>.pdf`.
4. Client either polls (temporary) or relies on realtime subscription to receive progress & completion, then downloads signed URL for the artifact.

### New Enqueue Edge Function

`enqueue-mission-orders-bulk-pdf` request body:

```json
{ "orders": [{ "matchId": "...", "officialId": "..." }], "dedupe": true }
```

Response:

```json
{ "jobId": "<uuid>", "reused": false, "status": "pending" }
```

### Client Helper

`missionOrderService.getBulkMissionOrdersPdf` now:
1. Attempts unified job enqueue + polling of `jobs` row.
2. Falls back to legacy server bulk (temporary) if unified path fails & order set large.
3. Finally falls back to client-side merge.

### Legacy Status (Deprecated)

The previous dedicated table & edge functions are now deprecated and scheduled for removal:

Deprecated edge functions:
| Function | Replacement |
|----------|-------------|
| `start-mission-order-batch` | `enqueue-mission-orders-bulk-pdf` |
| `process-mission-order-batches` | `process-jobs` |
| `get-mission-order-batch` | Realtime + direct `jobs` select |

Deprecated table: `mission_order_batches` (to be dropped after a stable period once no references remain).

If you still need to reference the legacy schema temporarily, see the prior documentation in repository history before this deprecation section.

---

## (Deprecated) Legacy Mission Order Batch Documentation

> NOTE: This section is retained for historical context and will be removed in a future cleanup once the legacy table is dropped. Prefer the unified jobs flow described above.

### Legacy Overview

1. Client computes a stable SHA-256 hash of the requested mission order set (matchId + officialId pairs canonicalized and sorted).
2. (Legacy) Client called `start-mission-order-batch` edge function with `{ hash, orders }`.
   - If a completed artifact already exists, a signed URL is returned immediately.
   - Otherwise a `mission_order_batches` row is inserted with `status=pending`.
3. (Legacy) Background/cron triggered `process-mission-order-batches`:
   - Transitions jobs from `pending` -> `processing`.
   - Generates each individual PDF (re-using existing single generation function) and merges them.
   - Uploads merged result to Supabase Storage (`mission_orders/batches/<hash>.pdf`).
   - Marks job `completed` with `artifact_path` or `failed` with an error code.
4. (Legacy) Client polled `get-mission-order-batch` with the same hash until `completed` (or timeout) to download the artifact.

### Legacy Edge Functions

| Function | Responsibility |
|----------|----------------|
| `start-mission-order-batch` | (Deprecated) Idempotent creation/retrieval of a batch job. |
| `process-mission-order-batches` | (Deprecated) Processes pending jobs; merges PDFs; uploads artifact. |
| `get-mission-order-batch` | (Deprecated) Returns status + signed artifact URL if complete. |

 
### Legacy Client Integration

`missionOrderService.getBulkMissionOrdersPdf` now attempts the job path first:

```ts
const blob = await getBulkMissionOrdersPdf(orders, progressCb);
```

Internally it:

1. Hashes orders
2. Calls start/reuse edge function
3. Polls for up to 60s for completion
4. Falls back to legacy server bulk function or client-side merge if necessary

 
### Legacy Table

Add a table (Run separately – not auto-managed here):

```sql
CREATE TABLE mission_order_batches (
   hash text PRIMARY KEY,
   status text NOT NULL CHECK (status IN ('pending','processing','completed','failed')),
   orders_json jsonb NOT NULL,
   artifact_path text,
   error text,
   created_at timestamptz NOT NULL DEFAULT now(),
   updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON mission_order_batches (status);
```

Add a trigger to auto-update `updated_at` if desired.

### Error Handling Codes (Early Set)

| Code | Meaning |
|------|---------|
| `no_pages` | No individual PDFs produced pages (all failures / empty). |
| `upload_failed` | Storage upload did not succeed. |

### Legacy Operational Notes

- Previously required: schedule the `process-mission-order-batches` function (cron or manual trigger). Now replaced by scheduling `process-jobs`.
- Signed URLs currently valid for 1 hour (adjust in edge functions if needed).
- Client still supports immediate inline progress for small sets (legacy path) for responsive UX.

### Legacy Future Enhancements (superseded)

- Persist per-order failure diagnostics in a companion detail table.
- Add exponential backoff & partial artifact reuse.
- Emit real-time updates via Realtime channel instead of polling.

### Legacy Troubleshooting

Common issues & resolutions for the mission order batch workflow:

1. Server bulk path always returns 401
   - Ensure the client has an active session (Supabase `auth.getSession()` not null) before invoking.
   - The edge function now validates the JWT via `auth.getUser()`. Expired tokens will return `Invalid or expired token`.
   - Confirm the browser request includes `Authorization: Bearer <access_token>` (Supabase JS handles this automatically on `functions.invoke`).
   - If running locally with the CLI, verify the `anon` key matches the project and that the access token is for the same project domain.

2. Batch stays in `pending` then falls back after ~8s
   - The client now performs a one-time "kick" of `process-mission-order-batches` if the job is still pending after ~1.8s.
   - Verify the cron schedule is active (Supabase Dashboard > Edge Functions > Schedules) and that `process-mission-order-batches` deploy succeeded.
   - Manually trigger the processor via CLI if needed:
     `supabase functions invoke process-mission-order-batches --no-verify-jwt`

3. Repeated regeneration of same batch artifact
   - Confirm the hashing logic canonicalizes order pairs (sorted) – review `hashMissionOrders` util.
   - Check the storage bucket (`mission_orders/batches/<hash>.pdf`) exists; missing artifact path suggests processing never completed or failed.

4. Slow large merges (>50 PDFs)
   - Increase batch processor parallelism cautiously; current single job fetch is parallel per order already.
   - Consider splitting extremely large sets into deterministic sub-batches (future enhancement).

5. Missing pages in merged PDF
   - Inspect logs from `process-mission-order-batches` for individual order failures.
   - Run single order generation via `generate-mission-order` to isolate problematic match/official pairs.

Logging Hints:

- `[MissionOrders][job-path]` covers job hashing, polling, and processor kicks.
- `[MissionOrders][server-bulk]` logs direct bulk function attempts.
- `[MissionOrders][client-merge]` logs per-order failures during client fallback merging.

Security Notes:

- `generate-bulk-mission-orders` re-validates tokens (`auth.getUser`) and does not trust unsigned input.
- Storage uploads use service role; ensure bucket RLS policies allow only intended access through signed URLs.

---

## Unified Job System (Phase 4+)

The application now supports a generalized, realtime-aware job orchestration layer replacing ad‑hoc batch tables. It enables:

- Multi-phase progress with weighted phases (overall progress derived from intra-phase progress)
- Fine-grained per-target tracking via `job_items` (e.g. recipients in a bulk email)
- Idempotent artifacts with `dedupe_key` (re-using previously completed work)
- Realtime UI updates (subscription on `jobs` + `job_items`)
- Extensible handler registry in a single edge function (`process-jobs`)

### Database Additions

Migration (already applied): `20250926_unified_jobs_ext.sql`

Adds columns to `public.jobs`:

```sql
priority INT DEFAULT 100
phase TEXT
phase_progress INT DEFAULT 0
attempts INT DEFAULT 0
dedupe_key TEXT
artifact_path TEXT
artifact_type TEXT
error_code TEXT
```

Adds `public.job_items`:

```sql
id UUID PK
job_id UUID REFERENCES jobs(id) ON DELETE CASCADE
seq INT
target JSONB (opaque per handler)
status TEXT (pending|running|completed|failed|skipped)
error_code TEXT
error_message TEXT
started_at timestamptz
finished_at timestamptz
```

Helper view: `job_items_progress` summarizing counts + percent.

### Phase Weighting

Handler declares ordered phases with weights totaling 100. Example (bulk PDF v2):

```text
fetch (40) -> merge (40) -> upload (20)
```
During a phase the `jobs.phase_progress` (0–100) is scaled by the phase weight to compute `jobs.progress`.

### Edge Function: `process-jobs`

Single unified processor:

1. Claims stale `running` (updated_at older than threshold) or `pending` jobs.
2. Updates status to `running`.
3. Executes handler by `job.type` (registry dispatch pattern).
4. Updates phase + phase_progress inside each handler.
5. Finalizes status (`completed` | `failed`) with error_code if provided.

### Realtime

The UI subscribes to `jobs` table changes (all events) and maps snake_case columns to camelCase job records. Expansion per-job displays live `job_items` states (counts, errors, durations).

### Idempotency

`(type, dedupe_key)` unique index (partial) prevents duplicate artifacts when input invariants hash to same value.

### Adding a New Handler

1. Define phase weights in `PHASE_WEIGHTS` inside `process-jobs/index.ts`.
2. Add an async function in `handlers` keyed by the new `job.type`.
3. (Optional) Create job_items for per-target work at an early phase.
4. Update progress each loop: `phase_progress` then call helper to recompute overall.
5. Set `artifact_path` / `artifact_type` if generating output.
6. Throw errors with a `code` property for standardized `error_code`.

### Client Realtime Integration

The `JobRealtimeBridge` component (now mounted in `App.tsx`) consumes realtime changes and auto-registers unknown jobs (minimal label) so the Job Center UI reflects server-originated jobs even if not initiated by the current tab/session.

---

## Email Bulk v2 (mission_orders.email_bulk_v2)

Implemented as a multi-phase job leveraging `job_items` for each recipient.

Phases:

1. prepare (15%) – populate `job_items` from `payload.recipients` if not already present (idempotent).
2. render (35%) – validate emails, mark invalid ones `skipped`, ensure others remain `pending`.
3. send (50%) – iterate remaining items, mark `running` → `completed` or `failed` (placeholder send logic, ready for provider integration).

Per-item statuses are visible in the expanded Job Row; invalid emails surface as `skipped` with `invalid_email` code.

Future Enhancements:

- Attach provider message IDs in `target` or new column.
- Retry failed sends with backoff and `attempts` increment.
- Partial success heuristics (mark job failed only if failure ratio > threshold).
- Aggregate artifact (CSV summary) uploaded as `artifact_path`.

### Enqueue Function

Edge Function: `enqueue-email-bulk`

Request body example:

```json
{
   "recipients": [
      { "email": "user1@example.com", "name": "User One" },
      { "email": "user2@example.com" }
   ],
   "template": "reminder",
   "dedupe": true
}
```

Response:

```json
{ "jobId": "<uuid>", "reused": false, "status": "pending" }
```

If a previous identical (template + recipient set) job exists and is still active or completed, the response sets `reused: true` and returns its current status.

### Client Usage

```ts
import { enqueueBulkEmails } from '@/services/emailBulkService';
import { useJobCenter } from '@/hooks/useJobCenter';

function useSendReminderEmails() {
   const { register } = useJobCenter();
   return async (recipients: { email: string; name?: string }[]) => {
      const res = await enqueueBulkEmails(recipients, { template: 'reminder', registerJob: register });
      return res.jobId;
   };
}
```

The realtime bridge will continue updating progress, phases, and per-item statuses automatically after initial registration.

### SendGrid Integration

Bulk send phase uses SendGrid directly if `SENDGRID_API_KEY` is present in Edge Function environment. Optional supporting vars:

| Env Var | Purpose | Default |
|---------|---------|---------|
| `SENDGRID_API_KEY` | Authenticate API calls | (required for real sends) |
| `SENDGRID_FROM_EMAIL` | From email address | `noreply@example.com` |
| `SENDGRID_FROM_NAME` | From display name | `Notifications` |

If the key is absent, the handler simulates success (for local development). Failures from SendGrid surface as `sendgrid_error` in `job_items.error_code` with raw API response in `error_message`.

Current simple templating builds a subject `[template] Notification` and a bilingual-ish placeholder body; extend by mapping `template` to stored HTML in a config table or storage bucket for richer content.

---

## Roadmap (Next Steps)

- Implement resend/retry button per failed job_item.
- Enrich job labels server-side (store label/title in jobs table at enqueue time).
- Add metrics RPC for dashboard (success rate, average duration per type).
- Integrate real email provider (Resend/Mailgun) with secret rotation and bounce tracking.
- Expose cancellation semantics (set status=cancelled; handlers honor cooperative abort).


