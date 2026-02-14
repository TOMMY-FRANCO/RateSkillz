import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserPlus, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { sendFriendRequest } from '../lib/friendRequests';

export default function AddFriendByQR() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [targetProfile, setTargetProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [alreadyFriends, setAlreadyFriends] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(false);

  useEffect(() => {
    const userId = searchParams.get('user_id');
    if (userId) {
      setTargetUserId(userId);
      loadTargetProfile(userId);
    } else {
      setError('Invalid friend request link');
      setLoading(false);
    }
  }, [searchParams]);

  const loadTargetProfile = async (userId: string) => {
    setLoading(true);
    setError('');

    console.log('[QR Scan] Loading profile');

    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, bio, overall_rating, is_verified')
        .eq('id', userId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        console.error('[QR Scan] No profile found');
        setError('User not found');
        setLoading(false);
        return;
      }

      console.log('[QR Scan] Profile loaded');
      setTargetProfile(data);

      if (user) {
        if (user.id === userId) {
          console.log('[QR Scan] Self-friending attempt detected');
        } else {
          await checkFriendshipStatus(user.id, userId);
        }
      }
    } catch (err: any) {
      console.error('[QR Scan] Error loading profile:', err);
      setError('Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };

  const checkFriendshipStatus = async (currentUserId: string, targetUserId: string) => {
    try {
      const { data: friendData } = await supabase
        .from('friends')
        .select('id')
        .or(`and(user_id.eq.${currentUserId},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${currentUserId})`)
        .maybeSingle();

      if (friendData) {
        setAlreadyFriends(true);
        return;
      }

      const { data: requestData } = await supabase
        .from('friend_requests')
        .select('id')
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${currentUserId})`)
        .eq('status', 'pending')
        .maybeSingle();

      if (requestData) {
        setPendingRequest(true);
      }
    } catch (err) {
      console.error('Error checking friendship status:', err);
    }
  };

  const handleSendRequest = async () => {
    if (!user || !targetUserId || !profile) {
      setError('You must be logged in to send a friend request');
      return;
    }

    if (user.id === targetUserId) {
      setError("Cannot add yourself as friend");
      return;
    }

    console.log('[QR Scan] Sending friend request:', {
      senderId: user.id,
      receiverId: targetUserId,
      senderUsername: profile.username
    });

    setSending(true);
    setError('');

    try {
      const { error: requestError } = await sendFriendRequest(targetUserId);

      if (requestError) {
        console.error('[QR Scan] Friend request error:', requestError);
        throw new Error(requestError.message || 'Failed to send friend request');
      }

      console.log('[QR Scan] Friend request sent successfully');
      setSuccess(true);
      setTimeout(() => {
        navigate('/friends');
      }, 2000);
    } catch (err: any) {
      console.error('[QR Scan] Error sending friend request:', err);
      setError(err.message || 'Failed to send friend request');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#00E0FF] animate-spin mx-auto mb-4" />
          <p className="text-white text-lg font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00FF85]/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#38BDF8]/10 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-md mx-auto relative z-10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[#B0B8C8] hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="glass-container p-6 animate-fade-in">
          {error && !targetProfile ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserPlus className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Error</h2>
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={() => navigate('/dashboard')}
                className="btn-primary"
              >
                Go to Dashboard
              </button>
            </div>
          ) : success ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Request Sent!</h2>
              <p className="text-[#B0B8C8] mb-4">
                Your friend request has been sent to {targetProfile?.username}
              </p>
              <p className="text-sm text-[#6B7280]">Redirecting to Friends page...</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#00FF85] to-[#00E0FF] rounded-xl flex items-center justify-center shadow-lg shadow-[#00FF85]/30">
                    <UserPlus className="w-8 h-8 text-black" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2 heading-glow">Add Friend</h2>
                <p className="text-[#B0B8C8] text-sm">
                  Send a friend request to connect
                </p>
              </div>

              {targetProfile && (
                <div className="space-y-4">
                  <div className="glass-container p-4 flex items-center gap-4">
                    <div className="relative">
                      {targetProfile.avatar_url ? (
                        <img
                          src={targetProfile.avatar_url}
                          alt={targetProfile.username}
                          className="w-16 h-16 rounded-xl object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#00FF85] to-[#00E0FF] flex items-center justify-center">
                          <span className="text-2xl font-bold text-black">
                            {targetProfile.username[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white">{targetProfile.username}</h3>
                        {targetProfile.is_verified && (
                          <svg className="w-5 h-5 text-[#00E0FF]" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                          </svg>
                        )}
                      </div>
                      {targetProfile.bio && (
                        <p className="text-sm text-[#B0B8C8] line-clamp-2">{targetProfile.bio}</p>
                      )}
                      {targetProfile.overall_rating && (
                        <p className="text-sm text-[#00FF85] font-semibold mt-1">
                          Rating: {targetProfile.overall_rating}
                        </p>
                      )}
                    </div>
                  </div>

                  {!user && (
                    <div className="glass-container bg-yellow-500/10 border-yellow-500/50 p-4">
                      <p className="text-yellow-400 text-sm text-center mb-3">
                        You need to sign in to send a friend request
                      </p>
                      <button
                        onClick={() => navigate('/login')}
                        className="btn-primary w-full"
                      >
                        Sign In
                      </button>
                    </div>
                  )}

                  {user && user.id === targetUserId && (
                    <div className="glass-container bg-blue-500/10 border-blue-500/50 p-4">
                      <p className="text-blue-400 text-sm text-center">
                        This is your own profile
                      </p>
                    </div>
                  )}

                  {user && user.id !== targetUserId && alreadyFriends && (
                    <div className="glass-container bg-green-500/10 border-green-500/50 p-4">
                      <p className="text-green-400 text-sm text-center">
                        You are already friends with {targetProfile.username}
                      </p>
                    </div>
                  )}

                  {user && user.id !== targetUserId && pendingRequest && !alreadyFriends && (
                    <div className="glass-container bg-yellow-500/10 border-yellow-500/50 p-4">
                      <p className="text-yellow-400 text-sm text-center">
                        A friend request is already pending
                      </p>
                    </div>
                  )}

                  {user && user.id !== targetUserId && !alreadyFriends && !pendingRequest && (
                    <>
                      {error && (
                        <div className="glass-container bg-red-500/10 border-red-500/50 p-4">
                          <p className="text-red-400 text-sm text-center">{error}</p>
                        </div>
                      )}

                      <button
                        onClick={handleSendRequest}
                        disabled={sending}
                        className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sending ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Sending Request...</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-5 h-5" />
                            <span>Send Friend Request</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
