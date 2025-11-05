import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { enqueueJob, getUserId, validateProfileOwnership } from './jobQueue.ts';
import { AppError, ErrorCodes, SyncJobPayload } from '@ig-analytics/shared';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const userId = await getUserId(req);
    const { profile_id, job_type } = await req.json();

    if (!profile_id || !job_type) {
      throw new AppError(ErrorCodes.MISSING_REQUIRED_FIELD, 'Missing profile_id or job_type.', 400);
    }

    if (!['SYNC_FOLLOWERS', 'SYNC_MEDIA', 'SYNC_STORIES', 'DERIVE_METRICS'].includes(job_type)) {
      throw new AppError(ErrorCodes.INVALID_INPUT, `Invalid job_type: ${job_type}`, 400);
    }

    await validateProfileOwnership(profile_id, userId);

    const jobPayload: SyncJobPayload = {
      profile_id,
      user_id: userId,
      job_type,
    };

    const job = await enqueueJob(jobPayload);

    return new Response(
      JSON.stringify({ success: true, job_id: job.id, status: job.status }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 202, // Accepted
      }
    );
  } catch (error) {
    const appError = error instanceof AppError ? error : new AppError(ErrorCodes.INTERNAL_SERVER_ERROR, error.message, 500);
    return new Response(
      JSON.stringify({ success: false, error: appError.message, code: appError.code }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: appError.statusCode,
      }
    );
  }
});
