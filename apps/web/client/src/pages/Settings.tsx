import { useState } from 'react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle, CheckCircle2, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function Settings() {
  const { user, logout } = useSupabaseAuth();
  const { data: profile, isLoading: profileLoading } = useProfile(user?.id);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleManualSync = async () => {
    if (!profile?.id) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/sync-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          profile_id: profile.id,
          sync_type: 'FULL',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      setMessage({
        type: 'success',
        text: 'Sync initiated successfully! Check back in a few minutes for updated data.',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Sync failed. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (!profile?.id) return;

    setLoading(true);
    setMessage(null);

    try {
      // Delete all data associated with the profile
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profile.id);

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'All data deleted successfully. You will be logged out.',
      });

      setTimeout(() => {
        logout();
      }, 2000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to delete data. Please try again.',
      });
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
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
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-gray-600 mt-2">Manage your account and sync preferences</p>
      </div>

      {/* Messages */}
      {message && (
        <div
          className={`p-4 rounded-lg border flex items-start gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <p className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {message.text}
          </p>
        </div>
      )}

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Email</label>
            <p className="mt-1 text-gray-900">{user?.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Account Created</label>
            <p className="mt-1 text-gray-900">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Instagram Connection */}
      {profile && (
        <Card>
          <CardHeader>
            <CardTitle>Instagram Connection</CardTitle>
            <CardDescription>Your connected Instagram account status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Username</label>
                <p className="mt-1 text-gray-900">@{profile.ig_username}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Followers</label>
                <p className="mt-1 text-gray-900">{profile.followers_count.toLocaleString()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Connection Status</label>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      profile.connection_state === 'CONNECTED'
                        ? 'bg-green-100 text-green-800'
                        : profile.connection_state === 'NEEDS_2FA'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {profile.connection_state}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Last Sync</label>
                <p className="mt-1 text-gray-900">
                  {profile.last_sync_at
                    ? new Date(profile.last_sync_at).toLocaleString()
                    : 'Never'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Management</CardTitle>
          <CardDescription>Control how and when your data is synchronized</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Automatic Sync:</strong> Your data is automatically synced daily. You can also trigger a manual sync below.
            </p>
          </div>
          <Button
            onClick={handleManualSync}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Trigger Manual Sync Now
              </>
            )}
          </Button>
          <p className="text-xs text-gray-600">
            Manual sync may take 2-5 minutes depending on your account size.
          </p>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>Manage your stored data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Storage Used:</strong> Your analytics data is stored securely in Supabase. You can delete all data at any time.
            </p>
          </div>
          {!showDeleteConfirm ? (
            <Button
              onClick={() => setShowDeleteConfirm(true)}
              variant="destructive"
              className="w-full"
              size="lg"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete All Data
            </Button>
          ) : (
            <div className="space-y-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-medium text-red-900">
                Are you sure? This action cannot be undone. All your analytics data will be permanently deleted.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowDeleteConfirm(false)}
                  variant="outline"
                  className="flex-1"
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeleteAllData}
                  variant="destructive"
                  className="flex-1"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Yes, Delete Everything'
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Privacy & Security */}
      <Card>
        <CardHeader>
          <CardTitle>Privacy & Security</CardTitle>
          <CardDescription>Your data security and privacy settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Data Encryption</h4>
            <p className="text-gray-700">
              Your Instagram session credentials are encrypted using AES-256-CBC before storage.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Row-Level Security</h4>
            <p className="text-gray-700">
              All your data is protected by Supabase Row-Level Security policies. Only you can access your data.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Data Retention</h4>
            <p className="text-gray-700">
              Your data is retained for as long as your account is active. You can request deletion at any time.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Account Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Account Actions</CardTitle>
          <CardDescription>Manage your account access</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={logout}
            variant="outline"
            className="w-full"
            size="lg"
          >
            Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
