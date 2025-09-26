-- Unified Job System Extension Migration
-- Date: 2025-09-26
-- Adds columns to jobs and introduces job_items for granular tracking.

-- 1. New columns on jobs (safe additive changes)
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS phase text,
  ADD COLUMN IF NOT EXISTS phase_progress integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS artifact_path text,
  ADD COLUMN IF NOT EXISTS artifact_type text,
  ADD COLUMN IF NOT EXISTS error_code text;

-- 2. Unique index for idempotent jobs (only when dedupe_key present)
CREATE UNIQUE INDEX IF NOT EXISTS jobs_type_dedupe_key_idx
  ON public.jobs(type, dedupe_key) WHERE dedupe_key IS NOT NULL;

-- 3. job_items table for per-target granularity (emails, etc.)
CREATE TABLE IF NOT EXISTS public.job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  target jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending|running|completed|failed|skipped
  error_code text,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS job_items_job_id_status_idx ON public.job_items(job_id, status);
CREATE INDEX IF NOT EXISTS job_items_job_id_seq_idx ON public.job_items(job_id, seq);

-- 4. Helper view (optional) summarizing job progress via job_items
CREATE OR REPLACE VIEW public.job_items_progress AS
SELECT j.id as job_id,
       COUNT(*) FILTER (WHERE ji.status IN ('completed','skipped')) AS done,
       COUNT(*) AS total,
       CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND( (COUNT(*) FILTER (WHERE ji.status IN ('completed','skipped')) * 100.0) / COUNT(*)) END::int AS pct
FROM public.jobs j
LEFT JOIN public.job_items ji ON ji.job_id = j.id
GROUP BY j.id;

-- 5. Comment markers for future rollbacks (manual)
-- To rollback: drop view job_items_progress; drop table job_items; drop columns if desired.
