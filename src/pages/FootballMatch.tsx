import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, RefreshCw, Plus, AlertCircle } from 'lucide-react';
import { ShimmerBar } from '../components/ui/Shimmer';
import { useToast } from '../contexts/ToastContext';

interface FootballMatch {
  id: string;
  match_name: string;
  match_date: string;
  match_time: string | null;
  location: string | null;
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'disputed';
  wager_per_player: number;
  organiser_id: string;
}

interface MatchInvite {
  id: string;
  match_id: string;
  user_id: string;
  status: string;
  match: FootballMatch;
}

type Tab = 'my_matches' | 'invites';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  active: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
  completed: 'bg-green-500/20 text-green-400 border border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border border-red-500/30',
  disputed: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function MatchCard({ match }: { match: FootballMatch }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold truncate">{match.match_name}</h3>
          <p className="text-[#B0B8C8] text-sm mt-0.5">
            {formatDate(match.match_date)}{match.match_time ? ` · ${match.match_time}` : ''}
          </p>
          {match.location && (
            <p className="text-[#B0B8C8] text-xs mt-0.5 truncate">{match.location}</p>
          )}
          {match.wager_per_player > 0 && (
            <p className="text-yellow-400 text-xs font-semibold mt-1">{match.wager_per_player} coins per player</p>
          )}
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${STATUS_STYLES[match.status] || STATUS_STYLES.pending}`}>
          {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
        </span>
      </div>
    </div>
  );
}

function MatchInviteCard({
  invite,
  onAccept,
  onDecline,
  actionLoading,
}: {
  invite: MatchInvite;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  actionLoading: string | null;
}) {
  const match = invite.match;
  const isLoading = actionLoading === invite.id;

  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold truncate">{match.match_name}</h3>
          <p className="text-[#B0B8C8] text-sm mt-0.5">
            {formatDate(match.match_date)}{match.match_time ? ` · ${match.match_time}` : ''}
          </p>
          {match.location && (
            <p className="text-[#B0B8C8] text-xs mt-0.5 truncate">{match.location}</p>
          )}
          {match.wager_per_player > 0 && (
            <p className="text-yellow-400 text-xs font-semibold mt-1">{match.wager_per_player} coins per player</p>
          )}
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${STATUS_STYLES[match.status] || STATUS_STYLES.pending}`}>
          {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onAccept(invite.id)}
          disabled={isLoading}
          className="flex-1 py-2 rounded-xl text-sm font-bold bg-[#00E0FF]/20 text-[#00E0FF] border border-[#00E0FF]/30 hover:bg-[#00E0FF]/30 transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Processing...' : 'Accept'}
        </button>
        <button
          onClick={() => onDecline(invite.id)}
          disabled={isLoading}
          className="flex-1 py-2 rounded-xl text-sm font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </div>
  );
}

function MatchSkeleton() {
  return (
    <div className="glass-card p-4 space-y-2">
      <ShimmerBar className="h-5 w-3/4 rounded-lg" />
      <ShimmerBar className="h-4 w-1/2 rounded-lg" />
      <ShimmerBar className="h-3 w-1/3 rounded-lg" />
    </div>
  );
}

