import { useState } from 'react';
import { CheckCircle, Share2, Loader2, X, Gift } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { claimWhatsAppVerificationReward } from '../lib/rewards';

interface WhatsAppVerificationProps {
  isVerified: boolean;
  username: string;
  onVerificationComplete?: () => void;
}

export function WhatsAppVerification({
  isVerified,
  username,
  onVerificationComplete
}: WhatsAppVerificationProps) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [rewardClaimed, setRewardClaimed] = useState(false);
  const [showRewardMessage, setShowRewardMessage] = useState(false);

  const handleOpenModal = () => {
    setShowModal(true);
    setError(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setVerificationToken(null);
    setError(null);
  };

  const generateVerificationLink = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: tokenError } = await supabase
        .rpc('generate_user_verification_token');

      if (tokenError) throw tokenError;

      setVerificationToken(data);

      const verificationUrl = `${window.location.origin}/verify/${data}`;
      const shareText = `Check out my RatingSkill card! ${verificationUrl}`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

      window.open(whatsappUrl, '_blank');

      setTimeout(() => {
        checkVerificationStatus(data);
      }, 3000);

    } catch (err: any) {
      console.error('Error generating verification link:', err);
      setError(err.message || 'Failed to generate verification link');
    } finally {
      setLoading(false);
    }
  };

  const checkVerificationStatus = async (token: string) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, is_verified')
        .eq('verification_share_token', token)
        .single();

      if (profile?.is_verified) {
        const rewardResult = await claimWhatsAppVerificationReward(profile.id);

        if (rewardResult.success) {
          setRewardClaimed(true);
          setShowRewardMessage(true);
          setTimeout(() => setShowRewardMessage(false), 5000);
        }

        handleCloseModal();
        if (onVerificationComplete) {
          onVerificationComplete();
        }
      }
    } catch (err) {
      console.error('Error checking verification status:', err);
    }
  };

  if (isVerified) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircle className="w-5 h-5 text-green-600" />
        <span className="text-sm font-medium text-green-800">Profile Verified</span>
      </div>
    );
  }

  return (
    <>
      {showRewardMessage && (
        <div className="fixed top-4 right-4 z-[60] bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-4 rounded-lg shadow-2xl animate-slide-in">
          <div className="flex items-center gap-3">
            <Gift className="w-6 h-6" />
            <div>
              <p className="font-bold">Verification Successful!</p>
              <p className="text-sm">You earned 10 coins! 🎉</p>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleOpenModal}
        className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
      >
        <Share2 className="w-5 h-5" />
        Verify Profile on WhatsApp
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Share2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Verify Your Profile
              </h2>
              <p className="text-gray-600">
                Share your profile on WhatsApp to get verified and earn a blue checkmark badge!
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-300 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-900">Verification Reward:</h3>
                </div>
                <p className="text-lg font-bold text-blue-900 mb-3">🎁 Earn 10 Coins!</p>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Blue checkmark badge on your card</li>
                  <li>• Increased trust and credibility</li>
                  <li>• Stand out in leaderboards and battles</li>
                  <li>• Unlock social badge with 5+ friends</li>
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-900 mb-2">How it works:</h3>
                <ol className="text-sm text-yellow-800 space-y-1">
                  <li>1. Click "Share on WhatsApp"</li>
                  <li>2. Send the message to any contact or group</li>
                  <li>3. Your profile will be verified instantly</li>
                </ol>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              onClick={generateVerificationLink}
              disabled={loading}
              className="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating Link...
                </>
              ) : (
                <>
                  <Share2 className="w-5 h-5" />
                  Share on WhatsApp
                </>
              )}
            </button>

            <p className="text-xs text-gray-500 text-center mt-4">
              By verifying, you agree to share your profile publicly
            </p>
          </div>
        </div>
      )}
    </>
  );
}
