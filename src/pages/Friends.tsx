import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  ArrowLeft, UserCheck, UserX, Clock, Eye, CheckCircle, XCircle, AlertCircle,
  Coins, Send, Loader2, RefreshCw, MessageCircle, Search, Users, UserPlus,
} from 'lucide-react';

const FRIENDS_PAGE_SIZE = 20;
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
import { sendFriendRequest } from '../lib/friendRequests';

interface FriendRequest {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
  created_at: string;
  profile: Profile;
}

interface NotificationState {
  type: 'success' | 'error' | 'info';
  message: string;
}

interface SearchResult {
  id: string;
  username: string;
  avatar_url: string | null;
  overall_rating: number;
  is_verified: boolean;
  last_active: string;
}

function Avatar({
  src, name, size = 'md', borderClass = 'border-gray-600',
}: {
  src: string | null; name: string; size?: 'sm' | 'md'; borderClass?: string;
}) {
  const dim = size === 'sm' ? 'w-10 h-10 text-base' : 'w-12 h-12 sm:w-14 sm:h-14 text-lg sm:text-xl';
  return src ? (
    <img
      src={src}
      alt={name}
      className={`${dim} rounded-full object-cover border-2 ${borderClass} flex-shrink-0`}
      loading="lazy"
    />
  ) : (
    <div
      className={`${dim} rounded-full bg-gradient-to-br from-[#00FF85] to-[#00E0FF] flex items-center justify-center text-black font-black border-2 ${borderClass} flex-shrink-0`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function Friends() {
  const { profile: currentUser } = useAuth();
  const navigate = useNavigate();

  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<FriendRequest[]>([]);
  const [friendsOffset, setFriendsOffset] = useState(0);
  const [hasMoreFriends, setHasMoreFriends] = useState(false);
  const [loadingMoreFriends, setLoadingMoreFriends] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const [userBalances, setUserBalances] = useState<Map<string, number>>(new Map());
  const [userPresence, setUserPresence] = useState<Map<string, UserPresence>>(new Map());
  const [showSendCoinsModal, setShowSendCoinsModal] = useState(false);
  const [sendCoinsRecipient, setSendCoinsRecipient] = useState<{
    id: string; username: string; full_name: string | null; is_verified: boolean;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [searchActionLoading, setSearchActionLoading] = useState<string | null>(null);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (currentUser) {
      loadFriendData(false, 0);
      supabase
        .from('friends')
        .update({ seen_by_sender: true })
        .eq('user_id', currentUser.id)
        .eq('status', 'accepted')
        .eq('seen_by_sender', false)
        .then(() => {});
    }
  }, [currentUser]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchDone(false);
      return;
    }
    const timer = setTimeout(() => handleSearch(searchQuery.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadFriendData = async (appendFriends = false, offset = 0) => {
    if (!currentUser) return;
    try {
      setLoadError(null);

      const pendingQuery = supabase
        .from('friends')
        .select('id, user_id, friend_id, status, created_at')
        .or(`user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id}`)
        .eq('status', 'pending');

      const acceptedQuery = supabase
        .from('friends')
        .select('id, user_id, friend_id, status, created_at')
        .or(`user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id}`)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false })
        .range(offset, offset + FRIENDS_PAGE_SIZE - 1);

      const [pendingResult, acceptedResult] = await Promise.all([pendingQuery, acceptedQuery]);

      if (pendingResult.error) throw pendingResult.error;
      if (acceptedResult.error) throw acceptedResult.error;

      const allRows = [...(pendingResult.data || []), ...(acceptedResult.data || [])];

      if (allRows.length > 0) {
        const allOtherUserIds = allRows.map(f =>
          f.friend_id === currentUser.id ? f.user_id : f.friend_id
        );

        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, overall_rating, is_verified, has_social_badge')
          .in('id', allOtherUserIds);

        if (profilesError) throw profilesError;

        const profileMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        const incoming: FriendRequest[] = [];
        const outgoing: FriendRequest[] = [];
        const accepted: FriendRequest[] = [];

        for (const friendship of pendingResult.data || []) {
          const isIncoming = friendship.friend_id === currentUser.id;
          const otherUserId = isIncoming ? friendship.user_id : friendship.friend_id;
          const profileData = profileMap.get(otherUserId);
          if (profileData) {
            const request = { ...friendship, profile: profileData };
            if (isIncoming) incoming.push(request);
            else outgoing.push(request);
          }
        }

        for (const friendship of acceptedResult.data || []) {
          const isIncoming = friendship.friend_id === currentUser.id;
          const otherUserId = isIncoming ? friendship.user_id : friendship.friend_id;
          const profileData = profileMap.get(otherUserId);
          if (profileData) {
            accepted.push({ ...friendship, profile: profileData });
          }
        }

        if (!appendFriends) {
          setIncomingRequests(incoming);
          setOutgoingRequests(outgoing);
          setFriends(accepted);
          setFriendsOffset(accepted.length);
        } else {
          setFriends(prev => [...prev, ...accepted]);
          setFriendsOffset(prev => prev + accepted.length);
        }

        setHasMoreFriends((acceptedResult.data || []).length === FRIENDS_PAGE_SIZE);
        setFriendsBadgeSeenCount(incoming.length);

        const allUserIds = new Set<string>();
        [...incoming, ...outgoing, ...accepted].forEach(r => {
          if (r.profile?.id) allUserIds.add(r.profile.id);
        });

        if (allUserIds.size > 0) {
          const [balances, presence] = await Promise.all([
            getMultipleUserBalances(Array.from(allUserIds)),
            getMultipleUserPresence(Array.from(allUserIds)),
          ]);
          if (!appendFriends) {
            setUserBalances(balances);
            setUserPresence(presence);
          } else {
            setUserBalances(prev => new Map([...prev, ...balances]));
            setUserPresence(prev => new Map([...prev, ...presence]));
          }
        }
      } else if (!appendFriends) {
        setIncomingRequests([]);
        setOutgoingRequests([]);
        setFriends([]);
        setHasMoreFriends(false);
      }
    } catch (error: any) {
      console.error('Error loading friend data:', error);
      if (!appendFriends) {
        setLoadError('Failed to load friends. Please try again.');
        showNotification('error', 'Failed to load friends. Please refresh.');
      }
    } finally {
      setLoading(false);
      setLoadingMoreFriends(false);
    }
  };

  const handleLoadMoreFriends = async () => {
    setLoadingMoreFriends(true);
    await loadFriendData(true, friendsOffset);
  };

  const handleSearch = async (query: string) => {
    if (!query || !currentUser) return;
    setSearching(true);
    setSearchDone(false);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, overall_rating, is_verified, last_active')
        .ilike('username', `%${query}%`)
        .neq('id', currentUser.id)
        .limit(20);

      if (error) throw error;
      setSearchResults(data || []);
      setSearchDone(true);
    } catch {
      setSearchResults([]);
      setSearchDone(true);
    } finally {
      setSearching(false);
    }
  };

  const handleSendFriendRequest = async (recipientId: string) => {
    setSearchActionLoading(recipientId);
    try {
      const { error } = await sendFriendRequest(recipientId);
      if (error) throw error;
      setSentRequests(prev => new Set([...prev, recipientId]));
      showNotification('success', 'Friend request sent!');
    } catch (error: any) {
      showNotification('error', error?.message || 'Failed to send friend request.');
    } finally {
      setSearchActionLoading(null);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const request = incomingRequests.find(r => r.id === requestId);
      const { error } = await supabase.from('friends').update({ status: 'accepted' }).eq('id', requestId);
      if (error) throw error;
      showNotification('success', 'Friend request accepted!');
      if (request && currentUser) {
        getOrCreateConversation(currentUser.id, request.user_id).catch(() => {});
        claimPerFriendMilestoneReward(currentUser.id, request.user_id).catch(() => {});
      }
      setFriendsOffset(0);
      await loadFriendData(false, 0);
    } catch (error: any) {
      showNotification('error', 'Failed to accept request. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const { error } = await supabase.from('friends').delete().eq('id', requestId);
      if (error) throw error;
      showNotification('info', 'Friend request declined.');
      setFriendsOffset(0);
      await loadFriendData(false, 0);
    } catch {
      showNotification('error', 'Failed to decline request. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const { error } = await supabase.from('friends').delete().eq('id', requestId);
      if (error) throw error;
      showNotification('info', 'Friend request cancelled.');
      setFriendsOffset(0);
      await loadFriendData(false, 0);
    } catch {
      showNotification('error', 'Failed to cancel request. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveFriend = async (requestId: string) => {
    if (!confirm('Are you sure you want to remove this friend?')) return;
    setActionLoading(requestId);
    try {
      const { error } = await supabase.from('friends').delete().eq('id', requestId);
      if (error) throw error;
      showNotification('info', 'Friend removed.');
      setFriendsOffset(0);
      await loadFriendData(false, 0);
    } catch {
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

  const isAlreadyFriend = (userId: string) =>
    friends.some(f => f.profile.id === userId) ||
    incomingRequests.some(r => r.profile.id === userId) ||
    outgoingRequests.some(r => r.profile.id === userId);

  const pendingCount = incomingRequests.length + outgoingRequests.length;

  return (
    <div className="min-h-screen">
      <nav className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-[#B0B8C8] hover:text-[#00E0FF] transition-colors"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-white heading-glow">Friends</h1>
              {pendingCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                  {pendingCount}
                </span>
              )}
            </div>
            <button
              onClick={async () => { setRefreshing(true); setFriendsOffset(0); await loadFriendData(false, 0); setRefreshing(false); }}
              disabled={refreshing}
              className="text-[#B0B8C8] hover:text-[#00E0FF] transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </nav>

      {notification && (
        <div className="fixed top-20 right-4 z-50 max-w-xs sm:max-w-sm animate-fade-in">
          <div className={`glass-card p-4 border ${
            notification.type === 'success' ? 'border-green-500/40' :
            notification.type === 'error' ? 'border-red-500/40' : 'border-[#00E0FF]/40'
          }`}>
            <div className="flex items-center gap-2">
              {notification.type === 'success' && <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />}
              {notification.type === 'error' && <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
              {notification.type === 'info' && <AlertCircle className="w-4 h-4 text-[#00E0FF] flex-shrink-0" />}
              <p className="text-sm font-medium text-white">{notification.message}</p>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-28">

        {/* Search Section */}
        <section>
          <h2 className="text-sm font-semibold text-[#B0B8C8] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Search className="w-4 h-4" />
            Find Friends
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B0B8C8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by username..."
              className="w-full pl-10 pr-4 py-3 bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.3)] rounded-xl text-white placeholder-[#B0B8C8] text-sm focus:outline-none focus:border-[#00E0FF] transition-colors"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00E0FF] animate-spin" />
            )}
          </div>

          {searchQuery.trim() && (
            <div className="mt-3 space-y-2">
              {searching && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 text-[#00E0FF] animate-spin" />
                </div>
              )}
              {!searching && searchDone && searchResults.length === 0 && (
                <p className="text-center text-[#B0B8C8] text-sm py-6">No users found for "{searchQuery}"</p>
              )}
              {!searching && searchResults.map(result => {
                const alreadyConnected = isAlreadyFriend(result.id);
                const requestSent = sentRequests.has(result.id);
                const isLoading = searchActionLoading === result.id;
                return (
                  <div key={result.id} className="glass-card p-3 flex items-center gap-3">
                    <Avatar src={result.avatar_url} name={result.username} size="sm" borderClass="border-[rgba(0,224,255,0.3)]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{displayUsername(result.username)}</p>
                      <p className="text-[#B0B8C8] text-xs">OVR {result.overall_rating}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => navigate(`/profile/${result.username}`)}
                        className="p-2 rounded-lg bg-[rgba(0,224,255,0.1)] text-[#00E0FF] hover:bg-[rgba(0,224,255,0.2)] transition-colors"
                        aria-label="View profile"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {!alreadyConnected && !requestSent && (
                        <button
                          onClick={() => handleSendFriendRequest(result.id)}
                          disabled={isLoading}
                          className="p-2 rounded-lg bg-[rgba(0,255,133,0.1)] text-[#00FF85] hover:bg-[rgba(0,255,133,0.2)] transition-colors disabled:opacity-50"
                          aria-label="Add friend"
                        >
                          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                        </button>
                      )}
                      {(alreadyConnected || requestSent) && (
                        <span className="p-2 rounded-lg bg-[rgba(0,255,133,0.05)] text-[#00FF85]/50">
                          <UserCheck className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Pending Requests Section */}
        <section>
          <h2 className="text-sm font-semibold text-[#B0B8C8] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Pending Requests
            {pendingCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </h2>

          {loading ? (
            <div className="glass-card p-6 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-[#00E0FF] animate-spin" />
            </div>
          ) : incomingRequests.length === 0 && outgoingRequests.length === 0 ? (
            <div className="glass-card p-6 text-center">
              <p className="text-[#B0B8C8] text-sm">No pending requests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {incomingRequests.map(request => (
                <div key={request.id} className="glass-card p-4">
                  <div className="flex items-start gap-3">
                    <Avatar
                      src={request.profile.avatar_url}
                      name={displayUsername(request.profile.username)}
                      borderClass="border-[#00E0FF]/50"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-white font-bold text-sm truncate">
                          {displayUsername(request.profile.username)}
                        </span>
                        <span className="text-[10px] bg-[#00E0FF]/10 text-[#00E0FF] px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
                          Incoming
                        </span>
                      </div>
                      <OnlineStatus
                        lastActive={userPresence.get(request.profile.id)?.last_seen}
                        size="small"
                      />
                      <p className="text-[#B0B8C8] text-xs mt-0.5">OVR {request.profile.overall_rating ?? 50}</p>
                      {userBalances.has(request.profile.id) && (
                        <div className="flex items-center gap-1 mt-1">
                          <Coins className="w-3 h-3 text-yellow-500" />
                          <span className="text-xs text-yellow-500">
                            {formatCoinBalance(userBalances.get(request.profile.id) || 0)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleAcceptRequest(request.id)}
                      disabled={actionLoading === request.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black font-bold text-sm rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
                    >
                      {actionLoading === request.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <UserCheck className="w-4 h-4" />}
                      Accept
                    </button>
                    <button
                      onClick={() => handleDeclineRequest(request.id)}
                      disabled={actionLoading === request.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600/20 border border-red-500/30 text-red-400 font-semibold text-sm rounded-lg hover:bg-red-600/30 disabled:opacity-50 transition-all"
                    >
                      {actionLoading === request.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <UserX className="w-4 h-4" />}
                      Decline
                    </button>
                  </div>
                </div>
              ))}

              {outgoingRequests.map(request => (
                <div key={request.id} className="glass-card p-4">
                  <div className="flex items-start gap-3">
                    <Avatar
                      src={request.profile.avatar_url}
                      name={displayUsername(request.profile.username)}
                      borderClass="border-gray-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-white font-bold text-sm truncate">
                          {displayUsername(request.profile.username)}
                        </span>
                        <span className="text-[10px] bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
                          Sent
                        </span>
                      </div>
                      <OnlineStatus
                        lastActive={userPresence.get(request.profile.id)?.last_seen}
                        size="small"
                      />
                      <div className="flex items-center gap-1 text-[#B0B8C8] text-xs mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>Awaiting response</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancelRequest(request.id)}
                    disabled={actionLoading === request.id}
                    className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-gray-700/50 border border-gray-600/50 text-[#B0B8C8] font-semibold text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-all"
                  >
                    {actionLoading === request.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <XCircle className="w-4 h-4" />}
                    Cancel Request
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Friends Section */}
        <section>
          <h2 className="text-sm font-semibold text-[#B0B8C8] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            My Friends
            <span className="text-[#00E0FF] font-bold">{friends.length}</span>
          </h2>

          {loadError && (
            <div className="glass-card p-4 border border-red-500/30 text-center mb-3">
              <p className="text-red-400 text-sm mb-2">{loadError}</p>
              <button
                onClick={() => { setFriendsOffset(0); loadFriendData(false, 0); }}
                className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <div className="glass-card p-6 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-[#00E0FF] animate-spin" />
            </div>
          ) : friends.length === 0 && !loadError ? (
            <div className="glass-card p-8 text-center">
              <Users className="w-10 h-10 text-[#B0B8C8]/30 mx-auto mb-3" />
              <p className="text-[#B0B8C8] text-sm">No friends yet</p>
              <p className="text-[#B0B8C8]/60 text-xs mt-1">Search above to find and connect with people</p>
            </div>
          ) : (
            <div className="space-y-3">
              {friends.map(friend => (
                <div key={friend.id} className="glass-card p-4">
                  <div className="flex items-start gap-3">
                    <Avatar
                      src={friend.profile.avatar_url}
                      name={displayUsername(friend.profile.username)}
                      borderClass="border-[#00FF85]/50"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate">
                        {displayUsername(friend.profile.username)}
                      </p>
                      <OnlineStatus
                        lastActive={userPresence.get(friend.profile.id)?.last_seen}
                        size="small"
                      />
                      <p className="text-[#B0B8C8] text-xs mt-0.5">OVR {friend.profile.overall_rating ?? 50}</p>
                      {userBalances.has(friend.profile.id) && (
                        <div className="flex items-center gap-1 mt-1">
                          <Coins className="w-3 h-3 text-yellow-500" />
                          <span className="text-xs text-yellow-500">
                            {formatCoinBalance(userBalances.get(friend.profile.id) || 0)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button
                      onClick={() => navigate(`/profile/${friend.profile.username}`)}
                      className="flex items-center justify-center gap-1.5 py-2.5 bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black font-bold text-xs sm:text-sm rounded-lg hover:opacity-90 transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Profile
                    </button>
                    <button
                      onClick={() => handleMessageFriend(friend)}
                      disabled={actionLoading === friend.id}
                      className="flex items-center justify-center gap-1.5 py-2.5 bg-[rgba(0,224,255,0.1)] border border-[rgba(0,224,255,0.3)] text-[#00E0FF] font-semibold text-xs sm:text-sm rounded-lg hover:bg-[rgba(0,224,255,0.2)] disabled:opacity-50 transition-all"
                    >
                      {actionLoading === friend.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <MessageCircle className="w-3.5 h-3.5" />}
                      Message
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
                      className="flex items-center justify-center gap-1.5 py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold text-xs sm:text-sm rounded-lg hover:bg-amber-500/20 transition-all"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send Coins
                    </button>
                    <button
                      onClick={() => handleRemoveFriend(friend.id)}
                      disabled={actionLoading === friend.id}
                      className="flex items-center justify-center gap-1.5 py-2.5 bg-red-600/10 border border-red-500/20 text-red-400 font-semibold text-xs sm:text-sm rounded-lg hover:bg-red-600/20 disabled:opacity-50 transition-all"
                    >
                      {actionLoading === friend.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <UserX className="w-3.5 h-3.5" />}
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              {loadingMoreFriends && (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 text-[#00E0FF] animate-spin" />
                </div>
              )}

              {!loadingMoreFriends && hasMoreFriends && friends.length > 0 && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={handleLoadMoreFriends}
                    className="px-6 py-3 glass-card text-[#00E0FF] font-semibold text-sm rounded-xl transition-all hover:border-[rgba(0,224,255,0.5)]"
                  >
                    Load More Friends
                  </button>
                </div>
              )}

              {!hasMoreFriends && friends.length > 0 && (
                <p className="text-center text-[#B0B8C8]/50 text-xs py-3">All {friends.length} friends loaded</p>
              )}
            </div>
          )}
        </section>
      </main>

      <SendCoinsModal
        isOpen={showSendCoinsModal}
        onClose={() => { setShowSendCoinsModal(false); setSendCoinsRecipient(null); }}
        recipientId={sendCoinsRecipient?.id}
        recipientUsername={sendCoinsRecipient?.username}
        recipientFullName={null}
        recipientIsVerified={sendCoinsRecipient?.is_verified}
        onTransferComplete={() => loadFriendData()}
      />
    </div>
  );
}
