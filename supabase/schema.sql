-- =================================================================================
-- Supabase Database Schema for Instagram Analytics MVP
-- This script defines all tables, indexes, and Row-Level Security (RLS) policies.
-- =================================================================================

-- Ensure the 'public' schema is used
SET search_path = public;

-- Drop existing tables if they exist (in reverse dependency order)
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS sync_jobs CASCADE;
DROP TABLE IF EXISTS hashtags_metrics CASCADE;
DROP TABLE IF EXISTS profile_insights_daily CASCADE;
DROP TABLE IF EXISTS media_metrics CASCADE;
DROP TABLE IF EXISTS media CASCADE;
DROP TABLE IF EXISTS follower_changes CASCADE;
DROP TABLE IF EXISTS followers_snapshots CASCADE;
DROP TABLE IF EXISTS followers CASCADE;
DROP TABLE IF EXISTS ig_sessions CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 1. Table: profiles
-- Stores user's connected Instagram profile information
CREATE TABLE profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    ig_username text NOT NULL,
    ig_user_id text UNIQUE NOT NULL,
    followers_count integer DEFAULT 0 NOT NULL,
    following_count integer DEFAULT 0 NOT NULL,
    bio text,
    profile_pic_url text,
    is_verified boolean DEFAULT FALSE NOT NULL,
    connection_state text DEFAULT 'DISCONNECTED' NOT NULL, -- VALID, EXPIRED, NEEDS_2FA, DISCONNECTED
    last_sync_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (user_id, ig_username)
);

-- Index for fast lookups by user_id
CREATE INDEX idx_profiles_user_id ON profiles (user_id);

-- RLS: Users can only see and modify their own profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for authenticated users based on user_id"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Allow insert for authenticated users"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow update for authenticated users based on user_id"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow delete for authenticated users based on user_id"
ON profiles FOR DELETE
TO authenticated
USING (auth.uid() = user_id);


-- 2. Table: ig_sessions
-- Stores encrypted Instagram session data
CREATE TABLE ig_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    session_payload_encrypted text NOT NULL, -- Encrypted JSON string of cookies and user agent
    last_login_at timestamp with time zone,
    state text DEFAULT 'INVALID' NOT NULL, -- VALID, EXPIRED, NEEDS_2FA, INVALID
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (profile_id)
);

-- Index for fast lookups by profile_id
CREATE INDEX idx_ig_sessions_profile_id ON ig_sessions (profile_id);

-- RLS: Users can only see and modify their own sessions
ALTER TABLE ig_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for authenticated users based on user_id"
ON ig_sessions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Allow insert for authenticated users"
ON ig_sessions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow update for authenticated users based on user_id"
ON ig_sessions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow delete for authenticated users based on user_id"
ON ig_sessions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);


-- 3. Table: followers
-- Stores the current list of followers and following
CREATE TABLE followers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    follower_ig_id text NOT NULL,
    follower_username text NOT NULL,
    follower_name text,
    follower_pic_url text,
    is_verified boolean DEFAULT FALSE NOT NULL,
    is_private boolean DEFAULT FALSE NOT NULL,
    is_follower boolean DEFAULT FALSE NOT NULL, -- True if this user follows the profile
    is_following boolean DEFAULT FALSE NOT NULL, -- True if the profile is following this user
    is_following_back boolean DEFAULT FALSE NOT NULL, -- True if both follow each other
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (profile_id, follower_ig_id)
);

-- Index for fast lookups by profile_id and follower_ig_id
CREATE INDEX idx_followers_profile_follower ON followers (profile_id, follower_ig_id);

-- RLS: Users can only see and modify their own follower data
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for authenticated users based on user_id"
ON followers FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Allow insert for service role only"
ON followers FOR INSERT
TO service_role
WITH CHECK (TRUE);

CREATE POLICY "Allow update for service role only"
ON followers FOR UPDATE
TO service_role
USING (TRUE)
WITH CHECK (TRUE);

CREATE POLICY "Allow delete for service role only"
ON followers FOR DELETE
TO service_role
USING (TRUE);


-- 4. Table: followers_snapshots
-- Stores historical snapshots for diffing (new/lost/non-followers)
CREATE TABLE followers_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    total_followers integer NOT NULL,
    total_following integer NOT NULL,
    new_followers integer DEFAULT 0 NOT NULL,
    lost_followers integer DEFAULT 0 NOT NULL,
    non_followers integer DEFAULT 0 NOT NULL, -- Following but not following back
    snapshot_data jsonb, -- Store the list of follower IDs for diffing
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 4b. Table: follower_changes
-- Stores individual follower/unfollower events for detailed tracking
CREATE TABLE follower_changes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    follower_ig_id text NOT NULL,
    follower_username text NOT NULL,
    change_type text NOT NULL, -- NEW_FOLLOWER, UNFOLLOWED, STARTED_FOLLOWING, STOPPED_FOLLOWING
    detected_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Index for time-series queries
