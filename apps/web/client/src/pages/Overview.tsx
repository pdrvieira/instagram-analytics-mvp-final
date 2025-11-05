import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useProfile } from '@/hooks/useProfile';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loader2, TrendingUp, Users, Heart, Eye, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DailyInsight {
  date: string;
  followers_count: number;
  followers_growth: number;
  engagement_rate: number;
  reach: number;
  impressions: number;
}

export default function Overview() {
  const { user } = useSupabaseAuth();
  const { data: profile, isLoading: profileLoading } = useProfile(user?.id);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ['profile_insights_daily', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('profile_insights_daily')
        .select('*')
        .eq('profile_id', profile.id)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) throw error;
      return (data || []) as DailyInsight[];
    },
    enabled: !!profile?.id,
  });

  const isLoading = profileLoading || insightsLoading;

  const handleSyncData = async () => {
    if (!profile || !user) return;
    
    setSyncing(true);
    setSyncMessage('Creating sync jobs...');
    
    try {
      const jobs = [
        { job_type: 'SYNC_PROFILE' },
        { job_type: 'SYNC_FOLLOWERS' },
        { job_type: 'SYNC_MEDIA' },
        { job_type: 'DERIVE_METRICS' },
      ];

      for (const job of jobs) {
        const { error } = await supabase.from('sync_jobs').insert({
          profile_id: profile.id,
          user_id: user.id,
          job_type: job.job_type as any,
          status: 'PENDING',
          metadata: {},
        });

        if (error) {
          console.error('Error creating job:', error);
          throw error;
        }
      }

      setSyncMessage('✅ Sync started! Data will update automatically in a few moments.');
      setTimeout(() => setSyncMessage(null), 5000);
    } catch (error) {
      setSyncMessage('❌ Error starting sync. Please try again.');
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-600">
              No Instagram account connected. Please connect your account first.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate KPIs
  const latestInsight = insights?.[insights.length - 1];
  const previousInsight = insights?.[insights.length - 2];

  const followerGrowth = latestInsight?.followers_growth || 0;
  const engagementRate = latestInsight?.engagement_rate || 0;
  const reach = latestInsight?.reach || 0;
  const impressions = latestInsight?.impressions || 0;

  const KPICard = ({ title, value, icon: Icon, trend }: any) => (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {trend !== undefined && (
              <p className={`text-xs mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {trend >= 0 ? '+' : ''}{trend}%
              </p>
            )}
          </div>
          <Icon className="w-8 h-8 text-gray-400" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Overview</h1>
          <p className="text-gray-600 mt-2">
            @{profile.ig_username} • {profile.followers_count.toLocaleString()} followers
          </p>
        </div>
        <Button 
          onClick={handleSyncData} 
          disabled={syncing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Data'}
        </Button>
      </div>

      {/* Sync Message */}
      {syncMessage && (
        <Alert>
          <AlertDescription>{syncMessage}</AlertDescription>
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Followers Growth (7d)"
          value={followerGrowth}
          icon={Users}
          trend={followerGrowth}
        />
        <KPICard
          title="Engagement Rate"
          value={`${engagementRate.toFixed(2)}%`}
          icon={Heart}
        />
        <KPICard
          title="Reach (7d)"
          value={reach.toLocaleString()}
          icon={TrendingUp}
        />
        <KPICard
          title="Impressions (7d)"
          value={impressions.toLocaleString()}
          icon={Eye}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Followers Growth Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Followers Growth (30 days)</CardTitle>
            <CardDescription>Daily follower count trend</CardDescription>
          </CardHeader>
          <CardContent>
            {insights && insights.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={insights}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => value.toLocaleString()}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  />
                  <Line
                    type="monotone"
                    dataKey="followers_count"
                    stroke="#3b82f6"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-600 py-8">No data available</p>
            )}
          </CardContent>
        </Card>

        {/* Engagement Rate Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Engagement Rate (30 days)</CardTitle>
            <CardDescription>Daily engagement rate trend</CardDescription>
          </CardHeader>
          <CardContent>
            {insights && insights.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={insights}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => `${(value as number).toFixed(2)}%`}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  />
                  <Line
                    type="monotone"
                    dataKey="engagement_rate"
                    stroke="#ef4444"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-600 py-8">No data available</p>
            )}
          </CardContent>
        </Card>

        {/* Reach & Impressions Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Reach & Impressions (30 days)</CardTitle>
            <CardDescription>Daily reach and impressions trend</CardDescription>
          </CardHeader>
          <CardContent>
            {insights && insights.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={insights}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => value.toLocaleString()}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="reach"
                    stroke="#10b981"
                    dot={false}
                    strokeWidth={2}
                    name="Reach"
                  />
                  <Line
                    type="monotone"
                    dataKey="impressions"
                    stroke="#f59e0b"
                    dot={false}
                    strokeWidth={2}
                    name="Impressions"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-600 py-8">No data available</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
