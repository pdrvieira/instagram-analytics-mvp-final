import { useState } from 'react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useProfile } from '@/hooks/useProfile';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, Search, UserMinus, ExternalLink, AlertCircle } from 'lucide-react';
import { exportDataToCSV } from '@/lib/exportUtils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface NonFollower {
  id: string;
  follower_ig_id: string;
  follower_username: string;
  follower_name: string | null;
  follower_pic_url: string | null;
  is_verified: boolean;
  is_private: boolean;
  created_at: string;
}

export default function NonFollowers() {
  const { user } = useSupabaseAuth();
  const { data: profile } = useProfile(user?.id);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: nonFollowers, isLoading, refetch } = useQuery({
    queryKey: ['non-followers', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      
      // Get users where is_following = true AND is_follower = false
      const { data, error } = await supabase
        .from('followers')
        .select('*')
        .eq('profile_id', profile.id)
        .eq('is_following', true)
        .eq('is_follower', false)
        .order('follower_username', { ascending: true });
      
      if (error) throw error;
      return (data || []) as NonFollower[];
    },
    enabled: !!profile?.id,
  });

  const filteredNonFollowers = nonFollowers?.filter((user) =>
    user.follower_username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.follower_name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleExport = () => {
    if (!nonFollowers) return;
    exportDataToCSV(
      nonFollowers,
      ['follower_username', 'follower_name', 'is_verified', 'is_private', 'created_at'],
      'nao-seguidores.csv'
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <UserMinus className="w-8 h-8 text-red-500" />
          Não Seguidores
        </h1>
        <p className="text-gray-600 mt-2">
          Pessoas que você segue mas que não seguem você de volta
        </p>
      </div>

      {/* Stats Card */}
      <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total de Não Seguidores</p>
              <p className="text-4xl font-bold text-red-600">{nonFollowers?.length || 0}</p>
              <p className="text-sm text-gray-500 mt-2">
                {profile?.following_count || 0} seguindo • {profile?.followers_count || 0} seguidores
              </p>
            </div>
            <UserMinus className="w-16 h-16 text-red-300" />
          </div>
        </CardContent>
      </Card>

      {/* Alert Info */}
      {nonFollowers && nonFollowers.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Dica</AlertTitle>
          <AlertDescription>
            Você pode revisar esta lista periodicamente para decidir se deseja continuar seguindo essas contas.
            Clique no nome de usuário para visitar o perfil no Instagram.
          </AlertDescription>
        </Alert>
      )}

      {/* Search and Export */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <Input 
            placeholder="Buscar por nome ou @usuario..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="pl-10" 
          />
        </div>
        <Button variant="outline" onClick={handleExport} disabled={!nonFollowers || nonFollowers.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Non-Followers List */}
      <Card>
        <CardHeader>
          <CardTitle>Lista Completa ({filteredNonFollowers.length})</CardTitle>
          <CardDescription>
            Contas que não seguem você de volta
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredNonFollowers.length === 0 ? (
            <div className="text-center py-12">
              <UserMinus className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg font-medium">
                {searchTerm ? 'Nenhum resultado encontrado' : 'Nenhum não-seguidor encontrado!'}
              </p>
              <p className="text-gray-500 text-sm mt-2">
                {searchTerm 
                  ? 'Tente buscar com outros termos' 
                  : 'Todas as pessoas que você segue também seguem você de volta 🎉'
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNonFollowers.map((user) => (
                <Card key={user.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      {/* Profile Picture */}
                      <div className="flex-shrink-0">
                        {user.follower_pic_url ? (
                          <img
                            src={user.follower_pic_url}
                            alt={user.follower_username}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold">
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
                            className="font-semibold text-gray-900 hover:text-blue-600 flex items-center gap-1 truncate"
                          >
                            @{user.follower_username}
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                          {user.is_verified && (
                            <Badge variant="secondary" className="text-blue-600 bg-blue-50 border-blue-200">
                              ✓
                            </Badge>
                          )}
                        </div>
                        
                        {user.follower_name && (
                          <p className="text-sm text-gray-600 truncate mb-2">
                            {user.follower_name}
                          </p>
                        )}

                        <div className="flex gap-2 flex-wrap">
                          {user.is_private && (
                            <Badge variant="outline" className="text-xs">
                              🔒 Privado
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs text-red-600 border-red-200">
                            Não segue de volta
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom Stats */}
      {nonFollowers && nonFollowers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">Contas Verificadas</p>
              <p className="text-2xl font-bold">
                {nonFollowers.filter(u => u.is_verified).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">Contas Privadas</p>
              <p className="text-2xl font-bold">
                {nonFollowers.filter(u => u.is_private).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">Contas Públicas</p>
              <p className="text-2xl font-bold">
                {nonFollowers.filter(u => !u.is_private).length}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
