-- Migration: Add missing columns to jobs table for enhanced job system
-- Run this in your Supabase SQL Editor or via migration

-- Add missing columns to jobs table
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS label TEXT,
ADD COLUMN IF NOT EXISTS scope TEXT,
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS total INTEGER,
ADD COLUMN IF NOT EXISTS completed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS artifact_url TEXT,
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS error_code TEXT,
ADD COLUMN IF NOT EXISTS phase TEXT,
ADD COLUMN IF NOT EXISTS phase_progress INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS retry_policy JSONB,
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS dependencies TEXT[],
ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

-- Update existing jobs to have a label if they don't have one
UPDATE jobs 
SET label = COALESCE(
    CASE 
        WHEN type LIKE '%email%' THEN 'Email Job'
        WHEN type LIKE '%pdf%' THEN 'PDF Generation Job'
        WHEN type LIKE '%export%' THEN 'Export Job'
        ELSE 'Job'
    END,
    'Unknown Job'
)
WHERE label IS NULL;

-- Make label NOT NULL after setting defaults
ALTER TABLE jobs ALTER COLUMN label SET NOT NULL;

-- Add useful indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_status_priority ON jobs(status, priority);
CREATE INDEX IF NOT EXISTS idx_jobs_type_status ON jobs(type, status);
CREATE INDEX IF NOT EXISTS idx_jobs_dedupe_key ON jobs(dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_next_retry_at ON jobs(next_retry_at) WHERE next_retry_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);

-- Add comments for documentation
COMMENT ON COLUMN jobs.label IS 'Human-readable job description for UI display';
COMMENT ON COLUMN jobs.scope IS 'Optional scope identifier (e.g., matchId, userId)';
COMMENT ON COLUMN jobs.priority IS 'Job priority: low, normal, high, urgent';
COMMENT ON COLUMN jobs.total IS 'Total number of items to process';
COMMENT ON COLUMN jobs.completed IS 'Number of items completed';
COMMENT ON COLUMN jobs.artifact_url IS 'URL to generated artifact (PDF, file, etc.)';
COMMENT ON COLUMN jobs.error_message IS 'Human-readable error message';
COMMENT ON COLUMN jobs.error_code IS 'Machine-readable error code';
COMMENT ON COLUMN jobs.phase IS 'Current processing phase';
COMMENT ON COLUMN jobs.phase_progress IS 'Progress within current phase (0-100)';
COMMENT ON COLUMN jobs.retry_policy IS 'JSON retry configuration';
COMMENT ON COLUMN jobs.next_retry_at IS 'Timestamp for next retry attempt';
COMMENT ON COLUMN jobs.dependencies IS 'Array of job IDs this job depends on';
COMMENT ON COLUMN jobs.attempts IS 'Number of processing attempts';
COMMENT ON COLUMN jobs.duration_ms IS 'Job processing duration in milliseconds';

-- Create enum types if they don't exist
DO $$ BEGIN
    CREATE TYPE job_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled', 'paused', 'retrying');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE job_priority AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update status column to use enum if not already
-- (This might require updating the column type carefully based on existing data)

-- Add constraint to ensure priority is valid
ALTER TABLE jobs ADD CONSTRAINT jobs_priority_check 
CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

-- Add constraint to ensure progress values are valid
ALTER TABLE jobs ADD CONSTRAINT jobs_progress_check 
CHECK (progress >= 0 AND progress <= 100);

ALTER TABLE jobs ADD CONSTRAINT jobs_phase_progress_check 
CHECK (phase_progress >= 0 AND phase_progress <= 100);

-- Add constraint to ensure completed <= total
ALTER TABLE jobs ADD CONSTRAINT jobs_completed_total_check 
CHECK (completed IS NULL OR total IS NULL OR completed <= total);

COMMENT ON TABLE jobs IS 'Enhanced job processing queue with progress tracking and error handling';