import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useProfile } from '@/hooks/useProfile';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface Demographics {
  id: string;
  profile_id: string;
  gender_male_percentage: number;
  gender_female_percentage: number;
  gender_unknown_percentage: number;
  age_13_17: number;
  age_18_24: number;
  age_25_34: number;
  age_35_44: number;
  age_45_54: number;
  age_55_plus: number;
  top_locations: string[];
  captured_at: string;
}

export default function Demographics() {
  const { user } = useSupabaseAuth();
  const { data: profile } = useProfile(user?.id);

  const { data: demographics, isLoading } = useQuery({
    queryKey: ['demographics', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;

      const { data, error } = await supabase
        .from('audience_demographics')
        .select('*')
        .eq('profile_id', profile.id)
        .order('captured_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as Demographics | null;
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

  if (!demographics) {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Audience Demographics</h1>
          <p className="text-gray-600 mt-2">Understand your audience composition</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-600">No demographic data available yet. Run a sync to collect data.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const genderData = [
    { name: 'Male', value: demographics.gender_male_percentage },
    { name: 'Female', value: demographics.gender_female_percentage },
    { name: 'Unknown', value: demographics.gender_unknown_percentage },
  ];

  const ageData = [
    { name: '13-17', value: demographics.age_13_17 },
    { name: '18-24', value: demographics.age_18_24 },
    { name: '25-34', value: demographics.age_25_34 },
    { name: '35-44', value: demographics.age_35_44 },
    { name: '45-54', value: demographics.age_45_54 },
    { name: '55+', value: demographics.age_55_plus },
  ];

  const COLORS = ['#ec4899', '#f43f5e', '#fb7185', '#fda4af', '#fbcfe8', '#fce7f3'];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Audience Demographics</h1>
        <p className="text-gray-600 mt-2">Understand your audience composition and characteristics</p>
      </div>

      {/* Gender Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Gender Distribution</CardTitle>
          <CardDescription>Estimated breakdown of your audience by gender</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={genderData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {genderData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              {genderData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <span className="text-2xl font-bold">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Age Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Age Distribution</CardTitle>
          <CardDescription>Estimated breakdown of your audience by age group</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ageData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#ec4899" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
            {ageData.map((item) => (
              <div key={item.name} className="p-4 bg-gradient-to-br from-pink-50 to-rose-50 rounded-lg border border-pink-200">
                <p className="text-sm text-gray-600">{item.name} years</p>
                <p className="text-2xl font-bold text-pink-600 mt-1">{item.value}%</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Locations */}
      {demographics.top_locations && demographics.top_locations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Locations</CardTitle>
            <CardDescription>Countries and regions where your audience is located</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {demographics.top_locations.map((location, index) => (
                <div key={location} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-600">#{index + 1}</span>
                    <span className="font-medium">{location}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-900">
            <strong>Note:</strong> Demographics data is estimated based on Instagram's audience insights API and may not be 100% accurate. These are approximations used for analytics purposes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
