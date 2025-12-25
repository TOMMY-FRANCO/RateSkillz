import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PlayerCard, { UserStats } from '../components/PlayerCard';
import OnlineStatus from '../components/OnlineStatus';
import FirstTimeUsernamePrompt from '../components/FirstTimeUsernamePrompt';
import TermsAcceptanceModal from '../components/TermsAcceptanceModal';
import { CoinBalance } from '../components/CoinBalance';
import { Settings, Users, LogOut, Edit, Bell, Trophy, Coins, ShoppingBag, Tv, TrendingUp, Eye, MessageCircle, Swords } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { displayUsername } from '../lib/username';
import { getUserStats } from '../lib/ratings';
import { useUnreadMessages } from '../hooks/useUnreadMessages';

export default function Dashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [rank, setRank] = useState<{ position: number; total: number } | undefined>();
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [hasSocialBadge, setHasSocialBadge] = useState(false);
  const unreadMessagesCount = useUnreadMessages();

  useEffect(() => {
    if (profile) {
      fetchUserStats();
      calculateRank();
      fetchPendingRequests();
      fetchVerificationStatus();

      if (!profile.terms_accepted_at) {
        setShowTermsModal(true);
      } else if (!profile.username_customized) {
        setShowUsernamePrompt(true);
      }
    }
  }, [profile]);

  const fetchVerificationStatus = async () => {
    if (!profile) return;

    try {
      const { data } = await supabase
        .from('profiles')
        .select('is_verified, has_social_badge')
        .eq('id', profile.id)
        .single();

      if (data) {
        setIsVerified(data.is_verified || false);
        setHasSocialBadge(data.has_social_badge || false);
      }
    } catch (error) {
      console.error('Error fetching verification status:', error);
    }
  };

  const fetchPendingRequests = async () => {
    if (!profile) return;

    try {
      const { data } = await supabase
        .from('friends')
        .select('id')
        .eq('friend_id', profile.id)
        .eq('status', 'pending');

      setPendingRequestsCount(data?.length || 0);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const fetchUserStats = async () => {
    if (!profile) return;

    try {
      const stats = await getUserStats(profile.id);
      setUserStats(stats);
    } catch (error) {
      console.error('Error fetching user stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateRank = async () => {
    if (!profile) return;

    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, overall_rating')
        .order('overall_rating', { ascending: false });

      if (profilesError) throw profilesError;

      const position = (profiles || []).findIndex((p) => p.id === profile.id) + 1;
      setRank({ position, total: profiles?.length || 0 });
    } catch (error) {
      console.error('Error calculating rank:', error);
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <nav className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400">
                RatingSkill.com
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/shop')}
                className="bg-none border-none cursor-pointer hover:scale-105 transition-transform"
              >
                <CoinBalance />
              </button>
              <button
                onClick={() => navigate('/inbox')}
                className="text-gray-300 hover:text-cyan-400 transition-colors flex items-center space-x-2 bg-none border-none cursor-pointer relative"
              >
                <MessageCircle className="w-5 h-5" />
                {unreadMessagesCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                    {unreadMessagesCount}
                  </span>
                )}
                <span className="hidden sm:inline">Messages</span>
              </button>
              <button
                onClick={() => navigate('/friends')}
                className="text-gray-300 hover:text-cyan-400 transition-colors flex items-center space-x-2 bg-none border-none cursor-pointer relative"
              >
                <Bell className="w-5 h-5" />
                {pendingRequestsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                    {pendingRequestsCount}
                  </span>
                )}
                <span className="hidden sm:inline">Notifications</span>
              </button>
              <button
                onClick={() => navigate('/edit-profile')}
                className="text-gray-300 hover:text-cyan-400 transition-colors flex items-center space-x-2 bg-none border-none cursor-pointer"
              >
                <Edit className="w-5 h-5" />
                <span className="hidden sm:inline">Edit Profile</span>
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="text-gray-300 hover:text-cyan-400 transition-colors bg-none border-none cursor-pointer"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={handleSignOut}
                className="text-gray-300 hover:text-red-400 transition-colors bg-none border-none cursor-pointer"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">
            Welcome, {displayUsername(profile.username)}!
          </h2>
          <div className="flex items-center justify-center gap-2 mb-2">
            <OnlineStatus lastActive={profile.last_active} size="large" />
          </div>
          <p className="text-gray-400">
            {(userStats?.rating_count || 0) === 0
              ? 'Invite friends to rate your player card'
              : `Your card has been rated by ${userStats?.rating_count || 0} ${userStats?.rating_count === 1 ? 'friend' : 'friends'}`}
          </p>
        </div>

        <div className="flex justify-center mb-8">
          {loading ? (
            <div className="text-white">Loading your card...</div>
          ) : (
            <PlayerCard
              profile={profile}
              userStats={userStats}
              rank={rank}
              showDownloadButton={true}
              overallRating={profile.overall_rating}
              isVerified={isVerified}
              hasSocialBadge={hasSocialBadge}
            />
          )}
        </div>

        <div className="flex justify-center mb-12">
          <button
            onClick={() => navigate(`/profile/${profile.username}?preview=true`)}
            className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl hover:scale-105"
          >
            <Eye className="w-5 h-5" />
            <span>Preview Profile</span>
            <span className="text-sm opacity-80">See how others view your profile</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          <button
            onClick={() => navigate('/inbox')}
            className="bg-gradient-to-br from-pink-900/30 to-rose-900/30 border border-pink-600/50 rounded-xl p-6 hover:border-pink-500 transition-all group cursor-pointer text-left w-full relative"
          >
            {unreadMessagesCount > 0 && (
              <span className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                {unreadMessagesCount}
              </span>
            )}
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <MessageCircle className="w-6 h-6 text-black" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Messages</h3>
                <p className="text-gray-400 text-sm">Chat with friends</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/trading')}
            className="bg-gradient-to-br from-cyan-900/30 to-blue-900/30 border border-cyan-600/50 rounded-xl p-6 hover:border-cyan-500 transition-all group cursor-pointer text-left w-full"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <ShoppingBag className="w-6 h-6 text-black" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Card Trading</h3>
                <p className="text-gray-400 text-sm">Buy & sell cards</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/battle-mode')}
            className="bg-gradient-to-br from-red-900/30 to-orange-900/30 border-2 border-red-600/50 rounded-xl p-6 hover:border-red-500 transition-all group cursor-pointer text-left w-full relative"
          >
            {profile.is_manager && (
              <span className="absolute top-2 right-2 px-2 py-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-xs font-bold rounded">
                MANAGER
              </span>
            )}
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <Swords className="w-6 h-6 text-black" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Battle Mode</h3>
                <p className="text-gray-400 text-sm">
                  {profile.is_manager ? 'Card battles & wagers' : 'View battles & challenges'}
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/shop')}
            className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border border-yellow-600/50 rounded-xl p-6 hover:border-yellow-500 transition-all group cursor-pointer text-left w-full"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <ShoppingBag className="w-6 h-6 text-black" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Coin Shop</h3>
                <p className="text-gray-400 text-sm">Buy coins</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/watch-ad')}
            className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-600/50 rounded-xl p-6 hover:border-green-500 transition-all group cursor-pointer text-left w-full"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <Tv className="w-6 h-6 text-black" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Watch & Earn</h3>
                <p className="text-gray-400 text-sm">Get 10 coins/day</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/transactions')}
            className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border border-blue-600/50 rounded-xl p-6 hover:border-blue-500 transition-all group cursor-pointer text-left w-full"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingUp className="w-6 h-6 text-black" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Transactions</h3>
                <p className="text-gray-400 text-sm">View history</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/leaderboard')}
            className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-600/50 rounded-xl p-6 hover:border-purple-500 transition-all group cursor-pointer text-left w-full"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <Trophy className="w-6 h-6 text-black" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Leaderboard</h3>
                <p className="text-gray-400 text-sm">Top 150 rankings</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/friends')}
            className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-6 hover:border-cyan-500/50 transition-all group cursor-pointer text-left w-full relative"
          >
            {pendingRequestsCount > 0 && (
              <span className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                {pendingRequestsCount}
              </span>
            )}
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-cyan-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <Bell className="w-6 h-6 text-black" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Notifications</h3>
                <p className="text-gray-400 text-sm">Friend requests</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/edit-profile')}
            className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-6 hover:border-cyan-500/50 transition-all group cursor-pointer text-left w-full"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-cyan-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <Edit className="w-6 h-6 text-black" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Edit Profile</h3>
                <p className="text-gray-400 text-sm">Update your info</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/settings')}
            className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-6 hover:border-cyan-500/50 transition-all group cursor-pointer text-left w-full"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-cyan-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <Settings className="w-6 h-6 text-black" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Settings</h3>
                <p className="text-gray-400 text-sm">Account options</p>
              </div>
            </div>
          </button>
        </div>
      </main>

      {showTermsModal && (
        <TermsAcceptanceModal
          onAccept={() => {
            setShowTermsModal(false);
            window.location.reload();
          }}
        />
      )}

      {showUsernamePrompt && !showTermsModal && (
        <FirstTimeUsernamePrompt
          onComplete={() => setShowUsernamePrompt(false)}
        />
      )}
    </div>
  );
}
