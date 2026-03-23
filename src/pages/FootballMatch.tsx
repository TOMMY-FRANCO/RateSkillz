import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, RefreshCw, Plus, AlertCircle, X, Search, UserCheck, ChevronDown, ChevronUp, Trophy, MapPin, Calendar, Clock, FileText, Users } from 'lucide-react';
import { ShimmerBar } from '../components/ui/Shimmer';
import { DefaultAvatar } from '../components/ui/DefaultAvatar';
import { useToast } from '../contexts/ToastContext';

interface FootballMatch {
  id: string;
  match_name: string;
  match_date: string;
  match_time: string | null;
  location: string | null;
  notes: string | null;
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'disputed';
  wager_per_player: number;
  team_size: number;
  organiser_id: string;
  team_a_captain_id: string | null;
  team_b_captain_id: string | null;
  winning_team: string | null;
}

interface MatchPlayer {
  id: string;
  user_id: string;
  team: string;
  status: string;
  username: string;
  avatar_url: string | null;
}

interface MatchInvite {
  id: string;
  match_id: string;
  user_id: string;
  status: string;
  match: FootballMatch;
}

interface FriendProfile {
  id: string;
  username: string;
  avatar_url: string | null;
}

type Tab = 'my_matches' | 'invites';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  active: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
  completed: 'bg-green-500/20 text-green-400 border border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border border-red-500/30',
  disputed: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
};

const inputClass =
  'w-full px-3 py-2.5 rounded-xl bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] text-white text-sm placeholder-[#6B7A99] focus:outline-none focus:border-[#00E0FF] transition-colors';

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function AvatarBubble({ name, avatar, size = 'md' }: { name: string; avatar: string | null; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        className={`${dim} rounded-full object-cover border border-[rgba(0,224,255,0.3)] flex-shrink-0`}
      />
    );
  }
  return (
    <DefaultAvatar size={size === 'sm' ? 28 : 36} className={`${dim} rounded-full flex-shrink-0`} />
  );
}

