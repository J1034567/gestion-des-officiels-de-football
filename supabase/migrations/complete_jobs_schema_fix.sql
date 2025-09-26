-- Complete Jobs Schema Fix
-- This migration adds ALL missing columns that the enhanced job system requires
-- Run this in Supabase SQL Editor to resolve all schema-related errors

-- Add missing columns to jobs table (handle existing columns safely)
-- Note: Some columns may already exist with different types, so we handle them carefully

-- Add text-based columns
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS scope TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS artifact_url TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS artifact_path TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS artifact_type TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS error_code TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS phase TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

-- Add integer-based columns
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS total INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completed INTEGER DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS phase_progress INTEGER DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

-- Add timestamp columns
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

-- Add array columns
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dependencies TEXT[];

-- Add JSONB columns
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS retry_policy JSONB;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;

-- Handle priority column (might already exist as integer)
DO $$
BEGIN
    -- Check if priority column exists and its type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'jobs' AND column_name = 'priority' AND data_type = 'integer'
    ) THEN
        -- Priority exists as integer, add priority_text for text values
        ALTER TABLE jobs ADD COLUMN IF NOT EXISTS priority_text TEXT DEFAULT 'normal';
        
        -- Convert existing integer priorities to text
        UPDATE jobs SET priority_text = 
            CASE 
                WHEN priority >= 300 THEN 'urgent'
                WHEN priority >= 200 THEN 'high' 
                WHEN priority >= 100 THEN 'normal'
                ELSE 'low'
            END
        WHERE priority_text IS NULL;
        
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'jobs' AND column_name = 'priority'
    ) THEN
        -- Priority doesn't exist, create as text
        ALTER TABLE jobs ADD COLUMN priority TEXT DEFAULT 'normal';
    END IF;
END $$;

-- Update existing jobs to have default values for required columns
UPDATE jobs 
SET 
    label = COALESCE(label, CASE 
        WHEN type LIKE '%email%' THEN 'Email Job'
        WHEN type LIKE '%pdf%' THEN 'PDF Generation Job'
        WHEN type LIKE '%export%' THEN 'Export Job'
        WHEN type LIKE '%mission%' THEN 'Mission Order Job'
        ELSE 'Processing Job'
    END),
    meta = COALESCE(meta, '{}'::jsonb),
    payload = COALESCE(payload, '{}'::jsonb),
    completed = COALESCE(completed, 0),
    attempts = COALESCE(attempts, 0),
    phase_progress = COALESCE(phase_progress, 0)
WHERE 
    label IS NULL 
    OR meta IS NULL 
    OR payload IS NULL
    OR completed IS NULL
    OR attempts IS NULL
    OR phase_progress IS NULL;

-- Make essential columns NOT NULL
ALTER TABLE jobs ALTER COLUMN label SET NOT NULL;
ALTER TABLE jobs ALTER COLUMN meta SET NOT NULL;
ALTER TABLE jobs ALTER COLUMN payload SET NOT NULL;

-- Add constraints to ensure data integrity
-- Handle priority constraint based on column type
DO $$
BEGIN
    -- Drop existing constraints if they exist
    ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_priority_check;
    
    -- Add priority constraint based on actual column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'jobs' AND column_name = 'priority_text'
    ) THEN
        ALTER TABLE jobs ADD CONSTRAINT jobs_priority_text_check 
            CHECK (priority_text IN ('low', 'normal', 'high', 'urgent'));
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'jobs' AND column_name = 'priority' AND data_type = 'text'
    ) THEN
        ALTER TABLE jobs ADD CONSTRAINT jobs_priority_check 
            CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
    END IF;
END $$;

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_progress_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_progress_check 
    CHECK (progress >= 0 AND progress <= 100);

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_phase_progress_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_phase_progress_check 
    CHECK (phase_progress >= 0 AND phase_progress <= 100);

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_completed_total_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_completed_total_check 
    CHECK (completed IS NULL OR total IS NULL OR completed <= total);

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_attempts_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_attempts_check 
    CHECK (attempts >= 0);

-- Create performance indexes (handle both priority column types)
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_updated_at ON jobs(updated_at);
CREATE INDEX IF NOT EXISTS idx_jobs_dedupe_key ON jobs(dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_next_retry_at ON jobs(next_retry_at) WHERE next_retry_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_phase ON jobs(phase) WHERE phase IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_user_id_status ON jobs(user_id, status);

-- Create priority indexes based on column type
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'jobs' AND column_name = 'priority_text'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_jobs_status_priority_text ON jobs(status, priority_text);
        CREATE INDEX IF NOT EXISTS idx_jobs_type_status_priority_text ON jobs(type, status, priority_text);
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'jobs' AND column_name = 'priority' AND data_type = 'text'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_jobs_status_priority ON jobs(status, priority);
        CREATE INDEX IF NOT EXISTS idx_jobs_type_status ON jobs(type, status);
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'jobs' AND column_name = 'priority' AND data_type = 'integer'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_jobs_status_priority_int ON jobs(status, priority);
        CREATE INDEX IF NOT EXISTS idx_jobs_type_status_priority_int ON jobs(type, status, priority);
    END IF;
END $$;

-- Add unique constraint for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_dedupe_unique 
    ON jobs(type, dedupe_key) 
    WHERE dedupe_key IS NOT NULL AND status != 'failed';

-- Add comments for documentation
COMMENT ON TABLE jobs IS 'Enhanced job processing queue with comprehensive tracking and error handling';
COMMENT ON COLUMN jobs.label IS 'Human-readable job description for UI display';
COMMENT ON COLUMN jobs.scope IS 'Optional scope identifier (e.g., matchId, userId, "all")';
COMMENT ON COLUMN jobs.priority IS 'Job priority: low, normal, high, urgent';
COMMENT ON COLUMN jobs.total IS 'Total number of items to process';
COMMENT ON COLUMN jobs.completed IS 'Number of items completed successfully';
COMMENT ON COLUMN jobs.artifact_url IS 'Public URL to generated artifact (PDF, file, etc.)';
COMMENT ON COLUMN jobs.artifact_path IS 'Internal storage path for generated artifact';
COMMENT ON COLUMN jobs.artifact_type IS 'MIME type of generated artifact';
COMMENT ON COLUMN jobs.error_message IS 'Human-readable error message';
COMMENT ON COLUMN jobs.error_code IS 'Machine-readable error code for categorization';
COMMENT ON COLUMN jobs.phase IS 'Current processing phase (e.g., "preparation", "generation", "delivery")';
COMMENT ON COLUMN jobs.phase_progress IS 'Progress within current phase (0-100)';
COMMENT ON COLUMN jobs.attempts IS 'Number of processing attempts made';
COMMENT ON COLUMN jobs.duration_ms IS 'Total job processing duration in milliseconds';
COMMENT ON COLUMN jobs.retry_policy IS 'JSON configuration for retry behavior';
COMMENT ON COLUMN jobs.next_retry_at IS 'Timestamp for next retry attempt';
COMMENT ON COLUMN jobs.dependencies IS 'Array of job IDs this job depends on';
COMMENT ON COLUMN jobs.dedupe_key IS 'Key for preventing duplicate job creation';
COMMENT ON COLUMN jobs.meta IS 'Additional metadata and context for job processing';
COMMENT ON COLUMN jobs.payload IS 'Job parameters and data for processing';

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON jobs TO authenticated;
-- GRANT USAGE ON jobs_id_seq TO authenticated;

-- Display completion message
SELECT 'Jobs table schema enhancement completed successfully!' as status;