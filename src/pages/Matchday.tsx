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
      if (tab === 'scorers')  url = `${API_BASE}/competitions/PL/scorers`;

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
                {activeTab === 'table'    && <div>{/* Table content — placeholder */}</div>}
                {activeTab === 'fixtures' && <div>{/* Fixtures content — placeholder */}</div>}
                {activeTab === 'results'  && <div>{/* Results content — placeholder */}</div>}
                {activeTab === 'scorers'  && <div>{/* Top Scorers content — placeholder */}</div>}
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
