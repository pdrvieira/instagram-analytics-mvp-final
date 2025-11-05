import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useProfile } from '@/hooks/useProfile';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface HourlyMetric {
  day_of_week: number;
  hour_of_day: number;
  engagement_count: number;
}

export default function Hours() {
  const { user } = useSupabaseAuth();
  const { data: profile } = useProfile(user?.id);

  const { data: hourlyData, isLoading } = useQuery({
    queryKey: ['hourly_metrics', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from('hourly_engagement_metrics')
        .select('*')
        .eq('profile_id', profile.id);

      if (error) throw error;
      return (data || []) as HourlyMetric[];
    },
    enabled: !!profile?.id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Create a 2D grid for the heatmap
  const heatmapData: Record<string, number> = {};
  hourlyData?.forEach((metric) => {
    const key = `${metric.day_of_week}-${metric.hour_of_day}`;
    heatmapData[key] = metric.engagement_count;
  });

  // Find max value for color scaling
  const maxEngagement = Math.max(...Object.values(heatmapData), 1);

  const getColor = (value: number) => {
    const intensity = value / maxEngagement;
    if (intensity === 0) return 'bg-gray-100';
    if (intensity < 0.2) return 'bg-blue-100';
    if (intensity < 0.4) return 'bg-blue-300';
    if (intensity < 0.6) return 'bg-blue-500';
    if (intensity < 0.8) return 'bg-blue-700';
    return 'bg-blue-900';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Best Times to Post</h1>
        <p className="text-gray-600 mt-2">7×24 engagement heatmap showing when your audience is most active</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Engagement Heatmap</CardTitle>
          <CardDescription>Darker colors indicate higher engagement. Hover for exact values.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="inline-block">
            {/* Hours header */}
            <div className="flex">
              <div className="w-24" />
              {hours.map((hour) => (
                <div
                  key={`header-${hour}`}
                  className="w-12 h-10 flex items-center justify-center text-xs font-semibold text-gray-600 border-b"
                >
                  {hour.toString().padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Heatmap rows */}
            {days.map((day, dayIndex) => (
              <div key={day} className="flex">
                <div className="w-24 flex items-center px-3 font-medium text-sm text-gray-700 border-r">
                  {day}
                </div>
                {hours.map((hour) => {
                  const key = `${dayIndex}-${hour}`;
                  const value = heatmapData[key] || 0;
                  return (
                    <div
                      key={key}
                      className={`w-12 h-12 flex items-center justify-center text-xs font-semibold text-gray-700 border cursor-pointer transition-all hover:ring-2 hover:ring-offset-2 hover:ring-blue-500 ${getColor(value)}`}
                      title={`${day} ${hour}:00 - ${value} engagements`}
                    >
                      {value > 0 ? value : ''}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-8 flex items-center gap-4">
            <span className="text-sm font-medium">Engagement Level:</span>
            <div className="flex gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-gray-100 border border-gray-300" />
                <span className="text-xs">None</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-100" />
                <span className="text-xs">Low</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-500" />
                <span className="text-xs">Medium</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-900" />
                <span className="text-xs">High</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Peak Hours Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-600">Best Day</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {hourlyData && hourlyData.length > 0
                  ? days[
                      Math.floor(
                        hourlyData.reduce((sum, m) => sum + m.engagement_count, 0) /
                          hourlyData.length /
                          24
                      )
                    ] || 'N/A'
                  : 'N/A'}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-gray-600">Peak Hour</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {hourlyData && hourlyData.length > 0
                  ? `${Math.max(...hourlyData.map((m) => m.hour_of_day))
                      .toString()
                      .padStart(2, '0')}:00`
                  : 'N/A'}
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-sm text-gray-600">Total Engagements</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {hourlyData?.reduce((sum, m) => sum + m.engagement_count, 0).toLocaleString() || '0'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