function MatchCard({ match, userId, onResultSubmitted }: { match: FootballMatch; userId: string; onResultSubmitted: (matchId: string) => void }) {
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [players, setPlayers] = useState<MatchPlayer[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [resultSubmitting, setResultSubmitting] = useState(false);

  const isCaptain = userId === match.team_a_captain_id || userId === match.team_b_captain_id;
  const canSubmitResult = isCaptain && (match.status === 'active' || match.status === 'pending');

  const loadPlayers = async () => {
    if (players.length > 0) return;
    setPlayersLoading(true);
    try {
      const { data: playerRows, error } = await supabase
        .from('football_match_players')
        .select('id, user_id, team, status')
        .eq('match_id', match.id);
      if (error) throw error;

      const userIds = (playerRows || []).map((r: any) => r.user_id);
      if (userIds.length === 0) { setPlayers([]); return; }

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);
      if (profileError) throw profileError;

      const profileMap: Record<string, { username: string; avatar_url: string | null }> = {};
      for (const p of profiles || []) profileMap[p.id] = { username: p.username || 'Unknown', avatar_url: p.avatar_url || null };

      setPlayers(
        (playerRows || []).map((r: any) => ({
          id: r.id,
          user_id: r.user_id,
          team: r.team,
          status: r.status,
          username: profileMap[r.user_id]?.username ?? 'Unknown',
          avatar_url: profileMap[r.user_id]?.avatar_url ?? null,
        }))
      );
    } catch {
      // silently fail — detail still shows without players
    } finally {
      setPlayersLoading(false);
    }
  };

  const handleToggle = () => {
    if (!expanded) loadPlayers();
    setExpanded(prev => !prev);
  };

  const handleSubmitResult = async (winningTeam: string) => {
    setResultSubmitting(true);
    try {
      const { error } = await supabase.rpc('submit_match_result', {
        p_user_id: userId,
        p_match_id: match.id,
        p_winning_team: winningTeam,
      });
      if (error) throw error;
      toast.success('Result submitted!');
      onResultSubmitted(match.id);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit result.');
    } finally {
      setResultSubmitting(false);
    }
  };

  const teamA = players.filter(p => p.team === 'team_a');
  const teamB = players.filter(p => p.team === 'team_b');

  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full p-4 text-left"
      >
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
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${STATUS_STYLES[match.status] || STATUS_STYLES.pending}`}>
              {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
            </span>
            {expanded
              ? <ChevronUp className="w-4 h-4 text-[#B0B8C8]" />
              : <ChevronDown className="w-4 h-4 text-[#B0B8C8]" />
            }
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[rgba(0,224,255,0.1)] px-4 pb-4 pt-3 space-y-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#00E0FF] flex-shrink-0" />
              <span className="text-[#B0B8C8] text-xs">{formatDate(match.match_date)}</span>
            </div>
            {match.match_time && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#00E0FF] flex-shrink-0" />
                <span className="text-[#B0B8C8] text-xs">{match.match_time}</span>
              </div>
            )}
            {match.location && (
              <div className="flex items-center gap-1.5 col-span-2">
                <MapPin className="w-3.5 h-3.5 text-[#00E0FF] flex-shrink-0" />
                <span className="text-[#B0B8C8] text-xs">{match.location}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#00E0FF] flex-shrink-0" />
              <span className="text-[#B0B8C8] text-xs">{match.team_size}v{match.team_size}</span>
            </div>
            {match.wager_per_player > 0 && (
              <div className="flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                <span className="text-yellow-400 text-xs font-semibold">{match.wager_per_player} coins/player</span>
              </div>
            )}
            {match.notes && (
              <div className="flex items-start gap-1.5 col-span-2">
                <FileText className="w-3.5 h-3.5 text-[#00E0FF] flex-shrink-0 mt-0.5" />
                <span className="text-[#B0B8C8] text-xs">{match.notes}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[#00E0FF] text-xs font-bold mb-1.5">Team A</p>
              {playersLoading ? (
                <ShimmerBar className="h-8 rounded-xl" />
              ) : teamA.length === 0 ? (
                <p className="text-[#6B7A99] text-xs italic">No players</p>
              ) : (
                <div className="space-y-1">
                  {teamA.map((p, idx) => (
                    <div key={p.id} className="flex items-center gap-1.5">
                      <AvatarBubble name={p.username} avatar={p.avatar_url} size="sm" />
                      <span className="text-white text-xs truncate flex-1">@{p.username}</span>
                      {idx === 0 && (
                        <span className="text-[10px] font-black bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-full px-1.5 py-0.5 whitespace-nowrap">
                          Captain
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="w-px bg-[rgba(0,224,255,0.1)]" />
            <div className="flex-1 min-w-0">
              <p className="text-[#00E0FF] text-xs font-bold mb-1.5">Team B</p>
              {playersLoading ? (
                <ShimmerBar className="h-8 rounded-xl" />
              ) : teamB.length === 0 ? (
                <p className="text-[#6B7A99] text-xs italic">No players</p>
              ) : (
                <div className="space-y-1">
                  {teamB.map((p, idx) => (
                    <div key={p.id} className="flex items-center gap-1.5">
                      <AvatarBubble name={p.username} avatar={p.avatar_url} size="sm" />
                      <span className="text-white text-xs truncate flex-1">@{p.username}</span>
                      {idx === 0 && (
                        <span className="text-[10px] font-black bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-full px-1.5 py-0.5 whitespace-nowrap">
                          Captain
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {match.status === 'completed' && match.winning_team && (
            <div className="flex items-center gap-2 pt-1">
              <Trophy className="w-4 h-4 text-[#00FF85]" />
              <p className="text-[#00FF85] font-bold text-sm">
                {match.winning_team === 'team_a' ? 'Team A Won' : 'Team B Won'}
              </p>
            </div>
          )}

          {match.status === 'disputed' && (
            <p className="text-orange-400 text-sm font-semibold pt-1">
              Disputed — result disagreement, all coins refunded
            </p>
          )}

          {match.status === 'cancelled' && (
            <p className="text-red-400 text-sm font-semibold pt-1">Cancelled</p>
          )}

          {canSubmitResult && (
            <div className="pt-1 space-y-2">
              <p className="text-[#B0B8C8] text-xs font-semibold">Submit Result</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSubmitResult('team_a')}
                  disabled={resultSubmitting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#00FF85]/15 text-[#00FF85] border border-[#00FF85]/30 hover:bg-[#00FF85]/25 transition-colors disabled:opacity-50"
                >
                  {resultSubmitting ? 'Submitting...' : 'Team A Won'}
                </button>
                <button
                  onClick={() => handleSubmitResult('team_b')}
                  disabled={resultSubmitting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#00E0FF]/15 text-[#00E0FF] border border-[#00E0FF]/30 hover:bg-[#00E0FF]/25 transition-colors disabled:opacity-50"
                >
                  {resultSubmitting ? 'Submitting...' : 'Team B Won'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
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

function FriendPicker({
  friends,
  friendsLoading,
  selectedIds,
  onSelect,
  onClose,
}: {
  friends: FriendProfile[];
  friendsLoading: boolean;
  selectedIds: Set<string>;
  onSelect: (friend: FriendProfile) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = friends.filter(
    f =>
      !selectedIds.has(f.id) &&
      f.username.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-container rounded-2xl w-full max-w-sm flex flex-col max-h-[70vh]">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[rgba(0,224,255,0.1)]">
          <h3 className="text-white font-bold text-base">Add Player</h3>
          <button onClick={onClose} className="text-[#B0B8C8] hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7A99]" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search friends..."
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {friendsLoading ? (
            <>
              <ShimmerBar className="h-12 rounded-xl" />
              <ShimmerBar className="h-12 rounded-xl" />
              <ShimmerBar className="h-12 rounded-xl" />
            </>
          ) : filtered.length === 0 ? (
            <p className="text-center text-[#B0B8C8] text-sm py-6">
              {query ? 'No friends match your search.' : 'No friends available to add.'}
            </p>
          ) : (
            filtered.map(f => (
              <div key={f.id} className="glass-card p-3 flex items-center gap-3">
                <AvatarBubble name={f.username} avatar={f.avatar_url} />
                <span className="text-white text-sm font-semibold flex-1 truncate">@{f.username}</span>
                <button
                  onClick={() => { onSelect(f); onClose(); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#00E0FF]/20 text-[#00E0FF] border border-[#00E0FF]/30 hover:bg-[#00E0FF]/30 transition-colors text-xs font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function TeamSection({
  label,
  players,
  friends,
  friendsLoading,
  allSelectedIds,
  onAdd,
  onRemove,
}: {
  label: string;
  players: FriendProfile[];
  friends: FriendProfile[];
  friendsLoading: boolean;
  allSelectedIds: Set<string>;
  onAdd: (f: FriendProfile) => void;
  onRemove: (id: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <div className="flex-1 min-w-0 space-y-2">
        <h4 className="text-[#00E0FF] text-sm font-bold">{label}</h4>
        <div className="space-y-1.5 min-h-[2.5rem]">
          {players.map((p, idx) => (
            <div key={p.id} className="flex items-center gap-2 bg-[rgba(0,224,255,0.05)] border border-[rgba(0,224,255,0.1)] rounded-xl px-2.5 py-1.5">
              <AvatarBubble name={p.username} avatar={p.avatar_url} size="sm" />
              <span className="text-white text-xs font-semibold flex-1 truncate">@{p.username}</span>
              {idx === 0 && (
                <span className="text-[10px] font-black bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-full px-1.5 py-0.5 whitespace-nowrap">
                  Captain
                </span>
              )}
              <button
                onClick={() => onRemove(p.id)}
                className="text-[#6B7A99] hover:text-red-400 transition-colors ml-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-[rgba(0,224,255,0.3)] text-[#00E0FF] text-xs font-semibold hover:bg-[rgba(0,224,255,0.05)] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Player
        </button>
      </div>
      {pickerOpen && (
        <FriendPicker
          friends={friends}
          friendsLoading={friendsLoading}
          selectedIds={allSelectedIds}
          onSelect={onAdd}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}

interface CreateMatchFormProps {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function CreateMatchModal({ userId, onClose, onSuccess }: CreateMatchFormProps) {
  const toast = useToast();

  const [matchName, setMatchName] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [matchTime, setMatchTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [teamSize, setTeamSize] = useState(5);
  const [wagerPerPlayer, setWagerPerPlayer] = useState(0);

  const [teamA, setTeamA] = useState<FriendProfile[]>([]);
  const [teamB, setTeamB] = useState<FriendProfile[]>([]);

  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    setFriendsLoading(true);
    try {
      const { data, error } = await supabase
        .from('friends')
        .select('id, user_id, friend_id, status')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .eq('status', 'accepted');

      if (error) throw error;

      const friendIds = (data || []).map((row: any) =>
        row.user_id === userId ? row.friend_id : row.user_id
      );

      if (friendIds.length === 0) {
        setFriends([]);
        return;
      }

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', friendIds);

      if (profileError) throw profileError;

      setFriends(
        (profiles || []).map((p: any) => ({
          id: p.id,
          username: p.username || 'Unknown',
          avatar_url: p.avatar_url || null,
        }))
      );
    } catch {
      setFriends([]);
    } finally {
      setFriendsLoading(false);
    }
  };

  const allSelectedIds = new Set([...teamA.map(p => p.id), ...teamB.map(p => p.id)]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!matchName.trim()) { setValidationError('Match name is required.'); return; }
    if (!matchDate) { setValidationError('Match date is required.'); return; }
    if (teamA.length === 0) { setValidationError('Team A must have at least 1 player.'); return; }
    if (teamB.length === 0) { setValidationError('Team B must have at least 1 player.'); return; }

    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('create_football_match', {
        p_match_name: matchName.trim(),
        p_match_date: matchDate,
        p_match_time: matchTime || null,
        p_location: location.trim() || null,
        p_notes: notes.trim() || null,
        p_team_size: teamSize,
        p_wager_per_player: wagerPerPlayer,
        p_team_a_player_ids: teamA.map(p => p.id),
        p_team_b_player_ids: teamB.map(p => p.id),
      });

      if (error) throw error;

      toast.success('Match created!');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create match.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-container rounded-2xl w-full max-w-lg mx-4 my-6 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white text-xl font-bold">Create Match</h2>
          <button onClick={onClose} className="text-[#B0B8C8] hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#B0B8C8]">Match Name *</label>
            <input
              value={matchName}
              onChange={e => setMatchName(e.target.value)}
              placeholder="e.g. Sunday League"
              className={inputClass}
              maxLength={100}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#B0B8C8]">Date *</label>
              <input
                type="date"
                value={matchDate}
                onChange={e => setMatchDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#B0B8C8]">Time</label>
              <input
                type="time"
                value={matchTime}
                onChange={e => setMatchTime(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#B0B8C8]">Location</label>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Victoria Park"
              className={inputClass}
              maxLength={200}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#B0B8C8]">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
              className={`${inputClass} resize-none`}
              maxLength={500}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#B0B8C8]">Team Size</label>
              <input
                type="number"
                min={1}
                max={11}
                value={teamSize}
                onChange={e => setTeamSize(Math.min(11, Math.max(1, Number(e.target.value))))}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#B0B8C8]">Wager / Player (coins)</label>
              <input
                type="number"
                min={0}
                value={wagerPerPlayer}
                onChange={e => setWagerPerPlayer(Math.max(0, Number(e.target.value)))}
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="w-4 h-4 text-[#00E0FF]" />
              <span className="text-white text-sm font-bold">Teams</span>
            </div>
            <div className="flex gap-3">
              <TeamSection
                label="Team A"
                players={teamA}
                friends={friends}
                friendsLoading={friendsLoading}
                allSelectedIds={allSelectedIds}
                onAdd={f => setTeamA(prev => [...prev, f])}
                onRemove={id => setTeamA(prev => prev.filter(p => p.id !== id))}
              />
              <TeamSection
                label="Team B"
                players={teamB}
                friends={friends}
                friendsLoading={friendsLoading}
                allSelectedIds={allSelectedIds}
                onAdd={f => setTeamB(prev => [...prev, f])}
                onRemove={id => setTeamB(prev => prev.filter(p => p.id !== id))}
              />
            </div>
          </div>

          {validationError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-xs">{validationError}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-[rgba(15,24,41,0.85)] text-[#B0B8C8] border border-[rgba(0,224,255,0.15)] hover:border-[rgba(0,224,255,0.35)] hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-[#00E0FF] text-black hover:bg-[#00c4e0] transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Match'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function FootballMatch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<Tab>('my_matches');
  const [showCreateModal, setShowCreateModal] = useState(false);

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
              onClick={() => setShowCreateModal(true)}
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
              myMatches.map(match => (
              <MatchCard
                key={match.id}
                match={match}
                userId={user.id}
                onResultSubmitted={async (matchId) => {
                  const { data } = await supabase
                    .from('football_matches')
                    .select('*')
                    .eq('id', matchId)
                    .maybeSingle();
                  if (data) {
                    setMyMatches(prev => prev.map(m => m.id === matchId ? data : m));
                  }
                }}
              />
            ))
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

      {showCreateModal && (
        <CreateMatchModal
          userId={user.id}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => { loadMyMatches(); setActiveTab('my_matches'); }}
        />
      )}
    </div>
  );
}
