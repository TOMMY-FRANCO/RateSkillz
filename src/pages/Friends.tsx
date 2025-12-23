import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, UserCheck, UserX, Clock, Eye, Bell, CheckCircle, XCircle, AlertCircle, Coins } from 'lucide-react';
import type { Profile } from '../contexts/AuthContext';
import { displayUsername } from '../lib/username';
import { getMultipleUserBalances } from '../lib/balances';
import { formatCoinBalance } from '../lib/formatBalance';
import { getMultipleUserPresence, type UserPresence } from '../lib/presence';
import OnlineStatus from '../components/OnlineStatus';

interface FriendRequest {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
  created_at: string;
  profile: Profile;
}

type TabType = 'incoming' | 'outgoing' | 'friends';

interface NotificationState {
  type: 'success' | 'error' | 'info';
  message: string;
}

export default function Friends() {
  const { profile: currentUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('incoming');
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const [userBalances, setUserBalances] = useState<Map<string, number>>(new Map());
  const [userPresence, setUserPresence] = useState<Map<string, UserPresence>>(new Map());

  useEffect(() => {
    if (currentUser) {
      loadFriendData();
    }
  }, [currentUser]);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadFriendData = async () => {
    if (!currentUser) return;

    try {
      const { data: friendsData, error: fetchError } = await supabase
        .from('friends')
        .select('*')
        .or(`user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id}`);

      if (fetchError) {
        throw fetchError;
      }

      if (friendsData) {
        const incoming: FriendRequest[] = [];
        const outgoing: FriendRequest[] = [];
        const accepted: FriendRequest[] = [];

        for (const friendship of friendsData) {
          const isIncoming = friendship.friend_id === currentUser.id;
          const otherUserId = isIncoming ? friendship.user_id : friendship.friend_id;

          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', otherUserId)
            .maybeSingle();

          if (profileData) {
            const request = {
              ...friendship,
              profile: profileData,
            };

            if (friendship.status === 'pending') {
              if (isIncoming) {
                incoming.push(request);
              } else {
                outgoing.push(request);
              }
            } else if (friendship.status === 'accepted') {
              accepted.push(request);
            }
          }
        }

        setIncomingRequests(incoming);
        setOutgoingRequests(outgoing);
        setFriends(accepted);

        const allUserIds = new Set<string>();
        [...incoming, ...outgoing, ...accepted].forEach(req => {
          if (req.profile?.id) allUserIds.add(req.profile.id);
        });

        if (allUserIds.size > 0) {
          const balances = await getMultipleUserBalances(Array.from(allUserIds));
          setUserBalances(balances);

          const presence = await getMultipleUserPresence(Array.from(allUserIds));
          setUserPresence(presence);
        }
      }

      setLoading(false);
    } catch (error: any) {
      console.error('Error loading friend data:', error);
      showNotification('error', 'Failed to load friends. Please refresh the page.');
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const { error } = await supabase
        .from('friends')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (error) {
        throw error;
      }

      showNotification('success', 'Friend request accepted!');
      await loadFriendData();
    } catch (error: any) {
      console.error('Error accepting request:', error);
      showNotification('error', 'Failed to accept friend request. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('id', requestId);

      if (error) {
        throw error;
      }

      showNotification('info', 'Friend request declined.');
      await loadFriendData();
    } catch (error: any) {
      console.error('Error declining request:', error);
      showNotification('error', 'Failed to decline request. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('id', requestId);

      if (error) {
        throw error;
      }

      showNotification('info', 'Friend request canceled.');
      await loadFriendData();
    } catch (error: any) {
      console.error('Error canceling request:', error);
      showNotification('error', 'Failed to cancel request. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveFriend = async (requestId: string) => {
    if (!confirm('Are you sure you want to remove this friend?')) {
      return;
    }

    setActionLoading(requestId);
    try {
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('id', requestId);

      if (error) {
        throw error;
      }

      showNotification('info', 'Friend removed.');
      await loadFriendData();
    } catch (error: any) {
      console.error('Error removing friend:', error);
      showNotification('error', 'Failed to remove friend. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const calculateOverallRating = (profile: Profile): string => {
    const ratings = [
      profile.passing,
      profile.shooting,
      profile.dribbling,
      profile.defense,
      profile.physical,
    ];
    const total = ratings.reduce((sum, rating) => sum + rating, 0);
    const average = Math.round(total / ratings.length);
    return average.toString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
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
                className="text-gray-300 hover:text-cyan-400 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-white">Friends & Notifications</h1>
            </div>
            <div className="flex items-center space-x-2 text-gray-400">
              <Bell className="w-5 h-5" />
              {incomingRequests.length > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {incomingRequests.length}
                </span>
              )}
            </div>
          </div>
        </div>
      </nav>

      {notification && (
        <div className="fixed top-20 right-4 z-50 max-w-sm animate-slide-in">
          <div className={`rounded-lg shadow-lg p-4 border ${
            notification.type === 'success'
              ? 'bg-green-50 border-green-200'
              : notification.type === 'error'
              ? 'bg-red-50 border-red-200'
              : 'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-center gap-2">
              {notification.type === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
              {notification.type === 'error' && <XCircle className="w-5 h-5 text-red-600" />}
              {notification.type === 'info' && <AlertCircle className="w-5 h-5 text-blue-600" />}
              <p className={`text-sm font-medium ${
                notification.type === 'success'
                  ? 'text-green-800'
                  : notification.type === 'error'
                  ? 'text-red-800'
                  : 'text-blue-800'
              }`}>
                {notification.message}
              </p>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl overflow-hidden">
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab('incoming')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors relative ${
                activeTab === 'incoming'
                  ? 'text-cyan-400 bg-gray-800'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Friend Requests
              {incomingRequests.length > 0 && (
                <span className="absolute top-2 right-4 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {incomingRequests.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('outgoing')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'outgoing'
                  ? 'text-cyan-400 bg-gray-800'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Sent Requests
            </button>
            <button
              onClick={() => setActiveTab('friends')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'friends'
                  ? 'text-cyan-400 bg-gray-800'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              My Friends ({friends.length})
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'incoming' && (
              <div className="space-y-4">
                {incomingRequests.length === 0 ? (
                  <p className="text-gray-400 text-center py-12">
                    No incoming friend requests
                  </p>
                ) : (
                  incomingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="bg-gray-800 rounded-lg p-4 border border-gray-700 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-4">
                        {request.profile.profile_picture ? (
                          <img
                            src={request.profile.profile_picture}
                            alt={request.profile.username}
                            className="w-16 h-16 rounded-full object-cover border-2 border-cyan-500"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-cyan-500 flex items-center justify-center text-black font-bold text-2xl border-2 border-cyan-500">
                            {displayUsername(request.profile.username).charAt(0)}
                          </div>
                        )}
                        <div>
                          <h3 className="text-white font-bold text-lg">
                            {displayUsername(request.profile.username)}
                          </h3>
                          <OnlineStatus
                            lastActive={userPresence.get(request.profile.id)?.last_seen}
                            size="small"
                          />
                          <p className="text-gray-400 text-sm mt-1">
                            Overall Rating: {calculateOverallRating(request.profile)}
                          </p>
                          {userBalances.has(request.profile.id) && (
                            <div className="flex items-center gap-1 mt-1">
                              <Coins className="w-3 h-3 text-yellow-500" />
                              <span className="text-xs text-yellow-500 font-medium">
                                {formatCoinBalance(userBalances.get(request.profile.id) || 0)} balance
                              </span>
                            </div>
                          )}
                          <p className="text-gray-500 text-xs mt-1">
                            Sent {new Date(request.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => handleAcceptRequest(request.id)}
                          className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-500 transition-all flex items-center space-x-2"
                        >
                          <UserCheck className="w-4 h-4" />
                          <span>Accept</span>
                        </button>
                        <button
                          onClick={() => handleDeclineRequest(request.id)}
                          className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-500 transition-all flex items-center space-x-2"
                        >
                          <UserX className="w-4 h-4" />
                          <span>Decline</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'outgoing' && (
              <div className="space-y-4">
                {outgoingRequests.length === 0 ? (
                  <p className="text-gray-400 text-center py-12">
                    No pending outgoing requests
                  </p>
                ) : (
                  outgoingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="bg-gray-800 rounded-lg p-4 border border-gray-700 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-4">
                        {request.profile.profile_picture ? (
                          <img
                            src={request.profile.profile_picture}
                            alt={request.profile.username}
                            className="w-16 h-16 rounded-full object-cover border-2 border-gray-600"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-white font-bold text-2xl">
                            {displayUsername(request.profile.username).charAt(0)}
                          </div>
                        )}
                        <div>
                          <h3 className="text-white font-bold text-lg">
                            {displayUsername(request.profile.username)}
                          </h3>
                          <OnlineStatus
                            lastActive={userPresence.get(request.profile.id)?.last_seen}
                            size="small"
                          />
                          {userBalances.has(request.profile.id) && (
                            <div className="flex items-center gap-1 mt-1">
                              <Coins className="w-3 h-3 text-yellow-500" />
                              <span className="text-xs text-yellow-500 font-medium">
                                {formatCoinBalance(userBalances.get(request.profile.id) || 0)} balance
                              </span>
                            </div>
                          )}
                          <div className="flex items-center space-x-2 text-gray-400 text-sm mt-1">
                            <Clock className="w-4 h-4" />
                            <span>Pending...</span>
                          </div>
                          <p className="text-gray-500 text-xs">
                            Sent {new Date(request.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCancelRequest(request.id)}
                        className="px-6 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition-all"
                      >
                        Cancel Request
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'friends' && (
              <div className="space-y-4">
                {friends.length === 0 ? (
                  <p className="text-gray-400 text-center py-12">
                    No friends yet. Start sending friend requests!
                  </p>
                ) : (
                  friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="bg-gray-800 rounded-lg p-4 border border-gray-700 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-4">
                        {friend.profile.profile_picture ? (
                          <img
                            src={friend.profile.profile_picture}
                            alt={friend.profile.username}
                            className="w-16 h-16 rounded-full object-cover border-2 border-green-500"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-cyan-500 flex items-center justify-center text-black font-bold text-2xl border-2 border-green-500">
                            {displayUsername(friend.profile.username).charAt(0)}
                          </div>
                        )}
                        <div>
                          <h3 className="text-white font-bold text-lg">
                            {displayUsername(friend.profile.username)}
                          </h3>
                          <OnlineStatus
                            lastActive={userPresence.get(friend.profile.id)?.last_seen}
                            size="small"
                          />
                          <p className="text-gray-400 text-sm mt-1">
                            Overall Rating: {calculateOverallRating(friend.profile)}
                          </p>
                          {userBalances.has(friend.profile.id) && (
                            <div className="flex items-center gap-1 mt-1">
                              <Coins className="w-3 h-3 text-yellow-500" />
                              <span className="text-xs text-yellow-500 font-medium">
                                {formatCoinBalance(userBalances.get(friend.profile.id) || 0)} balance
                              </span>
                            </div>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            Friends since {new Date(friend.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => navigate(`/profile/${friend.profile.username}`)}
                          className="px-6 py-2 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-semibold rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all flex items-center space-x-2"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View Profile</span>
                        </button>
                        <button
                          onClick={() => handleRemoveFriend(friend.id)}
                          className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-500 transition-all flex items-center space-x-2"
                        >
                          <UserX className="w-4 h-4" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
