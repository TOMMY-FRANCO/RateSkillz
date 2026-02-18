import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getUserStats, getMyRatingForUser, type PlayerRating, type UserStats } from '../lib/ratings';
import { getCardOwnership, type CardOwnership } from '../lib/cardTrading';
import { recordUniqueProfileView } from '../lib/viewTracking';
import { getUserPresence } from '../lib/presence';
import type { Profile } from '../contexts/AuthContext';

interface Comment {
  id: string;
  profile_id: string;
  user_id: string;
  content: string;
  upvotes: number;
  downvotes: number;
  username: string;
  created_at: string;
}

export type FriendStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'blocked';

export function useProfileData(username: string | undefined, currentUserId: string | undefined, isPreviewMode: boolean) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>('none');
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [friendsCount, setFriendsCount] = useState(0);
  const [viewsCount, setViewsCount] = useState(0);
  const [myRating, setMyRating] = useState<PlayerRating | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [socialLinks, setSocialLinks] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentVotes, setCommentVotes] = useState<Record<string, { is_upvote: boolean; vote_id: string }>>({});
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [userVote, setUserVote] = useState<boolean | null>(null);
  const [cardOwnership, setCardOwnership] = useState<CardOwnership | null>(null);
  const [coinBalance, setCoinBalance] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [commentsCount, setCommentsCount] = useState<number>(0);
  const [userPresenceData, setUserPresenceData] = useState<string | undefined>();
  const [isVerified, setIsVerified] = useState(false);
  const [hasSocialBadge, setHasSocialBadge] = useState(false);

  const loadProfile = async () => {
    if (!username) return;

    try {
      const { data: summaryData, error: summaryError } = await supabase
        .from('profile_summary')
        .select('user_id, username, full_name, avatar_url, bio, position, team, age, overall_rating, is_verified, is_manager, is_admin, is_banned, friend_count, last_seen, created_at, manager_wins, pac_rating, sho_rating, pas_rating, dri_rating, def_rating, phy_rating')
        .eq('username', username)
        .maybeSingle();

      if (summaryError) throw summaryError;
      if (!summaryData) return null;

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
        profile_views_count: 0,
        comments_count: 0,
        has_social_badge: false,
        coin_balance: 0,
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
      setFriendsCount(profileData.friend_count || 0);

      const socialLinksData = {
        user_id: summaryData.user_id,
        instagram_url: (summaryData as any).instagram_url,
        twitter_url: (summaryData as any).twitter_url,
        youtube_url: (summaryData as any).youtube_url,
        tiktok_url: (summaryData as any).tiktok_url,
        twitch_url: (summaryData as any).twitch_url,
      };
      setSocialLinks(socialLinksData);

      // Fire-and-forget: record the view then refresh the count from DB
      if (currentUserId && profileData.id !== currentUserId && !isPreviewMode) {
        recordUniqueProfileView(profileData.id, currentUserId)
          .then(() => {
            supabase
              .from('profiles')
              .select('profile_views_count')
              .eq('id', profileData.id)
              .maybeSingle()
              .then(({ data }) => {
                if (data) setViewsCount(data.profile_views_count || 0);
              })
              .catch(() => {});
          })
          .catch(() => {});
      } else {
        // For own profile or preview, load the current count without recording
        supabase
          .from('profiles')
          .select('profile_views_count')
          .eq('id', profileData.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) setViewsCount(data.profile_views_count || 0);
          })
          .catch(() => {});
      }

      const isOtherUser = currentUserId && profileData.id !== currentUserId;

      const [
        presenceResult,
        friendResult,
        statsResult,
        myRatingResult,
        commentsResult,
        likesResult,
        cardOwnershipResult,
      ] = await Promise.all([
        getUserPresence(profileData.id).catch(() => null),
        isOtherUser
          ? supabase
              .from('friends')
              .select('id, user_id, friend_id, status')
              .or(`and(user_id.eq.${currentUserId},friend_id.eq.${profileData.id}),and(user_id.eq.${profileData.id},friend_id.eq.${currentUserId})`)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        getUserStats(profileData.id).catch(() => null),
        isOtherUser
          ? getMyRatingForUser(currentUserId, profileData.id).catch(() => null)
          : Promise.resolve(null),
        supabase
          .from('comments')
          .select('id, profile_id, user_id, content, upvotes, downvotes, username, created_at')
          .eq('profile_id', profileData.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('profile_likes')
          .select('id, profile_id, user_id, is_like')
          .eq('profile_id', profileData.id),
        getCardOwnership(profileData.id).catch(() => null),
      ]);

      if (presenceResult) {
        setUserPresenceData(presenceResult.last_seen);
      }

      const friendData = friendResult?.data;
      if (isOtherUser && friendData) {
        setFriendshipId(friendData.id);
        if (friendData.status === 'accepted') {
          setFriendStatus('accepted');
        } else if (friendData.status === 'blocked') {
          setFriendStatus('blocked');
        } else if (friendData.status === 'pending') {
          setFriendStatus(friendData.user_id === currentUserId ? 'pending_sent' : 'pending_received');
        }
      } else {
        setFriendStatus('none');
      }

      if (statsResult) {
        setUserStats(statsResult);
      } else {
        setUserStats({
          pac: summaryData.pac_rating || 50,
          sho: summaryData.sho_rating || 50,
          pas: summaryData.pas_rating || 50,
          dri: summaryData.dri_rating || 50,
          def: summaryData.def_rating || 50,
          phy: summaryData.phy_rating || 50,
          rating_count: 0,
        } as any);
      }

      if (isOtherUser) {
        setMyRating(myRatingResult);
      }

      const commentsData = commentsResult.data;
      setComments(commentsData || []);

      if (currentUserId && commentsData && commentsData.length > 0) {
        const { data: votesData } = await supabase
          .from('comment_votes')
          .select('id, comment_id, user_id, is_upvote')
          .eq('user_id', currentUserId)
          .in('comment_id', commentsData.map(c => c.id));

        const votesMap: Record<string, { is_upvote: boolean; vote_id: string }> = {};
        votesData?.forEach(vote => {
          votesMap[vote.comment_id] = { is_upvote: vote.is_upvote, vote_id: vote.id };
        });
        setCommentVotes(votesMap);
      }

      const likesData = likesResult.data;
      const likesCount = likesData?.filter((l) => l.is_like).length || 0;
      const dislikesCount = likesData?.filter((l) => !l.is_like).length || 0;
      setLikes(likesCount);
      setDislikes(dislikesCount);

      if (currentUserId) {
        const userLike = likesData?.find((l) => l.user_id === currentUserId);
        if (userLike) {
          setUserVote(userLike.is_like);
        }
      }

      setCardOwnership(cardOwnershipResult);
      setLoading(false);

      return profileData;
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

  const updateCardOwnership = async () => {
    if (profile) {
      const cardOwnershipData = await getCardOwnership(profile.id);
      setCardOwnership(cardOwnershipData);
      await refreshBalance();
      await loadProfile();
    }
  };

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

  return {
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
    commentsCount,
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
  };
}
