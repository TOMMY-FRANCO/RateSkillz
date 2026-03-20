import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  Eye, UserPlus, UserCheck, UserX, Clock, Loader2,
  ChevronLeft, ChevronRight, ArrowLeft, ShieldCheck,
} from 'lucide-react';
import { sendFriendRequest, removeFriend } from '../lib/friendRequests';
import { markNotificationsRead } from '../lib/notifications';
import { isOnline, formatTimeAgo } from '../lib/presence';
import { displayUsername } from '../lib/username';

interface ViewerData {
  viewer_id: string;
  username: string;
  avatar_url: string | null;
  overall_rating: number;
  position: string | null;
  team: string | null;
  is_verified: boolean;
  last_active: string;
  viewed_at: string;
}

type FriendStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted';

interface FriendStatusEntry {
  status: FriendStatus;
  id: string | null;
}

const VIEWERS_PER_PAGE = 20;

function UserAvatar({ src, name }: { src: string | null; name: string }) {
  return src ? (
    <img
      src={src}
      alt={name}
      className="w-12 h-12 rounded-full object-cover border-2 border-[rgba(0,224,255,0.4)] flex-shrink-0"
      loading="lazy"
    />
  ) : (
    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00FF85] to-[#00E0FF] flex items-center justify-center text-black font-black text-base border-2 border-[rgba(0,224,255,0.4)] flex-shrink-0">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function ViewedMe() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [viewers, setViewers] = useState<ViewerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalViewers, setTotalViewers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [friendStatuses, setFriendStatuses] = useState<Map<string, FriendStatusEntry>>(new Map());

  useEffect(() => {
    if (user) {
      fetchViewers();
      markNotificationsRead(user.id, 'profile_view');
      markProfileViewsAsRead();
    }
  }, [user, currentPage]);

  const markProfileViewsAsRead = async () => {
    if (!user) return;
    try {
      await supabase.rpc('mark_profile_views_read', { p_user_id: user.id });
    } catch (error) {
      console.error('Exception marking profile views as read:', error);
    }
  };

  const fetchViewers = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { count, error: countError } = await supabase
        .from('profile_views')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', user.id)
        .not('viewer_id', 'is', null);

      if (countError) throw countError;

      const total = count || 0;
      setTotalViewers(total);

      if (total === 0) {
        setViewers([]);
        return;
      }

      const offset = (currentPage - 1) * VIEWERS_PER_PAGE;

      const { data: viewRecords, error: viewError } = await supabase
        .from('profile_views')
        .select('viewer_id, viewed_at')
        .eq('profile_id', user.id)
        .not('viewer_id', 'is', null)
        .order('viewed_at', { ascending: false })
        .range(offset, offset + VIEWERS_PER_PAGE - 1);

      if (viewError) throw viewError;
      if (!viewRecords || viewRecords.length === 0) {
        setViewers([]);
        return;
      }

      const viewerIds = [...new Set(viewRecords.map(r => r.viewer_id as string))];

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, last_active, overall_rating, position, team, is_verified')
        .in('id', viewerIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map<string, any>();
      if (profilesData) {
        for (const p of profilesData) profileMap.set(p.id, p);
      }

      const viewerList: ViewerData[] = viewRecords.map(record => {
        const profile = profileMap.get(record.viewer_id as string);
        return {
          viewer_id: record.viewer_id as string,
          username: profile?.username || 'Unknown',
          avatar_url: profile?.avatar_url || null,
          overall_rating: profile?.overall_rating || 50,
          position: profile?.position || null,
          team: profile?.team || null,
          is_verified: profile?.is_verified || false,
          last_active: profile?.last_active || record.viewed_at,
          viewed_at: record.viewed_at,
        };
      });

      setViewers(viewerList);
      loadFriendStatuses(viewerIds);
    } catch (error) {
      console.error('Error fetching viewers:', error);
      setViewers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadFriendStatuses = async (userIds: string[]) => {
    if (!user || userIds.length === 0) return;
    try {
      const { data } = await supabase
        .from('friends')
        .select('id, user_id, friend_id, status')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      const map = new Map<string, FriendStatusEntry>();
      for (const uid of userIds) map.set(uid, { status: 'none', id: null });

      if (data) {
        for (const row of data) {
          const other = row.user_id === user.id ? row.friend_id : row.user_id;
          if (!userIds.includes(other)) continue;
          if (row.status === 'accepted') {
            map.set(other, { status: 'accepted', id: row.id });
          } else if (row.status === 'pending') {
            map.set(other, {
              status: row.user_id === user.id ? 'pending_sent' : 'pending_received',
              id: row.id,
            });
          }
        }
      }
      setFriendStatuses(map);
    } catch (error) {
      console.error('Error loading friend statuses:', error);
    }
  };

  const handleSendRequest = async (recipientId: string) => {
    setActionLoading(recipientId);
    try {
      const { data, error } = await sendFriendRequest(recipientId);
      if (error) throw error;
      setFriendStatuses(prev => {
        const next = new Map(prev);
        next.set(recipientId, { status: 'pending_sent', id: (data as any)?.id || null });
        return next;
      });
      toast.success('Friend request sent!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send friend request.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelRequest = async (recipientId: string, friendshipId: string) => {
    setActionLoading(recipientId);
    try {
      const { error } = await removeFriend(friendshipId);
      if (error) throw error;
      setFriendStatuses(prev => {
        const next = new Map(prev);
        next.set(recipientId, { status: 'none', id: null });
        return next;
      });
      toast.info('Friend request cancelled.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to cancel request.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptRequest = async (recipientId: string, friendshipId: string) => {
    setActionLoading(recipientId);
    try {
      const { error } = await supabase.from('friends').update({ status: 'accepted' }).eq('id', friendshipId);
      if (error) throw error;
      setFriendStatuses(prev => {
        const next = new Map(prev);
        next.set(recipientId, { status: 'accepted', id: friendshipId });
        return next;
      });
      toast.success('Friend request accepted!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to accept request.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveFriend = async (recipientId: string, friendshipId: string) => {
    if (!confirm('Remove this friend?')) return;
    setActionLoading(recipientId);
    try {
      const { error } = await removeFriend(friendshipId);
      if (error) throw error;
      setFriendStatuses(prev => {
        const next = new Map(prev);
        next.set(recipientId, { status: 'none', id: null });
        return next;
      });
      toast.info('Friend removed.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove friend.');
    } finally {
      setActionLoading(null);
    }
  };

  const getViewedAgo = (dateString: string) => {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    if (mins < 5) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(dateString).toLocaleDateString();
  };

  const totalPages = Math.ceil(totalViewers / VIEWERS_PER_PAGE);

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 h-16">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-[#B0B8C8] hover:text-[#00E0FF] transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-white">Viewed Me</h1>
            {totalViewers > 0 && (
              <span className="ml-auto text-xs font-bold text-[#B0B8C8]">
                {totalViewers} {totalViewers === 1 ? 'view' : 'views'}
              </span>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-3">

        {/* Loading */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="glass-card p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-white/10 rounded" />
                    <div className="h-3 w-20 bg-white/10 rounded" />
                  </div>
                  <div className="h-9 w-24 bg-white/10 rounded-lg" />
                </div>
              </div>
            ))}
          </div>

        ) : viewers.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <Eye className="w-10 h-10 text-[#B0B8C8]/20 mx-auto mb-3" />
            <p className="text-[#B0B8C8] text-sm font-semibold">No profile views yet</p>
            <p className="text-[#B0B8C8]/50 text-xs mt-1">Share your profile to get more views!</p>
          </div>

        ) : (
          <>
            {viewers.map(viewer => {
              const fs = friendStatuses.get(viewer.viewer_id);
              const isProcessing = actionLoading === viewer.viewer_id;
              const online = isOnline(viewer.last_active);

              return (
                <div key={viewer.viewer_id} className="glass-card p-4">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <UserAvatar src={viewer.avatar_url} name={viewer.username} />
                      {online && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#00FF85] rounded-full border-2 border-[#0f1829]" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="text-white font-bold text-sm truncate max-w-[160px]">
                          {displayUsername(viewer.username)}
                        </span>
                        {viewer.is_verified && (
                          <ShieldCheck className="w-3.5 h-3.5 text-[#00E0FF] flex-shrink-0" />
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-black text-black bg-gradient-to-r from-[#00FF85] to-[#00E0FF] px-1.5 py-0.5 rounded">
                          {viewer.overall_rating}
                        </span>
                        {viewer.position && (
                          <span className="text-[10px] font-bold text-[#00E0FF] bg-[rgba(0,224,255,0.1)] px-1.5 py-0.5 rounded border border-[rgba(0,224,255,0.2)]">
                            {viewer.position}
                          </span>
                        )}
                        {viewer.team && (
                          <span className="text-[10px] text-[#B0B8C8] truncate max-w-[100px]">
                            {viewer.team}
                          </span>
                        )}
                        <span className="text-[10px] text-[#B0B8C8]/60">
                          Viewed {getViewedAgo(viewer.viewed_at)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => navigate(`/profile/${viewer.username}`)}
                        className="p-2 rounded-lg bg-[rgba(0,224,255,0.08)] border border-[rgba(0,224,255,0.2)] text-[#00E0FF] hover:bg-[rgba(0,224,255,0.15)] transition-all"
                        aria-label="View profile"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {(() => {
                        if (fs?.status === 'accepted') {
                          return (
                            <button
                              onClick={() => handleRemoveFriend(viewer.viewer_id, fs.id!)}
                              disabled={isProcessing}
                              className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-all"
                              aria-label="Remove friend"
                            >
                              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                            </button>
                          );
                        }
                        if (fs?.status === 'pending_sent') {
                          return (
                            <button
                              onClick={() => handleCancelRequest(viewer.viewer_id, fs.id!)}
                              disabled={isProcessing}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-[#B0B8C8] text-xs font-semibold hover:bg-white/10 disabled:opacity-50 transition-all"
                            >
                              {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                              Pending
                            </button>
                          );
                        }
                        if (fs?.status === 'pending_received') {
                          return (
                            <button
                              onClick={() => handleAcceptRequest(viewer.viewer_id, fs.id!)}
                              disabled={isProcessing}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-all"
                            >
                              {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                              Accept
                            </button>
                          );
                        }
                        return (
                          <button
                            onClick={() => handleSendRequest(viewer.viewer_id)}
                            disabled={isProcessing}
                            className="p-2 rounded-lg bg-[rgba(0,255,133,0.1)] border border-[rgba(0,255,133,0.25)] text-[#00FF85] hover:bg-[rgba(0,255,133,0.2)] disabled:opacity-50 transition-all"
                            aria-label="Add friend"
                          >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="glass-card p-4 flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[rgba(0,224,255,0.08)] border border-[rgba(0,224,255,0.2)] text-[#00E0FF] text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[rgba(0,224,255,0.15)] transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </button>
                <span className="text-[#B0B8C8] text-sm font-semibold">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[rgba(0,224,255,0.08)] border border-[rgba(0,224,255,0.2)] text-[#00E0FF] text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[rgba(0,224,255,0.15)] transition-all"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}