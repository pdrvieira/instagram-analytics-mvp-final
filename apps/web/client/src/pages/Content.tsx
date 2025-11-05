import { useState } from 'react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useProfile } from '@/hooks/useProfile';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Heart, MessageCircle, Share2, Eye } from 'lucide-react';

interface Media {
  id: string;
  ig_media_id: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'STORY';
  caption: string | null;
  media_url: string | null;
  timestamp: string;
  created_at: string;
}

interface MediaMetrics {
  id: string;
  media_id: string;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  reach: number;
  impressions: number;
  engagement_rate: number;
  captured_at: string;
}

export default function Content() {
  const { user } = useSupabaseAuth();
  const { data: profile } = useProfile(user?.id);
  const [mediaType, setMediaType] = useState<'all' | 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'STORY'>('all');

  const { data: media, isLoading: mediaLoading } = useQuery({
    queryKey: ['media', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from('media')
        .select('*')
        .eq('profile_id', profile.id)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return (data || []) as Media[];
    },
    enabled: !!profile?.id,
  });

  const { data: metricsMap } = useQuery({
    queryKey: ['media_metrics', profile?.id],
    queryFn: async () => {
      if (!profile?.id || !media?.length) return {};

      const mediaIds = media.map((m) => m.id);
      const { data, error } = await supabase
        .from('media_metrics')
        .select('*')
        .in('media_id', mediaIds)
        .order('captured_at', { ascending: false });

      if (error) throw error;

      const map: Record<string, MediaMetrics> = {};
      (data || []).forEach((metric: MediaMetrics) => {
        if (!map[metric.media_id]) {
          map[metric.media_id] = metric;
        }
      });
      return map;
    },
    enabled: !!profile?.id && !!media?.length,
  });

  const filteredMedia = media?.filter((m) => mediaType === 'all' || m.media_type === mediaType) || [];

  const topMedia = filteredMedia
    .map((m) => ({
      ...m,
      metrics: metricsMap?.[m.id],
    }))
    .sort((a, b) => (b.metrics?.engagement_rate || 0) - (a.metrics?.engagement_rate || 0))
    .slice(0, 3);

  if (mediaLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const MediaCard = ({ item }: { item: (typeof filteredMedia)[0] & { metrics?: MediaMetrics } }) => {
    const metrics = metricsMap?.[item.id];

    return (
      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
        <div className="aspect-square bg-gray-100 relative overflow-hidden">
          {item.media_url ? (
            <img src={item.media_url} alt="Media" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
              <span className="text-gray-500 text-sm">{item.media_type}</span>
            </div>
          )}
          <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs font-medium">
            {item.media_type}
          </div>
        </div>
        <CardContent className="p-4">
          {item.caption && <p className="text-sm text-gray-700 line-clamp-2 mb-3">{item.caption}</p>}
          {metrics && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <Heart className="w-4 h-4 text-red-500" />
                <span>{metrics.likes.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageCircle className="w-4 h-4 text-blue-500" />
                <span>{metrics.comments.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <Share2 className="w-4 h-4 text-green-500" />
                <span>{metrics.shares.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <Eye className="w-4 h-4 text-purple-500" />
                <span>{metrics.reach.toLocaleString()}</span>
              </div>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-3">
            {new Date(item.timestamp).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Content Performance</h1>
        <p className="text-gray-600 mt-2">Track your posts, reels, and stories performance</p>
      </div>

      {/* Top Performing Content */}
      {topMedia.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Content</CardTitle>
            <CardDescription>Your best performing posts by engagement rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {topMedia.map((item) => (
                <MediaCard key={item.id} item={item} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Content */}
      <div>
        <div className="mb-6">
          <Tabs value={mediaType} onValueChange={(v) => setMediaType(v as any)}>
            <TabsList>
              <TabsTrigger value="all">All ({media?.length || 0})</TabsTrigger>
              <TabsTrigger value="IMAGE">Images ({media?.filter((m) => m.media_type === 'IMAGE').length || 0})</TabsTrigger>
              <TabsTrigger value="VIDEO">Videos ({media?.filter((m) => m.media_type === 'VIDEO').length || 0})</TabsTrigger>
              <TabsTrigger value="CAROUSEL">Carousels ({media?.filter((m) => m.media_type === 'CAROUSEL').length || 0})</TabsTrigger>
              <TabsTrigger value="STORY">Stories ({media?.filter((m) => m.media_type === 'STORY').length || 0})</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {filteredMedia.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-600">No content found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredMedia.map((item) => (
              <MediaCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
