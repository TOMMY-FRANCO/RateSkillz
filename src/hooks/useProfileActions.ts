import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { awardCommentCoins } from '../lib/coins';
import { saveRating, getUserStats, type PlayerRating } from '../lib/ratings';
import { getOrCreateConversation } from '../lib/messaging';
import type { FriendStatus } from './useProfileData';

export function useProfileActions() {
  const [submitting, setSubmitting] = useState(false);
  const [savingRating, setSavingRating] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [ratingSuccess, setRatingSuccess] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [coinEarned, setCoinEarned] = useState<number | null>(null);

  const handleFriendRequest = async (
    friendStatus: FriendStatus,
    friendshipId: string | null,
    currentUserId: string,
    profileId: string,
    setFriendStatus: (status: FriendStatus) => void,
    setFriendshipId: (id: string | null) => void,
    refreshProfile: () => Promise<any>
  ) => {
    try {
      if (friendStatus === 'none') {
        const { data, error } = await supabase
          .from('friends')
          .insert({
            user_id: currentUserId,
            friend_id: profileId,
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
          getOrCreateConversation(currentUserId, profileId).catch(() => {});
          await refreshProfile();
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
          await refreshProfile();
        }
      }
    } catch (error: any) {
      console.error('Error handling friend request:', error);
      alert(error?.message || 'Action failed. Try again.');
    }
  };

  const handleVote = async (
    isLike: boolean,
    userVote: boolean | null,
    likes: number,
    dislikes: number,
    currentUserId: string,
    profileId: string,
    setUserVote: (vote: boolean | null) => void,
    setLikes: (count: number) => void,
    setDislikes: (count: number) => void
  ) => {
    try {
      if (userVote === isLike) {
        const { error } = await supabase
          .from('profile_likes')
          .delete()
          .eq('profile_id', profileId)
          .eq('user_id', currentUserId);

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
            profile_id: profileId,
            user_id: currentUserId,
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

  const handleSubmitComment = async (
    newComment: string,
    currentUserId: string,
    currentUsername: string,
    profileId: string,
    comments: any[],
    setNewComment: (text: string) => void,
    setComments: (comments: any[]) => void,
    refreshBalance: () => Promise<void>
  ) => {
    if (!newComment.trim()) return;

    setSubmitting(true);
    setCommentError('');

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          profile_id: profileId,
          commenter_id: currentUserId,
          commenter_name: currentUsername,
          text: newComment.trim(),
        })
        .select()
        .single();

      if (error) {
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
          const coinResult = await awardCommentCoins(profileId, data.id);
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

  const handleSaveRatings = async (
    editingRatings: any,
    currentUserId: string,
    profileId: string,
    setMyRating: (rating: PlayerRating | null) => void,
    setUserStats: (stats: any) => void
  ) => {
    setSavingRating(true);
    setRatingError(null);
    setRatingSuccess(false);

    try {
      const rating: PlayerRating = {
        rater_id: currentUserId,
        player_id: profileId,
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
          const updatedStats = await getUserStats(profileId);
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

  const handleCommentVote = async (
    commentId: string,
    isUpvote: boolean,
    currentUserId: string,
    commentVotes: Record<string, { is_upvote: boolean; vote_id: string }>,
    comments: any[],
    setCommentVotes: (votes: Record<string, { is_upvote: boolean; vote_id: string }>) => void,
    setComments: (comments: any[]) => void
  ) => {
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

          setComments(comments.map(c =>
            c.id === commentId
              ? {
                  ...c,
                  upvotes: isUpvote ? c.upvotes - 1 : c.upvotes,
                  downvotes: !isUpvote ? c.downvotes - 1 : c.downvotes,
                }
              : c
          ));
        } else {
          await supabase
            .from('comment_votes')
            .update({ is_upvote: isUpvote })
            .eq('id', existingVote.vote_id);

          setCommentVotes({
            ...commentVotes,
            [commentId]: { ...existingVote, is_upvote: isUpvote },
          });

          setComments(comments.map(c =>
            c.id === commentId
              ? {
                  ...c,
                  upvotes: isUpvote ? c.upvotes + 1 : c.upvotes - 1,
                  downvotes: !isUpvote ? c.downvotes + 1 : c.downvotes - 1,
                }
              : c
          ));
        }
      } else {
        const { data, error } = await supabase
          .from('comment_votes')
          .insert({
            comment_id: commentId,
            user_id: currentUserId,
            is_upvote: isUpvote,
          })
          .select()
          .single();

        if (!error && data) {
          setCommentVotes({
            ...commentVotes,
            [commentId]: { is_upvote: isUpvote, vote_id: data.id },
          });

          setComments(comments.map(c =>
            c.id === commentId
              ? {
                  ...c,
                  upvotes: isUpvote ? c.upvotes + 1 : c.upvotes,
                  downvotes: !isUpvote ? c.downvotes + 1 : c.downvotes,
                }
              : c
          ));
        }
      }
    } catch (error) {
      console.error('Error voting on comment:', error);
    }
  };

  return {
    submitting,
    savingRating,
    ratingError,
    ratingSuccess,
    commentError,
    coinEarned,
    setCommentError,
    setRatingError,
    handleFriendRequest,
    handleVote,
    handleSubmitComment,
    handleSaveRatings,
    handleCommentVote,
  };
}
