import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import PlayerCard, { Rating } from '../components/PlayerCard';
import { ArrowLeft, ThumbsUp, ThumbsDown, Send } from 'lucide-react';
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

      const { data: ratingsData } = await supabase
        .from('ratings')
        .select('*')
        .eq('player_id', profileData.id);

      setRatings(ratingsData || []);

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

      setLoading(false);
    } catch (error) {
      console.error('Error loading profile:', error);
      setLoading(false);
    }
  };

  const handleVote = async (isLike: boolean) => {
    if (!currentUser || !profile) return;

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
    if (!currentUser || !profile || !newComment.trim()) return;

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
              <h1 className="text-xl font-bold text-white">{profile.username}'s Profile</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-center mb-8">
          <PlayerCard profile={profile} ratings={ratings} showDownloadButton={false} />
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-4">Rate this player</h3>
            <div className="flex items-center justify-center space-x-8">
              <button
                onClick={() => handleVote(true)}
                disabled={!currentUser}
                className={`flex flex-col items-center space-y-2 transition-all ${
                  userVote === true
                    ? 'text-green-400'
                    : 'text-gray-400 hover:text-green-400'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <ThumbsUp className="w-12 h-12" />
                <span className="text-2xl font-bold">{likes}</span>
              </button>
              <button
                onClick={() => handleVote(false)}
                disabled={!currentUser}
                className={`flex flex-col items-center space-y-2 transition-all ${
                  userVote === false
                    ? 'text-red-400'
                    : 'text-gray-400 hover:text-red-400'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <ThumbsDown className="w-12 h-12" />
                <span className="text-2xl font-bold">{dislikes}</span>
              </button>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-4">Comments</h3>

            {currentUser && (
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
    </div>
  );
}
