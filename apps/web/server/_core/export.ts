import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Converts data to CSV format
 */
function arrayToCSV(data: any[], headers: string[]): string {
  const csvRows: string[] = [];
  
  // Add headers
  csvRows.push(headers.join(','));
  
  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // Escape quotes and wrap in quotes if contains comma or newline
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

/**
 * Export followers data to CSV
 */
export async function exportFollowersToCSV(
  supabase: SupabaseClient,
  profileId: string,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('followers')
    .select('*')
    .eq('profile_id', profileId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const headers = [
    'follower_username',
    'follower_name',
    'follower_ig_id',
    'is_verified',
    'is_private',
    'is_follower',
    'is_following',
    'is_following_back',
    'created_at',
  ];

  return arrayToCSV(data || [], headers);
}

/**
 * Export non-followers (accounts you follow but don't follow back)
 */
export async function exportNonFollowersToCSV(
  supabase: SupabaseClient,
  profileId: string,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('followers')
    .select('*')
    .eq('profile_id', profileId)
    .eq('user_id', userId)
    .eq('is_following', true)
    .eq('is_follower', false)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const headers = [
    'follower_username',
    'follower_name',
    'follower_ig_id',
    'is_verified',
    'is_private',
    'created_at',
  ];

  return arrayToCSV(data || [], headers);
}

/**
 * Export follower changes (new followers, unfollows) to CSV
 */
export async function exportFollowerChangesToCSV(
  supabase: SupabaseClient,
  profileId: string,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('follower_changes')
    .select('*')
    .eq('profile_id', profileId)
    .eq('user_id', userId)
    .order('detected_at', { ascending: false })
    .limit(1000); // Limit to last 1000 changes

  if (error) throw error;

  const headers = [
    'follower_username',
    'follower_ig_id',
    'change_type',
    'detected_at',
  ];

  return arrayToCSV(data || [], headers);
}

/**
 * Export media posts to CSV
 */
export async function exportMediaToCSV(
  supabase: SupabaseClient,
  profileId: string,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('media')
    .select('*')
    .eq('profile_id', profileId)
    .eq('user_id', userId)
    .order('timestamp', { ascending: false });

  if (error) throw error;

  const processedData = (data || []).map(post => ({
    ...post,
    hashtags: Array.isArray(post.hashtags) ? post.hashtags.join(' ') : '',
    mentions: Array.isArray(post.mentions) ? post.mentions.join(' ') : '',
  }));

  const headers = [
    'ig_media_id',
    'shortcode',
    'media_type',
    'caption',
    'hashtags',
    'mentions',
    'likes_count',
    'comments_count',
    'video_views',
    'timestamp',
    'permalink',
  ];

  return arrayToCSV(processedData, headers);
}

/**
 * Export hashtag metrics to CSV
 */
export async function exportHashtagsToCSV(
  supabase: SupabaseClient,
  profileId: string,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('hashtags_metrics')
    .select('*')
    .eq('profile_id', profileId)
    .eq('user_id', userId)
    .order('total_engagement', { ascending: false });

  if (error) throw error;

  const headers = [
    'hashtag',
    'usage_count',
    'total_engagement',
    'avg_engagement',
    'first_used',
    'last_used',
  ];

  return arrayToCSV(data || [], headers);
}

/**
 * Export daily insights to CSV
 */
export async function exportInsightsToCSV(
  supabase: SupabaseClient,
  profileId: string,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('profile_insights_daily')
    .select('*')
    .eq('profile_id', profileId)
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(365); // Last year

  if (error) throw error;

  const headers = [
    'date',
    'followers_count',
    'followers_growth',
    'engagement_rate',
    'reach',
    'impressions',
  ];

  return arrayToCSV(data || [], headers);
}
