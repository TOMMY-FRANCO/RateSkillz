import { useState, useEffect } from 'react';
import { MessageCircle, Gift, CheckCircle, Coins } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

interface WhatsAppDashboardShareProps {
  username: string;
  profileUrl: string;
}

export function WhatsAppDashboardShare({ username, profileUrl }: WhatsAppDashboardShareProps) {
  const { user } = useAuth();
  const [claimed, setClaimed] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overallRating, setOverallRating] = useState(0);
  const [newBalance, setNewBalance] = useState<number | null>(null);

  useEffect(() => {
    checkClaimStatus();
    fetchProfileData();
  }, [user]);

  const fetchProfileData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('overall_rating')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setOverallRating(data.overall_rating || 0);
      }
    } catch (err) {
      console.error('Error fetching profile data:', err);
    }
  };

  const checkClaimStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('whatsapp_share_claimed')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setClaimed(data.whatsapp_share_claimed || false);
      }
    } catch (err) {
      console.error('Error checking claim status:', err);
    }
  };

  const handleWhatsAppShare = async () => {
    if (!user || claimed || claiming) return;

    setClaiming(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc('claim_whatsapp_share_reward', {
        p_user_id: user.id
      });

      if (error) throw error;

      if (!data.success) {
        setError(data.error || 'Failed to claim reward');
        setClaiming(false);
        return;
      }

      setClaimed(true);
      setShowSuccess(true);
      setNewBalance(data.new_balance);

      const shareText = `Check out @${username}'s Football Player Card! Overall Rating: ${overallRating}. Rate me on RatingSkill!`;
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + profileUrl)}`;

      window.open(whatsappUrl, '_blank');

      setTimeout(() => setShowSuccess(false), 5000);
    } catch (err) {
      console.error('Error claiming WhatsApp share reward:', err);
      setError('Failed to claim reward. Please try again.');
    } finally {
      setClaiming(false);
    }
  };

  if (claimed) {
    return (
      <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-600/50 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-green-400" />
          <div>
            <p className="font-semibold text-green-300">WhatsApp Share Reward Claimed!</p>
            <p className="text-sm text-green-400/80">You earned 10 coins for sharing</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-600/50 rounded-xl p-6">
      <div className="flex items-start gap-3 mb-4">
        <Gift className="w-6 h-6 text-green-400 mt-1" />
        <div className="flex-1">
          <h3 className="font-bold text-lg text-white">Earn 10 Coins Instantly!</h3>
          <p className="text-sm text-gray-300 mt-1">
            Share your profile link via WhatsApp and get 10 coins immediately (one-time reward)
          </p>
        </div>
      </div>

      {showSuccess && (
        <div className="mb-4 bg-green-500/20 border border-green-500/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-5 h-5 text-yellow-400" />
            <p className="text-green-200 font-semibold">
              You've earned 10 coins! Your new balance: {newBalance} coins
            </p>
          </div>
          <p className="text-sm text-green-300/80">
            Share this link: <span className="font-mono break-all">{profileUrl}</span>
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-900/30 border border-red-500/50 rounded-lg p-3">
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      )}

      <button
        onClick={handleWhatsAppShare}
        disabled={claiming || claimed}
        className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-lg font-semibold transition-all ${
          claiming
            ? 'bg-gray-700 text-gray-400 cursor-wait'
            : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white shadow-lg hover:shadow-xl hover:scale-105'
        }`}
      >
        <MessageCircle className="w-5 h-5" />
        <span>{claiming ? 'Processing...' : 'Share via WhatsApp & Earn 10 Coins'}</span>
        <Coins className="w-5 h-5 text-yellow-300" />
      </button>

      <p className="text-xs text-gray-400 text-center mt-3">
        Instant reward • One-time only • No verification needed
      </p>
    </div>
  );
}
