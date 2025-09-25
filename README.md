<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1Tsy_MAQ3WXIXGLcxF376pA2Ibm0c07k6

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
# gestion-des-officiels-de-football

## Mission Orders: Idempotent Batch Workflow (Phase 3)

To avoid regenerating identical merged PDFs and to support asynchronous processing for large sets of mission orders, the application introduces a hash + job based workflow.

### Overview

1. Client computes a stable SHA-256 hash of the requested mission order set (matchId + officialId pairs canonicalized and sorted).
2. Client calls `start-mission-order-batch` edge function with `{ hash, orders }`.
   - If a completed artifact already exists, a signed URL is returned immediately.
   - Otherwise a `mission_order_batches` row is inserted with `status=pending`.
3. Background/cron triggers `process-mission-order-batches`:
   - Transitions jobs from `pending` -> `processing`.
   - Generates each individual PDF (re-using existing single generation function) and merges them.
   - Uploads merged result to Supabase Storage (`mission_orders/batches/<hash>.pdf`).
   - Marks job `completed` with `artifact_path` or `failed` with an error code.
4. Client polls `get-mission-order-batch` with the same hash until `completed` (or timeout) to download the artifact.

### Edge Functions Added

| Function | Responsibility |
|----------|----------------|
| `start-mission-order-batch` | Idempotent creation/retrieval of a batch job. |
| `process-mission-order-batches` | Processes pending jobs; merges PDFs; uploads artifact. |
| `get-mission-order-batch` | Returns status + signed artifact URL if complete. |

 
### Client Integration

`missionOrderService.getBulkMissionOrdersPdf` now attempts the job path first:

```ts
const blob = await getBulkMissionOrdersPdf(orders, progressCb);
```

Internally it:

1. Hashes orders
2. Calls start/reuse edge function
3. Polls for up to 60s for completion
4. Falls back to legacy server bulk function or client-side merge if necessary

 
### Database (Proposed Table)

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

### Operational Notes

- Schedule the `process-mission-order-batches` function (cron or manual trigger) depending on throughput requirements.
- Signed URLs currently valid for 1 hour (adjust in edge functions if needed).
- Client still supports immediate inline progress for small sets (legacy path) for responsive UX.

### Future Enhancements

- Persist per-order failure diagnostics in a companion detail table.
- Add exponential backoff & partial artifact reuse.
- Emit real-time updates via Realtime channel instead of polling.

### Troubleshooting

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

