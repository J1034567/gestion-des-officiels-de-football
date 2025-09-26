-- Quick fix: Add essential missing columns to jobs table
-- Run this in Supabase SQL Editor to fix immediate error

-- Add the label column (most critical for the current error)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS label TEXT;

-- Update existing jobs to have a default label
UPDATE jobs 
SET label = CASE 
    WHEN type LIKE '%email%' THEN 'Email Job'
    WHEN type LIKE '%pdf%' THEN 'PDF Generation Job'
    WHEN type LIKE '%export%' THEN 'Export Job'
    ELSE 'Processing Job'
END
WHERE label IS NULL;

-- Make label required
ALTER TABLE jobs ALTER COLUMN label SET NOT NULL;

-- Add other essential columns used by the job system
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS scope TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS total INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completed INTEGER DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS artifact_url TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;

-- Add basic index for performance
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);