import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { getUserId, validateProfileOwnership } from './jobQueue.ts';
import { AppError, ErrorCodes } from '@ig-analytics/shared';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Supabase client for Edge Functions
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
 * Generates a signed URL for a file in the 'exports' bucket.
 * NOTE: The actual file generation (CSV/XLSX) is a complex task that should be
 * offloaded to the worker or a dedicated service. For this MVP, this function
 * simulates the process by checking for a file and generating a signed URL.
 */
async function generateSignedUrl(profileId: string, fileType: 'csv' | 'xlsx'): Promise<string> {
  // In a real implementation, the worker would generate the file and save it to storage.
  // We'll assume a file exists with a predictable name.
  const filePath = `${profileId}/export_${new Date().toISOString().split('T')[0]}.${fileType}`;

  // Simulate file creation if it doesn't exist (for testing the signed URL part)
  // In production, this would be a check for an existing file.
  const { error: uploadError } = await supabase.storage
    .from('exports')
    .upload(filePath, new TextEncoder().encode('Simulated Export Data'), {
      contentType: 'text/plain',
      upsert: true,
    });

  if (uploadError) {
    throw new AppError(ErrorCodes.INTERNAL_SERVER_ERROR, `Failed to simulate file upload: ${uploadError.message}`, 500);
  }

  // Generate the signed URL, valid for 15 minutes (900 seconds)
  const { data, error } = await supabase.storage
    .from('exports')
    .createSignedUrl(filePath, 900);

  if (error) {
    throw new AppError(ErrorCodes.INTERNAL_SERVER_ERROR, `Failed to create signed URL: ${error.message}`, 500);
  }

  return data.signedUrl;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const userId = await getUserId(req);
    const { profile_id, format } = await req.json();

    if (!profile_id || !format) {
      throw new AppError(ErrorCodes.MISSING_REQUIRED_FIELD, 'Missing profile_id or format.', 400);
    }

    if (format !== 'csv' && format !== 'xlsx') {
      throw new AppError(ErrorCodes.INVALID_INPUT, 'Invalid export format. Must be "csv" or "xlsx".', 400);
    }

    await validateProfileOwnership(profile_id, userId);

    // The actual data generation is complex and should be a job for the worker.
    // For this MVP, we'll simulate the worker having already generated the file
    // and just generate the signed URL for the client to download.
    const signedUrl = await generateSignedUrl(profile_id, format);

    return new Response(
      JSON.stringify({ success: true, signed_url: signedUrl }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
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
