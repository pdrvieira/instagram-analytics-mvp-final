import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { JobPayload, SyncJob, ErrorCodes, AppError } from '@ig-analytics/shared';

// Supabase client for Edge Functions
// NOTE: The URL and Key are automatically available in the Deno environment
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

/**
 * Enqueues a new job into the sync_jobs table.
 * @param payload The job payload containing profile_id, user_id, and job_type.
 * @returns The created SyncJob object.
 */
export async function enqueueJob(payload: JobPayload): Promise<SyncJob> {
  const { profile_id, user_id, job_type, metadata = {} } = payload;

  // 1. Check if a job of the same type is already PENDING or RUNNING for this profile
  const { data: existingJobs, error: selectError } = await supabase
    .from('sync_jobs')
    .select('id, status')
    .eq('profile_id', profile_id)
    .eq('job_type', job_type)
    .in('status', ['PENDING', 'RUNNING']);

  if (selectError) {
    throw new AppError(
      ErrorCodes.DATABASE_ERROR,
      `Failed to check for existing jobs: ${selectError.message}`,
      500
    );
  }

  if (existingJobs && existingJobs.length > 0) {
    // Idempotency check: return the existing job if found
    const existingJob = existingJobs[0];
    console.log(`Job ${job_type} for profile ${profile_id} is already ${existingJob.status}. Returning existing job.`);
    // NOTE: We can't return the full SyncJob object here without fetching it again,
    // but for the Edge Function response, we can return a simplified status.
    // For simplicity in this MVP, we'll just throw an error to prevent duplicate processing.
    throw new AppError(
      ErrorCodes.CONFLICT,
      `A job of type ${job_type} is already ${existingJob.status} for this profile.`,
      409
    );
  }

  // 2. Insert the new job
  const { data, error: insertError } = await supabase
    .from('sync_jobs')
    .insert({
      profile_id,
      user_id,
      job_type,
      status: 'PENDING',
      metadata,
    })
    .select()
    .single();

  if (insertError) {
    throw new AppError(
      ErrorCodes.DATABASE_ERROR,
      `Failed to enqueue job: ${insertError.message}`,
      500
    );
  }

  return data as SyncJob;
}

/**
 * Helper function to get the current user's ID from the request context.
 * @param req The Deno Request object.
 * @returns The user ID (UUID).
 */
export async function getUserId(req: Request): Promise<string> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new AppError(ErrorCodes.UNAUTHORIZED, 'Missing Authorization header.', 401);
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new AppError(ErrorCodes.UNAUTHORIZED, 'Invalid or expired token.', 401);
  }

  return user.id;
}

/**
 * Helper function to validate profile ownership.
 * @param profileId The profile ID to check.
 * @param userId The user ID to check against.
 */
export async function validateProfileOwnership(profileId: string, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw new AppError(ErrorCodes.FORBIDDEN, 'Profile not found or does not belong to the user.', 403);
  }
}
