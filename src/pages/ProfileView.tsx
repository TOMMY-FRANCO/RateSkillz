import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import PlayerCard, { Rating } from '../components/PlayerCard';
import ShareCardModal from '../components/ShareCardModal';
import SocialLinks from '../components/SocialLinks';
import EditSocialLinks from '../components/EditSocialLinks';
import OnlineStatus from '../components/OnlineStatus';
import CardOwnershipStatus from '../components/CardOwnershipStatus';
import ReportUserModal from '../components/ReportUserModal';
import { ArrowLeft, ThumbsUp, ThumbsDown, Send, UserPlus, UserCheck, UserX, Clock, Users, Eye, Share2, Coins, Lock, X, Loader2, MessageSquare, MessageCircle, Flag, AlertTriangle } from 'lucide-react';
import { formatCoinBalance, formatCoinBalanceFull } from '../lib/formatBalance';
import type { Profile } from '../contexts/AuthContext';
import { awardCommentCoins } from '../lib/coins';
import { getCardOwnership, type CardOwnership } from '../lib/cardTrading';
import { saveRating, getMyRatingForUser, getUserStats, type PlayerRating, type UserStats } from '../lib/ratings';
import { recordUniqueProfileView } from '../lib/viewTracking';
import { getOrCreateConversation, checkAreFriends } from '../lib/messaging';
import { getUserPresence } from '../lib/presence';
import { ShimmerBar, StaggerItem, SlowLoadMessage } from '../components/ui/Shimmer';
import { SkeletonAvatar } from '../components/ui/SkeletonPresets';

interface Comment {
  id: string;
  commenter_id: string;
  commenter_name: string;
  text: string;
  likes: number;
  dislikes: number;
  created_at: string;
}

interface ProfileLike {
  id: string;
  user_id: string;
  is_like: boolean;
}

type FriendStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'blocked';