CREATE INDEX idx_followers_snapshots_profile_captured ON followers_snapshots (profile_id, captured_at DESC);

-- RLS: Users can only see their own snapshot data
ALTER TABLE followers_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for authenticated users based on user_id"
ON followers_snapshots FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Allow insert for service role only"
ON followers_snapshots FOR INSERT
TO service_role
WITH CHECK (TRUE);

CREATE POLICY "Allow delete for service role only"
ON followers_snapshots FOR DELETE
TO service_role
USING (TRUE);

-- Index for follower changes
CREATE INDEX idx_follower_changes_profile_detected ON follower_changes (profile_id, detected_at DESC);

-- RLS: Users can only see their own follower change events
ALTER TABLE follower_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for authenticated users based on user_id"
ON follower_changes FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Allow insert for service role only"
ON follower_changes FOR INSERT
TO service_role
WITH CHECK (TRUE);

CREATE POLICY "Allow delete for service role only"
ON follower_changes FOR DELETE
TO service_role
USING (TRUE);


-- 5. Table: media
-- Stores posts, reels, and stories metadata
CREATE TABLE media (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    ig_media_id text UNIQUE NOT NULL,
    shortcode text NOT NULL,
    media_type text NOT NULL, -- IMAGE, VIDEO, CAROUSEL, STORY
    caption text,
    hashtags text[] DEFAULT ARRAY[]::text[], -- Array of hashtags extracted from caption
    mentions text[] DEFAULT ARRAY[]::text[], -- Array of mentioned usernames
    media_url text,
    permalink text,
    likes_count integer DEFAULT 0 NOT NULL,
    comments_count integer DEFAULT 0 NOT NULL,
    video_views integer,
    timestamp timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Index for fast lookups by profile_id and timestamp
CREATE INDEX idx_media_profile_timestamp ON media (profile_id, timestamp DESC);

-- RLS: Users can only see their own media data
ALTER TABLE media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for authenticated users based on user_id"
ON media FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Allow insert for service role only"
ON media FOR INSERT
TO service_role
WITH CHECK (TRUE);

CREATE POLICY "Allow update for service role only"
ON media FOR UPDATE
TO service_role
USING (TRUE)
WITH CHECK (TRUE);

CREATE POLICY "Allow delete for service role only"
ON media FOR DELETE
TO service_role
USING (TRUE);


-- 6. Table: media_metrics
-- Stores performance metrics for media (can be updated over time)
CREATE TABLE media_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id uuid REFERENCES media(id) ON DELETE CASCADE NOT NULL,
    profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    likes integer DEFAULT 0 NOT NULL,
    comments integer DEFAULT 0 NOT NULL,
    saves integer DEFAULT 0 NOT NULL,
    shares integer DEFAULT 0 NOT NULL,
    reach integer DEFAULT 0 NOT NULL,
    impressions integer DEFAULT 0 NOT NULL,
    engagement_rate numeric DEFAULT 0.0 NOT NULL,
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (media_id, captured_at)
);

-- Index for time-series metrics
CREATE INDEX idx_media_metrics_media_captured ON media_metrics (media_id, captured_at DESC);
CREATE INDEX idx_media_metrics_profile_captured ON media_metrics (profile_id, captured_at DESC);

-- RLS: Users can only see their own media metrics
ALTER TABLE media_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for authenticated users based on user_id"
ON media_metrics FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Allow insert for service role only"
ON media_metrics FOR INSERT
TO service_role
WITH CHECK (TRUE);

CREATE POLICY "Allow update for service role only"
ON media_metrics FOR UPDATE
TO service_role
USING (TRUE)
WITH CHECK (TRUE);

CREATE POLICY "Allow delete for service role only"
ON media_metrics FOR DELETE
TO service_role
USING (TRUE);


-- 7. Table: profile_insights_daily
-- Stores aggregated daily KPIs (materialized view candidate)
CREATE TABLE profile_insights_daily (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date date NOT NULL,
    followers_count integer NOT NULL,
    followers_growth integer DEFAULT 0 NOT NULL,
    engagement_rate numeric DEFAULT 0.0 NOT NULL,
    reach integer DEFAULT 0 NOT NULL,
    impressions integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (profile_id, date)
);

-- Index for time-series daily insights
CREATE INDEX idx_profile_insights_daily_profile_date ON profile_insights_daily (profile_id, date DESC);

