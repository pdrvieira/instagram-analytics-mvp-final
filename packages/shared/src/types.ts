/**
 * Shared types for Instagram Analytics MVP
 * Used across Web App, Worker, and Edge Functions
 */

// ============================================
// Database Types
// ============================================

export interface Profile {
  id: string;
  user_id: string;
  ig_username: string;
  ig_user_id: string;
  followers_count: number;
  following_count: number;
  bio: string;
  profile_pic_url: string;
  is_verified: boolean;
  connection_state: 'CONNECTED' | 'EXPIRED' | 'NEEDS_2FA' | 'DISCONNECTED';
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IGSession {
  id: string;
  user_id: string;
  profile_id: string;
  session_payload_encrypted: string;
  last_login_at: string;
  state: 'VALID' | 'EXPIRED' | 'NEEDS_2FA' | 'INVALID';
  created_at: string;
  updated_at: string;
}

export interface Follower {
  id: string;
  profile_id: string;
  follower_id: string;
  follower_username: string;
  follower_name: string;
  follower_pic_url: string;
  is_following_back: boolean;
  created_at: string;
  updated_at: string;
}

export interface FollowerSnapshot {
  id: string;
  profile_id: string;
  captured_at: string;
  total_followers: number;
  new_followers: number;
  lost_followers: number;
  non_followers: number;
  created_at: string;
}

export interface Media {
  id: string;
  profile_id: string;
  ig_media_id: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'STORY';
  caption: string;
  media_url: string;
  permalink: string;
  timestamp: string;
  created_at: string;
  updated_at: string;
}

export interface MediaMetrics {
  id: string;
  media_id: string;
  profile_id: string;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  reach: number;
  impressions: number;
  engagement_rate: number;
  captured_at: string;
  created_at: string;
  updated_at: string;
}

export interface ProfileInsightsDaily {
  id: string;
  profile_id: string;
  date: string;
  followers_count: number;
  followers_growth: number;
  engagement_rate: number;
  reach: number;
  impressions: number;
  created_at: string;
}

export interface HashtagMetrics {
  id: string;
  profile_id: string;
  hashtag: string;
  usage_count: number;
  total_engagement: number;
  avg_engagement_per_post: number;
  created_at: string;
  updated_at: string;
}

export interface SyncJob {
  id: string;
  profile_id: string;
  user_id: string;
  job_type: 'LOGIN' | 'RECONNECT' | 'SYNC_PROFILE' | 'SYNC_FOLLOWERS' | 'SYNC_MEDIA' | 'SYNC_STORIES' | 'DERIVE_METRICS';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  started_at: string | null;
  finished_at: string | null;
  processed_items: number;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  profile_id: string;
  user_id: string;
  alert_type: 'ENGAGEMENT_DROP' | 'FOLLOWER_SPIKE' | 'SYNC_FAILED' | 'SESSION_EXPIRED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  message: string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

// ============================================
// Job Queue Types
// ============================================

export interface JobPayload {
  profile_id: string;
  user_id: string;
  job_type: SyncJob['job_type'];
  metadata?: Record<string, unknown>;
}

export interface LoginJobPayload extends JobPayload {
  job_type: 'LOGIN';
  username: string;
  password: string;
  two_fa_code?: string;
}

export interface SyncJobPayload extends JobPayload {
  job_type: 'SYNC_PROFILE' | 'SYNC_FOLLOWERS' | 'SYNC_MEDIA' | 'SYNC_STORIES' | 'DERIVE_METRICS';
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ============================================
// Dashboard Types
// ============================================

export interface DashboardKPIs {
  followers_count: number;
  followers_growth_7d: number;
  followers_growth_30d: number;
  engagement_rate_avg: number;
  reach_total: number;
  impressions_total: number;
}

export interface EngagementHeatmapData {
  day: number; // 0-6 (Sunday-Saturday)
  hour: number; // 0-23
  engagement: number;
}

export interface DemographicsEstimate {
  gender: {
    male: number;
    female: number;
    unknown: number;
  };
  age_groups: {
    '13-17': number;
    '18-24': number;
    '25-34': number;
    '35-44': number;
    '45-54': number;
    '55-64': number;
    '65+': number;
  };
  top_locations: Array<{
    location: string;
    percentage: number;
  }>;
}

// ============================================
// Encryption Types
// ============================================

export interface EncryptedSessionPayload {
  iv: string; // hex-encoded initialization vector
  encryptedData: string; // hex-encoded encrypted data
  algorithm: 'aes-256-cbc';
}

export interface DecryptedSessionPayload {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: string;
  }>;
  user_agent: string;
  timestamp: number;
}

// ============================================
// Error Types
// ============================================

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const ErrorCodes = {
  // Auth errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',

  // Validation errors
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Instagram errors
  IG_LOGIN_FAILED: 'IG_LOGIN_FAILED',
  IG_2FA_REQUIRED: 'IG_2FA_REQUIRED',
  IG_ACCOUNT_LOCKED: 'IG_ACCOUNT_LOCKED',
  IG_RATE_LIMITED: 'IG_RATE_LIMITED',
  IG_SCRAPE_FAILED: 'IG_SCRAPE_FAILED',

  // Database errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',

  // Server errors
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
