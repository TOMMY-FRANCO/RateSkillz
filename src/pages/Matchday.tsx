import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, AlertCircle, RotateCcw } from 'lucide-react';

type Tab = 'table' | 'fixtures' | 'results' | 'scorers';

interface TabData {
  data: unknown | null;
  lastUpdated: Date | null;
  error: string | null;
  loaded: boolean;
}

interface StandingRow {
  position: number;
  team: { id: number; name: string; crest: string };
  playedGames: number;
  goalDifference: number;
  points: number;
}

interface MatchTeam {
  id: number;
  name: string;
  crest: string;
}

interface Match {
  id: number;
  matchday: number;
  utcDate: string;
  homeTeam: MatchTeam;
  awayTeam: MatchTeam;
}

interface MatchScore {
  home: number | null;
  away: number | null;
}

interface FinishedMatch {
  id: number;
  matchday: number;
  utcDate: string;
  homeTeam: MatchTeam;
  awayTeam: MatchTeam;
  score: { fullTime: MatchScore };
}

interface Scorer {
  player: { id: number; name: string };
  team: { id: number; name: string; crest: string };
  goals: number;
  assists: number | null;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'table', label: 'Table' },
  { id: 'fixtures', label: 'Fixtures' },
  { id: 'results', label: 'Results' },
  { id: 'scorers', label: 'Top Scorers' },
];

const API_BASE = 'https://api.football-data.org/v4';
const API_KEY = import.meta.env.VITE_FOOTBALL_DATA_API_KEY;

function ShimmerBar() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="glass-container p-4 rounded-xl animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-6 h-4 bg-[rgba(0,224,255,0.08)] rounded" />
            <div className="flex-1 h-4 bg-[rgba(0,224,255,0.08)] rounded" />
            <div className="w-20 h-4 bg-[rgba(0,224,255,0.08)] rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
    ' · ' + date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function formatMatchDate(utcDate: string): { date: string; time: string } {
  const d = new Date(utcDate);
  const date = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
  return { date, time };
}

function rowBorderClass(pos: number, total: number): string {
  if (pos <= 4) return 'border-l-2 border-l-[rgba(0,224,255,0.4)]';
  if (pos > total - 3) return 'border-l-2 border-l-red-500/40';
  return 'border-l-2 border-l-transparent';
}

