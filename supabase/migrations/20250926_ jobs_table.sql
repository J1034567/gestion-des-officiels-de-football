-- Create an ENUM type for job statuses for data integrity
CREATE TYPE public.job_status AS ENUM (
    'pending',
    'processing',
e    'completed',
    'failed',
    'cancelled'
);

-- The main jobs table
CREATE TABLE public.jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid DEFAULT auth.uid() NOT NULL REFERENCES auth.users(id),
    type text NOT NULL,
    label text,
    status public.job_status DEFAULT 'pending'::public.job_status NOT NULL,
    payload jsonb,
    result jsonb, -- To store artifact URL or other output
    error_message text,
    progress integer DEFAULT 0,
    total integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable Realtime on the new table
ALTER TABLE public.jobs REPLICA IDENTITY FULL;
-- Send all changes to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;

-- RLS Policy: Users can only see and manage their own jobs
CREATE POLICY "Allow users to manage their own jobs"
ON public.jobs
FOR ALL
USING (auth.uid() = user_id);

-- Automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_job_update
BEFORE UPDATE ON public.jobs
FOR EACH ROW
EXECUTE PROCEDURE public.handle_updated_at();