-- Base jobs table (initial part of unified job system)
-- Run before 20250926_unified_jobs_ext.sql if not already present.
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','running','completed','failed')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  progress integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jobs_type_status_idx ON public.jobs(type, status);

-- Simple updated_at trigger (optional; only if pgcrypto / extension environment supports)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_current_timestamp_updated_at') THEN
    CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
    RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_public_jobs_updated_at'
  ) THEN
    CREATE TRIGGER set_public_jobs_updated_at
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW EXECUTE PROCEDURE public.set_current_timestamp_updated_at();
  END IF;
END $$;
