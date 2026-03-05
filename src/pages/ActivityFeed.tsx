import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Coins,
  Swords,
  Trophy,
  Heart,
  MessageSquare,
  Gift,
  RefreshCw,
  Activity,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

type FeedCategory = 'gold' | 'blue' | 'red' | 'purple';

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
  purple: { border: 'border-l-fuchsia-400', bg: 'bg-fuchsia-400/10', text: 'text-fuchsia-400' },
};

function classifyTransaction(type: string, amount: number): FeedCategory {
  const goldTypes = [
    'ad_reward', 'ad_view', 'comment_reward', 'reward_whatsapp',
    'reward_whatsapp_share', 'reward_social_share', 'reward_friend_milestone',
    'tutorial_completion', 'whatsapp_share', 'whatsapp_share_retroactive_credit',
    'card_sale', 'card_royalty', 'purchase_request_sale',
    'battle_win', 'battle_winner_payout', 'coin_purchase',
    'balance_correction',
  ];
  if (goldTypes.includes(type) && amount > 0) return 'gold';

  const blueTypes = ['coin_transfer_received', 'coin_transfer_sent'];
  if (blueTypes.includes(type)) return 'blue';

  if (type === 'card_purchase' || type === 'purchase') return 'gold';
  if (type === 'battle_wager' || type === 'battle_entry_fee') return 'purple';

  return amount > 0 ? 'gold' : 'red';
}

