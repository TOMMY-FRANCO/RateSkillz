import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, UserCheck, UserX, Clock, Eye, Bell, CheckCircle, XCircle, AlertCircle, Coins, Send, Loader2, RefreshCw, MessageCircle } from 'lucide-react';
import type { Profile } from '../contexts/AuthContext';
import { displayUsername } from '../lib/username';
import { getMultipleUserBalances } from '../lib/balances';
import { formatCoinBalance } from '../lib/formatBalance';
import { getMultipleUserPresence, type UserPresence } from '../lib/presence';
import OnlineStatus from '../components/OnlineStatus';
import SendCoinsModal from '../components/SendCoinsModal';
import { claimPerFriendMilestoneReward } from '../lib/rewards';
import { getOrCreateConversation } from '../lib/messaging';
import { setFriendsBadgeSeenCount } from '../lib/notifications';

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
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const [userBalances, setUserBalances] = useState<Map<string, number>>(new Map());
  const [userPresence, setUserPresence] = useState<Map<string, UserPresence>>(new Map());
  const [showSendCoinsModal, setShowSendCoinsModal] = useState(false);
  const [sendCoinsRecipient, setSendCoinsRecipient] = useState<{ id: string; username: string; full_name: string | null; is_verified: boolean } | null>(null);

  useEffect(() => {
    if (currentUser) {
      loadFriendData();
    }
  }, [currentUser]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFriendData();
    setRefreshing(false);
  };

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadFriendData = async () => {
    if (!currentUser) return;

    try {
      const { data: friendsData, error: fetchError } = await supabase
        .from('friends')
        .select('id, user_id, friend_id, status, created_at')
        .or(`user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id}`);

      if (fetchError) {
        throw fetchError;
      }

      if (friendsData && friendsData.length > 0) {
        // FIX: Fetch all profiles in a single query to prevent N+1 problem
        const allOtherUserIds = friendsData.map(friendship => {
          return friendship.friend_id === currentUser.id ? friendship.user_id : friendship.friend_id;
        });

        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, overall_rating, is_verified, has_social_badge')
          .in('id', allOtherUserIds);

        if (profilesError) throw profilesError;

        // Create a map for quick profile lookup
        const profileMap = new Map(profilesData?.map(profile => [profile.id, profile]) || []);

        const incoming: FriendRequest[] = [];
        const outgoing: FriendRequest[] = [];
        const accepted: FriendRequest[] = [];

        for (const friendship of friendsData) {
          const isIncoming = friendship.friend_id === currentUser.id;
          const otherUserId = isIncoming ? friendship.user_id : friendship.friend_id;
          const profileData = profileMap.get(otherUserId);

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
        setFriendsBadgeSeenCount(incoming.length);

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
      } else {
        setIncomingRequests([]);
        setOutgoingRequests([]);
        setFriends([]);
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
      const request = incomingRequests.find((r) => r.id === requestId);

      const { error } = await supabase
        .from('friends')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (error) {
        throw error;
      }

      showNotification('success', 'Friend request accepted!');

      if (request && currentUser) {
        getOrCreateConversation(currentUser.id, request.user_id).catch(() => {});
        claimPerFriendMilestoneReward(currentUser.id, request.user_id).catch(() => {});
      }

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

  const handleMessageFriend = async (friend: FriendRequest) => {
    if (!currentUser) return;
    setActionLoading(friend.id);
    try {
      const conversationId = await getOrCreateConversation(currentUser.id, friend.profile.id);
      if (conversationId) {
        navigate(`/inbox/${conversationId}`, {
          state: {
            otherUser: {
              id: friend.profile.id,
              username: friend.profile.username,
              full_name: friend.profile.full_name,
              avatar_url: friend.profile.avatar_url,
            },
          },
        });
      } else {
        showNotification('error', 'Could not open conversation. Please try again.');
      }
    } catch {
      showNotification('error', 'Could not open conversation. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const getOverallRating = (profile: Profile): number => {
    return profile.overall_rating ?? 50;
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
              <h1 className="text-xl font-bold text-white">Friends</h1>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="text-gray-400 hover:text-cyan-400 transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
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
                        {request.profile.avatar_url ? (
                          <img
                            src={request.profile.avatar_url}
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
                            OVR {getOverallRating(request.profile)}
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
                          disabled={actionLoading === request.id}
                          className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2"
                        >
                          {actionLoading === request.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                          <span>Accept</span>
                        </button>
                        <button
                          onClick={() => handleDeclineRequest(request.id)}
                          disabled={actionLoading === request.id}
                          className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2"
                        >
                          {actionLoading === request.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
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
                        {request.profile.avatar_url ? (
                          <img
                            src={request.profile.avatar_url}
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
                        disabled={actionLoading === request.id}
                        className="px-6 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2"
                      >
                        {actionLoading === request.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        <span>Cancel Request</span>
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
                        {friend.profile.avatar_url ? (
                          <img
                            src={friend.profile.avatar_url}
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
                            OVR {getOverallRating(friend.profile)}
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
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleMessageFriend(friend)}
                          disabled={actionLoading === friend.id}
                          className="px-4 py-2 bg-cyan-500/10 text-cyan-400 font-semibold rounded-lg hover:bg-cyan-500/20 transition-all flex items-center space-x-2 border border-cyan-500/30"
                        >
                          {actionLoading === friend.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                          <span>Message</span>
                        </button>
                        <button
                          onClick={() => {
                            setSendCoinsRecipient({
                              id: friend.profile.id,
                              username: friend.profile.username,
                              full_name: friend.profile.full_name,
                              is_verified: (friend.profile as any).is_verified ?? false,
                            });
                            setShowSendCoinsModal(true);
                          }}
                          className="px-4 py-2 bg-amber-500/10 text-amber-400 font-semibold rounded-lg hover:bg-amber-500/20 transition-all flex items-center space-x-2 border border-amber-500/30"
                        >
                          <Send className="w-4 h-4" />
                          <span>Send Coins</span>
                        </button>
                        <button
                          onClick={() => navigate(`/profile/${friend.profile.username}`)}
                          className="px-4 py-2 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-semibold rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all flex items-center space-x-2"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View Profile</span>
                        </button>
                        <button
                          onClick={() => handleRemoveFriend(friend.id)}
                          disabled={actionLoading === friend.id}
                          className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2"
                        >
                          {actionLoading === friend.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
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

      <SendCoinsModal
        isOpen={showSendCoinsModal}
        onClose={() => {
          setShowSendCoinsModal(false);
          setSendCoinsRecipient(null);
        }}
        recipientId={sendCoinsRecipient?.id}
        recipientUsername={sendCoinsRecipient?.username}
        recipientFullName={null}
        recipientIsVerified={sendCoinsRecipient?.is_verified}
        onTransferComplete={() => loadFriendData()}
      />
    </div>
  );
}
