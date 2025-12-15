import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import PlayerCard, { Rating } from '../components/PlayerCard';
import ShareCardModal from '../components/ShareCardModal';
import SocialLinks from '../components/SocialLinks';
import EditSocialLinks from '../components/EditSocialLinks';
import OnlineStatus from '../components/OnlineStatus';
import { ArrowLeft, ThumbsUp, ThumbsDown, Send, UserPlus, UserCheck, UserX, Clock, Users, Eye, Share2 } from 'lucide-react';
import type { Profile } from '../contexts/AuthContext';

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
  const [myRating, setMyRating] = useState<Rating | null>(null);
  const [editingSkill, setEditingSkill] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEditSocialLinks, setShowEditSocialLinks] = useState(false);
  const [socialLinks, setSocialLinks] = useState<any>(null);

  useEffect(() => {
    if (username) {
      loadProfile();
    }
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

      if (currentUser && profileData.id !== currentUser.id) {
        await supabase.from('profile_views').insert({
          profile_id: profileData.id,
          viewer_id: currentUser.id,
        });

        await supabase.from('notifications').insert({
          user_id: profileData.id,
          actor_id: currentUser.id,
          type: 'profile_view',
          message: `${currentUser.username} viewed your profile`,
          metadata: { profile_id: profileData.id },
        });
      }

      const { data: viewsData } = await supabase
        .from('profile_views')
        .select('id')
        .eq('profile_id', profileData.id);
      setViewsCount(viewsData?.length || 0);

      const { data: friendsData } = await supabase
        .from('friends')
        .select('id')
        .eq('status', 'accepted')
        .or(`user_id.eq.${profileData.id},friend_id.eq.${profileData.id}`);
      setFriendsCount(friendsData?.length || 0);

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
            if (friendData.user_id === currentUser.id) {
              setFriendStatus('pending_sent');
            } else {
              setFriendStatus('pending_received');
            }
          }
        }
      }

      const { data: ratingsData } = await supabase
        .from('ratings')
        .select('*')
        .eq('player_id', profileData.id);

      setRatings(ratingsData || []);

      if (currentUser && profileData.id !== currentUser.id) {
        const userRating = ratingsData?.find((r) => r.rater_id === currentUser.id);
        setMyRating(userRating || null);
      }

      const { data: commentsData } = await supabase
        .from('comments')
        .select('*')
        .eq('profile_id', profileData.id)
        .order('created_at', { ascending: false });

      setComments(commentsData || []);

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

      setLoading(false);
    } catch (error) {
      console.error('Error loading profile:', error);
      setLoading(false);
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

        if (!error && data) {
          setFriendshipId(data.id);
          setFriendStatus('pending_sent');
        }
      } else if (friendStatus === 'pending_sent') {
        if (friendshipId) {
          const { error } = await supabase
            .from('friends')
            .delete()
            .eq('id', friendshipId);

          if (!error) {
            setFriendshipId(null);
            setFriendStatus('none');
          }
        }
      } else if (friendStatus === 'pending_received') {
        if (friendshipId) {
          const { error } = await supabase
            .from('friends')
            .update({ status: 'accepted' })
            .eq('id', friendshipId);

          if (!error) {
            setFriendStatus('accepted');
          }
        }
      } else if (friendStatus === 'accepted') {
        if (friendshipId) {
          const { error } = await supabase
            .from('friends')
            .delete()
            .eq('id', friendshipId);

          if (!error) {
            setFriendshipId(null);
            setFriendStatus('none');
          }
        }
      }
    } catch (error) {
      console.error('Error managing friend request:', error);
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
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkillClick = (skill: string, currentValue: number) => {
    if (friendStatus !== 'accepted') return;
    setEditingSkill(skill);
    setTempValue(currentValue.toString());
  };

  const handleSkillUpdate = async (skill: string) => {
    if (!currentUser || !profile) return;

    const numValue = parseInt(tempValue);
    if (isNaN(numValue) || numValue < 1 || numValue > 100) {
      setEditingSkill(null);
      return;
    }

    try {
      const updateData: any = {
        rater_id: currentUser.id,
        player_id: profile.id,
        [skill]: numValue,
      };

      if (myRating) {
        const { data, error } = await supabase
          .from('ratings')
          .update({ [skill]: numValue })
          .eq('id', myRating.id)
          .select()
          .single();

        if (!error && data) {
          setMyRating(data);
          setRatings(ratings.map((r) => (r.id === data.id ? data : r)));
        }
      } else {
        const newRating = {
          rater_id: currentUser.id,
          player_id: profile.id,
          pac: 50,
          sho: 50,
          pas: 50,
          dri: 50,
          def: 50,
          phy: 50,
          [skill]: numValue,
        };

        const { data, error } = await supabase
          .from('ratings')
          .insert(newRating)
          .select()
          .single();

        if (!error && data) {
          setMyRating(data);
          setRatings([...ratings, data]);
        }
      }
    } catch (error) {
      console.error('Error updating rating:', error);
    } finally {
      setEditingSkill(null);
    }
  };

  const handleSkillBlur = (skill: string) => {
    handleSkillUpdate(skill);
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent, skill: string) => {
    if (e.key === 'Enter') {
      handleSkillUpdate(skill);
    } else if (e.key === 'Escape') {
      setEditingSkill(null);
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
                onClick={() => navigate('/settings')}
                className="text-gray-300 hover:text-cyan-400 transition-colors bg-none border-none cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-white">{profile.username}'s Profile</h1>
                <OnlineStatus lastActive={profile.last_active} size="medium" />
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-center mb-8">
          <PlayerCard
            profile={profile}
            ratings={ratings}
            showDownloadButton={false}
            overallRating={profile.overall_rating}
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
          isOwner={currentUser?.id === profile.id}
          onEdit={() => setShowEditSocialLinks(true)}
        />

        <div className="max-w-2xl mx-auto mb-8">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 text-center">Profile Stats</h3>
            <div className="grid grid-cols-3 gap-6">
              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-bold text-white">{friendsCount}</span>
                <span className="text-sm text-gray-400">Friends</span>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <Eye className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-bold text-white">{viewsCount}</span>
                <span className="text-sm text-gray-400">Views</span>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                  <ThumbsUp className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-bold text-white">{likes}</span>
                <span className="text-sm text-gray-400">Likes</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
          {currentUser && profile.id !== currentUser.id && (
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
              <div className="flex items-center justify-center">
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
                  <button
                    onClick={handleFriendRequest}
                    className="px-8 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-500 transition-all flex items-center space-x-2"
                  >
                    <UserX className="w-5 h-5" />
                    <span>Remove Friend</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {currentUser && profile.id !== currentUser.id && (
            <>
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Your Skill Ratings</h3>
                  {ratings.length > 0 && (
                    <span className="text-sm text-cyan-400 font-medium">
                      Card shows average of {ratings.length} {ratings.length === 1 ? 'rating' : 'ratings'}
                    </span>
                  )}
                </div>
                {friendStatus === 'accepted' ? (
                  <>
                    <p className="text-sm text-gray-400 mb-4">
                      Click any skill to edit your rating. The player card above shows the average from all friends.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      { key: 'pac', label: 'PAC', color: 'from-blue-500 to-cyan-500' },
                      { key: 'sho', label: 'SHO', color: 'from-red-500 to-orange-500' },
                      { key: 'pas', label: 'PAS', color: 'from-green-500 to-emerald-500' },
                      { key: 'dri', label: 'DRI', color: 'from-purple-500 to-pink-500' },
                      { key: 'def', label: 'DEF', color: 'from-yellow-500 to-amber-500' },
                      { key: 'phy', label: 'PHY', color: 'from-teal-500 to-cyan-500' },
                    ].map(({ key, label, color }) => {
                      const currentValue = myRating ? myRating[key as keyof Rating] as number : 50;
                      const isEditing = editingSkill === key;

                      return (
                        <div
                          key={key}
                          className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-cyan-500 transition-all cursor-pointer"
                          onClick={() => !isEditing && handleSkillClick(key, currentValue)}
                        >
                          <div className="text-xs font-semibold text-gray-400 mb-2">{label}</div>
                          {isEditing ? (
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={tempValue}
                              onChange={(e) => setTempValue(e.target.value)}
                              onBlur={() => handleSkillBlur(key)}
                              onKeyDown={(e) => handleSkillKeyDown(e, key)}
                              className="w-full bg-gray-700 text-white text-2xl font-bold text-center rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                              autoFocus
                            />
                          ) : (
                            <div className={`text-3xl font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
                              {currentValue}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  </>
                ) : (
                  <div className="text-center text-gray-400 py-8">
                    Become friends to rate this player's skills
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
            <h3 className="text-xl font-bold text-white mb-4">Comments</h3>

            {currentUser && profile.id !== currentUser.id && (
              <>
                {friendStatus === 'accepted' ? (
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
                ) : (
                  <div className="mb-6 p-4 bg-gray-800 border border-gray-700 rounded-lg text-center">
                    <p className="text-gray-400">Only friends can comment on this profile</p>
                  </div>
                )}
              </>
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
                    <div className="flex items-center space-x-4 text-sm text-gray-400">
                      <span className="flex items-center space-x-1">
                        <ThumbsUp className="w-4 h-4" />
                        <span>{comment.likes}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <ThumbsDown className="w-4 h-4" />
                        <span>{comment.dislikes}</span>
                      </span>
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