export default function ProfileView() {
  const { username } = useParams<{ username: string }>();
  const { profile: currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPreviewMode = searchParams.get('preview') === 'true';
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const [loading, setLoading] = useState(true);
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [userVote, setUserVote] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>('none');
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [friendsCount, setFriendsCount] = useState(0);
  const [viewsCount, setViewsCount] = useState(0);
  const [myRating, setMyRating] = useState<PlayerRating | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [editingRatings, setEditingRatings] = useState({
    pac: 50,
    sho: 50,
    pas: 50,
    dri: 50,
    def: 50,
    phy: 50,
  });
  const [savingRating, setSavingRating] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [ratingSuccess, setRatingSuccess] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEditSocialLinks, setShowEditSocialLinks] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [socialLinks, setSocialLinks] = useState<any>(null);
  const [commentVotes, setCommentVotes] = useState<Record<string, { is_upvote: boolean; vote_id: string }>>({});
  const [coinEarned, setCoinEarned] = useState<number | null>(null);
  const [cardOwnership, setCardOwnership] = useState<CardOwnership | null>(null);
  const [coinBalance, setCoinBalance] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [commentsCount, setCommentsCount] = useState<number>(0);
  const [userPresenceData, setUserPresenceData] = useState<string | undefined>();
  const [isVerified, setIsVerified] = useState(false);
  const [hasSocialBadge, setHasSocialBadge] = useState(false);

  const isOwner = currentUser?.id === profile?.id;
  const isEditingEnabled = !isPreviewMode && !isOwner;

  useEffect(() => {
    if (username) {
      loadProfile();
    }
  }, [username]);

  useEffect(() => {
    if (!profile) return;

    const fetchBalance = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('coin_balance')
          .eq('id', profile.id)
          .maybeSingle();

        if (!error && data) {
          setCoinBalance(Number(data.coin_balance || 0));
        }
      } catch (error) {
        console.error('Error fetching balance:', error);
      }
    };

    fetchBalance();
  }, [profile?.id]);

  const loadProfile = async () => {
    try {
      // Use profile_summary cache for optimized query
      const { data: summaryData, error: summaryError } = await supabase
        .from('profile_summary')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (summaryError) throw summaryError;
      if (!summaryData) {
        navigate('/settings');
        return;
      }

      // Map cache fields to profile format
      const profileData = {
        id: summaryData.user_id,
        username: summaryData.username,
        full_name: summaryData.full_name,
        avatar_url: summaryData.avatar_url,
        bio: summaryData.bio,
        position: summaryData.position,
        team: summaryData.team,
        age: summaryData.age,
        overall_rating: summaryData.overall_rating,
        is_verified: summaryData.is_verified,
        is_manager: summaryData.is_manager,
        is_admin: summaryData.is_admin,
        is_banned: summaryData.is_banned,
        friend_count: summaryData.friend_count,
        profile_views_count: 0, // Not available in cache
        comments_count: 0, // Not available in cache
        has_social_badge: false, // Not available in cache
        coin_balance: 0, // We'll fetch this separately if needed
        last_active: summaryData.last_seen,
        created_at: summaryData.created_at,
        manager_wins: summaryData.manager_wins,
      };

      setProfile(profileData as any);
      setIsVerified(profileData.is_verified || false);
      setHasSocialBadge(false);
      setCoinBalance(0);
      setBalanceLoading(false);
      setBalanceError(null);

      setViewsCount(0);
      setCommentsCount(0);

      const presence = await getUserPresence(profileData.id);
      if (presence) {
        setUserPresenceData(presence.last_seen);
      }

      if (currentUser && profileData.id !== currentUser.id && !isPreviewMode) {
        recordUniqueProfileView(profileData.id, currentUser.id).then((viewResult) => {
          if (viewResult.success && viewResult.counted && viewResult.new_count) {
            setViewsCount(viewResult.new_count);

            supabase.from('notifications').insert({
              user_id: profileData.id,
              actor_id: currentUser.id,
              type: 'profile_view',
              message: `${currentUser.username} viewed your profile`,
              metadata: { profile_id: profileData.id },
            }).catch(err => console.error('Error creating notification:', err));
          }
        }).catch(err => console.error('Error recording view:', err));
      }

      setFriendsCount(profileData.friend_count || 0);

      if (currentUser && profileData.id !== currentUser.id) {
        const { data: friendData } = await supabase
          .from('friends')
          .select('*')
          .or(`and(user_id.eq.${currentUser.id},friend_id.eq.${profileData.id}),and(user_id.eq.${profileData.id},friend_id.eq.${currentUser.id})`)
          .maybeSingle();

        if (friendData) {
          setFriendshipId(friendData.id);
          if (friendData.status === 'accepted') {
            setFriendStatus('accepted');
          } else if (friendData.status === 'blocked') {
            setFriendStatus('blocked');
          } else if (friendData.status === 'pending') {
            setFriendStatus(friendData.user_id === currentUser.id ? 'pending_sent' : 'pending_received');
          }
        } else {
          setFriendStatus('none');
        }
      }

      // Use stats from profile_summary cache
      const stats = {
        pac: summaryData.pac_rating || 50,
        sho: summaryData.sho_rating || 50,
        pas: summaryData.pas_rating || 50,
        dri: summaryData.dri_rating || 50,
        def: summaryData.def_rating || 50,
        phy: summaryData.phy_rating || 50,
      };
      setUserStats(stats);

      if (currentUser && profileData.id !== currentUser.id) {
        const myRatingData = await getMyRatingForUser(currentUser.id, profileData.id);
        setMyRating(myRatingData);

        if (myRatingData) {
          setEditingRatings({
            pac: myRatingData.pac,
            sho: myRatingData.sho,
            pas: myRatingData.pas,
            dri: myRatingData.dri,
            def: myRatingData.def,
            phy: myRatingData.phy,
          });
        }
      }

      const { data: commentsData } = await supabase
        .from('comments')
        .select('*')
        .eq('profile_id', profileData.id)
        .order('created_at', { ascending: false });

      setComments(commentsData || []);

      if (currentUser && commentsData) {
        const { data: votesData } = await supabase
          .from('comment_votes')
          .select('*')
          .eq('user_id', currentUser.id)
          .in('comment_id', commentsData.map(c => c.id));

        const votesMap: Record<string, { is_upvote: boolean; vote_id: string }> = {};
        votesData?.forEach(vote => {
          votesMap[vote.comment_id] = { is_upvote: vote.is_upvote, vote_id: vote.id };
        });
        setCommentVotes(votesMap);
      }

      const { data: likesData } = await supabase
        .from('profile_likes')
        .select('*')
        .eq('profile_id', profileData.id);

      const likesCount = likesData?.filter((l) => l.is_like).length || 0;
      const dislikesCount = likesData?.filter((l) => !l.is_like).length || 0;
      setLikes(likesCount);
      setDislikes(dislikesCount);

      if (currentUser) {
        const userLike = likesData?.find((l) => l.user_id === currentUser.id);
        if (userLike) {
          setUserVote(userLike.is_like);
        }
      }

      // Use social links from profile_summary cache
      const socialLinksData = {
        user_id: summaryData.user_id,
        instagram_url: summaryData.instagram_url,
        twitter_url: summaryData.twitter_url,
        youtube_url: summaryData.youtube_url,
        tiktok_url: summaryData.tiktok_url,
        twitch_url: summaryData.twitch_url,
      };

      setSocialLinks(socialLinksData);

      const cardOwnershipData = await getCardOwnership(profileData.id);
      setCardOwnership(cardOwnershipData);

      setLoading(false);
    } catch (error) {
      console.error('Error loading profile:', error);
      setBalanceError('Unable to load balance');
      setBalanceLoading(false);
      setLoading(false);
      return null;
    }
  };

  const refreshBalance = async () => {
    if (!profile) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('coin_balance')
        .eq('id', profile.id)
        .maybeSingle();

      if (error) {
        console.error('Error refreshing balance:', error);
        setBalanceError('Unable to load balance');
      } else if (data) {
        setCoinBalance(Number(data.coin_balance || 0));
        setBalanceError(null);
      }
    } catch (error) {
      console.error('Error refreshing balance:', error);
      setBalanceError('Unable to load balance');
    }
  };

  const handleCardOwnershipUpdate = async () => {
    if (profile) {
      const cardOwnershipData = await getCardOwnership(profile.id);
      setCardOwnership(cardOwnershipData);
      await refreshBalance();
      await loadProfile();
    }
  };

  const handleFriendRequest = async () => {
    if (!currentUser || !profile) return;

    try {
      if (friendStatus === 'none') {
        const { data, error } = await supabase
          .from('friends')
          .insert({
            user_id: currentUser.id,
            friend_id: profile.id,
            status: 'pending',
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setFriendshipId(data.id);
          setFriendStatus('pending_sent');
        }
      } else if (friendStatus === 'pending_sent') {
        if (friendshipId) {
          const { error } = await supabase
            .from('friends')
            .delete()
            .eq('id', friendshipId);

          if (error) throw error;
          setFriendshipId(null);
          setFriendStatus('none');
        }
      } else if (friendStatus === 'pending_received') {
        if (friendshipId) {
          const { error } = await supabase
            .from('friends')
            .update({ status: 'accepted' })
            .eq('id', friendshipId);

          if (error) throw error;
          setFriendStatus('accepted');
          getOrCreateConversation(currentUser.id, profile.id).catch(() => {});
          await loadProfile();
        }
      } else if (friendStatus === 'accepted') {
        if (!confirm('Remove this friend?')) return;
        if (friendshipId) {
          const { error } = await supabase
            .from('friends')
            .delete()
            .eq('id', friendshipId);

          if (error) throw error;
          setFriendshipId(null);
          setFriendStatus('none');
          await loadProfile();
        }
      }
    } catch (error: any) {
      console.error('Error handling friend request:', error);
      alert(error?.message || 'Action failed. Try again.');
    }
  };

  const handleVote = async (isLike: boolean) => {
    if (!currentUser || !profile || friendStatus !== 'accepted') return;

    try {
      if (userVote === isLike) {
        const { error } = await supabase
          .from('profile_likes')
          .delete()
          .eq('profile_id', profile.id)
          .eq('user_id', currentUser.id);

        if (!error) {
          setUserVote(null);
          if (isLike) {
            setLikes(likes - 1);
          } else {
            setDislikes(dislikes - 1);
          }
        }
      } else {
        const { error } = await supabase
          .from('profile_likes')
          .upsert({
            profile_id: profile.id,
            user_id: currentUser.id,
            is_like: isLike,
          });

        if (!error) {
          if (userVote !== null) {
            if (userVote) {
              setLikes(likes - 1);
              setDislikes(dislikes + 1);
            } else {
              setDislikes(dislikes - 1);
              setLikes(likes + 1);
            }
          } else {
            if (isLike) {
              setLikes(likes + 1);
            } else {
              setDislikes(dislikes + 1);
            }
          }
          setUserVote(isLike);
        }
      }
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !profile || !newComment.trim() || friendStatus !== 'accepted') return;

    setSubmitting(true);
    setCommentError('');

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          profile_id: profile.id,
          commenter_id: currentUser.id,
          commenter_name: currentUser.username,
          text: newComment.trim(),
        })
        .select()
        .single();

      if (error) {
        // Check if error is from profanity filter
        if (error.message.includes('inappropriate language') ||
            error.message.includes('links or URLs') ||
            error.message.includes('not allowed')) {
          setCommentError(error.message);
        } else {
          setCommentError('Failed to post comment. Please try again.');
        }
        console.error('Error submitting comment:', error);
        return;
      }

      if (data) {
        setComments([data, ...comments]);
        setNewComment('');
        setCommentError('');

        try {
          const coinResult = await awardCommentCoins(profile.id, data.id);
          if (coinResult.earned) {
            setCoinEarned(coinResult.amount);
            setTimeout(() => setCoinEarned(null), 3000);
            await refreshBalance();
          }
        } catch (coinError: any) {
          console.log('Coin reward info:', coinError.message);
        }
      }
    } catch (error: any) {
      console.error('Error submitting comment:', error);
      if (error.message) {
        setCommentError(error.message);
      } else {
        setCommentError('Failed to post comment. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

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

  const handleSaveRatings = async () => {
    if (!currentUser || !profile || friendStatus !== 'accepted') {
      setRatingError('You can only rate accepted friends');
      return;
    }

    setSavingRating(true);
    setRatingError(null);
    setRatingSuccess(false);

    try {
      const rating: PlayerRating = {
        rater_id: currentUser.id,
        player_id: profile.id,
        pac: editingRatings.pac,
        sho: editingRatings.sho,
        pas: editingRatings.pas,
        dri: editingRatings.dri,
        def: editingRatings.def,
        phy: editingRatings.phy,
      };

      const result = await saveRating(rating);

      if (result.success) {
        setMyRating(result.data || null);
        setRatingSuccess(true);

        setTimeout(() => {
          setRatingSuccess(false);
        }, 3000);

        setTimeout(async () => {
          const updatedStats = await getUserStats(profile.id);
          setUserStats(updatedStats);
        }, 1000);
      } else {
        setRatingError(result.error || 'Failed to save ratings');
      }
    } catch (error: any) {
      console.error('Error saving ratings:', error);
      setRatingError(error.message || 'An unexpected error occurred');
    } finally {
      setSavingRating(false);
    }
  };

  const handleCommentVote = async (commentId: string, isUpvote: boolean) => {
    if (!currentUser || isPreviewMode) return;

    try {
      const existingVote = commentVotes[commentId];

      if (existingVote) {
        if (existingVote.is_upvote === isUpvote) {
          await supabase
            .from('comment_votes')
            .delete()
            .eq('id', existingVote.vote_id);

          const newVotes = { ...commentVotes };
          delete newVotes[commentId];
          setCommentVotes(newVotes);
        } else {
          await supabase
            .from('comment_votes')
            .update({ is_upvote: isUpvote })
            .eq('id', existingVote.vote_id);

          setCommentVotes({
            ...commentVotes,
            [commentId]: { ...existingVote, is_upvote: isUpvote }
          });
        }
      } else {
        const { data, error } = await supabase
          .from('comment_votes')
          .insert({
            comment_id: commentId,
            user_id: currentUser.id,
            is_upvote: isUpvote
          })
          .select()
          .single();

        if (!error && data) {
          setCommentVotes({
            ...commentVotes,
            [commentId]: { is_upvote: isUpvote, vote_id: data.id }
          });
        }
      }

      await loadProfile();
    } catch (error) {
      console.error('Error voting on comment:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <nav className="bg-gray-900 border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
            <ShimmerBar className="w-5 h-5 rounded" />
            <ShimmerBar className="h-5 w-40 rounded" />
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
      <nav className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => isPreviewMode ? exitPreviewMode() : navigate('/settings')}
                className="text-gray-300 hover:text-cyan-400 transition-colors bg-none border-none cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-white">{profile.username}'s Profile</h1>
                <OnlineStatus lastActive={userPresenceData || profile.last_active} size="medium" />
              </div>
            </div>
          </div>
        </div>
      </nav>

      {isPreviewMode && isOwner && (
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 border-b border-blue-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-full">
                  <Eye className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold">Preview Mode</p>
                  <p className="text-blue-100 text-sm">This is how other users see your profile</p>
                </div>
              </div>
              <button
                onClick={exitPreviewMode}
                className="flex items-center space-x-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
                <span>Exit Preview</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex justify-center mb-4">
          <PlayerCard
            profile={profile}
            userStats={userStats}
            showDownloadButton={false}
            overallRating={profile.overall_rating}
            isVerified={isVerified}
            hasSocialBadge={hasSocialBadge}
          />
        </div>

        <div className="flex justify-center mb-4">
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-bold rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all shadow-lg hover:shadow-xl hover:scale-105 text-sm sm:text-base"
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

        <div className="max-w-3xl mx-auto mb-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-4">
            <h3 className="text-base sm:text-lg font-bold text-white mb-4 text-center">Profile Stats</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <div className="flex flex-col items-center space-y-1.5">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                  <Coins className="w-6 h-6 text-white" />
                </div>
                {balanceLoading ? (
                  <div className="flex flex-col items-center space-y-0.5">
                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                    <span className="text-[10px] text-gray-400">Loading...</span>
                  </div>
                ) : balanceError ? (
                  <div className="flex flex-col items-center space-y-0.5">
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
                    <span className="text-xs text-gray-400">{isOwner ? 'Your Balance' : 'Balance'}</span>
                    <span className="text-[10px] text-gray-500">{formatCoinBalanceFull(coinBalance)} coins</span>
                  </>
                )}
              </div>
              <div className="flex flex-col items-center space-y-1.5">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-white">{friendsCount}</span>
                <span className="text-xs text-gray-400">Friends</span>
              </div>
              <div className="flex flex-col items-center space-y-1.5">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
                  <Eye className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-white">{viewsCount}</span>
                <span className="text-xs text-gray-400">Views</span>
              </div>
              <div className="flex flex-col items-center space-y-1.5">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                  <ThumbsUp className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-white">{likes}</span>
                <span className="text-xs text-gray-400">Likes</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto mb-4">
          <CardOwnershipStatus
            cardOwnership={cardOwnership}
            currentUserId={currentUser?.id || null}
            cardUserId={profile.id}
            onUpdate={handleCardOwnershipUpdate}
          />
        </div>

        <div className="max-w-2xl mx-auto space-y-4">
          {currentUser && profile.id !== currentUser.id && !isPreviewMode && (
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                {friendStatus === 'none' && (
                  <button
                    onClick={handleFriendRequest}
                    className="px-4 sm:px-6 py-2 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-semibold rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all flex items-center space-x-2 text-sm sm:text-base"
                  >
                    <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Send Friend Request</span>
                  </button>
                )}
                {friendStatus === 'pending_sent' && (
                  <button
                    onClick={handleFriendRequest}
                    className="px-4 sm:px-6 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition-all flex items-center space-x-2 text-sm sm:text-base"
                  >
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Request Pending (Cancel)</span>
                  </button>
                )}
                {friendStatus === 'pending_received' && (
                  <button
                    onClick={handleFriendRequest}
                    className="px-4 sm:px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-lg hover:from-blue-400 hover:to-purple-400 transition-all flex items-center space-x-2 text-sm sm:text-base"
                  >
                    <UserCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Accept Friend Request</span>
                  </button>
                )}
                {friendStatus === 'accepted' && (
                  <>
                    <button
                      onClick={async () => {
                        if (!currentUser || !profile) return;
                        const conversationId = await getOrCreateConversation(currentUser.id, profile.id);
                        if (conversationId) {
                          navigate(`/inbox/${conversationId}`, {
                            state: {
                              otherUser: {
                                id: profile.id,
                                username: profile.username,
                                full_name: null,
                                avatar_url: profile.avatar_url,
                              },
                            },
                          });
                        }
                      }}
                      className="px-4 sm:px-6 py-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white font-semibold rounded-lg hover:from-pink-500 hover:to-purple-500 transition-all flex items-center space-x-2 text-sm sm:text-base"
                    >
                      <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span>Send Message</span>
                    </button>
                    <button
                      onClick={handleFriendRequest}
                      className="px-4 sm:px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-500 transition-all flex items-center space-x-2 text-sm sm:text-base"
                    >
                      <UserX className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span>Remove Friend</span>
                    </button>
                  </>
                )}

                {/* Report Button - Always visible for non-owners */}
                <button
                  onClick={() => setShowReportModal(true)}
                  className="px-4 sm:px-6 py-2 bg-gray-800 hover:bg-gray-700 text-red-400 font-semibold rounded-lg border border-red-500/30 hover:border-red-500/50 transition-all flex items-center space-x-2 text-sm sm:text-base"
                  title="Report user for harassment"
                >
                  <Flag className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Report</span>
                </button>
              </div>
            </div>
          )}

          {currentUser && profile.id !== currentUser.id && !isPreviewMode && (
            <>
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-white">Your Skill Ratings</h3>
                  {userStats && userStats.rating_count > 0 && (
                    <span className="text-xs sm:text-sm text-cyan-400 font-medium">
                      Card shows average of {userStats.rating_count} {userStats.rating_count === 1 ? 'rating' : 'ratings'}
                    </span>
                  )}
                </div>
                {friendStatus === 'accepted' ? (
                  <>
                    <p className="text-xs sm:text-sm text-gray-400 mb-3">
                      {isPreviewMode ? 'Skill ratings from friends' : 'Adjust the sliders to rate this player\'s skills. The player card above shows the average from all friends.'}
                    </p>

                    {ratingError && (
                      <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-xs sm:text-sm text-red-400">{ratingError}</p>
                      </div>
                    )}

                    {ratingSuccess && (
                      <div className="mb-3 p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-xs sm:text-sm text-green-400">Ratings saved successfully! Card will update shortly.</p>
                      </div>
                    )}

                    <div className="space-y-3 mb-4">
                      {[
                        { key: 'pac', label: 'PAC (Pace)', color: 'from-blue-500 to-cyan-500', bgColor: 'bg-blue-500' },
                        { key: 'sho', label: 'SHO (Shooting)', color: 'from-red-500 to-orange-500', bgColor: 'bg-red-500' },
                        { key: 'pas', label: 'PAS (Passing)', color: 'from-green-500 to-emerald-500', bgColor: 'bg-green-500' },
                        { key: 'dri', label: 'DRI (Dribbling)', color: 'from-purple-500 to-pink-500', bgColor: 'bg-purple-500' },
                        { key: 'def', label: 'DEF (Defense)', color: 'from-yellow-500 to-amber-500', bgColor: 'bg-yellow-500' },
                        { key: 'phy', label: 'PHY (Physical)', color: 'from-teal-500 to-cyan-500', bgColor: 'bg-teal-500' },
                      ].map(({ key, label, color, bgColor }) => {
                        const value = editingRatings[key as keyof typeof editingRatings];

                        return (
                          <div key={key} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs sm:text-sm font-semibold text-gray-300">{label}</label>
                              <div className={`text-lg sm:text-xl font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
                                {value}
                              </div>
                            </div>
                            <input
                              type="range"
                              min="1"
                              max="100"
                              value={value}
                              onChange={(e) => handleRatingChange(key, parseInt(e.target.value))}
                              disabled={savingRating || isPreviewMode}
                              className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${bgColor}/20 slider-thumb-${key}`}
                              style={{
                                background: `linear-gradient(to right, ${bgColor.replace('bg-', '')} 0%, ${bgColor.replace('bg-', '')} ${value}%, rgb(31, 41, 55) ${value}%, rgb(31, 41, 55) 100%)`
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>

                    <button
                      onClick={handleSaveRatings}
                      disabled={savingRating}
                      className="w-full px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-lg hover:from-cyan-400 hover:to-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm sm:text-base"
                    >
                      {savingRating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white" />
                          <span>Saving your ratings...</span>
                        </>
                      ) : (
                        <span>Save Ratings</span>
                      )}
                    </button>

                    {myRating && (
                      <p className="text-xs text-gray-500 text-center mt-3">
                        Last updated: {new Date(myRating.updated_at || myRating.created_at || '').toLocaleDateString()}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="text-center text-gray-400 py-8">
                    <Lock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Become friends to rate this player's skills</p>
                  </div>
                )}
              </div>

              <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-4">
                <h3 className="text-base sm:text-lg font-bold text-white mb-3">Rate this player</h3>
              {friendStatus === 'accepted' ? (
                <div className="flex items-center justify-center space-x-6 sm:space-x-8">
                  <button
                    onClick={() => handleVote(true)}
                    className={`flex flex-col items-center space-y-1.5 transition-all ${
                      userVote === true
                        ? 'text-green-400'
                        : 'text-gray-400 hover:text-green-400'
                    }`}
                  >
                    <ThumbsUp className="w-10 h-10 sm:w-12 sm:h-12" />
                    <span className="text-xl sm:text-2xl font-bold">{likes}</span>
                  </button>
                  <button
                    onClick={() => handleVote(false)}
                    className={`flex flex-col items-center space-y-1.5 transition-all ${
                      userVote === false
                        ? 'text-red-400'
                        : 'text-gray-400 hover:text-red-400'
                    }`}
                  >
                    <ThumbsDown className="w-10 h-10 sm:w-12 sm:h-12" />
                    <span className="text-xl sm:text-2xl font-bold">{dislikes}</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-6 sm:space-x-8">
                  <div className="flex flex-col items-center space-y-1.5 text-gray-600">
                    <ThumbsUp className="w-10 h-10 sm:w-12 sm:h-12" />
                    <span className="text-xl sm:text-2xl font-bold">{likes}</span>
                  </div>
                  <div className="flex flex-col items-center space-y-1.5 text-gray-600">
                    <ThumbsDown className="w-10 h-10 sm:w-12 sm:h-12" />
                    <span className="text-xl sm:text-2xl font-bold">{dislikes}</span>
                  </div>
                </div>
              )}
              {friendStatus !== 'accepted' && (
                <p className="text-center text-gray-400 text-xs sm:text-sm mt-3">
                  Become friends to rate this player
                </p>
              )}
            </div>
            </>
          )}

          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">Comments</h3>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-cyan-500/20 border border-cyan-500/30 rounded-full">
                  <MessageSquare className="w-3 h-3 text-cyan-400" />
                  <span className="text-xs font-bold text-cyan-400">{commentsCount}</span>
                </div>
              </div>
            </div>

            {currentUser && profile.id !== currentUser.id && !isPreviewMode && (
              <>
                {friendStatus === 'accepted' ? (
                  <>
                    <form onSubmit={handleSubmitComment} className="mb-4">
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={newComment}
                          onChange={(e) => {
                            setNewComment(e.target.value);
                            if (commentError) setCommentError('');
                          }}
                          placeholder="Add a comment..."
                          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                        />
                        <button
                          type="submit"
                          disabled={!newComment.trim() || submitting}
                          className="px-3 sm:px-4 py-2 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-semibold rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </form>
                    {commentError && (
                      <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs sm:text-sm text-red-400">{commentError}</p>
                        </div>
                      </div>
                    )}
                    {coinEarned !== null && (
                      <div className="mb-3 p-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 rounded-lg animate-pulse">
                        <div className="flex items-center justify-center gap-2 text-yellow-400">
                          <Coins className="w-4 h-4" />
                          <span className="text-xs sm:text-sm font-semibold">You earned {coinEarned === 1 ? '1 coin' : `${coinEarned.toFixed(2)} coins`} for commenting!</span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mb-4 p-3 bg-gray-800 border border-gray-700 rounded-lg text-center">
                    <p className="text-gray-400 text-xs sm:text-sm">Only friends can comment on this profile</p>
                  </div>
                )}
              </>
            )}

            {isPreviewMode && (
              <div className="mb-4 p-3 bg-blue-900/20 border border-blue-600/50 rounded-lg text-center">
                <div className="flex items-center justify-center gap-2 text-blue-400">
                  <Lock className="w-3 h-3 sm:w-4 sm:h-4" />
                  <p className="text-xs sm:text-sm">Preview mode - commenting disabled</p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {comments.length === 0 ? (
                <p className="text-gray-400 text-center py-6 text-sm">No comments yet. Be the first to comment!</p>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="bg-gray-800 rounded-lg p-3 border border-gray-700"
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <span className="font-semibold text-cyan-400 text-sm">{comment.commenter_name}</span>
                      <span className="text-[10px] text-gray-500">
                        {new Date(comment.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-gray-300 mb-2 text-sm">{comment.text}</p>
                    <div className="flex items-center space-x-3 text-xs">
                      <button
                        onClick={() => handleCommentVote(comment.id, true)}
                        disabled={!currentUser}
                        className={`flex items-center space-x-1 transition-colors ${
                          commentVotes[comment.id]?.is_upvote === true
                            ? 'text-green-400'
                            : 'text-gray-400 hover:text-green-400'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>{comment.likes}</span>
                      </button>
                      <button
                        onClick={() => handleCommentVote(comment.id, false)}
                        disabled={!currentUser}
                        className={`flex items-center space-x-1 transition-colors ${
                          commentVotes[comment.id]?.is_upvote === false
                            ? 'text-red-400'
                            : 'text-gray-400 hover:text-red-400'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                        <span>{comment.dislikes}</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      <ShareCardModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        username={profile.username}
        fullName={`@${profile.username}`}
        overallRating={profile.overall_rating ?? 50}
      />

      <EditSocialLinks
        isOpen={showEditSocialLinks}
        onClose={() => setShowEditSocialLinks(false)}
        userId={profile.id}
        currentLinks={socialLinks}
        onSave={loadProfile}
      />

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
