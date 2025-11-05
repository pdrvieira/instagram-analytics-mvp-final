import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { enqueueJob, getUserId, validateProfileOwnership } from './jobQueue.ts';
import { AppError, ErrorCodes, LoginJobPayload } from '@ig-analytics/shared';

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
    const { profile_id, two_fa_code } = await req.json();

    if (!profile_id || !two_fa_code) {
      throw new AppError(ErrorCodes.MISSING_REQUIRED_FIELD, 'Missing profile_id or two_fa_code.', 400);
    }

    await validateProfileOwnership(profile_id, userId);

    // NOTE: This assumes the initial LOGIN job failed with NEEDS_2FA and the
    // worker is waiting for a new job to be enqueued with the 2FA code.
    // In a real-world scenario, the worker would be polling for an update to the existing job.
    // For this MVP, we'll enqueue a new job with the 2FA code and the worker will handle it.

    // To avoid storing the password in the database, we'll need to fetch the original job
    // and update its metadata, or the worker needs to be smart enough to look up the
    // profile's stored credentials (which is not implemented in the worker MVP).
    // For simplicity, we'll assume the worker will handle the 2FA step on its own
    // after the initial login attempt failed and the profile state was set to NEEDS_2FA.

    // For the MVP, we'll enqueue a RECONNECT job with the 2FA code, assuming the worker
    // will use the stored session and just needs the code to complete the login.
    const jobPayload: LoginJobPayload = {
      profile_id,
      user_id: userId,
      job_type: 'RECONNECT', // Using RECONNECT as a proxy for completing the login flow
      metadata: { two_fa_code },
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
