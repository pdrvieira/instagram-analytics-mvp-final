import { useState } from 'react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useProfile } from '@/hooks/useProfile';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  Download, 
  Search, 
  Users, 
  UserMinus, 
  UserCheck, 
  ExternalLink,
  TrendingUp,
  Heart,
  Star,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { exportDataToCSV } from '@/lib/exportUtils';

interface Follower {
  id: string;
  follower_ig_id: string;
  follower_username: string;
  follower_name: string | null;
  follower_pic_url: string | null;
  is_verified: boolean;
  is_private: boolean;
  is_follower: boolean;
  is_following: boolean;
  is_following_back: boolean;
  created_at: string;
}

export default function Followers() {
  const { user } = useSupabaseAuth();
  const { data: profile } = useProfile(user?.id);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('followers');

  const { data: followers, isLoading } = useQuery({
    queryKey: ['followers', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      
      let allFollowers: Follower[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('followers')
          .select('*')
          .eq('profile_id', profile.id)
          .order('follower_username', { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          allFollowers = [...allFollowers, ...data];
          page++;
          
          // Se retornou menos que pageSize, não há mais registros
          if (data.length < pageSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }
      
      return allFollowers as Follower[];
    },
    enabled: !!profile?.id,
  });

  // Categorize followers
  const myFollowers = followers?.filter(f => f.is_follower) || [];
  const myFollowing = followers?.filter(f => f.is_following) || [];
  const mutualFollows = followers?.filter(f => f.is_following_back) || [];
  const notFollowingBack = followers?.filter(f => f.is_following && !f.is_follower) || [];
  const fansOnly = followers?.filter(f => f.is_follower && !f.is_following) || [];

  // Filter based on active tab and search
  const getFilteredList = () => {
    let list: Follower[] = [];
    
    switch (activeTab) {
      case 'followers':
        list = myFollowers;
        break;
      case 'following':
        list = myFollowing;
        break;
      case 'mutual':
        list = mutualFollows;
        break;
      case 'non-followers':
        list = notFollowingBack;
        break;
      case 'fans':
        list = fansOnly;
        break;
      default:
        list = myFollowers;
    }

    if (searchTerm) {
      list = list.filter(f =>
        f.follower_username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.follower_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return list;
  };

  const filteredList = getFilteredList();

  const handleExport = (category: string) => {
    let dataToExport: Follower[] = [];
    let filename = 'followers.csv';

    switch (category) {
      case 'all':
        dataToExport = followers || [];
        filename = 'all-followers.csv';
        break;
      case 'non-followers':
        dataToExport = notFollowingBack;
        filename = 'nao-seguidores.csv';
        break;
      case 'mutual':
        dataToExport = mutualFollows;
        filename = 'mutual-followers.csv';
        break;
      case 'fans':
        dataToExport = fansOnly;
        filename = 'fans-only.csv';
        break;
    }

    exportDataToCSV(
      dataToExport,
      ['follower_username', 'follower_name', 'is_verified', 'is_private', 'is_follower', 'is_following', 'created_at'],
      filename
    );
  };

  const UserCard = ({ user }: { user: Follower }) => (
    <Card className="hover:shadow-lg transition-all hover:scale-[1.02] duration-200">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          {/* Profile Picture */}
          <div className="flex-shrink-0">
            {user.follower_pic_url ? (
              <img
                src={user.follower_pic_url}
                alt={user.follower_username}
                className="w-14 h-14 rounded-full object-cover ring-2 ring-gray-100"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 via-pink-400 to-red-400 flex items-center justify-center text-white font-bold text-xl">
                {user.follower_username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* User Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <a
                href={`https://www.instagram.com/${user.follower_username}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-gray-900 hover:text-blue-600 flex items-center gap-1 truncate group"
              >
                @{user.follower_username}
                <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
              {user.is_verified && (
                <Badge variant="secondary" className="text-blue-600 bg-blue-50 border-blue-200 px-1.5 py-0">
                  ✓
                </Badge>
              )}
            </div>
            
            {user.follower_name && (
              <p className="text-sm text-gray-600 truncate mb-2">
                {user.follower_name}
              </p>
            )}

            {/* Status Badges */}
            <div className="flex gap-1.5 flex-wrap">
              {user.is_follower && (
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Follows you
                </Badge>
              )}
              {user.is_following && (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                  <UserCheck className="w-3 h-3 mr-1" />
                  You follow
                </Badge>
              )}
              {user.is_following && !user.is_follower && (
                <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                  <XCircle className="w-3 h-3 mr-1" />
                  Not following back
                </Badge>
              )}
              {user.is_private && (
                <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200">
                  🔒 Private
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Users className="w-8 h-8" />
          Followers Analysis
        </h1>
        <p className="text-gray-600 mt-2">
          See who follows you, who you follow, and identify non-followers
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card 
          className={`bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 cursor-pointer hover:shadow-xl hover:scale-105 ${
            activeTab === 'followers' ? 'shadow-xl scale-105' : ''
          }`}
          onClick={() => setActiveTab('followers')}
        >
          <CardContent className="pt-6">
            <div className="text-center">
              <Users className={`w-8 h-8 mx-auto mb-2 text-blue-600 ${
                activeTab === 'followers' ? 'scale-110' : ''
              }`} />
              <p className="text-2xl font-bold text-blue-900">{myFollowers.length}</p>
              <p className="text-xs text-blue-700 mt-1">Followers</p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 cursor-pointer hover:shadow-xl hover:scale-105 ${
            activeTab === 'following' ? 'shadow-xl scale-105' : ''
          }`}
          onClick={() => setActiveTab('following')}
        >
          <CardContent className="pt-6">
            <div className="text-center">
              <UserCheck className={`w-8 h-8 mx-auto mb-2 text-purple-600 ${
                activeTab === 'following' ? 'scale-110' : ''
              }`} />
              <p className="text-2xl font-bold text-purple-900">{myFollowing.length}</p>
              <p className="text-xs text-purple-700 mt-1">Following</p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`bg-gradient-to-br from-green-50 to-green-100 border-green-200 cursor-pointer hover:shadow-xl hover:scale-105 ${
            activeTab === 'mutual' ? 'shadow-xl scale-105' : ''
          }`}
          onClick={() => setActiveTab('mutual')}
        >
          <CardContent className="pt-6">
            <div className="text-center">
              <Heart className={`w-8 h-8 mx-auto mb-2 text-green-600 ${
                activeTab === 'mutual' ? 'scale-110' : ''
              }`} />
              <p className="text-2xl font-bold text-green-900">{mutualFollows.length}</p>
              <p className="text-xs text-green-700 mt-1">Mutual</p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`bg-gradient-to-br from-red-50 to-red-100 border-red-200 cursor-pointer hover:shadow-xl hover:scale-105 ${
            activeTab === 'non-followers' ? 'shadow-xl scale-105' : ''
          }`}
          onClick={() => setActiveTab('non-followers')}
        >
          <CardContent className="pt-6">
            <div className="text-center">
              <UserMinus className={`w-8 h-8 mx-auto mb-2 text-red-600 ${
                activeTab === 'non-followers' ? 'scale-110' : ''
              }`} />
              <p className="text-2xl font-bold text-red-900">{notFollowingBack.length}</p>
              <p className="text-xs text-red-700 mt-1">Not Following Back</p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 cursor-pointer hover:shadow-xl hover:scale-105 ${
            activeTab === 'fans' ? 'shadow-xl scale-105' : ''
          }`}
          onClick={() => setActiveTab('fans')}
        >
          <CardContent className="pt-6">
            <div className="text-center">
              <Star className={`w-8 h-8 mx-auto mb-2 text-amber-600 ${
                activeTab === 'fans' ? 'scale-110' : ''
              }`} />
              <p className="text-2xl font-bold text-amber-900">{fansOnly.length}</p>
              <p className="text-xs text-amber-700 mt-1">Fans Only</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Export */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <Input 
            placeholder="Search by @username or name..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="pl-10" 
          />
        </div>
        <Button variant="outline" onClick={() => handleExport(activeTab)}>
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="followers">Followers ({myFollowers.length})</TabsTrigger>
          <TabsTrigger value="following">Following ({myFollowing.length})</TabsTrigger>
          <TabsTrigger value="mutual">Mutual ({mutualFollows.length})</TabsTrigger>
          <TabsTrigger value="non-followers" className="text-red-600">
            Not Following Back ({notFollowingBack.length})
          </TabsTrigger>
          <TabsTrigger value="fans">Fans ({fansOnly.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredList.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg font-medium">
                  {searchTerm ? 'No results found' : 'No users in this category'}
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  {searchTerm && 'Try searching with different terms'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-600">
                Showing {filteredList.length} user{filteredList.length !== 1 ? 's' : ''}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredList.map((user) => (
                  <UserCard key={user.id} user={user} />
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
