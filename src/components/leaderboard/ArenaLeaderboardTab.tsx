import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { MapPin, Swords, Lock, User, Trophy, Coins } from 'lucide-react';
import { ShimmerBar, StaggerItem } from '../ui/Shimmer';

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
  { slug: 'london', name: 'London', isActive: true },
  { slug: 'manchester', name: 'Manchester', isActive: false },
  { slug: 'liverpool', name: 'Liverpool', isActive: false },
  { slug: 'birmingham', name: 'Birmingham', isActive: false },
  { slug: 'leeds', name: 'Leeds', isActive: false },
  { slug: 'bristol', name: 'Bristol', isActive: false },
];

export default function ArenaLeaderboardTab() {
  const navigate = useNavigate();
  const [selectedArena, setSelectedArena] = useState('london');
  const [entries, setEntries] = useState<ArenaLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const arena = ARENA_TABS.find((a) => a.slug === selectedArena);
    if (arena?.isActive) {
      fetchArenaLeaderboard(selectedArena);
    } else {
      setEntries([]);
      setLoading(false);
    }
  }, [selectedArena]);

  const fetchArenaLeaderboard = async (arenaSlug: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_arena_leaderboard', {
        p_arena_slug: arenaSlug,
        p_limit: 50,
      });

      if (error) throw error;

      setEntries(
        (data || []).map((e: any) => ({
          user_id: e.user_id,
          username: e.username,
          avatar_url: e.avatar_url,
          wins: Number(e.wins),
          losses: Number(e.losses),
          total_battles: Number(e.total_battles),
          total_earnings: Number(e.total_earnings),
          win_rate: Number(e.win_rate),
        }))
      );
    } catch (error) {
      console.error('Error fetching arena leaderboard:', error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const activeArena = ARENA_TABS.find((a) => a.slug === selectedArena);

  const getRankBadge = (rank: number) => {
    if (rank === 1) return 'from-yellow-400 to-orange-500 border-yellow-300';
    if (rank === 2) return 'from-gray-300 to-gray-500 border-gray-200';
    if (rank === 3) return 'from-orange-600 to-orange-800 border-orange-400';
    return 'from-slate-600 to-slate-800 border-slate-500';
  };

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
        {ARENA_TABS.map((arena) => (
          <button
            key={arena.slug}
            onClick={() => arena.isActive && setSelectedArena(arena.slug)}
            disabled={!arena.isActive}
            className={`
              flex items-center gap-1.5 px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition-all flex-shrink-0
              ${selectedArena === arena.slug
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/20'
                : arena.isActive
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                  : 'bg-gray-900/50 text-gray-600 cursor-not-allowed border border-gray-800'}
            `}
          >
            {!arena.isActive && <Lock className="w-3 h-3" />}
            <MapPin className="w-3 h-3" />
            {arena.name}
          </button>
        ))}
      </div>

      {!activeArena?.isActive ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gray-800/50 border border-gray-700/50 mb-4">
            <Lock className="w-10 h-10 text-gray-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-400 mb-2">Coming Soon (2026)</h3>
          <p className="text-gray-500 max-w-sm mx-auto">
            The {ARENA_TABS.find((a) => a.slug === selectedArena)?.name} Arena leaderboard will be available when the arena launches.
          </p>
        </div>
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
            Be the first to battle in The {activeArena.name} Arena!
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
        </div>
      )}
    </div>
  );
}
