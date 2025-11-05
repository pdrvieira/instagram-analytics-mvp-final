const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://haaxnjudbfqbpnqnlwvc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhYXhuanVkYmZxYnBucW5sd3ZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTI1NDk4NCwiZXhwIjoyMDQ2ODMwOTg0fQ.EwJH1fwc_1RGX4Nc4Q1vt6YCJVy45d9KaXgLo2Y8iJo'
);

(async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, user_id, ig_username, connection_state')
    .eq('connection_state', 'CONNECTED')
    .single();
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Profile found:', JSON.stringify(data, null, 2));
  
  // Create sync jobs
  const jobs = [
    { job_type: 'SYNC_PROFILE' },
    { job_type: 'SYNC_FOLLOWERS' },
    { job_type: 'SYNC_MEDIA' },
    { job_type: 'DERIVE_METRICS' },
  ];
  
  for (const job of jobs) {
    const { error: jobError } = await supabase.from('sync_jobs').insert({
      profile_id: data.id,
      user_id: data.user_id,
      job_type: job.job_type,
      status: 'PENDING',
      metadata: {},
    });
    
    if (jobError) {
      console.error('Error creating job:', job.job_type, jobError);
    } else {
      console.log('✓ Created job:', job.job_type);
    }
  }
  
  console.log('\n✅ All sync jobs created! Worker will process them automatically.');
  process.exit(0);
})();
