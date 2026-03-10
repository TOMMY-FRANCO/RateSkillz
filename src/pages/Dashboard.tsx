import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PlayerCard, { UserStats } from '../components/PlayerCard';
import OnlineStatus from '../components/OnlineStatus';
import FirstTimeUsernamePrompt from '../components/FirstTimeUsernamePrompt';
import TermsAcceptanceModal from '../components/TermsAcceptanceModal';
import { CoinBalance } from '../components/CoinBalance';
import Tutorial from '../components/Tutorial';
import TutorialPrompt from '../components/TutorialPrompt';
import { Settings, Users, LogOut, CreditCard as Edit, Trophy, ShoppingBag, Tv, TrendingUp, Eye, MessageCircle, Swords, Search, BookOpen, QrCode, UserPlus, RefreshCw, Activity, HelpCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { displayUsername } from '../lib/username';
import { getUserStats } from '../lib/ratings';
import { getAppUrl } from '../lib/appConfig';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { useNotifications } from '../hooks/useNotifications';
import NotificationBadge from '../components/NotificationBadge';
import { SocialSharingReward } from '../components/SocialSharingReward';
import { FriendMilestoneReward } from '../components/FriendMilestoneReward';
import { WhatsAppDashboardShare } from '../components/WhatsAppDashboardShare';
import InviteQRModal from '../components/InviteQRModal';
import AddFriendQRModal from '../components/AddFriendQRModal';
import ModerationCaseAlert from '../components/ModerationCaseAlert';
import { checkAndNotifyNewMessages } from '../lib/messageNotifications';
import { useDashboardBadges } from '../hooks/useDashboardBadges';

export default function Dashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [rank, setRank] = useState<{ position: number; total: number } | undefined>();
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [hasSocialBadge, setHasSocialBadge] = useState(false);
  const [unreadProfileViews, setUnreadProfileViews] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showTutorialPrompt, setShowTutorialPrompt] = useState(false);
  const [tutorialCompleted, setTutorialCompleted] = useState(false);
  const [showInviteQR, setShowInviteQR] = useState(false);
  const [showFriendQR, setShowFriendQR] = useState(false);
  const { unreadCount: unreadMessagesCount } = useUnreadMessages();
  const { counts: notificationCounts, getCount, loading: notificationsLoading } = useNotifications(profile?.id);
  const { counts: badgeCounts, refetch: refetchBadges } = useDashboardBadges(profile?.id);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profile) {
      loadDashboardData();
      refetchBadges();

      if (!profile.terms_accepted_at) {
        setShowTermsModal(true);
      } else if (!profile.username_customized) {
        setShowUsernamePrompt(true);
      }
    }
  }, [profile?.id]);

  const loadDashboardData = async () => {
    if (!profile) return;

    try {
      const [stats, profileData, rankData] = await Promise.all([
        getUserStats(profile.id),
        supabase
          .from('profiles')
          .select('is_verified, has_social_badge, unread_profile_views, tutorial_completed')
          .eq('id', profile.id)
          .maybeSingle(),
        Promise.all([
          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .gt('overall_rating', profile.overall_rating || 0),
          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true }),
        ]),
      ]);

      setUserStats(stats);

      if (profileData.data) {
        setIsVerified(profileData.data.is_verified || false);
        setHasSocialBadge(profileData.data.has_social_badge || false);
        setUnreadProfileViews(profileData.data.unread_profile_views || 0);
        const completed = profileData.data.tutorial_completed || false;
        setTutorialCompleted(completed);
        if (!completed && profile.terms_accepted_at && profile.username_customized) {
          setTimeout(() => setShowTutorialPrompt(true), 2000);
        }
      }

      const [aboveMe, totalProfiles] = rankData;
      setRank({
        position: (aboveMe.count || 0) + 1,
        total: totalProfiles.count || 0,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);

    try {
      await Promise.all([
        loadDashboardData(),
        profile ? checkAndNotifyNewMessages(profile.id) : Promise.resolve(0),
        refetchBadges(),
      ]);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [isRefreshing, profile]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === 0 || isRefreshing) return;

    const touchY = e.touches[0].clientY;
    const diff = touchY - touchStartY.current;

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

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" ref={containerRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
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
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-white heading-glow">
                RatingSkill®
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="text-[#B0B8C8] hover:text-white transition-colors disabled:opacity-50"
                aria-label="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
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

        <div className="max-w-4xl mx-auto mb-6">
          <ModerationCaseAlert />
        </div>

        <div className="max-w-4xl mx-auto mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <WhatsAppDashboardShare
            username={profile.username}
            profileUrl={`${getAppUrl()}/profile/${profile.username}`}
          />
          <SocialSharingReward
            username={profile.username}
            profileUrl={`${getAppUrl()}/profile/${profile.username}`}
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
            <NotificationBadge
              count={badgeCounts.messages}
              userId={profile?.id}
              notificationType="message"
              capAt9
            />
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
            <NotificationBadge
              count={getCount(['swap_offer', 'purchase_offer', 'card_sold', 'purchase_request'])}
              userId={profile?.id}
              notificationType="card_sold"
            />
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
            <NotificationBadge
              count={badgeCounts.battleRequests}
              userId={profile?.id}
              notificationType="battle_request"
              className={profile.is_manager ? 'top-10' : ''}
              capAt9
            />
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
            onClick={() => navigate('/daily-quiz')}
            className="glass-card p-3 sm:p-4 cursor-pointer text-left w-full"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#00FF85] to-[#00E0FF] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-[#00FF85]/30">
                <HelpCircle className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm sm:text-base">Daily Quiz</h3>
                <p className="text-[#B0B8C8] text-xs sm:text-sm">Earn coins daily</p>
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
            <NotificationBadge
              count={notificationCounts.ad_available}
              userId={profile?.id}
              notificationType="ad_available"
            />
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#00FF85] to-[#00D67A] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-[#00FF85]/30">
                <Tv className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm sm:text-base">Watch & Earn</h3>
                <p className="text-[#B0B8C8] text-xs sm:text-sm">Get 5 coins/day</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/transactions')}
            className="glass-card p-3 sm:p-4 cursor-pointer text-left w-full relative"
          >
            <NotificationBadge
              count={badgeCounts.transactions}
              userId={profile?.id}
              notificationType="transaction"
              capAt9
            />
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
            onClick={() => navigate('/activity-feed')}
            className="glass-card p-3 sm:p-4 cursor-pointer text-left w-full"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#FF6B9D] to-[#FFA500] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-[#FF6B9D]/30">
                <Activity className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm sm:text-base">Activity Feed</h3>
                <p className="text-[#B0B8C8] text-xs sm:text-sm">Recent activity</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/leaderboard')}
            className="glass-card p-3 sm:p-4 cursor-pointer text-left w-full relative"
          >
            <NotificationBadge
              count={getCount(['rank_update'])}
              userId={profile?.id}
              notificationType="rank_update"
            />
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#FFD700] to-[#FFA500] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-[#FFD700]/30">
                <Trophy className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm sm:text-base">Leaderboard</h3>
                <p className="text-[#B0B8C8] text-xs sm:text-sm">Top 100 rankings</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/friends')}
            className="glass-card p-3 sm:p-4 cursor-pointer text-left w-full relative"
          >
            <NotificationBadge
              count={badgeCounts.pendingFriendRequests}
              userId={profile?.id}
              notificationType="coin_request"
              capAt9
            />
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#00FF85] to-[#00E0FF] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-[#00FF85]/30">
                <Users className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm sm:text-base">Friends</h3>
                <p className="text-[#B0B8C8] text-xs sm:text-sm">Manage connections</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/viewed-me')}
            className="glass-card p-3 sm:p-4 cursor-pointer text-left w-full relative"
          >
            <NotificationBadge
              count={badgeCounts.profileViews}
              userId={profile?.id}
              notificationType="profile_view"
              capAt9
            />
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
            <NotificationBadge
              count={getCount(['setting_change'])}
              userId={profile?.id}
              notificationType="setting_change"
            />
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

          <button
            onClick={() => setShowInviteQR(true)}
            className="glass-card p-3 sm:p-4 cursor-pointer text-left w-full"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#00FF85] to-[#00E0FF] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-[#00FF85]/30">
                <QrCode className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm sm:text-base">Show QR Code</h3>
                <p className="text-[#B0B8C8] text-xs sm:text-sm">Invite new users</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setShowFriendQR(true)}
            className="glass-card p-3 sm:p-4 cursor-pointer text-left w-full"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#38BDF8] to-[#0EA5E9] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-[#38BDF8]/30">
                <UserPlus className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm sm:text-base">Add Friend QR Code</h3>
                <p className="text-[#B0B8C8] text-xs sm:text-sm">Share friend code</p>
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
          window.location.reload();
        }}
      />

      <InviteQRModal
        isOpen={showInviteQR}
        onClose={() => setShowInviteQR(false)}
        username={profile.username}
      />

      <AddFriendQRModal
        isOpen={showFriendQR}
        onClose={() => setShowFriendQR(false)}
        userId={profile.id}
        username={profile.username}
      />
    </div>
  );
}
