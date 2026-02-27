import { useState } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PlayerCard from '../components/PlayerCard';
import ShareCardModal from '../components/ShareCardModal';
import SocialLinks from '../components/SocialLinks';
import EditSocialLinks from '../components/EditSocialLinks';
import CardOwnershipStatus from '../components/CardOwnershipStatus';
import ReportUserModal from '../components/ReportUserModal';
import ProfileHeader from '../components/profile/ProfileHeader';
import ProfileActionButtons from '../components/profile/ProfileActionButtons';
import ProfileRatingsSection from '../components/profile/ProfileRatingsSection';
import ProfileCommentsSection from '../components/profile/ProfileCommentsSection';
import { useProfileData } from '../hooks/useProfileData';
import { useProfileActions } from '../hooks/useProfileActions';
import { Coins, Users, Eye, ThumbsUp, Share2, Loader2 } from 'lucide-react';
import { formatCoinBalance, formatCoinBalanceFull } from '../lib/formatBalance';
import { ShimmerBar, StaggerItem, SlowLoadMessage } from '../components/ui/Shimmer';
import { SkeletonAvatar } from '../components/ui/SkeletonPresets';

export default function ProfileView() {
  const { username } = useParams<{ username: string }>();
  const { profile: currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isPreviewMode = searchParams.get('preview') === 'true';

  const fromChatState = location.state as {
    fromChat?: boolean;
    conversationId?: string;
    otherUser?: { id: string; username: string; full_name: string | null; avatar_url: string | null };
    unsentMessage?: string;
  } | null;

  const backPath = fromChatState?.fromChat && fromChatState?.conversationId
    ? `/chat/${fromChatState.conversationId}`
    : undefined;

  const backState = fromChatState?.fromChat
    ? { otherUser: fromChatState.otherUser, unsentMessage: fromChatState.unsentMessage }
    : undefined;

  const [showShareModal, setShowShareModal] = useState(false);
  const [showEditSocialLinks, setShowEditSocialLinks] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [editingRatings, setEditingRatings] = useState({
    pac: 50,
    sho: 50,
    pas: 50,
    dri: 50,
    def: 50,
    phy: 50,
  });

  const {
    profile,
    loading,
    friendStatus,
    friendshipId,
    friendsCount,
    viewsCount,
    myRating,
    userStats,
    socialLinks,
    comments,
    commentVotes,
    likes,
    dislikes,
    userVote,
    cardOwnership,
    coinBalance,
    balanceLoading,
    balanceError,
    userPresenceData,
    isVerified,
    hasSocialBadge,
    loadProfile,
    refreshBalance,
    updateCardOwnership,
    setComments,
    setCommentVotes,
    setUserVote,
    setLikes,
    setDislikes,
    setFriendStatus,
    setFriendshipId,
    setSocialLinks,
    setMyRating,
  } = useProfileData(username, currentUser?.id, isPreviewMode);

  const {
    submitting,
    savingRating,
    ratingError,
    ratingSuccess,
    commentError,
    coinEarned,
    setRatingError,
    handleFriendRequest,
    handleVote,
    handleSubmitComment,
    handleSaveRatings,
    handleCommentVote,
  } = useProfileActions();

  const isOwner = currentUser?.id === profile?.id;
  const isEditingEnabled = !isPreviewMode && !isOwner;

  const exitPreviewMode = () => {
    navigate(`/profile/${username}`);
  };

  const handleRatingChange = (stat: string, value: number) => {
    setEditingRatings((prev) => ({
      ...prev,
      [stat]: Math.min(100, Math.max(1, value)),
    }));
    setRatingError(null);
  };

  if (myRating && editingRatings.pac === 50) {
    setEditingRatings({
      pac: myRating.pac,
      sho: myRating.sho,
      pas: myRating.pas,
      dri: myRating.dri,
      def: myRating.def,
      phy: myRating.phy,
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <nav className="bg-gray-900 border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <ShimmerBar className="h-6 w-32 rounded" />
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <StaggerItem index={0} className="flex justify-center mb-6">
            <ShimmerBar className="w-72 h-96 rounded-2xl" />
          </StaggerItem>
          <StaggerItem index={1} className="flex justify-center mb-6">
            <ShimmerBar className="h-10 w-32 rounded-lg" />
          </StaggerItem>
          <StaggerItem index={2} className="space-y-4 max-w-2xl mx-auto">
            <div className="flex items-center gap-3">
              <SkeletonAvatar size="lg" />
              <div className="space-y-2 flex-1">
                <ShimmerBar className="h-5 w-48 rounded" />
                <ShimmerBar className="h-3 w-32 rounded" speed="slow" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <ShimmerBar key={i} className="h-20 rounded-xl" speed="slow" />
              ))}
            </div>
            <ShimmerBar className="h-32 rounded-xl" speed="slow" />
          </StaggerItem>
          <SlowLoadMessage loading={true} message="Loading profile..." />
        </main>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Profile not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <ProfileHeader
        username={profile.username}
        userPresenceData={userPresenceData}
        lastActive={profile.last_active}
        isPreviewMode={isPreviewMode}
        isOwner={isOwner}
        onExitPreview={exitPreviewMode}
        backPath={backPath}
        backState={backState as Record<string, unknown> | undefined}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-3">
          {userStats === null ? (
            <p className="text-gray-500 text-sm animate-pulse">Loading ratings...</p>
          ) : (
            <p className="text-slate-400 text-sm sm:text-base tracking-wide">
              {(userStats?.rating_count || 0) === 0
                ? 'Card has not been rated yet'
                : `Card has been rated by ${userStats.rating_count} ${userStats.rating_count === 1 ? 'friend' : 'friends'}`}
            </p>
          )}
        </div>

        <div className="flex justify-center mb-6">
          <PlayerCard
            profile={profile}
            userStats={userStats}
            showDownloadButton={false}
            overallRating={profile.overall_rating}
            isVerified={isVerified}
            hasSocialBadge={hasSocialBadge}
          />
        </div>

        <div className="flex justify-center mb-6">
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-2.5 px-6 sm:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-bold rounded-xl hover:from-green-400 hover:to-cyan-400 transition-all shadow-lg shadow-cyan-500/20 hover:shadow-xl hover:shadow-cyan-500/30 hover:scale-105 text-sm sm:text-base"
          >
            <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Share Card</span>
          </button>
        </div>

        <SocialLinks
          socialLinks={socialLinks}
          isOwner={currentUser?.id === profile.id && !isPreviewMode}
          onEdit={() => setShowEditSocialLinks(true)}
        />

        <div className="max-w-3xl mx-auto mb-6">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-cyan-500/20 rounded-3xl p-5 sm:p-6 backdrop-blur-sm">
            <h3 className="text-base sm:text-lg font-bold text-white mb-5 text-center tracking-wide">Profile Stats</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
              <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 flex flex-col items-center space-y-2 hover:border-yellow-500/30 transition-all">
                <div className="w-14 h-14 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-500/20">
                  <Coins className="w-7 h-7 text-white" />
                </div>
                {balanceLoading ? (
                  <div className="flex flex-col items-center space-y-1">
                    <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                    <span className="text-[10px] text-slate-400">Loading...</span>
                  </div>
                ) : balanceError ? (
                  <div className="flex flex-col items-center space-y-1">
                    <span className="text-xs text-red-400">{balanceError}</span>
                    <button
                      onClick={refreshBalance}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 underline"
                    >
                      Refresh
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                      {formatCoinBalance(coinBalance)}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">{isOwner ? 'Your Balance' : 'Balance'}</span>
                    <span className="text-[10px] text-slate-500">{formatCoinBalanceFull(coinBalance)} coins</span>
                  </>
                )}
              </div>
              <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 flex flex-col items-center space-y-2 hover:border-cyan-500/30 transition-all">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <span className="text-xl font-bold text-white">{friendsCount}</span>
                <span className="text-xs text-slate-400 font-medium">Friends</span>
              </div>
              <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 flex flex-col items-center space-y-2 hover:border-blue-500/30 transition-all">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-sky-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Eye className="w-7 h-7 text-white" />
                </div>
                <span className="text-xl font-bold text-white">{viewsCount}</span>
                <span className="text-xs text-slate-400 font-medium">Views</span>
              </div>
              <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 flex flex-col items-center space-y-2 hover:border-green-500/30 transition-all">
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/20">
                  <ThumbsUp className="w-7 h-7 text-white" />
                </div>
                <span className="text-xl font-bold text-white">{likes}</span>
                <span className="text-xs text-slate-400 font-medium">Likes</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto mb-6">
          <CardOwnershipStatus
            cardOwnership={cardOwnership}
            currentUserId={currentUser?.id || null}
            cardUserId={profile.id}
            onUpdate={updateCardOwnership}
          />
        </div>

        <div className="max-w-2xl mx-auto space-y-5">
          <ProfileActionButtons
            isOwner={isOwner}
            isEditingEnabled={isEditingEnabled}
            friendStatus={friendStatus}
            likes={likes}
            dislikes={dislikes}
            userVote={userVote}
            currentUserId={currentUser?.id}
            profileId={profile.id}
            onVote={(isLike) =>
              handleVote(
                isLike,
                userVote,
                likes,
                dislikes,
                currentUser!.id,
                profile.id,
                setUserVote,
                setLikes,
                setDislikes
              )
            }
            onFriendRequest={() =>
              handleFriendRequest(
                friendStatus,
                friendshipId,
                currentUser!.id,
                profile.id,
                setFriendStatus,
                setFriendshipId,
                loadProfile
              )
            }
            onReport={() => setShowReportModal(true)}
          />

          <ProfileRatingsSection
            isOwner={isOwner}
            isEditingEnabled={isEditingEnabled}
            friendStatus={friendStatus}
            myRating={myRating}
            editingRatings={editingRatings}
            savingRating={savingRating}
            ratingError={ratingError}
            ratingSuccess={ratingSuccess}
            onRatingChange={handleRatingChange}
            onSaveRatings={() =>
              handleSaveRatings(
                editingRatings,
                currentUser!.id,
                profile.id,
                setMyRating,
                (stats) => userStats && Object.assign(userStats, stats)
              )
            }
          />

          <ProfileCommentsSection
            isOwner={isOwner}
            isPreviewMode={isPreviewMode}
            friendStatus={friendStatus}
            comments={comments}
            commentVotes={commentVotes}
            commentError={commentError}
            submitting={submitting}
            coinEarned={coinEarned}
            onSubmitComment={(comment) =>
              handleSubmitComment(
                comment,
                currentUser!.id,
                currentUser!.username,
                profile.id,
                comments,
                () => {},
                setComments,
                refreshBalance
              )
            }
            onCommentVote={(commentId, isUpvote) =>
              handleCommentVote(
                commentId,
                isUpvote,
                currentUser!.id,
                commentVotes,
                comments,
                setCommentVotes,
                setComments
              )
            }
          />
        </div>
      </main>

      {showShareModal && (
        <ShareCardModal
          profile={profile}
          userStats={userStats}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {showEditSocialLinks && (
        <EditSocialLinks
          currentLinks={socialLinks}
          onClose={() => setShowEditSocialLinks(false)}
          onUpdate={(newLinks) => {
            setSocialLinks(newLinks);
            setShowEditSocialLinks(false);
          }}
        />
      )}

      {showReportModal && (
        <ReportUserModal
          reportedUserId={profile.id}
          reportedUsername={profile.username}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
}
