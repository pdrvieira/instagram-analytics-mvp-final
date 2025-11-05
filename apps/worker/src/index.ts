import 'dotenv/config';
import { SupabaseService } from './SupabaseService';
import { InstagramClient } from './InstagramClient';
import { AppError, ErrorCodes, SyncJob, createLogger, sleep } from '@ig-analytics/shared';

const logger = createLogger('Worker');

// Environment variables
const SUPABASE_URL = process.env.WORKER_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.WORKER_SUPABASE_SERVICE_ROLE;
const ENCRYPTION_KEY = process.env.WORKER_ENCRYPTION_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ENCRYPTION_KEY) {
  logger.error('Missing required environment variables. Check .env.example.');
  process.exit(1);
}

const supabaseService = new SupabaseService(SUPABASE_URL, SERVICE_ROLE_KEY, ENCRYPTION_KEY);

/**
 * Main job processing function.
 * @param job The SyncJob to process.
 */
async function processJob(job: SyncJob): Promise<void> {
  logger.info(`Processing job: ${job.job_type} for profile ${job.profile_id}`);
  let client: InstagramClient | null = null;
  let processedItems = 0;
  let errorMessage: string | null = null;
  let jobStatus: 'COMPLETED' | 'FAILED' = 'COMPLETED';

  try {
    client = new InstagramClient();

    switch (job.job_type) {
      case 'LOGIN':
        {
          const { username, password, two_fa_code } = job.metadata as any;
          if (!username || !password) {
            throw new AppError(ErrorCodes.INVALID_INPUT, 'Missing username or password in job metadata.', 400);
          }

          const sessionPayload = await client.login(username, password, two_fa_code);
          await supabaseService.saveEncryptedSession(job.profile_id, job.user_id, sessionPayload, 'VALID');
          await supabaseService.updateProfileState(job.profile_id, 'CONNECTED');
          logger.info('LOGIN job completed successfully. Session saved.');
          
          // Automatically create sync jobs after successful login
          logger.info('[Worker] Creating automatic sync jobs after login...');
          
          const syncJobs = [
            { job_type: 'SYNC_PROFILE', priority: 1 },
            { job_type: 'SYNC_FOLLOWERS', priority: 2 },
            { job_type: 'SYNC_MEDIA', priority: 3 },
            { job_type: 'DERIVE_METRICS', priority: 4 },
          ];

          for (const syncJob of syncJobs) {
            await supabaseService.supabase.from('sync_jobs').insert({
              profile_id: job.profile_id,
              user_id: job.user_id,
              job_type: syncJob.job_type as any,
              status: 'PENDING',
              metadata: {},
            });
          }
          
          logger.info('[Worker] Automatic sync jobs created successfully');
        }
        break;

      case 'RECONNECT':
        {
          // TODO: Implement RECONNECT logic (e.g., try to re-login with saved credentials if possible)
          // For now, we'll just try to check the session.
          const sessionPayload = await supabaseService.getDecryptedSession(job.profile_id);
          if (!sessionPayload) {
            throw new AppError(ErrorCodes.SESSION_EXPIRED, 'No valid session found for reconnection.', 401);
          }
          const isValid = await client.checkSession(sessionPayload);
          if (!isValid) {
            await supabaseService.updateProfileState(job.profile_id, 'EXPIRED');
            throw new AppError(ErrorCodes.SESSION_EXPIRED, 'Session check failed. Session is expired.', 401);
          }
          logger.info('RECONNECT job completed successfully. Session is still valid.');
        }
        break;

      case 'SYNC_PROFILE':
        {
          const profile = await supabaseService.supabase.from('profiles').select('ig_username').eq('id', job.profile_id).single();
          if (profile.error || !profile.data) {
            throw new AppError(ErrorCodes.NOT_FOUND, 'Profile not found.', 404);
          }

          const sessionPayload = await supabaseService.getDecryptedSession(job.profile_id);
          if (!sessionPayload) {
            await supabaseService.updateProfileState(job.profile_id, 'EXPIRED');
            throw new AppError(ErrorCodes.SESSION_EXPIRED, 'Session expired. Cannot sync profile.', 401);
          }
          await client.initBrowser(sessionPayload, false); // headless mode for scraping

          const profileData = await client.scrapeProfile(profile.data.ig_username);
          
          logger.info(`[Worker] Scraped profile data:`, {
            username: profileData.username,
            followers: profileData.followers_count,
            following: profileData.following_count,
            posts: profileData.media_count,
          });
          
          // Update profile with scraped data
          const { error: updateError } = await supabaseService.supabase
            .from('profiles')
            .update({
              ig_user_id: profileData.username, // Use username as fallback for ID
              followers_count: profileData.followers_count,
              following_count: profileData.following_count,
              bio: profileData.bio,
              profile_pic_url: profileData.profile_pic_url,
              is_verified: profileData.is_verified,
              last_sync_at: new Date().toISOString(),
            })
            .eq('id', job.profile_id);

          if (updateError) {
            logger.error('[Worker] Failed to update profile data', updateError);
            throw new AppError(ErrorCodes.DATABASE_ERROR, 'Failed to save profile data', 500);
          }

          processedItems = 1;
          logger.info(`[Worker] ✅ Profile ${profile.data.ig_username} synced: ${profileData.followers_count} followers, ${profileData.following_count} following, ${profileData.media_count} posts`);
        }
        break;

      case 'SYNC_FOLLOWERS':
        {
          const profile = await supabaseService.supabase.from('profiles').select('ig_username').eq('id', job.profile_id).single();
          if (profile.error || !profile.data) {
            throw new AppError(ErrorCodes.NOT_FOUND, 'Profile not found.', 404);
          }

          const sessionPayload = await supabaseService.getDecryptedSession(job.profile_id);
          if (!sessionPayload) {
            await supabaseService.updateProfileState(job.profile_id, 'EXPIRED');
            throw new AppError(ErrorCodes.SESSION_EXPIRED, 'Session expired. Cannot sync followers.', 401);
          }
          await client.initBrowser(sessionPayload, false); // headless mode for scraping

          const { followers, following } = await client.scrapeFollowers(profile.data.ig_username);
          processedItems = await supabaseService.syncFollowers(job.profile_id, job.user_id, [...followers, ...following]);
        }
        break;

      case 'SYNC_MEDIA':
        {
          const profile = await supabaseService.supabase.from('profiles').select('ig_username').eq('id', job.profile_id).single();
          if (profile.error || !profile.data) {
            throw new AppError(ErrorCodes.NOT_FOUND, 'Profile not found.', 404);
          }

          const sessionPayload = await supabaseService.getDecryptedSession(job.profile_id);
          if (!sessionPayload) {
            await supabaseService.updateProfileState(job.profile_id, 'EXPIRED');
            throw new AppError(ErrorCodes.SESSION_EXPIRED, 'Session expired. Cannot sync media.', 401);
          }
          await client.initBrowser(sessionPayload, false); // headless mode for scraping

          const mediaData = await client.scrapeMedia(profile.data.ig_username);
          processedItems = await supabaseService.syncMedia(job.profile_id, job.user_id, mediaData);
        }
        break;

      case 'DERIVE_METRICS':
        {
          await supabaseService.deriveMetrics(job.profile_id, job.user_id);
          processedItems = 1; // Represents one profile's metrics derived
        }
        break;

      default:
        throw new AppError(ErrorCodes.INVALID_INPUT, `Unknown job type: ${job.job_type}`, 400);
    }
  } catch (error) {
    jobStatus = 'FAILED';
    if (error instanceof AppError) {
      errorMessage = `${error.code}: ${error.message}`;
      if (error.code === ErrorCodes.IG_2FA_REQUIRED) {
        logger.info(`[Worker] Updating profile ${job.profile_id} to NEEDS_2FA state`);
        await supabaseService.updateProfileState(job.profile_id, 'NEEDS_2FA');
        logger.info(`[Worker] Profile ${job.profile_id} updated to NEEDS_2FA - browser will REMAIN OPEN`);
        // CRITICAL: Do NOT close browser when 2FA is pending - user needs to complete it manually
      } else if (error.code === ErrorCodes.SESSION_EXPIRED) {
        await supabaseService.updateProfileState(job.profile_id, 'EXPIRED');
      }
    } else {
      errorMessage = `Internal Error: ${error instanceof Error ? error.message : String(error)}`;
    }
    logger.error(`Job ${job.id} FAILED: ${errorMessage}`, error);
  } finally {
    // Only close the browser if it's NOT a LOGIN job that needs 2FA
    // For 2FA cases, the browser must stay open for manual completion
    const is2FACase = errorMessage?.includes('IG_2FA_REQUIRED');
    
    if (client && !is2FACase) {
      logger.info('[Worker] Closing browser (job completed or non-2FA error)');
      await client.close();
    } else if (is2FACase) {
      logger.info('[Worker] ⚠️  Browser left OPEN for manual 2FA completion');
      logger.info('[Worker] ⚠️  Complete the 2FA in the browser, then submit code via frontend');
    }
    
    await supabaseService.updateJobStatus(job.id, jobStatus, processedItems, errorMessage);
    logger.info(`Job ${job.id} finished with status: ${jobStatus}`);
  }
}

/**
 * Main worker loop. Polls for new jobs.
 */
async function workerLoop() {
  logger.info('Worker started. Polling for jobs...');
  // NOTE: In a production environment, a message queue (e.g., Redis, SQS) or a
  // Supabase Realtime subscription would be used instead of polling.
  const POLLING_INTERVAL_MS = 5000;

  while (true) {
    try {
      logger.info('Checking for pending jobs...');
      const job = await supabaseService.getNextPendingJob();

      if (job) {
        logger.info(`Found job: ${job.id} - ${job.job_type}`);
        await processJob(job);
      } else {
        logger.info('No pending jobs found. Sleeping...');
      }
    } catch (error) {
      logger.error('Error in worker loop:', error);
      // Prevent a tight loop on persistent errors
      await sleep(POLLING_INTERVAL_MS * 2);
    }

    await sleep(POLLING_INTERVAL_MS);
  }
}

workerLoop();
