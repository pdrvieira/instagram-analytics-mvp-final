import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useProfile } from '@/hooks/useProfile';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ConnectIG() {
  const { user } = useSupabaseAuth();
  const { data: profile, isLoading: profileLoading, refetch } = useProfile(user?.id);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Auto-detect 2FA needed state
  const needs2FA = profile?.connection_state === 'NEEDS_2FA';
  const isConnected = profile?.connection_state === 'CONNECTED';
  const isDisconnected = !profile || profile?.connection_state === 'DISCONNECTED';

  // Poll profile status when waiting for worker to process login
  useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(() => {
      refetch();
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [isPolling, refetch]);

  // Stop polling when we reach a final state
  useEffect(() => {
    if (needs2FA || isConnected) {
      setIsPolling(false);
      // Clear password when connected successfully
      if (isConnected) {
        setPassword('');
      }
    }
  }, [needs2FA, isConnected]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (!user) {
        setError('You must be logged in to connect Instagram');
        return;
      }

      let profileId = profile?.id;
      
      if (!profileId) {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .eq('ig_username', username)
          .single();

        if (existingProfile) {
          profileId = existingProfile.id;
        } else {
          const { data: newProfile, error: profileError } = await supabase
            .from('profiles')
            .insert({
              user_id: user.id,
              ig_username: username,
              ig_user_id: `temp_${Date.now()}`,
              connection_state: 'DISCONNECTED',
            })
            .select()
            .single();

          if (profileError) throw profileError;
          profileId = newProfile.id;
        }
      } else {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ ig_username: username })
          .eq('id', profileId);

        if (updateError) throw updateError;
      }

      const { error: jobError } = await supabase
        .from('sync_jobs')
        .insert({
          profile_id: profileId,
          user_id: user.id,
          job_type: 'LOGIN',
          status: 'PENDING',
          metadata: {
            username,
            password,
            two_fa_code: twoFaCode || null,
          },
        });

      if (jobError) throw jobError;

      setSuccessMessage('Login job created! Worker will process it shortly...');
      setUsername('');
      // Don't clear password yet - we need it for 2FA
      setIsPolling(true); // Start polling for status updates
      
    } catch (err) {
      console.error('Connect IG Error:', err);
      const errorMessage = err instanceof Error 
        ? err.message 
        : typeof err === 'object' && err !== null 
          ? JSON.stringify(err) 
          : String(err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!user || !profile) {
        setError('Profile not found');
        return;
      }

      const { error: jobError } = await supabase
        .from('sync_jobs')
        .insert({
          profile_id: profile.id,
          user_id: user.id,
          job_type: 'LOGIN',
          status: 'PENDING',
          metadata: {
            username: profile.ig_username,
            password,
            two_fa_code: twoFaCode,
          },
        });

      if (jobError) throw jobError;

      setSuccessMessage('2FA code submitted! Worker will verify it...');
      setTwoFaCode('');
      setIsPolling(true); // Start polling for status updates
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);

    try {
      // Delete Instagram session
      await supabase
        .from('ig_sessions')
        .delete()
        .eq('profile_id', profile.id);

      // Delete all sync jobs
      await supabase
        .from('sync_jobs')
        .delete()
        .eq('profile_id', profile.id);

      // Delete the entire profile
      const { error: deleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profile.id);

      if (deleteError) throw deleteError;

      setSuccessMessage('Instagram account disconnected successfully');
      setTimeout(() => {
        refetch();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect account');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (state: string) => {
    switch (state) {
      case 'CONNECTED':
        return 'text-green-600';
      case 'EXPIRED':
        return 'text-red-600';
      case 'NEEDS_2FA':
        return 'text-yellow-600';
      case 'DISCONNECTED':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = (state: string) => {
    switch (state) {
      case 'CONNECTED':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'EXPIRED':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'NEEDS_2FA':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'DISCONNECTED':
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Connect Instagram Account</CardTitle>
          <CardDescription>
            Connect your Instagram account to start tracking analytics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {profile && (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                {getStatusIcon(profile.connection_state)}
                <div>
                  <p className="font-semibold">Session Status</p>
                  <p className={`text-sm ${getStatusColor(profile.connection_state)}`}>
                    {profile.connection_state}
                  </p>
                </div>
              </div>
              {profile.last_sync_at && (
                <p className="text-xs text-gray-600 mt-2">
                  Last synced: {new Date(profile.last_sync_at).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">{successMessage}</p>
            </div>
          )}

          {isDisconnected && !needs2FA && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Instagram Username</label>
                <Input
                  type="text"
                  placeholder="your_username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect Account'
                )}
              </Button>
            </form>
          )}

          {needs2FA && (
            <div className="space-y-4">
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 font-medium">
                  🔐 2FA Required
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Instagram sent a verification code to your device. Enter it below.
                </p>
              </div>
              <form onSubmit={handleVerify2FA} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Verification Code</label>
                  <Input
                    type="text"
                    placeholder="000000"
                    value={twoFaCode}
                    onChange={(e) => setTwoFaCode(e.target.value)}
                    disabled={loading}
                    maxLength={8}
                    required
                    autoFocus
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify Code'
                  )}
                </Button>
              </form>
            </div>
          )}

          {isConnected && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800 font-medium">
                ✓ Instagram connected successfully!
              </p>
              <p className="text-xs text-green-700 mt-1">
                Data is syncing. Check Overview for analytics.
              </p>
            </div>
          )}

          {profile && (
            <div className="pt-4 border-t border-gray-200">
              <Button
                variant="destructive"
                onClick={handleRevoke}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Disconnecting...
                  </>
                ) : (
                  'Disconnect Instagram Account'
                )}
              </Button>
              <p className="text-xs text-gray-500 text-center mt-2">
                This will remove your Instagram connection and delete all session data
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
