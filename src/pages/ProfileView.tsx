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
import { ArrowLeft, ThumbsUp, ThumbsDown, Send, UserPlus, UserCheck, UserX, Clock, Users, Eye, Share2, Coins, Lock, X, Loader2, MessageSquare, MessageCircle } from 'lucide-react';
import { formatCoinBalance, formatCoinBalanceFull } from '../lib/formatBalance';
import type { Profile } from '../contexts/AuthContext';
import { awardCommentCoins } from '../lib/coins';
import { getCardOwnership, type CardOwnership } from '../lib/cardTrading';
import { saveRating, getMyRatingForUser, getUserStats, type PlayerRating, type UserStats } from '../lib/ratings';
import { recordUniqueProfileView } from '../lib/viewTracking';
import { getOrCreateConversation, checkAreFriends } from '../lib/messaging';
import { getUserPresence } from '../lib/presence';

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
  const [socialLinks, setSocialLinks] = useState<any>(null);
  const [commentVotes, setCommentVotes] = useState<Record<string, { is_upvote: boolean; vote_id: string }>>({});
  const [coinEarned, setCoinEarned] = useState<number | null>(null);
  const [cardOwnership, setCardOwnership] = useState<CardOwnership | null>(null);
  const [coinBalance, setCoinBalance] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [commentsCount, setCommentsCount] = useState<number>(0);
  const [userPresenceData, setUserPresenceData] = useState<string | undefined>();
  const [isVerified, setIsVerified] = useState(false);
  const [hasSocialBadge, setHasSocialBadge] = useState(false);

  const isOwner = currentUser?.id === profile?.id;
  const isEditingEnabled = !isPreviewMode && !isOwner;

  useEffect(() => {
    let commentsChannel: any = null;

    if (username) {
      loadProfile().then((channel) => {
        commentsChannel = channel;
      });
    }

    return () => {
      if (commentsChannel) {
        commentsChannel.unsubscribe();
      }
    };
  }, [username]);

  const loadProfile = async () => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profileData) {
        navigate('/settings');
        return;
      }

      setProfile(profileData);
      setIsVerified(profileData.is_verified || false);
      setHasSocialBadge(profileData.has_social_badge || false);

      setViewsCount(profileData.profile_views_count || 0);
      setCommentsCount(profileData.comments_count || 0);

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
        console.log('🔍 Loading friend status...');
        console.log('Current User ID:', currentUser.id);
        console.log('Profile User ID:', profileData.id);

        const { data: friendData, error: friendError } = await supabase
          .from('friends')
          .select('*')
          .or(`and(user_id.eq.${currentUser.id},friend_id.eq.${profileData.id}),and(user_id.eq.${profileData.id},friend_id.eq.${currentUser.id})`)
          .maybeSingle();

        if (friendError) {
          console.error('❌ Error loading friend data:', friendError);
        } else {
          console.log('Friend Data:', friendData);
        }

        if (friendData) {
          setFriendshipId(friendData.id);
          if (friendData.status === 'accepted') {
            console.log('✅ Friend status: ACCEPTED');
            setFriendStatus('accepted');
          } else if (friendData.status === 'blocked') {
            console.log('🚫 Friend status: BLOCKED');
            setFriendStatus('blocked');
          } else if (friendData.status === 'pending') {
            if (friendData.user_id === currentUser.id) {
              console.log('⏳ Friend status: PENDING_SENT (you sent the request)');
              setFriendStatus('pending_sent');
            } else {
              console.log('⏳ Friend status: PENDING_RECEIVED (you received the request)');
              setFriendStatus('pending_received');
            }
          }
        } else {
          console.log('👥 Friend status: NONE (no friendship exists)');
          setFriendStatus('none');
        }
      }

      const stats = await getUserStats(profileData.id);
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

      const { data: socialLinksData } = await supabase
        .from('social_links')
        .select('*')
        .eq('user_id', profileData.id)
        .maybeSingle();

      setSocialLinks(socialLinksData);

      const cardOwnershipData = await getCardOwnership(profileData.id);
      setCardOwnership(cardOwnershipData);

      const { data: balanceData, error: balanceError } = await supabase
        .from('coins')
        .select('balance')
        .eq('user_id', profileData.id)
        .maybeSingle();

      if (balanceError) {
        console.error('Error loading coin balance:', balanceError);
      }

      console.log(`Coin balance for ${profileData.username}:`, balanceData?.balance || 0);
      setCoinBalance(balanceData?.balance || 0);
      setBalanceLoading(false);

      setLoading(false);

      const commentsChannel = supabase
        .channel(`comments:${profileData.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'comments',
            filter: `profile_id=eq.${profileData.id}`
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setComments(prev => [payload.new as Comment, ...prev]);
              setCommentsCount(prev => prev + 1);
            } else if (payload.eventType === 'DELETE') {
              setComments(prev => prev.filter(c => c.id !== payload.old.id));
              setCommentsCount(prev => Math.max(0, prev - 1));
            }
          }
        )
        .subscribe();

      return commentsChannel;
    } catch (error) {
      console.error('Error loading profile:', error);
      setLoading(false);
      return null;
    }
  };

  const handleCardOwnershipUpdate = async () => {
    if (profile) {
      const cardOwnershipData = await getCardOwnership(profile.id);
      setCardOwnership(cardOwnershipData);
      await loadProfile();
    }
  };

  const handleFriendRequest = async () => {
    console.log('🔵 Friend Request Button Clicked!');
    console.log('Current User:', currentUser?.id);
    console.log('Profile User:', profile?.id);
    console.log('Current Friend Status:', friendStatus);
    console.log('Friendship ID:', friendshipId);

    if (!currentUser || !profile) {
      console.log('❌ Missing currentUser or profile, aborting');
      return;
    }

    try {
      if (friendStatus === 'none') {
        console.log('➡️ Sending new friend request...');
        const { data, error } = await supabase
          .from('friends')
          .insert({
            user_id: currentUser.id,
            friend_id: profile.id,
            status: 'pending',
          })
          .select()
          .single();

        if (error) {
          console.error('❌ Error inserting friend request:', error);
        } else if (data) {
          console.log('✅ Friend request sent successfully:', data);
          setFriendshipId(data.id);
          setFriendStatus('pending_sent');
          alert('Friend request sent!');
        }
      } else if (friendStatus === 'pending_sent') {
        console.log('➡️ Canceling friend request...');
        if (friendshipId) {
          const { error } = await supabase
            .from('friends')
            .delete()
            .eq('id', friendshipId);

          if (error) {
            console.error('❌ Error canceling friend request:', error);
          } else {
            console.log('✅ Friend request canceled');
            setFriendshipId(null);
            setFriendStatus('none');
            alert('Friend request canceled');
          }
        }
      } else if (friendStatus === 'pending_received') {
        console.log('➡️ Accepting friend request...');
        if (friendshipId) {
          const { error } = await supabase
            .from('friends')
            .update({ status: 'accepted' })
            .eq('id', friendshipId);

          if (error) {
            console.error('❌ Error accepting friend request:', error);
          } else {
            console.log('✅ Friend request accepted');
            setFriendStatus('accepted');
            await loadProfile();
            alert('Friend request accepted!');
          }
        }
      } else if (friendStatus === 'accepted') {
        console.log('➡️ Removing friend...');
        if (friendshipId) {
          const { error } = await supabase
            .from('friends')
            .delete()
            .eq('id', friendshipId);

          if (error) {
            console.error('❌ Error removing friend:', error);
          } else {
            console.log('✅ Friend removed');
            setFriendshipId(null);
            setFriendStatus('none');
            await loadProfile();
            alert('Friend removed');
          }
        }
      }
    } catch (error) {
      console.error('❌ Exception in handleFriendRequest:', error);
      alert('An error occurred. Check console for details.');
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

      if (!error && data) {
        setComments([data, ...comments]);
        setNewComment('');

        try {
          const coinResult = await awardCommentCoins(profile.id, data.id);
          if (coinResult.earned) {
            setCoinEarned(coinResult.amount);
            setTimeout(() => setCoinEarned(null), 3000);
          }
        } catch (coinError: any) {
          console.log('Coin reward info:', coinError.message);
        }
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading profile...</div>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-center mb-8">
          <PlayerCard
            profile={profile}
            userStats={userStats}
            showDownloadButton={false}
            overallRating={profile.overall_rating}
            isVerified={isVerified}
            hasSocialBadge={hasSocialBadge}
          />
        </div>

        <div className="flex justify-center mb-8">
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-bold rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all shadow-lg hover:shadow-xl hover:scale-105"
          >
            <Share2 className="w-5 h-5" />
            <span>Share Card</span>
          </button>
        </div>

        <SocialLinks
          socialLinks={socialLinks}
          isOwner={currentUser?.id === profile.id && !isPreviewMode}
          onEdit={() => setShowEditSocialLinks(true)}
        />

        <div className="max-w-3xl mx-auto mb-8">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-6 text-center">Profile Stats</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="flex flex-col items-center space-y-2">
                <div className="w-14 h-14 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                  <Coins className="w-7 h-7 text-white" />
                </div>
                {balanceLoading ? (
                  <div className="flex items-center justify-center h-8">
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  </div>
                ) : (
                  <>
                    <span className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                      {formatCoinBalance(coinBalance)}
                    </span>
                    <span className="text-sm text-gray-400">{isOwner ? 'Your Balance' : 'Balance'}</span>
                    <span className="text-xs text-gray-500">{formatCoinBalanceFull(coinBalance)} coins</span>
                  </>
                )}
              </div>
              <div className="flex flex-col items-center space-y-2">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <span className="text-2xl font-bold text-white">{friendsCount}</span>
                <span className="text-sm text-gray-400">Friends</span>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
                  <Eye className="w-7 h-7 text-white" />
                </div>
                <span className="text-2xl font-bold text-white">{viewsCount}</span>
                <span className="text-sm text-gray-400">Views</span>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                  <ThumbsUp className="w-7 h-7 text-white" />
                </div>
                <span className="text-2xl font-bold text-white">{likes}</span>
                <span className="text-sm text-gray-400">Likes</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto mb-8">
          <CardOwnershipStatus
            cardOwnership={cardOwnership}
            currentUserId={currentUser?.id || null}
            cardUserId={profile.id}
            onUpdate={handleCardOwnershipUpdate}
          />
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
          {currentUser && profile.id !== currentUser.id && !isPreviewMode && (
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
              <div className="flex items-center justify-center gap-4">
                {friendStatus === 'none' && (
                  <button
                    onClick={handleFriendRequest}
                    className="px-8 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-semibold rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all flex items-center space-x-2"
                  >
                    <UserPlus className="w-5 h-5" />
                    <span>Send Friend Request</span>
                  </button>
                )}
                {friendStatus === 'pending_sent' && (
                  <button
                    onClick={handleFriendRequest}
                    className="px-8 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition-all flex items-center space-x-2"
                  >
                    <Clock className="w-5 h-5" />
                    <span>Request Pending (Cancel)</span>
                  </button>
                )}
                {friendStatus === 'pending_received' && (
                  <button
                    onClick={handleFriendRequest}
                    className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-lg hover:from-blue-400 hover:to-purple-400 transition-all flex items-center space-x-2"
                  >
                    <UserCheck className="w-5 h-5" />
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
                                full_name: profile.full_name,
                                avatar_url: profile.avatar_url,
                              },
                            },
                          });
                        }
                      }}
                      className="px-8 py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white font-semibold rounded-lg hover:from-pink-500 hover:to-purple-500 transition-all flex items-center space-x-2"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span>Send Message</span>
                    </button>
                    <button
                      onClick={handleFriendRequest}
                      className="px-8 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-500 transition-all flex items-center space-x-2"
                    >
                      <UserX className="w-5 h-5" />
                      <span>Remove Friend</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {currentUser && profile.id !== currentUser.id && !isPreviewMode && (
            <>
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Your Skill Ratings</h3>
                  {userStats && userStats.rating_count > 0 && (
                    <span className="text-sm text-cyan-400 font-medium">
                      Card shows average of {userStats.rating_count} {userStats.rating_count === 1 ? 'rating' : 'ratings'}
                    </span>
                  )}
                </div>
                {friendStatus === 'accepted' ? (
                  <>
                    <p className="text-sm text-gray-400 mb-4">
                      {isPreviewMode ? 'Skill ratings from friends' : 'Adjust the sliders to rate this player\'s skills. The player card above shows the average from all friends.'}
                    </p>

                    {ratingError && (
                      <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-sm text-red-400">{ratingError}</p>
                      </div>
                    )}

                    {ratingSuccess && (
                      <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-sm text-green-400">Ratings saved successfully! Card will update shortly.</p>
                      </div>
                    )}

                    <div className="space-y-4 mb-6">
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
                          <div key={key} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-sm font-semibold text-gray-300">{label}</label>
                              <div className={`text-2xl font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
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
                      className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-lg hover:from-cyan-400 hover:to-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    >
                      {savingRating ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
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

              <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-white mb-4">Rate this player</h3>
              {friendStatus === 'accepted' ? (
                <div className="flex items-center justify-center space-x-8">
                  <button
                    onClick={() => handleVote(true)}
                    className={`flex flex-col items-center space-y-2 transition-all ${
                      userVote === true
                        ? 'text-green-400'
                        : 'text-gray-400 hover:text-green-400'
                    }`}
                  >
                    <ThumbsUp className="w-12 h-12" />
                    <span className="text-2xl font-bold">{likes}</span>
                  </button>
                  <button
                    onClick={() => handleVote(false)}
                    className={`flex flex-col items-center space-y-2 transition-all ${
                      userVote === false
                        ? 'text-red-400'
                        : 'text-gray-400 hover:text-red-400'
                    }`}
                  >
                    <ThumbsDown className="w-12 h-12" />
                    <span className="text-2xl font-bold">{dislikes}</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-8">
                  <div className="flex flex-col items-center space-y-2 text-gray-600">
                    <ThumbsUp className="w-12 h-12" />
                    <span className="text-2xl font-bold">{likes}</span>
                  </div>
                  <div className="flex flex-col items-center space-y-2 text-gray-600">
                    <ThumbsDown className="w-12 h-12" />
                    <span className="text-2xl font-bold">{dislikes}</span>
                  </div>
                </div>
              )}
              {friendStatus !== 'accepted' && (
                <p className="text-center text-gray-400 text-sm mt-4">
                  Become friends to rate this player
                </p>
              )}
            </div>
            </>
          )}

          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-white">Comments</h3>
                <div className="flex items-center gap-2 px-3 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded-full">
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-bold text-cyan-400">{commentsCount}</span>
                </div>
              </div>
            </div>

            {currentUser && profile.id !== currentUser.id && !isPreviewMode && (
              <>
                {friendStatus === 'accepted' ? (
                  <>
                    <form onSubmit={handleSubmitComment} className="mb-6">
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Add a comment..."
                          className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                        />
                        <button
                          type="submit"
                          disabled={!newComment.trim() || submitting}
                          className="px-6 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-semibold rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                      </div>
                    </form>
                    {coinEarned !== null && (
                      <div className="mb-4 p-3 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 rounded-lg animate-pulse">
                        <div className="flex items-center justify-center gap-2 text-yellow-400">
                          <Coins className="w-5 h-5" />
                          <span className="font-semibold">You earned {coinEarned === 1 ? '1 coin' : `${coinEarned.toFixed(2)} coins`} for commenting!</span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mb-6 p-4 bg-gray-800 border border-gray-700 rounded-lg text-center">
                    <p className="text-gray-400">Only friends can comment on this profile</p>
                  </div>
                )}
              </>
            )}

            {isPreviewMode && (
              <div className="mb-6 p-4 bg-blue-900/20 border border-blue-600/50 rounded-lg text-center">
                <div className="flex items-center justify-center gap-2 text-blue-400">
                  <Lock className="w-4 h-4" />
                  <p>Preview mode - commenting disabled</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {comments.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No comments yet. Be the first to comment!</p>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-semibold text-cyan-400">{comment.commenter_name}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(comment.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-gray-300 mb-3">{comment.text}</p>
                    <div className="flex items-center space-x-4 text-sm">
                      <button
                        onClick={() => handleCommentVote(comment.id, true)}
                        disabled={!currentUser}
                        className={`flex items-center space-x-1 transition-colors ${
                          commentVotes[comment.id]?.is_upvote === true
                            ? 'text-green-400'
                            : 'text-gray-400 hover:text-green-400'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <ThumbsUp className="w-4 h-4" />
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
                        <ThumbsDown className="w-4 h-4" />
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
        fullName={profile.full_name || profile.username}
        overallRating={profile.overall_rating ?? 50}
      />

      <EditSocialLinks
        isOpen={showEditSocialLinks}
        onClose={() => setShowEditSocialLinks(false)}
        userId={profile.id}
        currentLinks={socialLinks}
        onSave={loadProfile}
      />
    </div>
  );
}