function transactionLabel(type: string, amount: number, desc: string): string {
  switch (type) {
    case 'card_purchase': return `Purchased a card for ${Math.abs(amount)} coins`;
    case 'card_sale': return `Sold a card and earned ${amount} coins`;
    case 'card_royalty': return `Earned ${amount} coins in royalties`;
    case 'ad_reward':
    case 'ad_view': return `Earned ${amount} coins from watching an ad`;
    case 'comment_reward': return `Earned ${amount} coins for commenting`;
    case 'coin_purchase': return `Bought ${amount} coins`;
    case 'reward_whatsapp':
    case 'reward_whatsapp_share':
    case 'whatsapp_share': return `Earned ${amount} coins from WhatsApp share`;
    case 'reward_social_share': return `Earned ${amount} coins from social share`;
    case 'reward_friend_milestone': return `Friend milestone reward: ${amount} coins`;
    case 'tutorial_completion': return `Completed tutorial and earned ${amount} coins`;
    case 'battle_win':
    case 'battle_winner_payout': return `Won a battle and earned ${amount} coins`;
    case 'battle_wager':
    case 'battle_entry_fee': return `Entered a battle with ${Math.abs(amount)} coins`;
    case 'coin_transfer_received': return `Received ${amount} coins from a friend`;
    case 'coin_transfer_sent': return `Sent ${Math.abs(amount)} coins to a friend`;
    case 'card_buyout':
    case 'card_buyout_payment': return `Card buyout: ${Math.abs(amount)} coins`;
    case 'balance_correction': return desc || `Balance adjustment: ${amount} coins`;
    default: return desc || `${type}: ${amount} coins`;
  }
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

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const since = sevenDaysAgo.toISOString();
    const allItems: FeedItem[] = [];

    try {
      const results = await Promise.allSettled([
        supabase
          .from('card_transactions')
          .select('id, seller_id, buyer_id, sale_price, transaction_type, created_at')
          .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(50),

        supabase
          .from('battles')
          .select('id, manager1_id, manager2_id, wager_amount, winner_id, completed_at')
          .eq('status', 'completed')
          .or(`manager1_id.eq.${user.id},manager2_id.eq.${user.id}`)
          .gte('completed_at', since)
          .order('completed_at', { ascending: false })
          .limit(50),

        supabase
          .from('leaderboard_cache')
          .select('rank, overall_rating, updated_at')
          .eq('user_id', user.id)
          .limit(1),

        supabase
          .from('coin_transactions')
          .select('id, amount, transaction_type, description, created_at')
          .eq('user_id', user.id)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(80),

        supabase
          .from('reward_logs')
          .select('id, reward_type, amount, milestone_level, created_at')
          .eq('user_id', user.id)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(50),

        supabase
          .from('profile_likes')
          .select('id, user_id, is_like, created_at')
          .eq('profile_id', user.id)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(50),

        supabase
          .from('comments')
          .select('id, commenter_name, text, created_at')
          .eq('profile_id', user.id)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      let hasAnyError = false;
      const errors: string[] = [];

      const [cardRes, battleRes, leaderboardRes, coinRes, rewardRes, likesRes, commentsRes] = results;

      if (cardRes.status === 'fulfilled' && !cardRes.value.error) {
        const rows = cardRes.value.data || [];
        for (const r of rows) {
          const isBuyer = r.buyer_id === user.id;
          allItems.push({
            id: `card-${r.id}`,
            label: isBuyer
              ? `Purchased a card for ${r.sale_price} coins`
              : `Sold a card for ${r.sale_price} coins`,
            timestamp: r.created_at,
            category: isBuyer ? 'gold' : 'gold',
            icon: <Coins className="w-4 h-4" />,
          });
        }
      } else {
        hasAnyError = true;
        errors.push('card trades');
      }

      if (battleRes.status === 'fulfilled' && !battleRes.value.error) {
        const rows = battleRes.value.data || [];
        for (const r of rows) {
          const won = r.winner_id === user.id;
          allItems.push({
            id: `battle-${r.id}`,
            label: won
              ? `Won a battle and earned ${r.wager_amount} coins`
              : `Lost a battle (${r.wager_amount} coin wager)`,
            timestamp: r.completed_at,
            category: won ? 'gold' : 'purple',
            icon: <Swords className="w-4 h-4" />,
          });
        }
      } else {
        hasAnyError = true;
        errors.push('battles');
      }

      if (leaderboardRes.status === 'fulfilled' && !leaderboardRes.value.error) {
        const rows = leaderboardRes.value.data || [];
        if (rows.length > 0) {
          const r = rows[0];
          allItems.push({
            id: `rank-current`,
            label: `Current leaderboard rank: #${r.rank} (Rating: ${r.overall_rating})`,
            timestamp: r.updated_at,
            category: 'gold',
            icon: <Trophy className="w-4 h-4" />,
          });
        }
      } else {
        hasAnyError = true;
        errors.push('leaderboard');
      }

      if (coinRes.status === 'fulfilled' && !coinRes.value.error) {
        const rows = coinRes.value.data || [];
        for (const r of rows) {
          allItems.push({
            id: `coin-${r.id}`,
            label: transactionLabel(r.transaction_type, r.amount, r.description),
            timestamp: r.created_at,
            category: classifyTransaction(r.transaction_type, r.amount),
            icon: <Coins className="w-4 h-4" />,
          });
        }
      } else {
        hasAnyError = true;
        errors.push('transactions');
      }

      if (rewardRes.status === 'fulfilled' && !rewardRes.value.error) {
        const rows = rewardRes.value.data || [];
        for (const r of rows) {
          const milestoneText = r.milestone_level ? ` (Level ${r.milestone_level})` : '';
          allItems.push({
            id: `reward-${r.id}`,
            label: `${r.reward_type} reward: ${r.amount} coins${milestoneText}`,
            timestamp: r.created_at,
            category: 'gold',
            icon: <Gift className="w-4 h-4" />,
          });
        }
      } else {
        hasAnyError = true;
        errors.push('rewards');
      }

      if (likesRes.status === 'fulfilled' && !likesRes.value.error) {
        const rows = likesRes.value.data || [];
        for (const r of rows) {
          allItems.push({
            id: `like-${r.id}`,
            label: r.is_like ? 'Someone liked your profile' : 'Someone disliked your profile',
            timestamp: r.created_at,
            category: 'blue',
            icon: <Heart className="w-4 h-4" />,
          });
        }
      } else {
        hasAnyError = true;
        errors.push('likes');
      }

      if (commentsRes.status === 'fulfilled' && !commentsRes.value.error) {
        const rows = commentsRes.value.data || [];
        for (const r of rows) {
          const name = r.commenter_name || 'Someone';
          const preview = r.text?.substring(0, 40) || '';
          allItems.push({
            id: `comment-${r.id}`,
            label: `${name} commented: "${preview}${r.text?.length > 40 ? '...' : ''}"`,
            timestamp: r.created_at,
            category: 'blue',
            icon: <MessageSquare className="w-4 h-4" />,
          });
        }
      } else {
        hasAnyError = true;
        errors.push('comments');
      }

      allItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const seen = new Set<string>();
      const deduped = allItems.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });

      setItems(deduped);

      if (hasAnyError && deduped.length === 0) {
        setError(`Failed to load: ${errors.join(', ')}`);
      }
    } catch (err) {
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
          {(['gold', 'blue', 'red', 'purple'] as FeedCategory[]).map(cat => {
            const labels: Record<FeedCategory, string> = {
              gold: 'Earnings',
              blue: 'Social',
              red: 'Spending',
              purple: 'Battles',
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
