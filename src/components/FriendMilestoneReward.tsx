import { useState, useEffect, useCallback, useRef } from 'react';
import { Users, CheckCircle, Trophy, Lock } from 'lucide-react';
import { getFriendMilestoneStatus } from '../lib/rewards';
import { useAuth } from '../hooks/useAuth';
import { ShimmerBar, StaggerItem } from './ui/Shimmer';
import { playSound } from '../lib/sounds';

interface MilestoneLevel {
  level: number;
  coins: number;
  claimed: boolean;
}

const MILESTONES = [
  { level: 5, coins: 10 },
  { level: 10, coins: 20 },
  { level: 25, coins: 50 },
  { level: 50, coins: 100 },
];

const TOTAL_POSSIBLE_COINS = MILESTONES.reduce((sum, m) => sum + m.coins, 0);

export function FriendMilestoneReward() {
  const { user } = useAuth();
  const [friendCount, setFriendCount] = useState(0);
  const [milestones, setMilestones] = useState<MilestoneLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const prevClaimedRef = useRef<Set<number>>(new Set());

  const loadRewardStatus = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const status = await getFriendMilestoneStatus(user.id);
    if (status) {
      setFriendCount(status.friend_count);
      const newMilestones = MILESTONES.map(m => ({
        level: m.level,
        coins: m.coins,
        claimed: status.claimed_milestones.includes(m.level)
      }));

      const newClaimedSet = new Set(status.claimed_milestones);
      const previouslyUnclaimed = [...newClaimedSet].filter(level => !prevClaimedRef.current.has(level));

      if (previouslyUnclaimed.length > 0 && prevClaimedRef.current.size > 0) {
        playSound(previouslyUnclaimed.includes(50) ? 'milestone' : 'coin-received');
      }
      prevClaimedRef.current = newClaimedSet;
      setMilestones(newMilestones);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadRewardStatus();
  }, [loadRewardStatus]);

  const claimedMilestones = milestones.filter(m => m.claimed);
  const totalEarned = claimedMilestones.reduce((sum, m) => sum + m.coins, 0);
  const nextMilestone = milestones.find(m => !m.claimed);
  const allComplete = claimedMilestones.length === MILESTONES.length;

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 border border-white/[0.06] rounded-2xl p-5 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <StaggerItem index={0}>
            <ShimmerBar className="w-10 h-10 rounded-xl" />
          </StaggerItem>
          <StaggerItem index={1} className="flex-1 space-y-2">
            <ShimmerBar className="h-4 w-48 rounded" />
            <ShimmerBar className="h-3 w-64 rounded" />
          </StaggerItem>
        </div>
        <div className="space-y-3">
          <StaggerItem index={2} className="flex justify-between">
            <ShimmerBar className="h-3 w-32 rounded" speed="slow" />
            <ShimmerBar className="h-3 w-20 rounded" speed="slow" />
          </StaggerItem>
          <StaggerItem index={3} className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <ShimmerBar key={i} className="h-20 rounded-lg" />
            ))}
          </StaggerItem>
        </div>
      </div>
    );
  }

  if (allComplete) {
    return (
      <div className="relative bg-gradient-to-br from-emerald-950/60 to-emerald-900/40 border border-emerald-500/20 rounded-2xl p-5 backdrop-blur-sm overflow-hidden animate-content-reveal">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center ring-2 ring-emerald-500/20">
            <Trophy className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-emerald-100 text-sm">All Milestones Complete!</p>
            <p className="text-emerald-400/80 text-xs">
              You've earned {TOTAL_POSSIBLE_COINS} coins from {friendCount} friends
            </p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {milestones.map((milestone) => (
            <div
              key={milestone.level}
              className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5 text-center"
            >
              <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
              <div className="text-[11px] font-bold text-emerald-300">{milestone.level}</div>
              <div className="text-[10px] text-emerald-400/80">+{milestone.coins}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-gradient-to-br from-gray-900/80 to-gray-800/80 border border-white/[0.06] rounded-2xl p-5 backdrop-blur-sm overflow-hidden animate-content-reveal">
      <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/[0.03] rounded-full -translate-y-1/2 translate-x-1/2" />

      <div className="relative flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
          <Users className="w-5 h-5 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            Friend Milestones
            <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
              {friendCount} friends
            </span>
          </h3>
          <p className="text-gray-400 text-xs mt-0.5">
            {nextMilestone
              ? `Earn coins at milestones! Next: ${nextMilestone.level} friends (+${nextMilestone.coins} coins)`
              : 'You reached all milestones!'}
          </p>
        </div>
      </div>

      <div className="relative space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 font-medium">
            {totalEarned} / {TOTAL_POSSIBLE_COINS} coins earned
          </span>
          <span className="text-blue-400 font-bold">
            {claimedMilestones.length}/{MILESTONES.length} milestones
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {milestones.map((milestone) => {
            const isReached = friendCount >= milestone.level;
            const isClaimed = milestone.claimed;
            const isNext = nextMilestone?.level === milestone.level;

            return (
              <div
                key={milestone.level}
                className={`rounded-lg p-2.5 border transition-all duration-300 ${
                  isClaimed
                    ? 'bg-blue-500/15 border-blue-500/30'
                    : isNext
                    ? 'bg-blue-500/5 border-blue-500/20 ring-2 ring-blue-500/20'
                    : 'bg-white/[0.02] border-white/[0.06]'
                }`}
              >
                <div className="flex flex-col items-center gap-1 text-center">
                  {isClaimed ? (
                    <CheckCircle className="w-4 h-4 text-blue-400" />
                  ) : isReached ? (
                    <div className="w-4 h-4 rounded-full bg-blue-500/20 animate-pulse" />
                  ) : (
                    <Lock className="w-4 h-4 text-gray-600" />
                  )}
                  <div className={`text-[11px] font-bold ${isClaimed ? 'text-blue-400' : isNext ? 'text-blue-300' : 'text-gray-500'}`}>
                    {milestone.level} friends
                  </div>
                  <div className={`text-[10px] font-semibold ${isClaimed ? 'text-blue-300' : isNext ? 'text-blue-400' : 'text-gray-600'}`}>
                    +{milestone.coins} coins
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {nextMilestone && (
          <p className="text-center text-[11px] text-gray-500 pt-0.5">
            {nextMilestone.level - friendCount} more {nextMilestone.level - friendCount === 1 ? 'friend' : 'friends'} to next milestone
            &middot; {TOTAL_POSSIBLE_COINS - totalEarned} coins remaining
          </p>
        )}
      </div>
    </div>
  );
}
