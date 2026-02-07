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
import { Settings, Users, LogOut, Edit, Bell, Trophy, Coins, ShoppingBag, Tv, TrendingUp, Eye, MessageCircle, Swords, Search, BookOpen, QrCode, UserPlus, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { displayUsername } from '../lib/username';
import { getUserStats } from '../lib/ratings';
import { getAppUrl } from '../lib/appConfig';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { useNotifications } from '../hooks/useNotifications';
import NotificationBadge from '../components/NotificationBadge';
import { getFriendsBadgeSeenCount } from '../lib/notifications';
import { SocialSharingReward } from '../components/SocialSharingReward';
import { FriendMilestoneReward } from '../components/FriendMilestoneReward';
import { WhatsAppDashboardShare } from '../components/WhatsAppDashboardShare';
import InviteQRModal from '../components/InviteQRModal';
import AddFriendQRModal from '../components/AddFriendQRModal';
import ModerationCaseAlert from '../components/ModerationCaseAlert';
import { NeonPanel } from '../components/ui/NeonPanel';
import { NeonCard } from '../components/ui/NeonCard';
import { NeonLoader } from '../components/ui/NeonLoader';

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
  const [showInviteQR, setShowInviteQR] = useState(false);
  const [showFriendQR, setShowFriendQR] = useState(false);
  const { unreadCount: unreadMessagesCount } = useUnreadMessages();
  const { counts: notificationCounts, getCount, loading: notificationsLoading } = useNotifications(profile?.id);

  useEffect(() => {
    if (profile) {
      loadDashboardData();

      if (!profile.terms_accepted_at) {
        setShowTermsModal(true);
      } else if (!profile.username_customized) {
        setShowUsernamePrompt(true);
      }
    }
  }, [profile]);

  const loadDashboardData = async () => {
    if (!profile) return;

    try {
      const [stats, profileData, pendingData, rankData] = await Promise.all([
        getUserStats(profile.id),
        supabase
          .from('profiles')
          .select('is_verified, has_social_badge, unread_profile_views, tutorial_completed')
          .eq('id', profile.id)
          .maybeSingle(),
        supabase
          .from('friends')
          .select('id', { count: 'exact', head: true })
          .eq('friend_id', profile.id)
          .eq('status', 'pending'),
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

      setPendingRequestsCount(pendingData.count || 0);

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

  if (!profile) {
    return (
      <div className="min-h-screen bg-space flex items-center justify-center">
        <NeonLoader size="lg" variant="cyan" text="Initializing..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-space pb-24 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-neon-cyan rounded-full blur-[200px]"></div>
        <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-neon-green rounded-full blur-[200px]"></div>
      </div>

      <nav className="sticky top-0 z-50 bg-space/90 backdrop-blur-md border-b-2 border-neon-cyan/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-neon-cyan to-neon-green rounded-lg flex items-center justify-center shadow-neon-cyan">
                <Star className="w-6 h-6 text-white" fill="white" />
              </div>
              <h1 className="font-heading text-2xl font-bold text-neon-cyan neon-text-cyan">
                RATINGSKILL
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/shop')}
                className="bg-transparent border-none cursor-pointer hover:scale-105 transition-transform"
              >
                <CoinBalance />
              </button>
              <button
                onClick={handleSignOut}
                className="text-white/60 hover:text-red-400 transition-colors bg-transparent border-none cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8 animate-fade-in scanline-effect">
          <h2 className="font-heading text-4xl sm:text-5xl font-bold text-white mb-2 uppercase neon-text-cyan">
            Welcome, {displayUsername(profile.username)}
          </h2>
          <div className="flex items-center justify-center gap-3 mb-2">
            <OnlineStatus lastActive={profile.last_active} size="large" />
          </div>
          <p className="text-white/70 text-base sm:text-lg font-body">
            {(userStats?.rating_count || 0) === 0
              ? 'Invite friends to rate your player card'
              : `Rated by ${userStats?.rating_count || 0} ${userStats?.rating_count === 1 ? 'friend' : 'friends'}`}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <NeonLoader size="lg" variant="cyan" text="Loading Player Card..." />
          </div>
        ) : (
          <div className="flex justify-center mb-8">
            <div className="animate-slide-in-up">
              <PlayerCard
                profile={profile}
                userStats={userStats}
                rank={rank}
                showDownloadButton={true}
                overallRating={profile.overall_rating}
                isVerified={isVerified}
                hasSocialBadge={hasSocialBadge}
              />
            </div>
          </div>
        )}

        <div className="flex justify-center mb-8">
          <button
            onClick={() => navigate(`/profile/${profile.username}?preview=true`)}
            className="px-6 py-3 bg-space/50 border-2 border-neon-green text-neon-green hover:bg-neon-green/10 font-heading text-lg uppercase tracking-wider transition-all duration-300 shadow-neon-green hover:shadow-neon-green-strong flex items-center gap-2"
          >
            <Eye className="w-5 h-5" />
            Preview Profile
          </button>
        </div>

        <div className="max-w-5xl mx-auto mb-8">
          <ModerationCaseAlert />
        </div>

        <div className="max-w-5xl mx-auto mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        <div className="mb-6">
          <h3 className="font-heading text-2xl font-bold text-center text-neon-cyan neon-text-cyan mb-2 uppercase">
            Mission Control
          </h3>
          <p className="text-center text-white/60 font-heading uppercase tracking-wider text-sm">
            Your Command Center
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-6xl mx-auto">
          <NeonCard variant="cyan" onClick={() => navigate('/inbox')} className="relative">
            <NotificationBadge count={getCount(['message', 'coin_received', 'coin_request'])} soundType="message-received" />
            <div className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-neon-cyan to-neon-cyan-bright rounded-lg flex items-center justify-center shadow-neon-cyan">
                  <MessageCircle className="w-6 h-6 text-space" />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-xl font-bold text-white uppercase">Messages</h3>
                  <p className="text-white/60 text-sm font-body">Chat with friends</p>
                </div>
              </div>
            </div>
          </NeonCard>

          <NeonCard variant="green" onClick={() => navigate('/search-friends')}>
            <div className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-neon-green to-neon-green-bright rounded-lg flex items-center justify-center shadow-neon-green">
                  <Search className="w-6 h-6 text-space" />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-xl font-bold text-white uppercase">Search</h3>
                  <p className="text-white/60 text-sm font-body">Find friends</p>
                </div>
              </div>
            </div>
          </NeonCard>

          <NeonCard variant="cyan" onClick={() => navigate('/trading')} className="relative">
            <NotificationBadge count={getCount(['swap_offer', 'purchase_offer', 'card_sold', 'purchase_request'])} soundType="card-swap" />
            <div className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-neon-cyan to-neon-cyan-bright rounded-lg flex items-center justify-center shadow-neon-cyan">
                  <ShoppingBag className="w-6 h-6 text-space" />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-xl font-bold text-white uppercase">Trading</h3>
                  <p className="text-white/60 text-sm font-body">Buy & sell cards</p>
                </div>
              </div>
            </div>
          </NeonCard>

          <NeonCard variant="green" onClick={() => navigate('/battle-mode')} className="relative border-4">
            <NotificationBadge count={getCount(['battle_request'])} className={profile.is_manager ? 'top-12' : ''} />
            {profile.is_manager && (
              <span className="absolute top-2 right-2 px-3 py-1 bg-gradient-to-r from-neon-cyan to-neon-green text-space text-xs font-heading font-bold rounded shadow-neon-cyan uppercase tracking-wider">
                Manager
              </span>
            )}
            <div className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-neon-green to-neon-green-bright rounded-lg flex items-center justify-center shadow-neon-green">
                  <Swords className="w-6 h-6 text-space" />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-xl font-bold text-white uppercase">Battle</h3>
                  <p className="text-white/60 text-sm font-body">
                    {profile.is_manager ? 'Card battles' : 'View battles'}
                  </p>
                </div>
              </div>
            </div>
          </NeonCard>

          <NeonCard variant="cyan" onClick={() => navigate('/shop')}>
            <div className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-neon-cyan to-neon-cyan-bright rounded-lg flex items-center justify-center shadow-neon-cyan">
                  <ShoppingBag className="w-6 h-6 text-space" />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-xl font-bold text-white uppercase">Shop</h3>
                  <p className="text-white/60 text-sm font-body">Buy coins</p>
                </div>
              </div>
            </div>
          </NeonCard>

          <NeonCard variant="green" onClick={() => navigate('/watch-ad')} className="relative">
            <NotificationBadge count={notificationCounts.ad_available} />
            <div className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-neon-green to-neon-green-bright rounded-lg flex items-center justify-center shadow-neon-green">
                  <Tv className="w-6 h-6 text-space" />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-xl font-bold text-white uppercase">Earn</h3>
                  <p className="text-white/60 text-sm font-body">Get 5 coins/day</p>
                </div>
              </div>
            </div>
          </NeonCard>

          <NeonCard variant="cyan" onClick={() => navigate('/transactions')} className="relative">
            <NotificationBadge count={getCount(['transaction'])} />
            <div className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-neon-cyan to-neon-cyan-bright rounded-lg flex items-center justify-center shadow-neon-cyan">
                  <TrendingUp className="w-6 h-6 text-space" />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-xl font-bold text-white uppercase">Ledger</h3>
                  <p className="text-white/60 text-sm font-body">View history</p>
                </div>
              </div>
            </div>
          </NeonCard>

          <NeonCard variant="green" onClick={() => navigate('/leaderboard')} className="relative">
            <NotificationBadge count={getCount(['rank_update'])} />
            <div className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-neon-green to-neon-green-bright rounded-lg flex items-center justify-center shadow-neon-green">
                  <Trophy className="w-6 h-6 text-space" />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-xl font-bold text-white uppercase">Ranks</h3>
                  <p className="text-white/60 text-sm font-body">Top 150</p>
                </div>
              </div>
            </div>
          </NeonCard>

          <NeonCard variant="cyan" onClick={() => navigate('/friends')} className="relative">
            <NotificationBadge count={Math.max(0, pendingRequestsCount - getFriendsBadgeSeenCount())} soundType="friend-request" />
            <div className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-neon-cyan to-neon-cyan-bright rounded-lg flex items-center justify-center shadow-neon-cyan">
                  <Users className="w-6 h-6 text-space" />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-xl font-bold text-white uppercase">Friends</h3>
                  <p className="text-white/60 text-sm font-body">Connections</p>
                </div>
              </div>
            </div>
          </NeonCard>

          <NeonCard variant="green" onClick={() => navigate('/viewed-me')} className="relative">
            <NotificationBadge count={unreadProfileViews} />
            <div className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-neon-green to-neon-green-bright rounded-lg flex items-center justify-center shadow-neon-green">
                  <Eye className="w-6 h-6 text-space" />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-xl font-bold text-white uppercase">Viewed</h3>
                  <p className="text-white/60 text-sm font-body">Profile visits</p>
                </div>
              </div>
            </div>
          </NeonCard>

          <NeonCard variant="cyan" onClick={() => navigate('/edit-profile')}>
            <div className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-neon-cyan to-neon-cyan-bright rounded-lg flex items-center justify-center shadow-neon-cyan">
                  <Edit className="w-6 h-6 text-space" />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-xl font-bold text-white uppercase">Edit</h3>
                  <p className="text-white/60 text-sm font-body">Update profile</p>
                </div>
              </div>
            </div>
          </NeonCard>

          <NeonCard variant="green" onClick={() => navigate('/settings')} className="relative">
            <NotificationBadge count={getCount(['setting_change'])} />
            <div className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-neon-green to-neon-green-bright rounded-lg flex items-center justify-center shadow-neon-green">
                  <Settings className="w-6 h-6 text-space" />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-xl font-bold text-white uppercase">Settings</h3>
                  <p className="text-white/60 text-sm font-body">Configure</p>
                </div>
              </div>
            </div>
          </NeonCard>

          <NeonCard variant="cyan" onClick={() => setShowTutorial(true)} className="relative border-2">
            {!tutorialCompleted && (
              <span className="absolute top-2 right-2 px-3 py-1 bg-gradient-to-r from-blue-500 to-neon-green text-white text-xs font-heading font-bold rounded shadow-neon-green uppercase tracking-wider animate-pulse">
                +5 Coins
              </span>
            )}
            <div className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-neon-green rounded-lg flex items-center justify-center shadow-neon-green">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-xl font-bold text-white uppercase">Tutorial</h3>
                  <p className="text-white/60 text-sm font-body">
                    {tutorialCompleted ? 'Review' : 'Earn 5 coins'}
                  </p>
                </div>
              </div>
            </div>
          </NeonCard>

          <NeonCard variant="green" onClick={() => setShowInviteQR(true)}>
            <div className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-neon-green to-neon-green-bright rounded-lg flex items-center justify-center shadow-neon-green">
                  <QrCode className="w-6 h-6 text-space" />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-xl font-bold text-white uppercase">QR Code</h3>
                  <p className="text-white/60 text-sm font-body">Invite users</p>
                </div>
              </div>
            </div>
          </NeonCard>

          <NeonCard variant="cyan" onClick={() => setShowFriendQR(true)}>
            <div className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-neon-cyan to-neon-cyan-bright rounded-lg flex items-center justify-center shadow-neon-cyan">
                  <UserPlus className="w-6 h-6 text-space" />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-xl font-bold text-white uppercase">Add Friend</h3>
                  <p className="text-white/60 text-sm font-body">Friend QR</p>
                </div>
              </div>
            </div>
          </NeonCard>
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
