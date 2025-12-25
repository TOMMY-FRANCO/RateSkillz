import { useState, useEffect } from 'react';
import { Twitter, Facebook, Gift, CheckCircle } from 'lucide-react';
import { markSocialPlatformShared, claimSocialSharingReward, getRewardStatus } from '../lib/rewards';
import { useAuth } from '../hooks/useAuth';

interface SocialSharingRewardProps {
  username: string;
  profileUrl: string;
}

export function SocialSharingReward({ username, profileUrl }: SocialSharingRewardProps) {
  const { user } = useAuth();
  const [sharedX, setSharedX] = useState(false);
  const [sharedFacebook, setSharedFacebook] = useState(false);
  const [rewardClaimed, setRewardClaimed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRewardStatus();
  }, [user]);

  const loadRewardStatus = async () => {
    if (!user) return;

    const status = await getRewardStatus(user.id);
    if (status) {
      setSharedX(status.has_shared_x);
      setSharedFacebook(status.has_shared_facebook);
      setRewardClaimed(status.social_reward_claimed);
    }
  };

  const handleShareToX = async () => {
    if (!user || sharedX) return;

    setLoading(true);
    setError(null);

    const text = `Check out my player card on PlayerCards! @${username}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(profileUrl)}`;

    window.open(url, '_blank', 'width=600,height=400');

    const success = await markSocialPlatformShared(user.id, 'x');
    if (success) {
      setSharedX(true);

      const updatedStatus = await getRewardStatus(user.id);
      if (updatedStatus && updatedStatus.has_shared_facebook && !updatedStatus.social_reward_claimed) {
        await tryClaimReward();
      }
    } else {
      setError('Failed to record share. Please try again.');
    }

    setLoading(false);
  };

  const handleShareToFacebook = async () => {
    if (!user || sharedFacebook) return;

    setLoading(true);
    setError(null);

    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl)}`;

    window.open(url, '_blank', 'width=600,height=400');

    const success = await markSocialPlatformShared(user.id, 'facebook');
    if (success) {
      setSharedFacebook(true);

      const updatedStatus = await getRewardStatus(user.id);
      if (updatedStatus && updatedStatus.has_shared_x && !updatedStatus.social_reward_claimed) {
        await tryClaimReward();
      }
    } else {
      setError('Failed to record share. Please try again.');
    }

    setLoading(false);
  };

  const tryClaimReward = async () => {
    if (!user || rewardClaimed) return;

    setLoading(true);
    const result = await claimSocialSharingReward(user.id);

    if (result.success) {
      setRewardClaimed(true);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    } else {
      setError(result.error || 'Failed to claim reward');
    }

    setLoading(false);
  };

  const bothShared = sharedX && sharedFacebook;
  const canClaimReward = bothShared && !rewardClaimed;

  if (rewardClaimed) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-green-600" />
          <div>
            <p className="font-semibold text-green-900">Social Sharing Reward Claimed!</p>
            <p className="text-sm text-green-700">You earned 20 coins for sharing your profile</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
      <div className="flex items-start gap-3 mb-4">
        <Gift className="w-6 h-6 text-blue-600 mt-1" />
        <div className="flex-1">
          <h3 className="font-bold text-lg text-gray-900">Earn 20 Coins!</h3>
          <p className="text-sm text-gray-600 mt-1">
            Share your profile to both X and Facebook to earn 20 coins (one-time reward)
          </p>
        </div>
      </div>

      {showSuccess && (
        <div className="mb-4 bg-green-100 border border-green-300 rounded-lg p-3">
          <p className="text-green-800 font-semibold">🎉 Congratulations! You earned 20 coins!</p>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-100 border border-red-300 rounded-lg p-3">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        <button
          onClick={handleShareToX}
          disabled={loading || sharedX}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition ${
            sharedX
              ? 'bg-green-100 border-2 border-green-300 cursor-default'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="flex items-center gap-3">
            <Twitter className="w-5 h-5" />
            <span className="font-semibold">
              {sharedX ? 'Shared to X' : 'Share to X (Twitter)'}
            </span>
          </div>
          {sharedX && <CheckCircle className="w-5 h-5 text-green-600" />}
        </button>

        <button
          onClick={handleShareToFacebook}
          disabled={loading || sharedFacebook}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition ${
            sharedFacebook
              ? 'bg-green-100 border-2 border-green-300 cursor-default'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="flex items-center gap-3">
            <Facebook className="w-5 h-5" />
            <span className="font-semibold">
              {sharedFacebook ? 'Shared to Facebook' : 'Share to Facebook'}
            </span>
          </div>
          {sharedFacebook && <CheckCircle className="w-5 h-5 text-green-600" />}
        </button>
      </div>

      {bothShared && canClaimReward && (
        <div className="mt-4 pt-4 border-t border-blue-200">
          <button
            onClick={tryClaimReward}
            disabled={loading}
            className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white font-bold py-3 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Claiming Reward...' : '🎁 Claim 20 Coins Reward'}
          </button>
        </div>
      )}

      {bothShared && !canClaimReward && !rewardClaimed && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">Processing your reward...</p>
        </div>
      )}
    </div>
  );
}
