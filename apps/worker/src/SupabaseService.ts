import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  SyncJob,
  Profile,
  IGSession,
  AppError,
  ErrorCodes,
  DecryptedSessionPayload,
  EncryptedSessionPayload,
  createLogger,
} from '@ig-analytics/shared';
import { EncryptionService } from './EncryptionService';

const logger = createLogger('SupabaseService');

/**
 * Service class to handle all Supabase interactions for the worker.
 * Uses the Service Role Key for elevated permissions.
 */
export class SupabaseService {
  public supabase: SupabaseClient;
  private encryptionService: EncryptionService;

  constructor(supabaseUrl: string, serviceRoleKey: string, encryptionKey: string) {
    this.supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    this.encryptionService = new EncryptionService(encryptionKey);
  }

  // ============================================
  // Sync Job Management
  // ============================================

  /**
   * Fetches the next pending job for the worker to process.
   * Uses a transaction-like approach to mark the job as RUNNING immediately.
   */
  public async getNextPendingJob(): Promise<SyncJob | null> {
    // NOTE: In a real-world scenario, this should be done via a PostgreSQL function
    // with a `FOR UPDATE SKIP LOCKED` clause to ensure atomicity and prevent race conditions.
    // For this MVP, we'll use a simple select/update, which is prone to race conditions
    // but demonstrates the flow.

    const { data: job, error: selectError } = await this.supabase
      .from('sync_jobs')
      .select('*')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      // PGRST116 is "No rows found"
      throw new AppError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to select pending job: ${selectError.message}`,
        500,
        { details: selectError }
      );
    }

    if (!job) {
      return null;
    }

    // Mark job as running
    const { error: updateError } = await this.supabase
      .from('sync_jobs')
      .update({ status: 'RUNNING', started_at: new Date().toISOString() })
      .eq('id', job.id);

    if (updateError) {
      throw new AppError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to mark job as RUNNING: ${updateError.message}`,
        500,
        { details: updateError }
      );
    }

    return job as SyncJob;
  }

  /**
   * Updates a job's status to COMPLETED or FAILED.
   */
  public async updateJobStatus(
    jobId: string,
    status: 'COMPLETED' | 'FAILED',
    processedItems: number = 0,
    errorMessage: string | null = null
  ): Promise<void> {
    const { error } = await this.supabase
      .from('sync_jobs')
      .update({
        status,
        finished_at: new Date().toISOString(),
        processed_items: processedItems,
        error_message: errorMessage,
      })
      .eq('id', jobId);

    if (error) {
      throw new AppError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to update job status to ${status}: ${error.message}`,
        500,
        { details: error }
      );
    }
  }

  // ============================================
  // Session Management
  // ============================================

  /**
   * Retrieves and decrypts the Instagram session payload.
   */
  public async getDecryptedSession(profileId: string): Promise<DecryptedSessionPayload | null> {
    const { data: session, error } = await this.supabase
      .from('ig_sessions')
      .select('session_payload_encrypted')
      .eq('profile_id', profileId)
      .eq('state', 'VALID')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new AppError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to fetch session: ${error.message}`,
        500,
        { details: error }
      );
    }

    if (!session) {
      return null;
    }

    const encryptedPayload = JSON.parse(session.session_payload_encrypted) as EncryptedSessionPayload;
    return this.encryptionService.decrypt(encryptedPayload);
  }

  /**
   * Encrypts and saves the Instagram session payload.
   */
  public async saveEncryptedSession(
    profileId: string,
    userId: string,
    payload: DecryptedSessionPayload,
    state: IGSession['state'] = 'VALID'
  ): Promise<void> {
    const encryptedPayload = this.encryptionService.encrypt(payload);
    const { error } = await this.supabase
      .from('ig_sessions')
      .upsert(
        {
          profile_id: profileId,
          user_id: userId,
          session_payload_encrypted: JSON.stringify(encryptedPayload),
          last_login_at: new Date().toISOString(),
          state,
        },
        { onConflict: 'profile_id' }
      );

    if (error) {
      throw new AppError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to save encrypted session: ${error.message}`,
        500,
        { details: error }
      );
    }
  }

  /**
   * Updates the profile's connection state.
   */
  public async updateProfileState(
    profileId: string,
    state: Profile['connection_state']
  ): Promise<void> {
    logger.info(`[SupabaseService] Updating profile ${profileId} to state: ${state}`);
    const { error } = await this.supabase
      .from('profiles')
      .update({ connection_state: state, updated_at: new Date().toISOString() })
      .eq('id', profileId);

    if (error) {
      logger.error(`[SupabaseService] Failed to update profile state:`, error);
      throw new AppError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to update profile state: ${error.message}`,
        500,
        { details: error }
      );
    }
    logger.info(`[SupabaseService] Profile ${profileId} successfully updated to ${state}`);
  }

  // ============================================
  // Data Synchronization (Placeholders)
  // ============================================

  public async syncFollowers(profileId: string, userId: string, followerData: any[]): Promise<number> {
    // TODO: Implement logic to calculate diffs and update 'followers' and 'followers_snapshots'
    // For MVP, just a placeholder to show the flow.
    console.log(`Syncing ${followerData.length} followers for profile ${profileId}`);
    return followerData.length;
  }

  public async syncMedia(profileId: string, userId: string, mediaData: any[]): Promise<number> {
    // TODO: Implement logic to upsert 'media' and 'media_metrics'
    console.log(`Syncing ${mediaData.length} media items for profile ${profileId}`);
    return mediaData.length;
  }

  public async deriveMetrics(profileId: string, userId: string): Promise<void> {
    console.log(`Deriving metrics for profile ${profileId}`);
    
    try {
      // Get profile data
      const { data: profile, error: profileError } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (profileError || !profile) {
        throw new Error(`Profile not found: ${profileError?.message}`);
      }

      // Get followers data
      const { data: followers, error: followersError } = await this.supabase
        .from('followers')
        .select('*')
        .eq('profile_id', profileId);

      if (followersError) {
        console.error('Error fetching followers:', followersError);
      }

      // Get media data
      const { data: media, error: mediaError } = await this.supabase
        .from('media')
        .select('*')
        .eq('profile_id', profileId);

      if (mediaError) {
        console.error('Error fetching media:', mediaError);
      }

      const today = new Date().toISOString().split('T')[0];
      
      // Calculate total engagement from media
      const totalLikes = media?.reduce((sum, m) => sum + (m.likes_count || 0), 0) || 0;
      const totalComments = media?.reduce((sum, m) => sum + (m.comments_count || 0), 0) || 0;
      const totalEngagement = totalLikes + totalComments;
      
      // Calculate engagement rate
      const postsCount = media?.length || 0;
      const followersCount = profile.followers_count || 0;
      const engagementRate = followersCount > 0 && postsCount > 0
        ? ((totalEngagement / postsCount) / followersCount) * 100
        : 0;

      // Get previous day's insight to calculate growth
      const { data: previousInsights } = await this.supabase
        .from('profile_insights_daily')
        .select('*')
        .eq('profile_id', profileId)
        .order('date', { ascending: false })
        .limit(1);

      const previousFollowersCount = previousInsights?.[0]?.followers_count || followersCount;
      const followersGrowth = followersCount - previousFollowersCount;

      // Insert today's metrics
      const { error: insertError } = await this.supabase
        .from('profile_insights_daily')
        .upsert({
          profile_id: profileId,
          user_id: userId,
          date: today,
          followers_count: followersCount,
          followers_growth: followersGrowth,
          engagement_rate: engagementRate,
          reach: 0, // Instagram doesn't provide this via scraping
          impressions: 0, // Instagram doesn't provide this via scraping
        }, {
          onConflict: 'profile_id,date',
        });

      if (insertError) {
        throw new Error(`Failed to insert insights: ${insertError.message}`);
      }

      console.log(`✅ Metrics derived successfully for ${profile.ig_username}`);
      console.log(`   Followers: ${followersCount} (${followersGrowth >= 0 ? '+' : ''}${followersGrowth})`);
      console.log(`   Following: ${profile.following_count || 0}`);
      console.log(`   Posts: ${postsCount}`);
      console.log(`   Engagement Rate: ${engagementRate.toFixed(2)}%`);

      // Calculate hashtag metrics
      if (media && media.length > 0) {
        const hashtagStats = new Map<string, { count: number; totalLikes: number; totalComments: number }>();

        media.forEach((post) => {
          const hashtags = post.hashtags || [];
          const likes = post.likes_count || 0;
          const comments = post.comments_count || 0;

          hashtags.forEach((tag: string) => {
            const current = hashtagStats.get(tag) || { count: 0, totalLikes: 0, totalComments: 0 };
            hashtagStats.set(tag, {
              count: current.count + 1,
              totalLikes: current.totalLikes + likes,
              totalComments: current.totalComments + comments,
            });
          });
        });

        // Insert top hashtags
        const hashtagMetrics = Array.from(hashtagStats.entries()).map(([tag, stats]) => ({
          profile_id: profileId,
          hashtag: tag,
          posts_count: stats.count,
          avg_likes: stats.totalLikes / stats.count,
          avg_comments: stats.totalComments / stats.count,
          avg_engagement_rate: ((stats.totalLikes + stats.totalComments) / stats.count / followersCount) * 100,
        }));

        if (hashtagMetrics.length > 0) {
          // Delete old hashtag metrics first
          await this.supabase
            .from('hashtags_metrics')
            .delete()
            .eq('profile_id', profileId);

          // Insert new metrics
          const { error: hashtagError } = await this.supabase
            .from('hashtags_metrics')
            .insert(hashtagMetrics);

          if (hashtagError) {
            console.error('Error inserting hashtag metrics:', hashtagError);
          } else {
            console.log(`   Hashtags analyzed: ${hashtagMetrics.length}`);
          }
        }
      }
    } catch (error) {
      console.error('Error deriving metrics:', error);
      throw error;
    }
  }
}
