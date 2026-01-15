import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PlayerCard, { UserStats } from '../components/PlayerCard';
import OnlineStatus from '../components/OnlineStatus';
import FirstTimeUsernamePrompt from '../components/FirstTimeUsernamePrompt';
import TermsAcceptanceModal from '../components/TermsAcceptanceModal';
import { CoinBalance } from '../components/CoinBalance';
import Tutorial from '../components/Tutorial';
import TutorialPrompt from '../components/TutorialPrompt';
import { Settings, Users, LogOut, Edit, Bell, Trophy, Coins, ShoppingBag, Tv, TrendingUp, Eye, MessageCircle, Swords, Search, BookOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { displayUsername } from '../lib/username';
import { getUserStats } from '../lib/ratings';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { useNotifications } from '../hooks/useNotifications';
import NotificationBadge from '../components/NotificationBadge';
import { SocialSharingReward } from '../components/SocialSharingReward';
import { FriendMilestoneReward } from '../components/FriendMilestoneReward';
import { WhatsAppDashboardShare } from '../components/WhatsAppDashboardShare';

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
  const [unreadProfileViews, setUnreadProfileViews] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showTutorialPrompt, setShowTutorialPrompt] = useState(false);
  const [tutorialCompleted, setTutorialCompleted] = useState(false);
  const { unreadCount: unreadMessagesCount } = useUnreadMessages();
  const { counts: notificationCounts, getCount } = useNotifications(profile?.id);

  useEffect(() => {
    if (profile) {
      fetchUserStats();
      calculateRank();
      fetchPendingRequests();
      fetchVerificationStatus();
      fetchUnreadProfileViews();
      checkTutorialStatus();

      if (!profile.terms_accepted_at) {
        setShowTermsModal(true);
      } else if (!profile.username_customized) {
        setShowUsernamePrompt(true);
      }
    }
  }, [profile]);

  const fetchUnreadProfileViews = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('unread_profile_views')
        .eq('id', profile.id)
        .maybeSingle();

      if (error) throw error;
      setUnreadProfileViews(data?.unread_profile_views || 0);
    } catch (error) {
      console.error('Error fetching unread profile views:', error);
    }
  };

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

  const checkTutorialStatus = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('tutorial_completed')
        .eq('id', profile.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking tutorial status:', error);
        return;
      }

      const completed = data?.tutorial_completed || false;
      setTutorialCompleted(completed);

      if (!completed && profile.terms_accepted_at && profile.username_customized) {
        setTimeout(() => {
          setShowTutorialPrompt(true);
        }, 2000);
      }
    } catch (error) {
      console.error('Error checking tutorial status:', error);
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-white heading-glow">
                RatingSkill®
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
                onClick={handleSignOut}
                className="text-[#B0B8C8] hover:text-red-400 transition-colors bg-none border-none cursor-pointer"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="text-center mb-4 animate-fade-in">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1 heading-glow">
            Welcome, {displayUsername(profile.username)}!
          </h2>
          <div className="flex items-center justify-center gap-2 mb-1">
            <OnlineStatus lastActive={profile.last_active} size="large" />
          </div>
          <p className="text-[#B0B8C8] text-sm sm:text-base">
            {(userStats?.rating_count || 0) === 0
              ? 'Invite friends to rate your player card'
              : `Your card has been rated by ${userStats?.rating_count || 0} ${userStats?.rating_count === 1 ? 'friend' : 'friends'}`}
          </p>
        </div>

        <div className="flex justify-center mb-4">
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

        <div className="flex justify-center mb-6">
          <button
            onClick={() => navigate(`/profile/${profile.username}?preview=true`)}
            className="btn-secondary flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base"
          >
            <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Preview Profile</span>
            <span className="hidden sm:inline text-xs opacity-80">See how others view your profile</span>
          </button>
        </div>

        <div className="max-w-4xl mx-auto mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <WhatsAppDashboardShare
            username={profile.username}
            profileUrl={`${window.location.origin}/profile/${profile.username}`}
          />
          <SocialSharingReward
            username={profile.username}
            profileUrl={`${window.location.origin}/profile/${profile.username}`}
          />
          <div className="sm:col-span-2">
            <FriendMilestoneReward />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 max-w-6xl mx-auto">
          <button
            onClick={() => navigate('/inbox')}
            className="glass-card p-3 sm:p-4 cursor-pointer text-left w-full relative"
          >
            <NotificationBadge count={getCount(['message', 'coin_received', 'coin_request'])} />
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#FF6B9D] to-[#C44569] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-[#FF6B9D]/30">
                <MessageCircle className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm sm:text-base">Messages</h3>
                <p className="text-[#B0B8C8] text-xs sm:text-sm">Chat with friends</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/search-friends')}
            className="glass-card p-3 sm:p-4 cursor-pointer text-left w-full"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#00FF85] to-[#00E0FF] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-[#00FF85]/30">
                <Search className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm sm:text-base">Search Friends</h3>
                <p className="text-[#B0B8C8] text-xs sm:text-sm">Find & connect</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/trading')}
            className="glass-card p-3 sm:p-4 cursor-pointer text-left w-full relative"
          >
            <NotificationBadge count={getCount(['swap_offer', 'purchase_offer', 'card_sold'])} />
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#00E0FF] to-[#38BDF8] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-[#00E0FF]/30">
                <ShoppingBag className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm sm:text-base">Card Trading</h3>
                <p className="text-[#B0B8C8] text-xs sm:text-sm">Buy & sell cards</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/battle-mode')}
            className="glass-card p-3 sm:p-4 border-2 border-[#38BDF8]/50 cursor-pointer text-left w-full relative"
          >
            <NotificationBadge count={getCount(['battle_request'])} className={profile.is_manager ? 'top-10' : ''} />
            {profile.is_manager && (
              <span className="absolute top-1 right-1 px-2 py-0.5 bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black text-[10px] font-bold rounded-md shadow-lg shadow-[#FFD700]/30 uppercase tracking-wider">
                Manager
              </span>
            )}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#38BDF8] to-[#0EA5E9] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-[#38BDF8]/30">
                <Swords className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm sm:text-base">Battle Mode</h3>
                <p className="text-[#B0B8C8] text-xs sm:text-sm">
                  {profile.is_manager ? 'Card battles & wagers' : 'View battles & challenges'}
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/shop')}
            className="glass-card p-3 sm:p-4 cursor-pointer text-left w-full"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#FFD700] to-[#FFA500] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-[#FFD700]/30">
                <ShoppingBag className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm sm:text-base">Coin Shop</h3>
                <p className="text-[#B0B8C8] text-xs sm:text-sm">Buy coins</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/watch-ad')}
            className="glass-card p-3 sm:p-4 cursor-pointer text-left w-full relative"
          >
            <NotificationBadge count={notificationCounts.ad_available} />
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#00FF85] to-[#00D67A] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-[#00FF85]/30">
                <Tv className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm sm:text-base">Watch & Earn</h3>
                <p className="text-[#B0B8C8] text-xs sm:text-sm">Get 10 coins/day</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/transactions')}
            className="glass-card p-3 sm:p-4 cursor-pointer text-left w-full relative"
          >
            <NotificationBadge count={getCount(['transaction'])} />
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#38BDF8] to-[#00E0FF] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-[#38BDF8]/30">
                <TrendingUp className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm sm:text-base">Transactions</h3>
                <p className="text-[#B0B8C8] text-xs sm:text-sm">View history</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/leaderboard')}
            className="glass-card p-3 sm:p-4 cursor-pointer text-left w-full relative"
          >
            <NotificationBadge count={getCount(['rank_update'])} />
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#FFD700] to-[#FFA500] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-[#FFD700]/30">
                <Trophy className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm sm:text-base">Leaderboard</h3>
                <p className="text-[#B0B8C8] text-xs sm:text-sm">Top 150 rankings</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/friends')}
            className="glass-card p-3 sm:p-4 cursor-pointer text-left w-full relative"
          >
            {pendingRequestsCount > 0 && (
              <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg shadow-red-500/50">
                {pendingRequestsCount}
              </span>
            )}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#00FF85] to-[#00E0FF] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-[#00FF85]/30">
                <Bell className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm sm:text-base">Notifications</h3>
                <p className="text-[#B0B8C8] text-xs sm:text-sm">Friend requests</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/viewed-me')}
            className="glass-card p-3 sm:p-4 cursor-pointer text-left w-full relative"
          >
            <NotificationBadge count={unreadProfileViews} />
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#00E0FF] to-[#38BDF8] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-[#00E0FF]/30">
                <Eye className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm sm:text-base">Viewed Me</h3>
                <p className="text-[#B0B8C8] text-xs sm:text-sm">See who visited</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/edit-profile')}
            className="glass-card p-3 sm:p-4 cursor-pointer text-left w-full"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#00FF85] to-[#00E0FF] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-[#00FF85]/30">
                <Edit className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm sm:text-base">Edit Profile</h3>
                <p className="text-[#B0B8C8] text-xs sm:text-sm">Update your info</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/settings')}
            className="glass-card p-3 sm:p-4 cursor-pointer text-left w-full relative"
          >
            <NotificationBadge count={getCount(['setting_change'])} />
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#00FF85] to-[#00E0FF] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-[#00FF85]/30">
                <Settings className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm sm:text-base">Settings</h3>
                <p className="text-[#B0B8C8] text-xs sm:text-sm">Account options</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setShowTutorial(true)}
            className="glass-card p-3 sm:p-4 cursor-pointer text-left w-full relative border-2 border-blue-500/30"
          >
            {!tutorialCompleted && (
              <span className="absolute top-1 right-1 px-2 py-0.5 bg-gradient-to-r from-blue-500 to-green-500 text-white text-[10px] font-bold rounded-md shadow-lg shadow-blue-500/30 uppercase tracking-wider animate-pulse">
                +5 Coins
              </span>
            )}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-green-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/30">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm sm:text-base">Tutorial</h3>
                <p className="text-[#B0B8C8] text-xs sm:text-sm">
                  {tutorialCompleted ? 'Review guide' : 'Learn & earn 5 coins'}
                </p>
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

      <TutorialPrompt
        isOpen={showTutorialPrompt}
        onStartTutorial={() => {
          setShowTutorialPrompt(false);
          setShowTutorial(true);
        }}
        onDismiss={() => {
          setShowTutorialPrompt(false);
        }}
      />

      <Tutorial
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        onComplete={async () => {
          setTutorialCompleted(true);
          await checkTutorialStatus();
          window.location.reload();
        }}
      />
    </div>
  );
}
