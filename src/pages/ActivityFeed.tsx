import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Award,
  Heart,
  Shield,
  TrendingUp,
  RefreshCw,
  Activity,
  BookOpen,
  Coins,
  Users,
  Swords,
  Eye,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { markNotificationsRead } from '../lib/notifications';

type FeedCategory = 'gold' | 'blue' | 'red' | 'purple';

interface FeedItem {
  id: string;
  label: string;
  timestamp: string;
  category: FeedCategory;
  notificationType: string;
  icon: React.ReactNode;
}

const CATEGORY_STYLES: Record<FeedCategory, { border: string; bg: string; text: string; label: string }> = {
  gold:   { border: 'border-l-amber-400',  bg: 'bg-amber-400/10',  text: 'text-amber-400',  label: 'Card Updates'  },
  blue:   { border: 'border-l-sky-400',    bg: 'bg-sky-400/10',    text: 'text-sky-400',    label: 'Social'        },
  red:    { border: 'border-l-red-400',    bg: 'bg-red-400/10',    text: 'text-red-400',    label: 'Security'      },
  purple: { border: 'border-l-purple-400', bg: 'bg-purple-400/10', text: 'text-purple-400', label: 'Daily Wrap-up' },
};

function getNotificationIcon(notificationType: string, category: FeedCategory, message: string): React.ReactNode {
  const msg = message.toLowerCase();

  if (category === 'red') return <Shield className="w-4 h-4" />;

  if (category === 'purple') {
    if (msg.includes('quiz'))   return <BookOpen className="w-4 h-4" />;
    if (msg.includes('battle')) return <Swords className="w-4 h-4" />;
    if (msg.includes('coin'))   return <Coins className="w-4 h-4" />;
    if (msg.includes('friend')) return <Users className="w-4 h-4" />;
    if (msg.includes('view'))   return <Eye className="w-4 h-4" />;
    if (msg.includes('like'))   return <Heart className="w-4 h-4" />;
    return <TrendingUp className="w-4 h-4" />;
  }

  if (category === 'blue') {
    if (msg.includes('friend')) return <Users className="w-4 h-4" />;
    return <Heart className="w-4 h-4" />;
  }

  // gold
  if (msg.includes('quiz'))   return <BookOpen className="w-4 h-4" />;
  if (msg.includes('coin'))   return <Coins className="w-4 h-4" />;
  if (msg.includes('battle')) return <Swords className="w-4 h-4" />;
  return <Award className="w-4 h-4" />;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getDateGroup(dateStr: string): string {
  const d         = new Date(dateStr);
  const now       = new Date();
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const itemDate  = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (itemDate.getTime() === today.getTime())     return 'Today';
  if (itemDate.getTime() === yesterday.getTime()) return 'Yesterday';
  return 'Earlier This Week';
}

const GROUP_ORDER = ['Today', 'Yesterday', 'Earlier This Week'];

export default function ActivityFeed() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [items,        setItems]        = useState<FeedItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const touchStartY = useRef(0);
  const isAtTop     = useRef(true);

  // Track real scroll position on window — containerRef.scrollTop is always
  // 0 in a PWA because scrolling happens on window, not the div
  useEffect(() => {
    const handleScroll = () => {
      isAtTop.current = window.scrollY === 0;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ─── data loading ─────────────────────────────────────────────────────────
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
        const category = (['gold', 'blue', 'red', 'purple'].includes(row.activity_feed_type)
          ? row.activity_feed_type
          : 'gold') as FeedCategory;
        const message = row.message || '';
        return {
          id:               `notif-${row.id}`,
          label:            message,
          timestamp:        row.created_at,
          category,
          notificationType: row.notification_type,
          icon:             getNotificationIcon(row.notification_type, category, message),
        };
      });

      setItems(feedItems);
    } catch {
      setError('Something went wrong loading your activity. Pull down to try again.');
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    markNotificationsRead(user.id, 'rank_update').catch(() => {});
    setLoading(true);
    loadFeed().finally(() => setLoading(false));
  }, [user, loadFeed]);

  // ─── pull-to-refresh ──────────────────────────────────────────────────────
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
    if (isAtTop.current) {
      touchStartY.current = e.touches[0].clientY;
    } else {
      touchStartY.current = 0;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === 0 || isRefreshing) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff, 100));
    } else {
      // Swiped up — cancel pull
      touchStartY.current = 0;
      setPullDistance(0);
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 60 && !isRefreshing) handleRefresh();
    else setPullDistance(0);
    touchStartY.current = 0;
  };

  // ─── grouping ─────────────────────────────────────────────────────────────
  const grouped: Record<string, FeedItem[]> = {};
  for (const item of items) {
    const group = getDateGroup(item.timestamp);
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(item);
  }

  // ─── next scheduled update ────────────────────────────────────────────────
  function getNextUpdateTime(): string {
    const now    = new Date();
    const london = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }));
    const h      = london.getHours();
    const nextHour = [6, 15, 16].find(t => t > h) ?? 6;
    return nextHour === 6 ? '6am' : nextHour === 15 ? '3pm' : '4pm';
  }

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen pb-24"
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

      {/* header */}
      <div className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-[#B0B8C8] hover:text-white transition-colors"
              >
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

        {/* category legend */}
        <div className="flex items-center gap-4 flex-wrap">
          {(Object.entries(CATEGORY_STYLES) as [FeedCategory, typeof CATEGORY_STYLES[FeedCategory]][]).map(([cat, style]) => (
            <div key={cat} className="flex items-center gap-1.5 text-xs">
              <div className={`w-2.5 h-2.5 rounded-full ${style.bg} border ${style.border}`} />
              <span className="text-[#B0B8C8]">{style.label}</span>
            </div>
          ))}
        </div>

        {/* next update banner */}
        {!loading && !error && (
          <div className="flex items-center gap-2 text-xs text-[#7A8599] bg-white/5 rounded-lg px-3 py-2">
            <Activity className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Next update at <strong className="text-[#B0B8C8]">{getNextUpdateTime()}</strong> London time</span>
          </div>
        )}

        {/* loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="text-[#B0B8C8] text-sm">Loading your activity...</p>
          </div>
        )}

        {/* error */}
        {error && !loading && (
          <div className="glass-card p-6 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
            <p className="text-red-400 font-medium">{error}</p>
            <button onClick={handleRefresh} className="btn-secondary px-4 py-2 text-sm">
              Try Again
            </button>
          </div>
        )}

        {/* empty state */}
        {!loading && !error && items.length === 0 && (
          <div className="glass-card p-10 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl flex items-center justify-center">
              <Activity className="w-8 h-8 text-[#B0B8C8]" />
            </div>
            <h3 className="text-white font-bold text-lg">No Recent Activity</h3>
            <p className="text-[#B0B8C8] text-sm max-w-xs mx-auto">
              Your daily wrap-ups, card updates, and social activity will appear here.
              Check back after <strong>{getNextUpdateTime()}</strong>!
            </p>
          </div>
        )}

        {/* feed */}
        {!loading && !error && items.length > 0 && (
          <div className="space-y-6">
            {GROUP_ORDER.map(groupName => {
              const groupItems = grouped[groupName];
              if (!groupItems?.length) return null;
              return (
                <div key={groupName}>
                  <h2 className="text-sm font-semibold text-[#B0B8C8] uppercase tracking-wider mb-3">
                    {groupName}
                  </h2>
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