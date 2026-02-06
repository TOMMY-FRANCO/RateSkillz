import { useState, useEffect, useCallback } from 'react';
import { Users, Coins, CheckCircle, Sparkles } from 'lucide-react';
import { getRewardStatus } from '../lib/rewards';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

const MAX_FRIENDS = 5;
const COINS_PER_FRIEND = 5;
const TOTAL_REWARD = MAX_FRIENDS * COINS_PER_FRIEND;

function ShimmerBar({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-white/[0.06] ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent animate-shimmer" />
    </div>
  );
}

export function FriendMilestoneReward() {
  const { user } = useAuth();
  const [friendCount, setFriendCount] = useState(0);
  const [claimedCount, setClaimedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadRewardStatus = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const status = await getRewardStatus(user.id);
    if (status) {
      setFriendCount(status.friend_count);
      setClaimedCount(status.friend_milestone_claimed_count);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadRewardStatus();
  }, [loadRewardStatus]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('friend-milestone-reward')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reward_logs', filter: `user_id=eq.${user.id}` },
        () => { loadRewardStatus(); }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        () => { loadRewardStatus(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, loadRewardStatus]);

  const isComplete = claimedCount >= MAX_FRIENDS;
  const displayCount = Math.min(claimedCount, MAX_FRIENDS);
  const totalEarned = displayCount * COINS_PER_FRIEND;
  const progress = (displayCount / MAX_FRIENDS) * 100;

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 border border-white/[0.06] rounded-2xl p-5 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <ShimmerBar className="w-10 h-10 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <ShimmerBar className="h-4 w-36 rounded" />
            <ShimmerBar className="h-3 w-52 rounded" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between">
            <ShimmerBar className="h-3 w-24 rounded" />
            <ShimmerBar className="h-3 w-16 rounded" />
          </div>
          <ShimmerBar className="h-3 w-full rounded-full" />
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <ShimmerBar key={i} className="flex-1 h-9 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="relative bg-gradient-to-br from-emerald-950/60 to-emerald-900/40 border border-emerald-500/20 rounded-2xl p-5 backdrop-blur-sm overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center ring-2 ring-emerald-500/20">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="font-bold text-emerald-100 text-sm">Milestone Complete!</p>
            <p className="text-emerald-400/80 text-xs">
              You've earned {TOTAL_REWARD} coins from {MAX_FRIENDS} friends
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: MAX_FRIENDS }).map((_, i) => (
            <div
              key={i}
              className="flex-1 h-2 rounded-full bg-emerald-500/60"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-gradient-to-br from-gray-900/80 to-gray-800/80 border border-white/[0.06] rounded-2xl p-5 backdrop-blur-sm overflow-hidden">
      <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/[0.03] rounded-full -translate-y-1/2 translate-x-1/2" />

      <div className="relative flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
          <Users className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            Friend Milestone
            <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
              +{COINS_PER_FRIEND} per friend
            </span>
          </h3>
          <p className="text-gray-400 text-xs mt-0.5">
            Earn {COINS_PER_FRIEND} coins per friend added! [{displayCount}/{MAX_FRIENDS} friends]
          </p>
        </div>
      </div>

      <div className="relative space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 font-medium">
            {totalEarned} / {TOTAL_REWARD} coins earned
          </span>
          <span className="text-amber-400 font-bold">
            {Math.round(progress)}%
          </span>
        </div>

        <div className="w-full bg-white/[0.06] rounded-full h-2.5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex gap-1.5">
          {Array.from({ length: MAX_FRIENDS }).map((_, i) => {
            const isClaimed = i < displayCount;
            return (
              <div
                key={i}
                className={`flex-1 rounded-lg py-1.5 flex flex-col items-center gap-0.5 border transition-all duration-300 ${
                  isClaimed
                    ? 'bg-amber-500/10 border-amber-500/25'
                    : 'bg-white/[0.02] border-white/[0.06]'
                }`}
              >
                {isClaimed ? (
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Coins className="w-3.5 h-3.5 text-gray-600" />
                )}
                <span className={`text-[10px] font-bold ${isClaimed ? 'text-amber-400' : 'text-gray-600'}`}>
                  +{COINS_PER_FRIEND}
                </span>
              </div>
            );
          })}
        </div>

        {displayCount < MAX_FRIENDS && (
          <p className="text-center text-[11px] text-gray-500 pt-0.5">
            {MAX_FRIENDS - displayCount} more {MAX_FRIENDS - displayCount === 1 ? 'friend' : 'friends'} to go
            &middot; {TOTAL_REWARD - totalEarned} coins remaining
          </p>
        )}
      </div>
    </div>
  );
}
