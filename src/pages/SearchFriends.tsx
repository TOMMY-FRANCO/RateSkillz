import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft, Search, X, Loader2, UserPlus, UserCheck, UserX, Clock, Eye,
  ChevronLeft, ChevronRight, ShieldCheck, Wifi,
} from 'lucide-react';
import { sendFriendRequest, removeFriend } from '../lib/friendRequests';
import { displayUsername } from '../lib/username';

interface SearchResult {
  id: string;
  username: string;
  avatar_url: string | null;
  overall_rating: number;
  position: string | null;
  team: string | null;
  is_verified: boolean;
  updated_at: string;
}

type FriendStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted';

interface FriendStatusEntry {
  status: FriendStatus;
  id: string | null;
}

const POSITIONS = ['AM', 'SW', 'CB', 'CF', 'LB', 'RB'];
const RESULTS_PER_PAGE = 20;

function getIsOnline(updatedAt: string): boolean {
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  return diffMs < 5 * 60 * 1000;
}

function getTimeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 5) return 'Online now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

function UserAvatar({ src, name, size = 'md' }: { src: string | null; name: string; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-10 h-10 text-sm' : 'w-12 h-12 text-base';
  return src ? (
    <img
      src={src}
      alt={name}
      className={`${dim} rounded-full object-cover border-2 border-[rgba(0,224,255,0.4)] flex-shrink-0`}
      loading="lazy"
    />
  ) : (
    <div className={`${dim} rounded-full bg-gradient-to-br from-[#00FF85] to-[#00E0FF] flex items-center justify-center text-black font-black border-2 border-[rgba(0,224,255,0.4)] flex-shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function SearchFriends() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [teamQuery, setTeamQuery] = useState('');

  const [friendStatuses, setFriendStatuses] = useState<Map<string, FriendStatusEntry>>(new Map());
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCurrentPage(1);
      performSearch(1);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, selectedPositions, verifiedOnly, onlineOnly, teamQuery]);

  useEffect(() => {
    performSearch(currentPage);
  }, [currentPage]);

  const performSearch = async (page: number) => {
    if (!user) return;
    setLoading(true);
    setHasSearched(true);
    try {
      let q = supabase
        .from('searchable_users_cache')
        .select('user_id, username, avatar_url, overall_rating, position, team, is_verified, updated_at', { count: 'exact' })
        .neq('user_id', user.id);

      if (query.trim()) {
        q = q.ilike('username', `%${query.trim()}%`);
      }
      if (selectedPositions.length > 0) {
        q = q.in('position', selectedPositions);
      }
      if (verifiedOnly) {
        q = q.eq('is_verified', true);
      }
      if (teamQuery.trim()) {
        q = q.ilike('team', `%${teamQuery.trim()}%`);
      }
      if (onlineOnly) {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        q = q.gte('updated_at', fiveMinAgo);
      }

      q = q.order('overall_rating', { ascending: false });

      const from = (page - 1) * RESULTS_PER_PAGE;
      q = q.range(from, from + RESULTS_PER_PAGE - 1);

      const { data, error, count } = await q;
      if (error) throw error;

      const mapped: SearchResult[] = (data || []).map((r: any) => ({
        id: r.user_id,
        username: r.username,
        avatar_url: r.avatar_url,
        overall_rating: r.overall_rating,
        position: r.position,
        team: r.team,
        is_verified: r.is_verified,
        updated_at: r.updated_at,
      }));

      setResults(mapped);
      setTotalResults(count || 0);

      if (mapped.length > 0) {
        loadFriendStatuses(mapped.map(r => r.id));
      }
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
      setTotalResults(0);
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
    } catch (err) {
      console.error('Error loading friend statuses:', err);
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
    } catch (err: any) {
      console.error(err);
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
    } catch (err: any) {
      console.error(err);
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
    } catch (err: any) {
      console.error(err);
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
    } catch (err: any) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const togglePosition = (pos: string) => {
    setSelectedPositions(prev =>
      prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]
    );
  };

  const clearAll = () => {
    setQuery('');
    setSelectedPositions([]);
    setVerifiedOnly(false);
    setOnlineOnly(false);
    setTeamQuery('');
    setCurrentPage(1);
  };

  const hasActiveFilters = selectedPositions.length > 0 || verifiedOnly || onlineOnly || teamQuery.trim();
  const totalPages = Math.ceil(totalResults / RESULTS_PER_PAGE);

  return (
    <div className="min-h-screen">
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
            <h1 className="text-xl font-bold text-white">Search Friends</h1>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-5">

        {/* Search input */}
        <div className="glass-container p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B0B8C8]" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by username"
              autoComplete="off"
              className="w-full pl-10 pr-10 py-3 bg-transparent text-white placeholder-[#B0B8C8] text-sm focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B0B8C8] hover:text-white transition-colors"
                aria-label="Clear"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Filter row */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
          {POSITIONS.map(pos => (
            <button
              key={pos}
              onClick={() => togglePosition(pos)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedPositions.includes(pos)
                  ? 'bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black shadow-[0_0_12px_rgba(0,224,255,0.4)]'
                  : 'bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] text-[#B0B8C8] hover:border-[#00E0FF] hover:text-white'
              }`}
            >
              {pos}
            </button>
          ))}

          <button
            onClick={() => setVerifiedOnly(v => !v)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              verifiedOnly
                ? 'bg-gradient-to-r from-[#00E0FF] to-[#38BDF8] text-black shadow-[0_0_12px_rgba(0,224,255,0.4)]'
                : 'bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] text-[#B0B8C8] hover:border-[#00E0FF] hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3 h-3" />
            Verified
          </button>

          <button
            onClick={() => setOnlineOnly(v => !v)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              onlineOnly
                ? 'bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black shadow-[0_0_12px_rgba(0,224,255,0.4)]'
                : 'bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] text-[#B0B8C8] hover:border-[#00E0FF] hover:text-white'
            }`}
          >
            <Wifi className="w-3 h-3" />
            Online
          </button>

          <div className="flex-shrink-0 relative">
            <input
              type="text"
              value={teamQuery}
              onChange={e => setTeamQuery(e.target.value)}
              placeholder="Team..."
              className={`w-28 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[rgba(15,24,41,0.85)] border transition-all focus:outline-none placeholder-[#B0B8C8] text-white ${
                teamQuery ? 'border-[#00E0FF]' : 'border-[rgba(0,224,255,0.2)] hover:border-[#00E0FF]/60'
              }`}
            />
            {teamQuery && (
              <button
                onClick={() => setTeamQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#B0B8C8] hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearAll}
              className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 transition-all"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        {/* Results count */}
        {hasSearched && !loading && (
          <p className="text-[#B0B8C8] text-xs px-1">
            {totalResults > 0
              ? <><span className="text-white font-bold">{totalResults}</span> {totalResults === 1 ? 'player' : 'players'} found{totalPages > 1 ? ` · Page ${currentPage} of ${totalPages}` : ''}</>
              : 'No players found'
            }
          </p>
        )}

        {/* Results */}
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
        ) : hasSearched && results.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <Search className="w-10 h-10 text-[#B0B8C8]/20 mx-auto mb-3" />
            <p className="text-[#B0B8C8] text-sm font-semibold">No players found</p>
            <p className="text-[#B0B8C8]/50 text-xs mt-1">Try a different username or adjust the filters</p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map(result => {
              const fs = friendStatuses.get(result.id);
              const isProcessing = actionLoading === result.id;
              const online = getIsOnline(result.updated_at);

              return (
                <div key={result.id} className="glass-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      <UserAvatar src={result.avatar_url} name={result.username} />
                      {online && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#00FF85] rounded-full border-2 border-[#0f1829]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="text-white font-bold text-sm truncate max-w-[160px]">
                          {displayUsername(result.username)}
                        </span>
                        {result.is_verified && (
                          <ShieldCheck className="w-3.5 h-3.5 text-[#00E0FF] flex-shrink-0" />
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-black text-black bg-gradient-to-r from-[#00FF85] to-[#00E0FF] px-1.5 py-0.5 rounded">
                          {result.overall_rating}
                        </span>
                        {result.position && (
                          <span className="text-[10px] font-bold text-[#00E0FF] bg-[rgba(0,224,255,0.1)] px-1.5 py-0.5 rounded border border-[rgba(0,224,255,0.2)]">
                            {result.position}
                          </span>
                        )}
                        {result.team && (
                          <span className="text-[10px] text-[#B0B8C8] truncate max-w-[100px]">
                            {result.team}
                          </span>
                        )}
                        <span className={`text-[10px] ${online ? 'text-[#00FF85]' : 'text-[#B0B8C8]/60'}`}>
                          {getTimeAgo(result.updated_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => navigate(`/profile/${result.username}`)}
                        className="p-2 rounded-lg bg-[rgba(0,224,255,0.08)] border border-[rgba(0,224,255,0.2)] text-[#00E0FF] hover:bg-[rgba(0,224,255,0.15)] transition-all"
                        aria-label="View profile"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {(() => {
                        if (fs?.status === 'accepted') {
                          return (
                            <button
                              onClick={() => handleRemoveFriend(result.id, fs.id!)}
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
                              onClick={() => handleCancelRequest(result.id, fs.id!)}
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
                              onClick={() => handleAcceptRequest(result.id, fs.id!)}
                              disabled={isProcessing}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-all"
                            >
                              {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                              Accept
                            </button>
                          );
                        }
                        if (fs?.status === 'none' || !fs) {
                          return (
                            <button
                              onClick={() => handleSendRequest(result.id)}
                              disabled={isProcessing}
                              className="p-2 rounded-lg bg-[rgba(0,255,133,0.1)] border border-[rgba(0,255,133,0.25)] text-[#00FF85] hover:bg-[rgba(0,255,133,0.2)] disabled:opacity-50 transition-all"
                              aria-label="Add friend"
                            >
                              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                            </button>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && !loading && (
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
      </main>
    </div>
  );
}
