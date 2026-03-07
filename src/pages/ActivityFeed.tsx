import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Award,
  Heart,
  MessageSquare,
  Shield,
  Star,
  Users,
  Bell,
  RefreshCw,
  Activity,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

type FeedCategory = 'gold' | 'blue' | 'red';

interface FeedItem {
  id: string;
  label: string;
  timestamp: string;
  category: FeedCategory;
  icon: React.ReactNode;
}

const CATEGORY_STYLES: Record<FeedCategory, { border: string; bg: string; text: string }> = {
  gold: { border: 'border-l-amber-400', bg: 'bg-amber-400/10', text: 'text-amber-400' },
  blue: { border: 'border-l-sky-400', bg: 'bg-sky-400/10', text: 'text-sky-400' },
  red: { border: 'border-l-red-400', bg: 'bg-red-400/10', text: 'text-red-400' },
};

function getNotificationIcon(type: string, category: FeedCategory): React.ReactNode {
  if (category === 'red') return <Shield className="w-4 h-4" />;
  if (type === 'social') {
    return <Heart className="w-4 h-4" />;
  }
  return <Award className="w-4 h-4" />;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getDateGroup(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (itemDate.getTime() === today.getTime()) return 'Today';
  if (itemDate.getTime() === yesterday.getTime()) return 'Yesterday';
  return 'Earlier This Week';
}

export default function ActivityFeed() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadFeed = useCallback(async () => {
    if (!user) return;
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('user_notifications')
        .select('id, notification_type, message, activity_feed_type, created_at')
        .eq('user_id', user.id)
        .not('activity_feed_type', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (fetchError) {
        setError('Failed to load activity feed. Pull down to try again.');
        return;
      }

      const feedItems: FeedItem[] = (data || []).map(row => {
        const category = (['gold', 'blue', 'red'].includes(row.activity_feed_type)
          ? row.activity_feed_type
          : 'gold') as FeedCategory;
        return {
          id: `notif-${row.id}`,
          label: row.message || '',
          timestamp: row.created_at,
          category,
          icon: getNotificationIcon(row.notification_type, category),
        };
      });

      setItems(feedItems);
    } catch {
      setError('Something went wrong loading your activity. Pull down to try again.');
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    loadFeed().finally(() => setLoading(false));
  }, [user, loadFeed]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await loadFeed();
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [isRefreshing, loadFeed]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === 0 || isRefreshing) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0 && containerRef.current && containerRef.current.scrollTop === 0) {
      setPullDistance(Math.min(diff, 100));
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 60 && !isRefreshing) {
      handleRefresh();
    } else {
      setPullDistance(0);
    }
    touchStartY.current = 0;
  };

  const grouped: Record<string, FeedItem[]> = {};
  for (const item of items) {
    const group = getDateGroup(item.timestamp);
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(item);
  }

  const groupOrder = ['Today', 'Yesterday', 'Earlier This Week'];

  return (
    <div
      className="min-h-screen pb-24"
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {pullDistance > 0 && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-gradient-to-b from-gray-900/90 to-transparent"
          style={{ height: `${pullDistance}px`, opacity: pullDistance / 100 }}
        >
          <RefreshCw className={`w-6 h-6 text-white ${isRefreshing ? 'animate-spin' : ''}`} />
        </div>
      )}

      <div className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center space-x-3">
              <button onClick={() => navigate('/dashboard')} className="text-[#B0B8C8] hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-lg font-bold text-white">Activity Feed</h1>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="text-[#B0B8C8] hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center gap-4 flex-wrap">
          {(['gold', 'blue', 'red'] as FeedCategory[]).map(cat => {
            const labels: Record<FeedCategory, string> = {
              gold: 'Achievements',
              blue: 'Social',
              red: 'Security',
            };
            return (
              <div key={cat} className="flex items-center gap-1.5 text-xs">
                <div className={`w-2.5 h-2.5 rounded-full ${CATEGORY_STYLES[cat].bg} border ${CATEGORY_STYLES[cat].border}`} />
                <span className="text-[#B0B8C8]">{labels[cat]}</span>
              </div>
            );
          })}
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="text-[#B0B8C8] text-sm">Loading your activity...</p>
          </div>
        )}

        {error && !loading && (
          <div className="glass-card p-6 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
            <p className="text-red-400 font-medium">{error}</p>
            <button
              onClick={handleRefresh}
              className="btn-secondary px-4 py-2 text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="glass-card p-10 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl flex items-center justify-center">
              <Activity className="w-8 h-8 text-[#B0B8C8]" />
            </div>
            <h3 className="text-white font-bold text-lg">No Recent Activity</h3>
            <p className="text-[#B0B8C8] text-sm max-w-xs mx-auto">
              Your activity from the last 7 days will appear here. Start trading cards, battling, or earning coins!
            </p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="space-y-6">
            {groupOrder.map(groupName => {
              const groupItems = grouped[groupName];
              if (!groupItems || groupItems.length === 0) return null;
              return (
                <div key={groupName}>
                  <h2 className="text-sm font-semibold text-[#B0B8C8] uppercase tracking-wider mb-3">{groupName}</h2>
                  <div className="space-y-2">
                    {groupItems.map((item, i) => {
                      const style = CATEGORY_STYLES[item.category];
                      return (
                        <div
                          key={item.id}
                          className={`glass-card border-l-4 ${style.border} p-3 sm:p-4 flex items-start gap-3 animate-fade-in`}
                          style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                        >
                          <div className={`w-8 h-8 rounded-lg ${style.bg} flex items-center justify-center flex-shrink-0 ${style.text}`}>
                            {item.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm leading-snug">{item.label}</p>
                            <p className="text-[#7A8599] text-xs mt-1">{formatTime(item.timestamp)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
