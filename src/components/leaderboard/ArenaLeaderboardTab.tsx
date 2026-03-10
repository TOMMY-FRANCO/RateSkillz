import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { MapPin, Swords, Lock, User, Trophy, Coins, Loader2, Users } from 'lucide-react';
import { ShimmerBar, StaggerItem } from '../ui/Shimmer';
import { useArenaUnlocks } from '../../hooks/useArenaUnlocks';

const PAGE_SIZE = 20;

interface ArenaLeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  wins: number;
  losses: number;
  total_battles: number;
  total_earnings: number;
  win_rate: number;
}

const ARENA_TABS = [
  { slug: 'london', name: 'London' },
  { slug: 'manchester', name: 'Manchester' },
  { slug: 'liverpool', name: 'Liverpool' },
  { slug: 'birmingham', name: 'Birmingham' },
  { slug: 'leeds', name: 'Leeds' },
  { slug: 'bristol', name: 'Bristol' },
];

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toLocaleString();
}

export default function ArenaLeaderboardTab() {
  const navigate = useNavigate();
  const [selectedArena, setSelectedArena] = useState('london');
  const [entries, setEntries] = useState<ArenaLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { isUnlocked, getProgress, loading: countLoading, error: countError } = useArenaUnlocks();

  useEffect(() => {
    if (isUnlocked(selectedArena)) {
      fetchArenaLeaderboard(selectedArena, false);
    } else {
      setEntries([]);
      setHasMore(false);
      setLoading(false);
    }
  }, [selectedArena, countLoading]);

  const fetchArenaLeaderboard = async (arenaSlug: string, append: boolean) => {
    const offset = append ? entries.length : 0;
    if (!append) setLoading(true);
    setFetchError(null);
    try {
      const { data, error } = await supabase.rpc('get_arena_leaderboard', {
        p_arena_slug: arenaSlug,
        p_limit: PAGE_SIZE,
        p_offset: offset,
      });

      if (error) throw error;

      const mapped = (data || []).map((e: any) => ({
        user_id: e.user_id,
        username: e.username,
        avatar_url: e.avatar_url,
        wins: Number(e.wins),
        losses: Number(e.losses),
        total_battles: Number(e.total_battles),
        total_earnings: Number(e.total_earnings),
        win_rate: Number(e.win_rate),
      }));

      if (append) {
        setEntries(prev => [...prev, ...mapped]);
      } else {
        setEntries(mapped);
      }

      setHasMore((data || []).length === PAGE_SIZE);
    } catch (error) {
      console.error('Error fetching arena leaderboard:', error);
      setFetchError('Failed to load arena rankings. Please try again.');
      if (!append) setEntries([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await fetchArenaLeaderboard(selectedArena, true);
  };

  const handleArenaChange = (slug: string) => {
    setEntries([]);
    setHasMore(false);
    setSelectedArena(slug);
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return 'from-yellow-400 to-orange-500 border-yellow-300';
    if (rank === 2) return 'from-gray-300 to-gray-500 border-gray-200';
    if (rank === 3) return 'from-orange-600 to-orange-800 border-orange-400';
    return 'from-slate-600 to-slate-800 border-slate-500';
  };

  const arenaIsUnlocked = (slug: string) => isUnlocked(slug);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Swords className="w-6 h-6 text-red-400" />
        <div>
          <h3 className="text-lg font-bold text-white">Arena Rankings</h3>
          <p className="text-sm text-gray-400">Battle performance by arena</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
        {ARENA_TABS.map((arena) => {
          const unlocked = arenaIsUnlocked(arena.slug);
          return (
            <button
              key={arena.slug}
              onClick={() => handleArenaChange(arena.slug)}
              className={`
                flex items-center gap-1.5 px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition-all flex-shrink-0
                ${selectedArena === arena.slug
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/20'
                  : unlocked
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                    : 'bg-gray-900/50 text-gray-500 border border-gray-800 hover:bg-gray-800/50'}
              `}
            >
              {!unlocked && <Lock className="w-3 h-3" />}
              <MapPin className="w-3 h-3" />
              {arena.name}
            </button>
          );
        })}
      </div>

      {!arenaIsUnlocked(selectedArena) ? (
        <LockedArenaPanel
          arenaName={ARENA_TABS.find(a => a.slug === selectedArena)?.name || ''}
          slug={selectedArena}
          getProgress={getProgress}
          countLoading={countLoading}
          countError={countError}
        />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <StaggerItem key={i} index={i}>
              <div className="glass-card p-4">
                <div className="flex items-center gap-4">
                  <ShimmerBar className="w-10 h-10 rounded-lg" />
                  <ShimmerBar className="w-12 h-12 rounded-lg" />
                  <div className="flex-grow space-y-2">
                    <ShimmerBar className="h-4 w-32 rounded" />
                    <ShimmerBar className="h-3 w-20 rounded" speed="slow" />
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gray-800/50 border border-gray-700/50 mb-4">
            <Swords className="w-10 h-10 text-gray-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-400 mb-2">No battles yet</h3>
          <p className="text-gray-500 max-w-sm mx-auto">
            Be the first to battle in The {ARENA_TABS.find(a => a.slug === selectedArena)?.name} Arena!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, index) => {
            const rank = index + 1;
            const badgeColor = getRankBadge(rank);

            return (
              <div
                key={entry.user_id}
                onClick={() => navigate(`/profile/${entry.username}`)}
                className="glass-card p-4 cursor-pointer transition-all hover:border-gray-600"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br ${badgeColor} border flex items-center justify-center shadow-lg`}
                  >
                    <span className="text-lg font-black text-white drop-shadow">{rank}</span>
                    {rank <= 3 && (
                      <Trophy className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 text-yellow-300" />
                    )}
                  </div>

                  <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-800 border border-gray-700">
                    {entry.avatar_url ? (
                      <img
                        src={entry.avatar_url}
                        alt={entry.username}
                        width="48"
                        height="48"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-6 h-6 text-gray-600" />
                      </div>
                    )}
                  </div>

                  <div className="flex-grow min-w-0">
                    <h3 className="text-base font-bold text-white truncate">@{entry.username}</h3>
                    <p className="text-xs text-gray-400">{entry.total_battles} battles played</p>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-5 flex-shrink-0">
                    <div className="text-center">
                      <div className="text-lg font-black text-green-400">{entry.wins}</div>
                      <div className="text-[10px] text-gray-500 font-semibold">WINS</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-black text-red-400">{entry.losses}</div>
                      <div className="text-[10px] text-gray-500 font-semibold">LOSSES</div>
                    </div>
                    <div className="text-center hidden sm:block">
                      <div className="text-lg font-black text-cyan-400">{entry.win_rate}%</div>
                      <div className="text-[10px] text-gray-500 font-semibold">WIN%</div>
                    </div>
                    <div className="text-center hidden sm:block">
                      <div className="text-lg font-black text-yellow-400">{Math.floor(entry.total_earnings)}</div>
                      <div className="text-[10px] text-gray-500 font-semibold">
                        <Coins className="w-3 h-3 inline" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {fetchError && (
            <div className="text-center py-6">
              <p className="text-red-400 mb-3">{fetchError}</p>
              <button
                onClick={() => fetchArenaLeaderboard(selectedArena, false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {loadingMore && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            </div>
          )}

          {!loadingMore && hasMore && entries.length > 0 && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleLoadMore}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-colors border border-white/20"
              >
                Load More
              </button>
            </div>
          )}

          {!hasMore && entries.length > 0 && (
            <p className="text-center text-gray-500 text-sm py-4">All {entries.length} players loaded</p>
          )}
        </div>
      )}
    </div>
  );
}

function LockedArenaPanel({
  arenaName,
  slug,
  getProgress,
  countLoading,
  countError,
}: {
  arenaName: string;
  slug: string;
  getProgress: (slug: string) => { current: number; target: number; percent: number };
  countLoading: boolean;
  countError: string | null;
}) {
  const progress = getProgress(slug);

  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gray-800/50 border border-gray-700/50 mb-4">
        <Lock className="w-10 h-10 text-gray-500" />
      </div>
      <h3 className="text-xl font-bold text-gray-300 mb-2">
        {arenaName} Arena - Locked
      </h3>
      <p className="text-gray-500 max-w-sm mx-auto mb-6">
        This arena unlocks when the platform reaches {formatCount(progress.target)} registered users.
      </p>

      {countLoading ? (
        <div className="max-w-sm mx-auto">
          <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading progress...
          </div>
        </div>
      ) : countError ? (
        <div className="max-w-sm mx-auto">
          <p className="text-red-400/70 text-sm">{countError}</p>
        </div>
      ) : (
        <div className="max-w-sm mx-auto space-y-3">
          <div className="relative h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-700/50">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.max(progress.percent, 1)}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white drop-shadow-sm">
                {progress.percent.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm">
            <Users className="w-4 h-4 text-cyan-400" />
            <span className="text-gray-300 font-semibold">
              {progress.current.toLocaleString()}
            </span>
            <span className="text-gray-500">of</span>
            <span className="text-gray-300 font-semibold">
              {progress.target.toLocaleString()}
            </span>
            <span className="text-gray-500">users</span>
          </div>
        </div>
      )}
    </div>
  );
}