function LeagueTable({ data }: { data: unknown }) {
  const standings = (data as { standings: { type: string; table: StandingRow[] }[] }).standings;
  const table = standings?.find(s => s.type === 'TOTAL')?.table ?? [];
  const total = table.length;

  return (
    <div className="glass-container rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[rgba(0,224,255,0.1)] text-[#B0B8C8] text-xs font-semibold">
        <span className="w-6 text-center">#</span>
        <span className="flex-1">Team</span>
        <span className="w-7 text-center">P</span>
        <span className="w-7 text-center">GD</span>
        <span className="w-8 text-center font-bold text-white">Pts</span>
      </div>

      {table.map((row) => (
        <div
          key={row.team.id}
          className={`flex items-center gap-2 px-3 py-2.5 border-b border-[rgba(255,255,255,0.04)] last:border-b-0 ${rowBorderClass(row.position, total)} ${row.position === 1 ? 'text-yellow-400' : 'text-white'}`}
        >
          <span className={`w-6 text-center text-xs font-semibold ${row.position === 1 ? 'text-yellow-400' : 'text-[#B0B8C8]'}`}>
            {row.position}
          </span>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <img
              src={row.team.crest}
              alt={row.team.name}
              className="w-6 h-6 object-contain flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <span className={`text-sm truncate ${row.position === 1 ? 'text-yellow-400 font-semibold' : 'text-white'}`}>
              {row.team.name}
            </span>
          </div>
          <span className="w-7 text-center text-xs text-[#B0B8C8]">{row.playedGames}</span>
          <span className={`w-7 text-center text-xs ${row.goalDifference > 0 ? 'text-green-400' : row.goalDifference < 0 ? 'text-red-400' : 'text-[#B0B8C8]'}`}>
            {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
          </span>
          <span className={`w-8 text-center text-sm font-bold ${row.position === 1 ? 'text-yellow-400' : 'text-white'}`}>
            {row.points}
          </span>
        </div>
      ))}

      {/* Legend */}
      <div className="px-3 py-3 border-t border-[rgba(0,224,255,0.1)] flex flex-wrap gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5 text-xs text-[#B0B8C8]">
          <span className="w-2.5 h-2.5 rounded-sm bg-[rgba(0,224,255,0.4)]" /> Champions League
        </span>
        <span className="flex items-center gap-1.5 text-xs text-[#B0B8C8]">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500/40" /> Relegation
        </span>
      </div>
    </div>
  );
}

function FixturesList({ data }: { data: unknown }) {
  const allMatches: Match[] = (data as { matches: Match[] }).matches ?? [];
  const upcoming = allMatches.slice(0, 10);

  const grouped = upcoming.reduce<Record<number, Match[]>>((acc, m) => {
    if (!acc[m.matchday]) acc[m.matchday] = [];
    acc[m.matchday].push(m);
    return acc;
  }, {});

  const matchdays = Object.keys(grouped).map(Number).sort((a, b) => a - b);

  if (upcoming.length === 0) {
    return (
      <div className="glass-container rounded-xl p-8 text-center text-[#B0B8C8] text-sm">
        No upcoming fixtures found.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {matchdays.map(md => (
        <div key={md} className="glass-container rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[rgba(0,224,255,0.1)]">
            <span className="text-xs font-bold text-[#00E0FF] uppercase tracking-wider">
              Matchday {md}
            </span>
          </div>
          <div className="divide-y divide-[rgba(255,255,255,0.04)]">
            {grouped[md].map(match => {
              const { date, time } = formatMatchDate(match.utcDate);
              return (
                <div key={match.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    {/* Home */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                      <span className="text-sm text-white truncate text-right">{match.homeTeam.name}</span>
                      <img
                        src={match.homeTeam.crest}
                        alt={match.homeTeam.name}
                        className="w-6 h-6 object-contain flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>

                    {/* vs */}
                    <div className="flex flex-col items-center flex-shrink-0 px-2 min-w-[56px]">
                      <span className="text-xs font-bold text-[#B0B8C8]">vs</span>
                      <span className="text-[10px] text-[#B0B8C8] whitespace-nowrap">{time}</span>
                    </div>

                    {/* Away */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-start">
                      <img
                        src={match.awayTeam.crest}
                        alt={match.awayTeam.name}
                        className="w-6 h-6 object-contain flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <span className="text-sm text-white truncate">{match.awayTeam.name}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-[#B0B8C8] text-center mt-1">{date}</p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ResultsList({ data }: { data: unknown }) {
  const allMatches: FinishedMatch[] = (data as { matches: FinishedMatch[] }).matches ?? [];
  const recent = [...allMatches].reverse().slice(0, 10);

  if (recent.length === 0) {
    return (
      <div className="glass-container rounded-xl p-8 text-center text-[#B0B8C8] text-sm">
        No results found.
      </div>
    );
  }

  return (
    <div className="glass-container rounded-xl overflow-hidden">
      <div className="divide-y divide-[rgba(255,255,255,0.04)]">
        {recent.map(match => {
          const hg = match.score.fullTime.home ?? 0;
          const ag = match.score.fullTime.away ?? 0;
          const homeName = match.homeTeam.name;
          const awayName = match.awayTeam.name;

          let homeColor = 'text-[#B0B8C8]';
          let awayColor = 'text-[#B0B8C8]';
          if (hg > ag) { homeColor = 'text-[#00FF85]'; awayColor = 'text-red-400'; }
          else if (ag > hg) { awayColor = 'text-[#00FF85]'; homeColor = 'text-red-400'; }

          const { date } = formatMatchDate(match.utcDate);

          return (
            <div key={match.id} className="px-4 py-3">
              <div className="flex items-center gap-2">
                {/* Home */}
                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                  <span className={`text-sm truncate text-right font-medium ${homeColor}`}>{homeName}</span>
                  <img
                    src={match.homeTeam.crest}
                    alt={homeName}
                    className="w-6 h-6 object-contain flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>

                {/* Score */}
                <div className="flex items-center gap-1.5 flex-shrink-0 px-2">
                  <span className={`text-base font-bold ${homeColor}`}>{hg}</span>
                  <span className="text-[#B0B8C8] text-xs font-semibold">-</span>
                  <span className={`text-base font-bold ${awayColor}`}>{ag}</span>
                </div>

                {/* Away */}
                <div className="flex items-center gap-2 flex-1 min-w-0 justify-start">
                  <img
                    src={match.awayTeam.crest}
                    alt={awayName}
                    className="w-6 h-6 object-contain flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className={`text-sm truncate font-medium ${awayColor}`}>{awayName}</span>
                </div>
              </div>
              <p className="text-[10px] text-[#B0B8C8] text-center mt-1">{date}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopScorersList({ data }: { data: unknown }) {
  const scorers: Scorer[] = (data as { scorers: Scorer[] }).scorers ?? [];

  if (scorers.length === 0) {
    return (
      <div className="glass-container rounded-xl p-8 text-center text-[#B0B8C8] text-sm">
        No scorers data found.
      </div>
    );
  }

  return (
    <div className="glass-container rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[rgba(0,224,255,0.1)] text-[#B0B8C8] text-xs font-semibold">
        <span className="w-6 text-center">#</span>
        <span className="flex-1">Player</span>
        <span className="w-20 truncate text-right">Club</span>
        <span className="w-8 text-center text-[#00FF85]">G</span>
        <span className="w-8 text-center">A</span>
      </div>

      <div className="divide-y divide-[rgba(255,255,255,0.04)]">
        {scorers.map((scorer, i) => {
          const rank = i + 1;
          const isTop = rank === 1;
          return (
            <div key={scorer.player.id} className="flex items-center gap-2 px-3 py-2.5">
              <span className={`w-6 text-center text-xs font-semibold flex-shrink-0 ${isTop ? 'text-yellow-400' : 'text-[#B0B8C8]'}`}>
                {rank}
              </span>
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium truncate block ${isTop ? 'text-yellow-400' : 'text-white'}`}>
                  {scorer.player.name}
                </span>
              </div>
              <div className="flex items-center gap-1.5 w-20 justify-end flex-shrink-0">
                <span className={`text-xs truncate text-right ${isTop ? 'text-yellow-400' : 'text-[#B0B8C8]'}`}>
                  {scorer.team.name}
                </span>
                <img
                  src={scorer.team.crest}
                  alt={scorer.team.name}
                  className="w-5 h-5 object-contain flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <span className={`w-8 text-center text-sm font-bold flex-shrink-0 ${isTop ? 'text-yellow-400' : 'text-[#00FF85]'}`}>
                {scorer.goals}
              </span>
              <span className="w-8 text-center text-xs text-[#B0B8C8] flex-shrink-0">
                {scorer.assists ?? 0}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Matchday() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('table');
  const [loading, setLoading] = useState<Record<Tab, boolean>>({
    table: false, fixtures: false, results: false, scorers: false,
  });
  const [tabData, setTabData] = useState<Record<Tab, TabData>>({
    table:    { data: null, lastUpdated: null, error: null, loaded: false },
    fixtures: { data: null, lastUpdated: null, error: null, loaded: false },
    results:  { data: null, lastUpdated: null, error: null, loaded: false },
    scorers:  { data: null, lastUpdated: null, error: null, loaded: false },
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchTab = useCallback(async (tab: Tab) => {
    setLoading(prev => ({ ...prev, [tab]: true }));
    setTabData(prev => ({ ...prev, [tab]: { ...prev[tab], error: null } }));

    try {
      let url = '';
      if (tab === 'table')    url = `${API_BASE}/competitions/PL/standings`;
      if (tab === 'fixtures') url = `${API_BASE}/competitions/PL/matches?status=SCHEDULED`;
      if (tab === 'results')  url = `${API_BASE}/competitions/PL/matches?status=FINISHED`;
      if (tab === 'scorers')  url = `${API_BASE}/competitions/PL/scorers?limit=20`;

      const res = await fetch(url, {
        headers: { 'X-Auth-Token': API_KEY ?? '' },
      });

      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();

      setTabData(prev => ({
        ...prev,
        [tab]: { data, lastUpdated: new Date(), error: null, loaded: true },
      }));
    } catch (err) {
      setTabData(prev => ({
        ...prev,
        [tab]: {
          ...prev[tab],
          error: err instanceof Error ? err.message : 'Failed to load data',
          loaded: false,
        },
      }));
    } finally {
      setLoading(prev => ({ ...prev, [tab]: false }));
    }
  }, []);

  const handleTabSelect = useCallback((tab: Tab) => {
    setActiveTab(tab);
    if (!tabData[tab].loaded && !loading[tab]) {
      fetchTab(tab);
    }
  }, [tabData, loading, fetchTab]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setTabData(prev => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], loaded: false },
    }));
    try {
      await fetchTab(activeTab);
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [isRefreshing, activeTab, fetchTab]);

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

  const current = tabData[activeTab];
  const isLoading = loading[activeTab];

  if (!tabData['table'].loaded && !loading['table']) {
    fetchTab('table');
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
              <h1 className="text-xl font-bold text-white">Matchday</h1>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="text-[#B0B8C8] hover:text-white transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </nav>

      {pullDistance > 0 && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-gradient-to-b from-gray-900/90 to-transparent"
          style={{ height: `${pullDistance}px`, opacity: pullDistance / 100 }}
        >
          <RefreshCw className={`w-6 h-6 text-white ${isRefreshing ? 'animate-spin' : ''}`} />
        </div>
      )}

      <div
        ref={containerRef}
        className="min-h-screen pb-28 overflow-y-auto"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">

          {/* Tab bar */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabSelect(tab.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-[#00E0FF] to-[#38BDF8] text-black font-bold'
                    : 'bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] text-[#B0B8C8] hover:border-[rgba(0,224,255,0.4)] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div>
            {isLoading && <ShimmerBar />}

            {!isLoading && current.error && (
              <div className="glass-container rounded-xl p-6 flex flex-col items-center gap-4 text-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
                <p className="text-[#B0B8C8] text-sm">{current.error}</p>
                <button
                  onClick={() => fetchTab(activeTab)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] text-[#B0B8C8] hover:border-[rgba(0,224,255,0.4)] hover:text-white transition-all text-sm"
                >
                  <RotateCcw className="w-4 h-4" />
                  Retry
                </button>
              </div>
            )}

            {!isLoading && !current.error && current.loaded && (
              <>
                {activeTab === 'table'    && <LeagueTable data={current.data} />}
                {activeTab === 'fixtures' && <FixturesList data={current.data} />}
                {activeTab === 'results'  && <ResultsList data={current.data} />}
                {activeTab === 'scorers'  && <TopScorersList data={current.data} />}
              </>
            )}
          </div>

          {/* Last updated timestamp */}
          {current.lastUpdated && !isLoading && (
            <p className="text-[#B0B8C8] text-xs text-center mt-6">
              Last updated {formatTimestamp(current.lastUpdated)}
            </p>
          )}

        </div>
      </div>
    </div>
  );
}
