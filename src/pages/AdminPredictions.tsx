import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  ArrowLeft, RefreshCw, Loader2, CheckCircle, XCircle, AlertCircle,
  Trophy, Clock, Users, Zap, Lock, ShieldCheck,
} from 'lucide-react';

interface MatchdayFixture {
  id: number;
  utcDate: string;
  status: string;
  homeTeam: { name: string; shortName: string; crest: string };
  awayTeam: { name: string; shortName: string; crest: string };
  matchday: number;
}

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
}

interface PredictionSlot {
  match_id: string;
  slots_taken: number;
}

interface NotificationState {
  type: 'success' | 'error' | 'info';
  message: string;
}

const ADMIN_USERNAMES = ['test123', 'tommy_franco'];

function TeamCrest({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="w-8 h-8 object-contain flex-shrink-0"
        loading="lazy"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00E0FF] to-[#38BDF8] flex items-center justify-center text-black font-black text-xs flex-shrink-0">
      {name.charAt(0)}
    </div>
  );
}

function FixtureSkeleton() {
  return (
    <div className="glass-card p-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-8 h-8 bg-white/10 rounded-full" />
          <div className="h-4 w-28 bg-white/10 rounded" />
          <div className="h-4 w-8 bg-white/10 rounded" />
          <div className="h-4 w-28 bg-white/10 rounded" />
          <div className="w-8 h-8 bg-white/10 rounded-full" />
        </div>
        <div className="h-9 w-20 bg-white/10 rounded-lg ml-3" />
      </div>
    </div>
  );
}

