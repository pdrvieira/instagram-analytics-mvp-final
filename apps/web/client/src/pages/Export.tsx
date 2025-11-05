import { useState } from 'react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileJson, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ExportOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  dataType: 'followers' | 'media' | 'hashtags' | 'demographics' | 'all';
}

export default function Export() {
  const { user } = useSupabaseAuth();
  const { data: profile } = useProfile(user?.id);
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const exportOptions: ExportOption[] = [
    {
      id: 'followers',
      label: 'Followers Data',
      description: 'Export your complete followers list with details',
      icon: <FileSpreadsheet className="w-6 h-6" />,
      dataType: 'followers',
    },
    {
      id: 'media',
      label: 'Media Performance',
      description: 'Export posts, reels, and stories with metrics',
      icon: <FileSpreadsheet className="w-6 h-6" />,
      dataType: 'media',
    },
    {
      id: 'hashtags',
      label: 'Hashtag Analytics',
      description: 'Export hashtag performance and usage data',
      icon: <FileSpreadsheet className="w-6 h-6" />,
      dataType: 'hashtags',
    },
    {
      id: 'demographics',
      label: 'Audience Demographics',
      description: 'Export demographic insights about your audience',
      icon: <FileSpreadsheet className="w-6 h-6" />,
      dataType: 'demographics',
    },
    {
      id: 'all',
      label: 'Complete Report',
      description: 'Export all analytics data in one file',
      icon: <FileJson className="w-6 h-6" />,
      dataType: 'all',
    },
  ];

  const handleExport = async (format: 'csv' | 'xlsx', dataType: string) => {
    if (!profile?.id) return;

    setLoading(`${dataType}-${format}`);
    setMessage(null);

    try {
      const response = await fetch('/api/export-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          profile_id: profile.id,
          format,
          data_type: dataType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Export failed');
      }

      if (data.signed_url) {
        // Create a temporary link and click it
        const link = document.createElement('a');
        link.href = data.signed_url;
        link.download = `instagram-analytics-${dataType}-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setMessage({
          type: 'success',
          text: `${dataType} exported successfully as ${format.toUpperCase()}!`,
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Export failed. Please try again.',
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Export Analytics</h1>
        <p className="text-gray-600 mt-2">Download your Instagram analytics data in CSV or XLSX format</p>
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

      {/* Export Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {exportOptions.map((option) => (
          <Card key={option.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-3">
                    {option.icon}
                    {option.label}
                  </CardTitle>
                  <CardDescription className="mt-2">{option.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button
                  onClick={() => handleExport('csv', option.dataType)}
                  disabled={loading !== null}
                  className="w-full"
                  variant="outline"
                >
                  {loading === `${option.dataType}-csv` ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Export as CSV
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => handleExport('xlsx', option.dataType)}
                  disabled={loading !== null}
                  className="w-full"
                >
                  {loading === `${option.dataType}-xlsx` ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Export as XLSX
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle>Export Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-blue-900">
          <p>
            <strong>CSV Format:</strong> Comma-separated values, compatible with Excel, Google Sheets, and most data analysis tools.
          </p>
          <p>
            <strong>XLSX Format:</strong> Microsoft Excel format with formatting and multiple sheets for complex data.
          </p>
          <p>
            <strong>Data Freshness:</strong> Exports include data from your last sync. Run a sync to get the latest data.
          </p>
          <p>
            <strong>File Size:</strong> Large exports may take a few seconds to generate. Downloads are automatically managed by your browser.
          </p>
        </CardContent>
      </Card>

      {/* Recent Exports */}
      <Card>
        <CardHeader>
          <CardTitle>Export History</CardTitle>
          <CardDescription>Your recent exports are available for 24 hours</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-600">
            <p>No recent exports yet. Start by exporting your data above!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
