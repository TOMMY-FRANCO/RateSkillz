import { useState, useEffect } from 'react';
import { Users, Gift, CheckCircle, Lock } from 'lucide-react';
import { getRewardStatus } from '../lib/rewards';
import { useAuth } from '../hooks/useAuth';

export function FriendMilestoneReward() {
  const { user } = useAuth();
  const [friendCount, setFriendCount] = useState(0);
  const [rewardClaimed, setRewardClaimed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRewardStatus();
  }, [user]);

  const loadRewardStatus = async () => {
    if (!user) return;

    setLoading(true);
    const status = await getRewardStatus(user.id);
    if (status) {
      setFriendCount(status.friend_count);
      setRewardClaimed(status.friend_milestone_reward_claimed);
    }
    setLoading(false);
  };

  const progress = Math.min((friendCount / 5) * 100, 100);
  const isComplete = friendCount >= 5;

  if (loading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 animate-pulse">
        <div className="h-20 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (rewardClaimed) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-green-600" />
          <div>
            <p className="font-semibold text-green-900">Friend Milestone Reward Claimed!</p>
            <p className="text-sm text-green-700">You earned 10 coins for reaching 5 friends</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-6 transition ${
      isComplete
        ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-300'
        : 'bg-gray-50 border-gray-200'
    }`}>
      <div className="flex items-start gap-3 mb-4">
        {isComplete ? (
          <Gift className="w-6 h-6 text-yellow-600 mt-1" />
        ) : (
          <Users className="w-6 h-6 text-gray-600 mt-1" />
        )}
        <div className="flex-1">
          <h3 className="font-bold text-lg text-gray-900">
            {isComplete ? '🎉 Milestone Reached!' : 'Friend Milestone'}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {isComplete
              ? 'You reached 5 friends! Your reward has been automatically added.'
              : 'Reach 5 friends to earn 10 coins (one-time reward)'}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-700 font-medium">
            Progress: {friendCount} / 5 Friends
          </span>
          <span className={`font-bold ${isComplete ? 'text-green-600' : 'text-gray-600'}`}>
            {Math.round(progress)}%
          </span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              isComplete
                ? 'bg-gradient-to-r from-yellow-400 to-orange-500'
                : 'bg-blue-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {!isComplete && (
          <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
            <Lock className="w-4 h-4" />
            <span>{5 - friendCount} more {5 - friendCount === 1 ? 'friend' : 'friends'} needed</span>
          </div>
        )}

        {isComplete && !rewardClaimed && (
          <div className="mt-3 bg-yellow-100 border border-yellow-300 rounded-lg p-3">
            <p className="text-yellow-900 text-sm font-semibold text-center">
              ⏳ Your 10 coin reward is being processed...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
