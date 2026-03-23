import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { displayUsername } from '../lib/username';
import OnlineStatus from '../components/OnlineStatus';
import {
  ArrowLeft, RefreshCw, Loader2, CheckCircle, XCircle, AlertCircle,
  Trophy, Clock, Users, Coins, TrendingUp,
} from 'lucide-react';

interface PredictionMatch {
  id: string;
  fixture_id: number;
  home_team: string;
  away_team: string;
  home_crest: string | null;
  away_crest: string | null;
  match_date: string;
  status: string;
  result: string | null;
  created_at: string;
}

interface PredictionSlot {
  match_id: string;
  slots_taken: number;
}

interface UserPrediction {
  id: string;
  match_id: string;
  user_id: string;
  prediction: string;
  is_correct: boolean | null;
  coins_awarded: number;
  created_at: string;
  is_cancelled: boolean;
  cancelled_at: string | null;
  profile: {
    username: string;
    avatar_url: string | null;
    overall_rating: number;
    last_active: string | null;
  };
}

interface NotificationState {
  type: 'success' | 'error' | 'info';
  message: string;
}

const MAX_SLOTS = 100;

function TeamCrest({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="w-8 h-8 sm:w-10 sm:h-10 object-contain flex-shrink-0"
        loading="lazy"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-[#00E0FF] to-[#38BDF8] flex items-center justify-center text-black font-black text-xs flex-shrink-0">
      {name.charAt(0)}
    </div>
  );
}

function UserAvatar({
  src, name, onClick,
}: { src: string | null; name: string; onClick: () => void }) {
  return src ? (
    <img
      src={src}
      alt={name}
      onClick={onClick}
      className="w-9 h-9 rounded-full object-cover border-2 border-[rgba(0,224,255,0.3)] flex-shrink-0 cursor-pointer hover:border-[#00E0FF] transition-colors"
      loading="lazy"
    />
  ) : (
    <div
      onClick={onClick}
      className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00FF85] to-[#00E0FF] flex items-center justify-center text-black font-black text-sm border-2 border-[rgba(0,224,255,0.3)] flex-shrink-0 cursor-pointer hover:border-[#00E0FF] transition-colors"
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function MatchSkeleton() {
  return (
    <div className="glass-card p-4 sm:p-5 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-32 bg-white/10 rounded" />
        <div className="h-5 w-16 bg-white/10 rounded-full" />
      </div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col items-center gap-2 w-24">
          <div className="w-10 h-10 bg-white/10 rounded-full" />
          <div className="h-3 w-20 bg-white/10 rounded" />
        </div>
        <div className="h-6 w-12 bg-white/10 rounded" />
        <div className="flex flex-col items-center gap-2 w-24">
          <div className="w-10 h-10 bg-white/10 rounded-full" />
          <div className="h-3 w-20 bg-white/10 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map(i => <div key={i} className="h-10 bg-white/10 rounded-lg" />)}
      </div>
    </div>
  );
}

function PredictionRow({ pred, navigate }: { pred: UserPrediction; navigate: (path: string) => void }) {
  const pickLabel = pred.prediction === 'home' ? 'Home' : pred.prediction === 'away' ? 'Away' : 'Draw';
  return (
    <div className="flex items-center gap-2 py-2 border-b border-white/5 last:border-0">
      <UserAvatar
        src={pred.profile.avatar_url}
        name={pred.profile.username}
        onClick={() => navigate(`/profile/${pred.profile.username}`)}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-white text-xs font-semibold truncate">
            {displayUsername(pred.profile.username)}
          </span>
          <OnlineStatus lastActive={pred.profile.last_active} size="small" />
        </div>
        <p className="text-[#B0B8C8] text-[10px]">OVR {pred.profile.overall_rating ?? 50}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          pred.prediction === 'home'
            ? 'bg-[#00E0FF]/15 text-[#00E0FF]'
            : pred.prediction === 'away'
            ? 'bg-[#FF6B9D]/15 text-[#FF6B9D]'
            : 'bg-[#FFD700]/15 text-[#FFD700]'
        }`}>
          {pickLabel}
        </span>
        <span className="text-[#4A5568] text-[9px]">
          {new Date(pred.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

export default function Predictions() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [matches, setMatches] = useState<PredictionMatch[]>([]);
  const [slots, setSlots] = useState<Map<string, number>>(new Map());
  const [allPredictions, setAllPredictions] = useState<Map<string, UserPrediction[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const { data: matchData, error: matchError } = await supabase
        .from('prediction_matches')
        .select('*')
        .in('status', ['open', 'closed', 'settled'])
        .order('match_date', { ascending: true });

      if (matchError) throw matchError;

      const matchList = matchData || [];
      setMatches(matchList);

      if (matchList.length === 0) return;

      const matchIds = matchList.map(m => m.id);

      const [slotsResult, predsResult] = await Promise.all([
        supabase.from('prediction_slots').select('match_id, slots_taken').in('match_id', matchIds),
        supabase
          .from('predictions')
          .select('id, match_id, user_id, prediction, is_correct, coins_awarded, created_at, is_cancelled, cancelled_at')
          .in('match_id', matchIds)
          .eq('is_cancelled', false)
          .order('created_at', { ascending: true }),
      ]);

      if (slotsResult.error) throw slotsResult.error;
      if (predsResult.error) throw predsResult.error;

      const slotMap = new Map<string, number>();
      (slotsResult.data || []).forEach((s: PredictionSlot) => slotMap.set(s.match_id, s.slots_taken));
      setSlots(slotMap);

      const predRows = predsResult.data || [];
      if (predRows.length > 0) {
        const userIds = [...new Set(predRows.map((p: any) => p.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, overall_rating, last_active')
          .in('id', userIds);

        const profileMap = new Map((profilesData || []).map((p: any) => [p.id, p]));

        const predMap = new Map<string, UserPrediction[]>();
        for (const pred of predRows) {
          const prof = profileMap.get(pred.user_id);
          if (!prof) continue;
          const full: UserPrediction = { ...pred, profile: prof };
          const existing = predMap.get(pred.match_id) || [];
          existing.push(full);
          predMap.set(pred.match_id, existing);
        }
        setAllPredictions(predMap);
      } else {
        setAllPredictions(new Map());
      }
    } catch (err: any) {
      showNotification('error', 'Failed to load predictions. Pull to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await load();
  };

  const myPredictionForMatch = (matchId: string): UserPrediction | undefined => {
    const preds = allPredictions.get(matchId) || [];
    return preds.find(p => p.user_id === profile?.id);
  };

  const hasPredictedToday = (): boolean => {
    const today = new Date().toDateString();
    for (const preds of allPredictions.values()) {
      const mine = preds.find(p => p.user_id === profile?.id);
      if (mine && new Date(mine.created_at).toDateString() === today) return true;
    }
    return false;
  };

  const handleJoin = async (matchId: string, pick: 'home' | 'away' | 'draw') => {
    if (!profile) return;

    const match = matches.find(m => m.id === matchId);
    if (!match || match.status !== 'open') {
      showNotification('error', 'This match is no longer open for predictions.');
      return;
    }

    const slotsTaken = slots.get(matchId) || 0;
    if (slotsTaken >= MAX_SLOTS) {
      showNotification('error', 'This match is full (100 predictors max).');
      return;
    }

    if (hasPredictedToday()) {
      showNotification('error', 'You can only make one prediction per day.');
      return;
    }

    setActionLoading(`join-${matchId}`);
    try {
      const { error: insertError } = await supabase.from('predictions').insert({
        match_id: matchId,
        user_id: profile.id,
        prediction: pick,
      });
      if (insertError) throw insertError;

      await supabase
        .from('prediction_slots')
        .update({ slots_taken: slotsTaken + 1 })
        .eq('match_id', matchId);

      showNotification('success', 'Prediction placed!');
      await load();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to place prediction.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (matchId: string) => {
    if (!profile) return;
    const myPred = myPredictionForMatch(matchId);
    if (!myPred) return;

    const match = matches.find(m => m.id === matchId);
    if (!match || match.status !== 'open') {
      showNotification('error', 'You can only cancel predictions on open matches.');
      return;
    }

    setActionLoading(`cancel-${matchId}`);
    try {
      const { error } = await supabase
        .from('predictions')
        .update({ is_cancelled: true, cancelled_at: new Date().toISOString() })
        .eq('id', myPred.id);
      if (error) throw error;

      const slotsTaken = slots.get(matchId) || 0;
      await supabase
        .from('prediction_slots')
        .update({ slots_taken: Math.max(0, slotsTaken - 1) })
        .eq('match_id', matchId);

      showNotification('info', 'Prediction cancelled. You cannot rejoin this match.');
      await load();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to cancel prediction.');
    } finally {
      setActionLoading(null);
    }
  };

  const formatMatchDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) +
      ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const isMidnight = () => {
    const now = new Date();
    return now.getHours() === 0 && now.getMinutes() < 5;
  };

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
              <h1 className="text-xl font-bold text-white heading-glow">Predictions</h1>
            </div>
            <button
              onClick={handleRefresh}
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

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-4">
        <div className="glass-card p-4 border border-[rgba(0,224,255,0.15)]">
          <div className="flex items-start gap-3">
            <Trophy className="w-5 h-5 text-[#FFD700] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white text-sm font-semibold mb-0.5">How it works</p>
              <p className="text-[#B0B8C8] text-xs leading-relaxed">
                Pick the result for each open match — home win, away win, or draw.
                Max 100 entries per match. One prediction per day. Correct predictions
                earn you <span className="text-[#FFD700] font-semibold">10 coins</span> from
                the community pool once the result is settled.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map(i => <MatchSkeleton key={i} />)}
          </div>
        ) : matches.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <Trophy className="w-12 h-12 text-[#B0B8C8]/30 mx-auto mb-3" />
            <p className="text-[#B0B8C8] font-semibold">No prediction matches available</p>
            <p className="text-[#4A5568] text-sm mt-1">Check back soon — admins activate matches before kick-off.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map(match => {
              const myPred = myPredictionForMatch(match.id);
              const slotsTaken = slots.get(match.id) || 0;
              const preds = allPredictions.get(match.id) || [];
              const isOpen = match.status === 'open';
              const isSettled = match.status === 'settled';
              const isClosed = match.status === 'closed';
              const isFull = slotsTaken >= MAX_SLOTS;
              const alreadyJoined = !!myPred;
              const cancelledByMe = myPred?.is_cancelled;
              const todayUsed = !alreadyJoined && hasPredictedToday();
              const joinDisabled = !isOpen || alreadyJoined || isFull || todayUsed;
              const isExpanded = expandedMatch === match.id;

              const homeCount = preds.filter(p => p.prediction === 'home').length;
              const awayCount = preds.filter(p => p.prediction === 'away').length;
              const drawCount = preds.filter(p => p.prediction === 'draw').length;

              return (
                <div key={match.id} className="glass-card overflow-hidden">
                  <div className="p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-[#B0B8C8] text-xs">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatMatchDate(match.match_date)}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${
                        isOpen
                          ? 'bg-green-500/15 text-green-400'
                          : isClosed
                          ? 'bg-yellow-500/15 text-yellow-400'
                          : 'bg-[#B0B8C8]/10 text-[#B0B8C8]'
                      }`}>
                        {isOpen ? 'Open' : isClosed ? 'Pending' : 'Settled'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                        <TeamCrest src={match.home_crest} name={match.home_team} />
                        <span className="text-white text-xs font-semibold text-center leading-tight line-clamp-2">
                          {match.home_team}
                        </span>
                      </div>
                      <div className="text-center flex-shrink-0">
                        <span className="text-[#B0B8C8] font-bold text-lg">vs</span>
                        {isSettled && match.result && (
                          <div className="mt-1">
                            <span className="text-[10px] font-bold text-[#FFD700] bg-[#FFD700]/10 px-2 py-0.5 rounded-full uppercase">
                              {match.result === 'home' ? 'Home Won' : match.result === 'away' ? 'Away Won' : 'Draw'}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                        <TeamCrest src={match.away_crest} name={match.away_team} />
                        <span className="text-white text-xs font-semibold text-center leading-tight line-clamp-2">
                          {match.away_team}
                        </span>
                      </div>
                    </div>

                    {isSettled && alreadyJoined && !cancelledByMe && myPred && (
                      <div className={`mb-4 p-3 rounded-xl text-center ${
                        myPred.is_correct
                          ? 'bg-green-500/10 border border-green-500/30'
                          : 'bg-red-500/10 border border-red-500/30'
                      }`}>
                        {myPred.is_correct ? (
                          <div className="flex items-center justify-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            <span className="text-green-400 font-bold text-sm">
                              Correct! +{myPred.coins_awarded} coins earned
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <XCircle className="w-4 h-4 text-red-400" />
                            <span className="text-red-400 font-semibold text-sm">Incorrect prediction</span>
                          </div>
                        )}
                      </div>
                    )}

                    {isOpen && !alreadyJoined && !cancelledByMe && (
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {(['home', 'draw', 'away'] as const).map(pick => {
                          const label = pick === 'home' ? 'Home' : pick === 'draw' ? 'Draw' : 'Away';
                          const isLoading = actionLoading === `join-${match.id}`;
                          const disabled = joinDisabled || isLoading;
                          return (
                            <button
                              key={pick}
                              onClick={() => !disabled && handleJoin(match.id, pick)}
                              disabled={disabled}
                              className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                                disabled
                                  ? 'bg-white/5 text-[#4A5568] cursor-not-allowed'
                                  : pick === 'home'
                                  ? 'bg-[#00E0FF]/15 border border-[#00E0FF]/30 text-[#00E0FF] hover:bg-[#00E0FF]/25'
                                  : pick === 'away'
                                  ? 'bg-[#FF6B9D]/15 border border-[#FF6B9D]/30 text-[#FF6B9D] hover:bg-[#FF6B9D]/25'
                                  : 'bg-[#FFD700]/15 border border-[#FFD700]/30 text-[#FFD700] hover:bg-[#FFD700]/25'
                              }`}
                            >
                              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {isOpen && alreadyJoined && !cancelledByMe && myPred && (
                      <div className="flex items-center justify-between mb-3 p-3 rounded-xl bg-[rgba(0,224,255,0.05)] border border-[rgba(0,224,255,0.15)]">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-[#00E0FF]" />
                          <span className="text-white text-sm font-semibold">
                            Your pick: <span className={
                              myPred.prediction === 'home' ? 'text-[#00E0FF]' :
                              myPred.prediction === 'away' ? 'text-[#FF6B9D]' : 'text-[#FFD700]'
                            }>
                              {myPred.prediction === 'home' ? 'Home' : myPred.prediction === 'away' ? 'Away' : 'Draw'}
                            </span>
                          </span>
                        </div>
                        <button
                          onClick={() => handleCancel(match.id)}
                          disabled={actionLoading === `cancel-${match.id}`}
                          className="text-xs text-red-400 hover:text-red-300 font-semibold transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          {actionLoading === `cancel-${match.id}`
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <XCircle className="w-3.5 h-3.5" />}
                          Cancel
                        </button>
                      </div>
                    )}

                    {isClosed && alreadyJoined && !cancelledByMe && myPred && (
                      <div className="mb-3 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-center">
                        <p className="text-yellow-400 text-sm font-semibold">
                          Your pick: {myPred.prediction === 'home' ? 'Home' : myPred.prediction === 'away' ? 'Away' : 'Draw'} — awaiting result
                        </p>
                      </div>
                    )}

                    {todayUsed && !alreadyJoined && isOpen && (
                      <div className="mb-3 p-3 rounded-xl bg-[rgba(0,224,255,0.05)] border border-[rgba(0,224,255,0.15)] text-center">
                        <p className="text-[#B0B8C8] text-xs">You have already used your prediction for today.</p>
                      </div>
                    )}

                    {isFull && !alreadyJoined && isOpen && (
                      <div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                        <p className="text-red-400 text-xs font-semibold">Match is full (100/100 predictors)</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-[#B0B8C8]">
                        <div className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          <span>{slotsTaken}/{MAX_SLOTS}</span>
                        </div>
                        <span className="text-[#00E0FF]/60">H:{homeCount}</span>
                        <span className="text-[#FFD700]/60">D:{drawCount}</span>
                        <span className="text-[#FF6B9D]/60">A:{awayCount}</span>
                        {isOpen && (
                          <div className="flex items-center gap-1">
                            <Coins className="w-3 h-3 text-yellow-500" />
                            <span className="text-yellow-500">10 coins</span>
                          </div>
                        )}
                      </div>
                      {preds.length > 0 && (
                        <button
                          onClick={() => setExpandedMatch(isExpanded ? null : match.id)}
                          className="text-xs text-[#00E0FF] hover:text-white transition-colors font-semibold"
                        >
                          {isExpanded ? 'Hide' : `${preds.length} prediction${preds.length !== 1 ? 's' : ''}`}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && preds.length > 0 && (
                    <div className="px-4 sm:px-5 pb-4 border-t border-white/5 pt-3">
                      <p className="text-[10px] font-semibold text-[#B0B8C8] uppercase tracking-wider mb-2">
                        All Predictions
                      </p>
                      <div>
                        {preds.map(pred => (
                          <PredictionRow key={pred.id} pred={pred} navigate={navigate} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="text-gray-600 text-[10px] text-center mt-4">
          Football data provided by the Football-Data.org API
        </p>
      </main>
    </div>
  );
}
