import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface Profile {
  id: string;
  user_id: string;
  ig_username: string;
  ig_user_id: string;
  followers_count: number;
  following_count: number;
  bio: string | null;
  profile_pic_url: string | null;
  is_verified: boolean;
  connection_state: 'CONNECTED' | 'EXPIRED' | 'NEEDS_2FA' | 'DISCONNECTED';
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useProfile(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found
          return null;
        }
        throw error;
      }

      return data as Profile;
    },
    enabled: !!userId,
  });
}

export function useProfiles(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['profiles', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      return (data || []) as Profile[];
    },
    enabled: !!userId,
  });
}
