import { useState } from 'react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useProfile } from '@/hooks/useProfile';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Download, Search } from 'lucide-react';

interface Follower {
  id: string;
  follower_ig_id: string;
  follower_username: string;
  follower_name: string | null;
  is_following_back: boolean;
}

export default function Followers() {
  const { user } = useSupabaseAuth();
  const { data: profile } = useProfile(user?.id);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: followers, isLoading } = useQuery({
    queryKey: ['followers', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from('followers')
        .select('*')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Follower[];
    },
    enabled: !!profile?.id,
  });

  const filteredFollowers = followers?.filter((f) =>
    f.follower_username.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Followers</h1>
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Button variant="outline"><Download className="w-4 h-4 mr-2" />CSV</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Followers ({filteredFollowers.length})</CardTitle></CardHeader>
        <CardContent>
          {filteredFollowers.length === 0 ? <p className="text-gray-600">No followers</p> : (
            <div className="overflow-x-auto">
              <table className="w-full"><thead><tr className="border-b"><th className="text-left py-3 px-4">Username</th><th className="text-left py-3 px-4">Following Back</th></tr></thead><tbody>{filteredFollowers.map((f) => (<tr key={f.id} className="border-b"><td className="py-3 px-4">@{f.follower_username}</td><td className="py-3 px-4"><span className={f.is_following_back ? 'text-green-600' : 'text-gray-600'}>{f.is_following_back ? 'Yes' : 'No'}</span></td></tr>))}</tbody></table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
