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
  // Data Synchronization
  // ============================================

  /**
   * Syncs followers and following data, calculates who follows back
   */
  public async syncFollowers(
    profileId: string, 
    userId: string, 
    followersData: Array<{
      ig_id: string;
      username: string;
      full_name: string | null;
      is_private: boolean;
      is_verified: boolean;
      profile_pic_url: string | null;
    }>,
    followingData: Array<{
      ig_id: string;
      username: string;
      full_name: string | null;
      is_private: boolean;
      is_verified: boolean;
      profile_pic_url: string | null;
    }>
  ): Promise<number> {
    logger.info(`[SupabaseService] Syncing ${followersData.length} followers and ${followingData.length} following for profile ${profileId}`);

    try {
      // Get current followers to detect changes
      const { data: currentFollowers, error: fetchError } = await this.supabase
        .from('followers')
        .select('follower_ig_id, follower_username, is_follower, is_following')
        .eq('profile_id', profileId);

      if (fetchError) {
        logger.error(`[SupabaseService] Error fetching current followers:`, fetchError);
      }

      const currentFollowerIds = new Set(currentFollowers?.filter(f => f.is_follower).map(f => f.follower_ig_id) || []);
      const currentFollowingIds = new Set(currentFollowers?.filter(f => f.is_following).map(f => f.follower_ig_id) || []);
      
      // Create sets for easy lookup
      const newFollowerIds = new Set(followersData.map(f => f.ig_id));
      const newFollowingIds = new Set(followingData.map(f => f.ig_id));

      // Combine all unique users (followers + following)
      const allUsersMap = new Map<string, {
        ig_id: string;
        username: string;
        full_name: string | null;
        is_private: boolean;
        is_verified: boolean;
        profile_pic_url: string | null;
        is_follower: boolean;
        is_following: boolean;
        is_following_back: boolean;
      }>();

      // Add all followers
      followersData.forEach(follower => {
        allUsersMap.set(follower.ig_id, {
          ...follower,
          is_follower: true,
          is_following: newFollowingIds.has(follower.ig_id),
          is_following_back: newFollowingIds.has(follower.ig_id),
        });
      });

      // Add all following (merge with followers if already exists)
      followingData.forEach(following => {
        const existing = allUsersMap.get(following.ig_id);
        if (existing) {
          existing.is_following = true;
          existing.is_following_back = true;
        } else {
          allUsersMap.set(following.ig_id, {
            ...following,
            is_follower: false,
            is_following: true,
            is_following_back: false,
          });
        }
      });

      // Prepare data for upsert
      const followersToUpsert = Array.from(allUsersMap.values()).map(user => ({
        profile_id: profileId,
        user_id: userId,
        follower_ig_id: user.ig_id,
        follower_username: user.username,
        follower_name: user.full_name,
        follower_pic_url: user.profile_pic_url,
        is_verified: user.is_verified,
        is_private: user.is_private,
        is_follower: user.is_follower,
        is_following: user.is_following,
        is_following_back: user.is_following_back,
        updated_at: new Date().toISOString(),
      }));

      // Batch upsert (Supabase limits to 1000 rows per request)
      const BATCH_SIZE = 1000;
      for (let i = 0; i < followersToUpsert.length; i += BATCH_SIZE) {
        const batch = followersToUpsert.slice(i, i + BATCH_SIZE);
        const { error: upsertError } = await this.supabase
          .from('followers')
          .upsert(batch, {
            onConflict: 'profile_id,follower_ig_id',
          });

        if (upsertError) {
          logger.error(`[SupabaseService] Error upserting followers batch ${i}:`, upsertError);
          throw new Error(`Failed to upsert followers: ${upsertError.message}`);
        }

        logger.info(`[SupabaseService] Upserted batch ${i + 1}-${Math.min(i + BATCH_SIZE, followersToUpsert.length)} of ${followersToUpsert.length}`);
      }

      // Detect changes (new followers, unfollows)
      const newFollowersList = Array.from(newFollowerIds).filter(id => !currentFollowerIds.has(id));
      const lostFollowersList = Array.from(currentFollowerIds).filter(id => !newFollowerIds.has(id));
      const newFollowingList = Array.from(newFollowingIds).filter(id => !currentFollowingIds.has(id));
      const stoppedFollowingList = Array.from(currentFollowingIds).filter(id => !newFollowingIds.has(id));

      logger.info(`[SupabaseService] Changes detected:`);
      logger.info(`  New followers: ${newFollowersList.length}`);
      logger.info(`  Lost followers: ${lostFollowersList.length}`);
      logger.info(`  New following: ${newFollowingList.length}`);
      logger.info(`  Stopped following: ${stoppedFollowingList.length}`);

      // Record changes in follower_changes table
      const changes: Array<{
        profile_id: string;
        user_id: string;
        follower_ig_id: string;
        follower_username: string;
        change_type: string;
      }> = [];

      newFollowersList.forEach(igId => {
        const user = allUsersMap.get(igId);
        if (user) {
          changes.push({
            profile_id: profileId,
            user_id: userId,
            follower_ig_id: igId,
            follower_username: user.username,
            change_type: 'NEW_FOLLOWER',
          });
        }
      });

      lostFollowersList.forEach(igId => {
        const existing = currentFollowers?.find(f => f.follower_ig_id === igId);
        if (existing) {
          changes.push({
            profile_id: profileId,
            user_id: userId,
            follower_ig_id: igId,
            follower_username: existing.follower_username || igId,
            change_type: 'UNFOLLOWED',
          });
        }
      });

      newFollowingList.forEach(igId => {
        const user = allUsersMap.get(igId);
        if (user) {
          changes.push({
            profile_id: profileId,
            user_id: userId,
            follower_ig_id: igId,
            follower_username: user.username,
            change_type: 'STARTED_FOLLOWING',
          });
        }
      });

      stoppedFollowingList.forEach(igId => {
        const existing = currentFollowers?.find(f => f.follower_ig_id === igId);
        if (existing) {
          changes.push({
            profile_id: profileId,
            user_id: userId,
            follower_ig_id: igId,
            follower_username: existing.follower_username || igId,
            change_type: 'STOPPED_FOLLOWING',
          });
        }
      });

      if (changes.length > 0) {
        const { error: changesError } = await this.supabase
          .from('follower_changes')
          .insert(changes);

        if (changesError) {
          logger.error(`[SupabaseService] Error recording follower changes:`, changesError);
        } else {
          logger.info(`[SupabaseService] Recorded ${changes.length} follower change events`);
        }
      }

      // Create snapshot
      const nonFollowersCount = Array.from(allUsersMap.values()).filter(u => u.is_following && !u.is_follower).length;

      const { error: snapshotError } = await this.supabase
        .from('followers_snapshots')
        .insert({
          profile_id: profileId,
          user_id: userId,
          total_followers: followersData.length,
          total_following: followingData.length,
          new_followers: newFollowersList.length,
          lost_followers: lostFollowersList.length,
          non_followers: nonFollowersCount,
          snapshot_data: {
            follower_ids: Array.from(newFollowerIds),
            following_ids: Array.from(newFollowingIds),
          },
        });

      if (snapshotError) {
        logger.error(`[SupabaseService] Error creating snapshot:`, snapshotError);
      }

      logger.info(`[SupabaseService] ✅ Successfully synced ${followersToUpsert.length} total users (followers + following)`);
      return followersToUpsert.length;

    } catch (error) {
      logger.error(`[SupabaseService] Failed to sync followers:`, error);
      throw error;
    }
  }

  /**
   * Syncs media posts with hashtags, mentions, and engagement metrics
   */
  public async syncMedia(
    profileId: string, 
    userId: string, 
    mediaData: Array<{
      media_id: string;
      shortcode: string;
      media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL';
      caption_text: string | null;
      hashtags: string[];
      mentions: string[];
      timestamp: string;
      media_url: string | null;
      likes_count: number;
      comments_count: number;
      video_views: number | null;
    }>
  ): Promise<number> {
    logger.info(`[SupabaseService] Syncing ${mediaData.length} media items for profile ${profileId}`);

    try {
      // Prepare media data for upsert
      const mediaToUpsert = mediaData.map(media => ({
        profile_id: profileId,
        user_id: userId,
        ig_media_id: media.media_id,
        shortcode: media.shortcode,
        media_type: media.media_type,
        caption: media.caption_text,
        hashtags: media.hashtags,
        mentions: media.mentions,
        media_url: media.media_url,
        permalink: `https://www.instagram.com/p/${media.shortcode}/`,
        likes_count: media.likes_count,
        comments_count: media.comments_count,
        video_views: media.video_views,
        timestamp: media.timestamp,
        updated_at: new Date().toISOString(),
      }));

      // Batch upsert
      const BATCH_SIZE = 500;
      let totalInserted = 0;

      for (let i = 0; i < mediaToUpsert.length; i += BATCH_SIZE) {
        const batch = mediaToUpsert.slice(i, i + BATCH_SIZE);
        const { error: upsertError } = await this.supabase
          .from('media')
          .upsert(batch, {
            onConflict: 'ig_media_id',
          });

        if (upsertError) {
          logger.error(`[SupabaseService] Error upserting media batch ${i}:`, upsertError);
          throw new Error(`Failed to upsert media: ${upsertError.message}`);
        }

        totalInserted += batch.length;
        logger.info(`[SupabaseService] Upserted batch ${i + 1}-${Math.min(i + BATCH_SIZE, mediaToUpsert.length)} of ${mediaToUpsert.length}`);
      }

      logger.info(`[SupabaseService] ✅ Successfully synced ${totalInserted} media items`);
      return totalInserted;

    } catch (error) {
      logger.error(`[SupabaseService] Failed to sync media:`, error);
      throw error;
    }
  }

  /**
   * Derives aggregated metrics from raw data (daily insights, hashtags, etc)
   */
  public async deriveMetrics(profileId: string, userId: string): Promise<void> {
    logger.info(`[SupabaseService] Deriving metrics for profile ${profileId}`);
    
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
        logger.error('[SupabaseService] Error fetching followers:', followersError);
      }

      // Get media data
      const { data: media, error: mediaError } = await this.supabase
        .from('media')
        .select('*')
        .eq('profile_id', profileId);

      if (mediaError) {
        logger.error('[SupabaseService] Error fetching media:', mediaError);
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

      logger.info(`[SupabaseService] ✅ Daily insights saved successfully`);
      logger.info(`   Followers: ${followersCount} (${followersGrowth >= 0 ? '+' : ''}${followersGrowth})`);
      logger.info(`   Following: ${profile.following_count || 0}`);
      logger.info(`   Posts: ${postsCount}`);
      logger.info(`   Engagement Rate: ${engagementRate.toFixed(2)}%`);

      // Calculate hashtag metrics
      if (media && media.length > 0) {
        logger.info(`[SupabaseService] Calculating hashtag metrics from ${media.length} posts...`);
        
        const hashtagStats = new Map<string, { 
          count: number; 
          totalLikes: number; 
          totalComments: number;
          firstUsed: Date;
          lastUsed: Date;
        }>();

        media.forEach((post) => {
          const hashtags: string[] = post.hashtags || [];
          const likes = post.likes_count || 0;
          const comments = post.comments_count || 0;
          const postDate = new Date(post.timestamp);

          hashtags.forEach((tag: string) => {
            const cleanTag = tag.startsWith('#') ? tag : `#${tag}`;
            const current = hashtagStats.get(cleanTag);
            
            if (current) {
              hashtagStats.set(cleanTag, {
                count: current.count + 1,
                totalLikes: current.totalLikes + likes,
                totalComments: current.totalComments + comments,
                firstUsed: postDate < current.firstUsed ? postDate : current.firstUsed,
                lastUsed: postDate > current.lastUsed ? postDate : current.lastUsed,
              });
            } else {
              hashtagStats.set(cleanTag, {
                count: 1,
                totalLikes: likes,
                totalComments: comments,
                firstUsed: postDate,
                lastUsed: postDate,
              });
            }
          });
        });

        // Prepare hashtag metrics for insertion
        const hashtagMetrics = Array.from(hashtagStats.entries()).map(([tag, stats]) => {
          const totalEngagement = stats.totalLikes + stats.totalComments;
          return {
            profile_id: profileId,
            user_id: userId,
            hashtag: tag,
            usage_count: stats.count,
            total_engagement: totalEngagement,
            avg_engagement: totalEngagement / stats.count,
            first_used: stats.firstUsed.toISOString(),
            last_used: stats.lastUsed.toISOString(),
          };
        });

        if (hashtagMetrics.length > 0) {
          // Delete old hashtag metrics first
          await this.supabase
            .from('hashtags_metrics')
            .delete()
            .eq('profile_id', profileId);

          // Insert new metrics in batches
          const BATCH_SIZE = 500;
          for (let i = 0; i < hashtagMetrics.length; i += BATCH_SIZE) {
            const batch = hashtagMetrics.slice(i, i + BATCH_SIZE);
            const { error: hashtagError } = await this.supabase
              .from('hashtags_metrics')
              .insert(batch);

            if (hashtagError) {
              logger.error('[SupabaseService] Error inserting hashtag metrics batch:', hashtagError);
            }
          }

          logger.info(`[SupabaseService] ✅ Analyzed ${hashtagMetrics.length} unique hashtags`);
          
          // Log top 5 hashtags
          const top5 = hashtagMetrics
            .sort((a, b) => b.total_engagement - a.total_engagement)
            .slice(0, 5);
          
          logger.info(`[SupabaseService] Top 5 hashtags by engagement:`);
          top5.forEach((tag, idx) => {
            logger.info(`   ${idx + 1}. ${tag.hashtag} - ${tag.total_engagement} engagement (used ${tag.usage_count}x)`);
          });
        }
      }
    } catch (error) {
      logger.error('[SupabaseService] Error deriving metrics:', error);
      throw error;
    }
  }
}