export default function FootballMatch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<Tab>('my_matches');

  const [myMatches, setMyMatches] = useState<FootballMatch[]>([]);
  const [myMatchesLoading, setMyMatchesLoading] = useState(true);
  const [myMatchesError, setMyMatchesError] = useState(false);

  const [invites, setInvites] = useState<MatchInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [invitesError, setInvitesError] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadMyMatches = async () => {
    if (!user) return;
    setMyMatchesLoading(true);
    setMyMatchesError(false);
    try {
      const { data, error } = await supabase
        .from('football_matches')
        .select('*')
        .eq('organiser_id', user.id)
        .order('match_date', { ascending: false });
      if (error) throw error;
      setMyMatches(data || []);
    } catch {
      setMyMatchesError(true);
    } finally {
      setMyMatchesLoading(false);
    }
  };

  const loadInvites = async () => {
    if (!user) return;
    setInvitesLoading(true);
    setInvitesError(false);
    try {
      const { data: playerRows, error: playerError } = await supabase
        .from('football_match_players')
        .select('id, match_id, user_id, status')
        .eq('user_id', user.id)
        .eq('status', 'invited');
      if (playerError) throw playerError;

      if (!playerRows || playerRows.length === 0) {
        setInvites([]);
        setInvitesLoading(false);
        return;
      }

      const matchIds = playerRows.map((r: any) => r.match_id);
      const { data: matchRows, error: matchError } = await supabase
        .from('football_matches')
        .select('*')
        .in('id', matchIds);
      if (matchError) throw matchError;

      const matchMap: Record<string, FootballMatch> = {};
      for (const m of matchRows || []) matchMap[m.id] = m;

      const combined: MatchInvite[] = playerRows
        .filter((r: any) => matchMap[r.match_id])
        .map((r: any) => ({
          id: r.id,
          match_id: r.match_id,
          user_id: r.user_id,
          status: r.status,
          match: matchMap[r.match_id],
        }));

      setInvites(combined);
    } catch {
      setInvitesError(true);
    } finally {
      setInvitesLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadMyMatches();
    loadInvites();
  }, [user]);

  const handleAccept = async (inviteId: string) => {
    setActionLoading(inviteId);
    try {
      const { error } = await supabase.rpc('accept_match_invite', { player_id: inviteId });
      if (error) throw error;
      toast.success('Invite accepted!');
      setInvites(prev => prev.filter(i => i.id !== inviteId));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to accept invite.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (inviteId: string) => {
    setActionLoading(inviteId);
    try {
      const { error } = await supabase
        .from('football_match_players')
        .update({ status: 'declined' })
        .eq('id', inviteId);
      if (error) throw error;
      toast.info('Invite declined.');
      setInvites(prev => prev.filter(i => i.id !== inviteId));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to decline invite.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([loadMyMatches(), loadInvites()]);
    } catch {
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [isRefreshing, user]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === 0 || isRefreshing) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0 && containerRef.current && containerRef.current.scrollTop === 0) {
      setPullDistance(Math.min(diff, 100));
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 60 && !isRefreshing) {
      handleRefresh();
    } else {
      setPullDistance(0);
    }
    touchStartY.current = 0;
  };

  if (!user) return null;

  return (
    <div
      className="min-h-screen"
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {pullDistance > 0 && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-gradient-to-b from-gray-900/90 to-transparent"
          style={{ height: `${pullDistance}px`, opacity: pullDistance / 100 }}
        >
          <RefreshCw className={`w-6 h-6 text-white ${isRefreshing ? 'animate-spin' : ''}`} />
        </div>
      )}

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
            <h1 className="text-xl font-bold text-white flex-1">Football Match</h1>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="text-[#B0B8C8] hover:text-white transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => navigate('/football-match/create')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00E0FF]/20 text-[#00E0FF] border border-[#00E0FF]/30 hover:bg-[#00E0FF]/30 transition-colors text-sm font-bold"
            >
              <Plus className="w-4 h-4" />
              Create Match
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-5">

        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('my_matches')}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              activeTab === 'my_matches'
                ? 'bg-[#00E0FF] text-black'
                : 'bg-[rgba(15,24,41,0.7)] text-[#B0B8C8] border border-[rgba(0,224,255,0.2)] hover:border-[rgba(0,224,255,0.5)] hover:text-white'
            }`}
          >
            My Matches
          </button>
          <button
            onClick={() => setActiveTab('invites')}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              activeTab === 'invites'
                ? 'bg-[#00E0FF] text-black'
                : 'bg-[rgba(15,24,41,0.7)] text-[#B0B8C8] border border-[rgba(0,224,255,0.2)] hover:border-[rgba(0,224,255,0.5)] hover:text-white'
            }`}
          >
            Invites
            {invites.length > 0 && (
              <span className="ml-1.5 bg-[#00E0FF] text-black text-xs font-black rounded-full px-1.5 py-0.5">
                {invites.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'my_matches' && (
          <div className="space-y-3">
            {myMatchesLoading ? (
              <>
                <MatchSkeleton />
                <MatchSkeleton />
                <MatchSkeleton />
              </>
            ) : myMatchesError ? (
              <div className="glass-card p-6 flex flex-col items-center gap-3 text-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
                <p className="text-[#B0B8C8] text-sm">Failed to load matches.</p>
                <button
                  onClick={loadMyMatches}
                  className="px-4 py-2 rounded-xl bg-[rgba(0,224,255,0.1)] text-[#00E0FF] border border-[rgba(0,224,255,0.2)] text-sm font-semibold hover:bg-[rgba(0,224,255,0.2)] transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : myMatches.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <p className="text-[#B0B8C8] text-sm">No matches yet. Create your first match!</p>
              </div>
            ) : (
              myMatches.map(match => <MatchCard key={match.id} match={match} />)
            )}
          </div>
        )}

        {activeTab === 'invites' && (
          <div className="space-y-3">
            {invitesLoading ? (
              <>
                <MatchSkeleton />
                <MatchSkeleton />
              </>
            ) : invitesError ? (
              <div className="glass-card p-6 flex flex-col items-center gap-3 text-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
                <p className="text-[#B0B8C8] text-sm">Failed to load invites.</p>
                <button
                  onClick={loadInvites}
                  className="px-4 py-2 rounded-xl bg-[rgba(0,224,255,0.1)] text-[#00E0FF] border border-[rgba(0,224,255,0.2)] text-sm font-semibold hover:bg-[rgba(0,224,255,0.2)] transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : invites.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <p className="text-[#B0B8C8] text-sm">No pending invites.</p>
              </div>
            ) : (
              invites.map(invite => (
                <MatchInviteCard
                  key={invite.id}
                  invite={invite}
                  onAccept={handleAccept}
                  onDecline={handleDecline}
                  actionLoading={actionLoading}
                />
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
