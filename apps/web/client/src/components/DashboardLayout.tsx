import { useState } from 'react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  Users,
  FileText,
  Clock,
  Hash,
  PieChart,
  Download,
  Settings,
  LogOut,
  Menu,
  X,
  Instagram,
  Loader2,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useSupabaseAuth();
  const { data: profile, isLoading: profileLoading } = useProfile(user?.id);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [location] = useLocation();

  const navItems: NavItem[] = [
    { label: 'Overview', href: '/dashboard/overview', icon: <BarChart3 className="w-5 h-5" /> },
    { label: 'Connect IG', href: '/dashboard/connect-ig', icon: <Instagram className="w-5 h-5" /> },
    { label: 'Followers', href: '/dashboard/followers', icon: <Users className="w-5 h-5" /> },
    { label: 'Content', href: '/dashboard/content', icon: <FileText className="w-5 h-5" /> },
    { label: 'Hours', href: '/dashboard/hours', icon: <Clock className="w-5 h-5" /> },
    { label: 'Hashtags', href: '/dashboard/hashtags', icon: <Hash className="w-5 h-5" /> },
    { label: 'Demographics', href: '/dashboard/demographics', icon: <PieChart className="w-5 h-5" /> },
    { label: 'Export', href: '/dashboard/export', icon: <Download className="w-5 h-5" /> },
    { label: 'Settings', href: '/dashboard/settings', icon: <Settings className="w-5 h-5" /> },
  ];

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  const isActive = (href: string) => location === href;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-white border-r border-gray-200 transition-all duration-300 flex flex-col shadow-sm`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-500 rounded-lg flex items-center justify-center">
              <Instagram className="w-6 h-6 text-white" />
            </div>
            {sidebarOpen && <span className="font-bold text-lg">InstaMetrics</span>}
          </div>
        </div>

        {/* Profile Section */}
        {sidebarOpen && profile && (
          <div className="p-4 border-b border-gray-200">
            <div className="text-sm">
              <p className="font-semibold text-gray-900">@{profile.ig_username}</p>
              <p className="text-xs text-gray-600">{profile.followers_count.toLocaleString()} followers</p>
              <div className="mt-2">
                <span
                  className={`inline-block px-2 py-1 rounded text-xs font-medium ${
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
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <a
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive(item.href)
                    ? 'bg-pink-50 text-pink-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                title={!sidebarOpen ? item.label : undefined}
              >
                {item.icon}
                {sidebarOpen && (
                  <>
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto bg-pink-500 text-white text-xs px-2 py-1 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </a>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 space-y-2">
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full justify-start gap-2"
            size="sm"
          >
            <LogOut className="w-4 h-4" />
            {sidebarOpen && 'Logout'}
          </Button>
          <Button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            variant="ghost"
            className="w-full justify-start gap-2"
            size="sm"
          >
            {sidebarOpen ? (
              <>
                <X className="w-4 h-4" />
                Collapse
              </>
            ) : (
              <Menu className="w-4 h-4" />
            )}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {navItems.find((item) => isActive(item.href))?.label || 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {profileLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            ) : (
              <div className="text-sm text-gray-600">
                {user?.email && <p>{user.email}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Page Content */}
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