export default function AdminPredictions() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [fixtures, setFixtures] = useState<MatchdayFixture[]>([]);
  const [activatedMatches, setActivatedMatches] = useState<PredictionMatch[]>([]);
  const [slots, setSlots] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [settleTarget, setSettleTarget] = useState<PredictionMatch | null>(null);
  const [notification, setNotification] = useState<NotificationState | null>(null);

  const isAdmin = profile && ADMIN_USERNAMES.includes(profile.username);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const load = useCallback(async () => {
    try {
      const [cacheResult, matchesResult] = await Promise.all([
        supabase
          .from('matchday_cache')
          .select('data')
          .eq('competition_code', 'PL')
          .eq('data_type', 'fixtures')
          .maybeSingle(),
        supabase
          .from('prediction_matches')
          .select('*')
          .order('match_date', { ascending: true }),
      ]);

      if (cacheResult.data?.data?.matches) {
        const raw: MatchdayFixture[] = cacheResult.data.data.matches;
        const upcoming = raw
          .filter((f: MatchdayFixture) => f.status === 'TIMED' || f.status === 'SCHEDULED')
          .sort((a: MatchdayFixture, b: MatchdayFixture) =>
            new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
          );
        setFixtures(upcoming);
      }

      const matchList = matchesResult.data || [];
      setActivatedMatches(matchList);

      if (matchList.length > 0) {
        const { data: slotsData } = await supabase
          .from('prediction_slots')
          .select('match_id, slots_taken')
          .in('match_id', matchList.map((m: PredictionMatch) => m.id));

        const slotMap = new Map<string, number>();
        (slotsData || []).forEach((s: PredictionSlot) => slotMap.set(s.match_id, s.slots_taken));
        setSlots(slotMap);
      }
    } catch (err: any) {
      showNotification('error', 'Failed to load data. Please refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    load();
  }, [isAdmin, load]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await load();
  };

  const isAlreadyActivated = (fixtureId: number) =>
    activatedMatches.some(m => m.fixture_id === fixtureId);

  const getActivatedMatch = (fixtureId: number) =>
    activatedMatches.find(m => m.fixture_id === fixtureId);

  const handleActivate = async (fixture: MatchdayFixture) => {
    if (isAlreadyActivated(fixture.id)) return;
    setActionLoading(`activate-${fixture.id}`);
    try {
      const { data: matchData, error: matchError } = await supabase
        .from('prediction_matches')
        .insert({
          fixture_id: fixture.id,
          home_team: fixture.homeTeam.shortName || fixture.homeTeam.name,
          away_team: fixture.awayTeam.shortName || fixture.awayTeam.name,
          home_crest: fixture.homeTeam.crest || null,
          away_crest: fixture.awayTeam.crest || null,
          match_date: fixture.utcDate,
          status: 'open',
          activated_by: profile?.id,
        })
        .select()
        .single();

      if (matchError) throw matchError;

      const { error: slotError } = await supabase
        .from('prediction_slots')
        .insert({ match_id: matchData.id, slots_taken: 0 });

      if (slotError) throw slotError;

      showNotification('success', `${fixture.homeTeam.shortName} vs ${fixture.awayTeam.shortName} activated for predictions!`);
      await load();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to activate match.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleClose = async (match: PredictionMatch) => {
    if (match.status !== 'open') return;
    setActionLoading(`close-${match.id}`);
    try {
      const { error } = await supabase
        .from('prediction_matches')
        .update({ status: 'closed' })
        .eq('id', match.id);
      if (error) throw error;
      showNotification('info', 'Predictions closed. Set the result when ready.');
      await load();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to close predictions.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSettle = async (result: 'home' | 'away' | 'draw') => {
    if (!settleTarget) return;
    setActionLoading(`settle-${settleTarget.id}`);
    try {
      const { data, error } = await supabase.rpc('settle_prediction_match', {
        p_match_id: settleTarget.id,
        p_result: result,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Settlement failed');
      showNotification(
        'success',
        `Match settled! ${data.winners_paid} winner(s) paid ${data.coins_per_winner} coins each.`
      );
      setSettleTarget(null);
      await load();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to settle match.');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) +
      ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card p-8 text-center max-w-sm">
          <ShieldCheck className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-white font-bold mb-1">Access Denied</p>
          <p className="text-[#B0B8C8] text-sm mb-4">You do not have permission to view this page.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2.5 bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black font-bold rounded-xl text-sm"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

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
              <h1 className="text-xl font-bold text-white heading-glow">Admin Predictions</h1>
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

      {settleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card p-6 max-w-sm w-full">
            <h2 className="text-white font-bold text-lg mb-1">Set Match Result</h2>
            <p className="text-[#B0B8C8] text-sm mb-4">
              {settleTarget.home_team} vs {settleTarget.away_team}
            </p>
            <div className="space-y-2 mb-4">
              {(['home', 'draw', 'away'] as const).map(pick => {
                const label = pick === 'home'
                  ? `Home Win — ${settleTarget.home_team}`
                  : pick === 'away'
                  ? `Away Win — ${settleTarget.away_team}`
                  : 'Draw';
                const isLoading = actionLoading === `settle-${settleTarget.id}`;
                return (
                  <button
                    key={pick}
                    onClick={() => !isLoading && handleSettle(pick)}
                    disabled={isLoading}
                    className={`w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 ${
                      pick === 'home'
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
            <button
              onClick={() => setSettleTarget(null)}
              className="w-full py-2.5 bg-white/5 border border-white/10 text-[#B0B8C8] text-sm rounded-xl hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-6">
        {activatedMatches.filter(m => m.status !== 'settled').length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-[#B0B8C8] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#FFD700]" />
              Active Prediction Matches
            </h2>
            <div className="space-y-3">
              {activatedMatches
                .filter(m => m.status !== 'settled')
                .map(match => {
                  const slotsTaken = slots.get(match.id) || 0;
                  const isOpen = match.status === 'open';
                  const isClosing = actionLoading === `close-${match.id}`;
                  const isSettling = actionLoading === `settle-${match.id}`;

                  return (
                    <div key={match.id} className="glass-card p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <TeamCrest src={match.home_crest} name={match.home_team} />
                          <span className="text-white text-sm font-semibold truncate">{match.home_team}</span>
                          <span className="text-[#B0B8C8] text-xs font-bold flex-shrink-0">vs</span>
                          <span className="text-white text-sm font-semibold truncate">{match.away_team}</span>
                          <TeamCrest src={match.away_crest} name={match.away_team} />
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                          isOpen ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'
                        }`}>
                          {isOpen ? 'Open' : 'Closed'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-2 text-xs text-[#B0B8C8]">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(match.match_date)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>{slotsTaken}/100 predictors</span>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-3">
                        {isOpen && (
                          <button
                            onClick={() => handleClose(match)}
                            disabled={isClosing}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-semibold text-sm rounded-xl hover:bg-yellow-500/20 disabled:opacity-50 transition-all"
                          >
                            {isClosing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                            Close Predictions
                          </button>
                        )}
                        <button
                          onClick={() => setSettleTarget(match)}
                          disabled={isSettling || match.status === 'open'}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black font-bold text-sm rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          {isSettling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                          Set Result & Pay
                        </button>
                      </div>
                      {match.status === 'open' && (
                        <p className="text-[10px] text-[#4A5568] mt-2 text-center">Close predictions before setting result</p>
                      )}
                    </div>
                  );
                })}
            </div>
          </section>
        )}

        {activatedMatches.filter(m => m.status === 'settled').length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-[#B0B8C8] uppercase tracking-wider mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              Settled Matches
            </h2>
            <div className="space-y-2">
              {activatedMatches
                .filter(m => m.status === 'settled')
                .map(match => (
                  <div key={match.id} className="glass-card p-3 flex items-center gap-3">
                    <TeamCrest src={match.home_crest} name={match.home_team} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">
                        {match.home_team} vs {match.away_team}
                      </p>
                      <p className="text-[#B0B8C8] text-xs">{formatDate(match.match_date)}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFD700]/15 text-[#FFD700] flex-shrink-0">
                      {match.result === 'home' ? 'Home Won' : match.result === 'away' ? 'Away Won' : 'Draw'}
                    </span>
                  </div>
                ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold text-[#B0B8C8] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Upcoming PL Fixtures
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2, 4, 5].map(i => <FixtureSkeleton key={i} />)}
            </div>
          ) : fixtures.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <Clock className="w-10 h-10 text-[#B0B8C8]/30 mx-auto mb-3" />
              <p className="text-[#B0B8C8] text-sm">No upcoming fixtures found in cache.</p>
              <p className="text-[#4A5568] text-xs mt-1">The matchday cache may need refreshing.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {fixtures.map(fixture => {
                const activated = isAlreadyActivated(fixture.id);
                const activatedMatch = getActivatedMatch(fixture.id);
                const isLoading = actionLoading === `activate-${fixture.id}`;

                return (
                  <div key={fixture.id} className="glass-card p-3 sm:p-4">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <TeamCrest src={fixture.homeTeam.crest} name={fixture.homeTeam.name} />
                        <span className="text-white text-sm font-semibold truncate">
                          {fixture.homeTeam.shortName}
                        </span>
                        <span className="text-[#B0B8C8] text-xs font-bold flex-shrink-0">vs</span>
                        <span className="text-white text-sm font-semibold truncate">
                          {fixture.awayTeam.shortName}
                        </span>
                        <TeamCrest src={fixture.awayTeam.crest} name={fixture.awayTeam.name} />
                      </div>
                      <button
                        onClick={() => !activated && handleActivate(fixture)}
                        disabled={activated || isLoading}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                          activated
                            ? 'bg-green-500/10 border border-green-500/30 text-green-400 cursor-default'
                            : 'bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black hover:opacity-90 disabled:opacity-50'
                        }`}
                      >
                        {isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : activated ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" />
                            {activatedMatch?.status === 'open' ? 'Open' : activatedMatch?.status === 'closed' ? 'Closed' : 'Settled'}
                          </>
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5" />
                            Activate
                          </>
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-1 mt-1.5 text-[10px] text-[#4A5568]">
                      <Clock className="w-3 h-3" />
                      <span>MD{fixture.matchday} · {formatDate(fixture.utcDate)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