-- RLS: Users can only see their own insights
ALTER TABLE profile_insights_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for authenticated users based on user_id"
ON profile_insights_daily FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Allow insert for service role only"
ON profile_insights_daily FOR INSERT
TO service_role
WITH CHECK (TRUE);

CREATE POLICY "Allow update for service role only"
ON profile_insights_daily FOR UPDATE
TO service_role
USING (TRUE)
WITH CHECK (TRUE);

CREATE POLICY "Allow delete for service role only"
ON profile_insights_daily FOR DELETE
TO service_role
USING (TRUE);


-- 7. Table: hashtags_metrics
-- Stores derived metrics per hashtag
CREATE TABLE hashtags_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    hashtag text NOT NULL,
    usage_count integer DEFAULT 0 NOT NULL,
    total_engagement integer DEFAULT 0 NOT NULL,
    avg_engagement numeric DEFAULT 0.0 NOT NULL,
    first_used timestamp with time zone,
    last_used timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (profile_id, hashtag)
);

-- Index for fast lookups by profile_id and hashtag
CREATE INDEX idx_hashtags_metrics_profile_hashtag ON hashtags_metrics (profile_id, hashtag);

-- RLS: Users can only see their own hashtag metrics
ALTER TABLE hashtags_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for authenticated users based on user_id"
ON hashtags_metrics FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Allow insert for service role only"
ON hashtags_metrics FOR INSERT
TO service_role
WITH CHECK (TRUE);

CREATE POLICY "Allow update for service role only"
ON hashtags_metrics FOR UPDATE
TO service_role
USING (TRUE)
WITH CHECK (TRUE);

CREATE POLICY "Allow delete for service role only"
ON hashtags_metrics FOR DELETE
TO service_role
USING (TRUE);


-- 9. Table: sync_jobs
-- Stores orchestration and logging for worker jobs
CREATE TABLE sync_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    job_type text NOT NULL, -- LOGIN, RECONNECT, SYNC_FOLLOWERS, SYNC_MEDIA, etc.
    status text DEFAULT 'PENDING' NOT NULL, -- PENDING, RUNNING, COMPLETED, FAILED
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    processed_items integer DEFAULT 0 NOT NULL,
    error_message text,
    metadata jsonb, -- For job-specific data (e.g., 2FA code, media IDs)
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Index for job status and profile
CREATE INDEX idx_sync_jobs_profile_status ON sync_jobs (profile_id, status);

-- RLS: Users can only see their own job logs
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for authenticated users based on user_id"
ON sync_jobs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Allow insert for authenticated users"
ON sync_jobs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow insert for service role"
ON sync_jobs FOR INSERT
TO service_role
WITH CHECK (TRUE);

CREATE POLICY "Allow update for service role only"
ON sync_jobs FOR UPDATE
TO service_role
USING (TRUE)
WITH CHECK (TRUE);

CREATE POLICY "Allow delete for service role only"
ON sync_jobs FOR DELETE
TO service_role
USING (TRUE);


-- 10. Table: alerts
-- Stores internal alerts for anomalies
CREATE TABLE alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    alert_type text NOT NULL, -- ENGAGEMENT_DROP, FOLLOWER_SPIKE, SYNC_FAILED, SESSION_EXPIRED
    severity text DEFAULT 'LOW' NOT NULL, -- LOW, MEDIUM, HIGH
    message text NOT NULL,
    metadata jsonb,
    is_read boolean DEFAULT FALSE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Index for fast lookups by profile_id and read status
CREATE INDEX idx_alerts_profile_read ON alerts (profile_id, is_read);

-- RLS: Users can only see their own alerts
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for authenticated users based on user_id"
ON alerts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Allow insert for service role only"
ON alerts FOR INSERT
TO service_role
WITH CHECK (TRUE);

CREATE POLICY "Allow update for authenticated users based on user_id"
ON alerts FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow delete for authenticated users based on user_id"
ON alerts FOR DELETE
TO authenticated
USING (auth.uid() = user_id);


-- =================================================================================
-- Post-Schema Setup
-- =================================================================================

-- Function to update 'updated_at' column automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to all tables that have an 'updated_at' column
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'updated_at'
    LOOP
        EXECUTE format('CREATE OR REPLACE TRIGGER set_updated_at
                        BEFORE UPDATE ON %I
                        FOR EACH ROW
                        EXECUTE FUNCTION update_updated_at_column();', t);
    END LOOP;
END;
$$ language 'plpgsql';

-- Final note: The user will need to run this script in their Supabase SQL editor.
-- The RLS policies for service_role are set to TRUE for simplicity, as the worker
-- will use the service role key and is trusted to handle data for all users.
-- The RLS for authenticated users is strictly enforced via auth.uid().
