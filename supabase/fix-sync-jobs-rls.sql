-- Fix RLS policy for sync_jobs to allow authenticated users to create jobs
-- Run this in your Supabase SQL Editor

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Allow insert for service role only" ON sync_jobs;

-- Create new policy that allows authenticated users to insert their own jobs
CREATE POLICY "Allow insert for authenticated users"
ON sync_jobs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Verify the change
SELECT * FROM pg_policies WHERE tablename = 'sync_jobs';
