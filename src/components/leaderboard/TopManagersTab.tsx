import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Search, Crown, User, Loader2 } from 'lucide-react';
import { VerificationBadge } from '../VerificationBadge';
import { ShimmerBar, StaggerItem, SlowLoadMessage } from '../ui/Shimmer';
import { SkeletonAvatar } from '../ui/SkeletonPresets';
import { RankChangeIndicator } from '../ui/HighValueSkeletons';

interface ManagerData {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  manager_wins: number;
  manager_losses: number;
  total_battle_earnings: number;
  overall_rating: number;
  team: string | null;
  is_verified: boolean;
  has_social_badge: boolean;
}

const MANAGERS_PER_PAGE = 20;

export default function TopManagersTab() {
  const navigate = useNavigate();
  const [managers, setManagers] = useState<ManagerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [winsFilter, setWinsFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const prevRanksRef = useRef<Map<string, number>>(new Map());

  const buildQuery = () => {
    let query = supabase
      .from('profiles')
      .select('*')
      .eq('is_manager', true);

    if (searchTerm) {
      query = query.or(`username.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`);
    }
    if (winsFilter) {
      query = query.gte('manager_wins', parseInt(winsFilter));
    }
    if (ratingFilter) {
      query = query.gte('overall_rating', parseInt(ratingFilter));
    }
    if (teamFilter) {
      query = query.ilike('team', `%${teamFilter}%`);
    }
    if (verifiedFilter === 'verified') {
      query = query.eq('is_verified', true);
    } else if (verifiedFilter === 'unverified') {
      query = query.eq('is_verified', false);
    }

    return query;
  };

  const fetchManagers = async (append = false) => {
    const offset = append ? managers.length : 0;
    if (!append) setLoading(true);
    setFetchError(null);
    try {
      const { data, error } = await buildQuery()
        .order('manager_wins', { ascending: false })
        .range(offset, offset + MANAGERS_PER_PAGE - 1);

      if (error) throw error;

      const formatted: ManagerData[] = (data || []).map((manager: any) => ({
        id: manager.id,
        username: manager.username,
        full_name: manager.full_name || '',
        avatar_url: manager.avatar_url || null,
        manager_wins: manager.manager_wins || 0,
        manager_losses: manager.manager_losses || 0,
        total_battle_earnings: parseFloat(manager.total_battle_earnings || 0),
        overall_rating: manager.overall_rating || 50,
        team: manager.team || null,
        is_verified: manager.is_verified || false,
        has_social_badge: manager.has_social_badge || false,
      }));

      const newRanks = new Map<string, number>(prevRanksRef.current);
      formatted.forEach((m, i) => {
        newRanks.set(m.id, offset + i + 1);
      });
      prevRanksRef.current = newRanks;

      if (append) {
        setManagers(prev => [...prev, ...formatted]);
      } else {
        setManagers(formatted);
      }

      setHasMore((data || []).length === MANAGERS_PER_PAGE);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching managers:', error);
      setFetchError('Failed to load managers. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setManagers([]);
    fetchManagers(false);
  }, [searchTerm, winsFilter, ratingFilter, teamFilter, verifiedFilter]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await fetchManagers(true);
  };

  const getWinLossRatio = (wins: number, losses: number) => {
    if (wins === 0 && losses === 0) return 0;
    if (losses === 0) return 100;
    return Math.round((wins / (wins + losses)) * 100);
  };

  const getTimeSinceUpdate = () => {
    const seconds = Math.floor((new Date().getTime() - lastUpdated.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  if (loading && managers.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <StaggerItem key={i} index={i}>
            <div className="bg-gradient-to-r from-gray-900/80 to-gray-800/80 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-4">
                <ShimmerBar className="w-12 h-8 rounded" speed="slow" />
                <SkeletonAvatar size="lg" shape="rounded" />
                <div className="flex-grow space-y-2">
                  <ShimmerBar className="h-4 w-40 rounded" />
                  <ShimmerBar className="h-3 w-24 rounded" speed="slow" />
                </div>
                <div className="hidden md:flex items-center gap-6">
                  {[0, 1, 2, 3, 4].map((j) => (
                    <div key={j} className="text-center space-y-1">
                      <ShimmerBar className="h-6 w-10 rounded mx-auto" />
                      <ShimmerBar className="h-3 w-12 rounded" speed="slow" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </StaggerItem>
        ))}
        <SlowLoadMessage loading={true} message="Loading managers..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Crown className="w-6 h-6 text-yellow-400" />
          <div>
            <h3 className="text-lg font-bold text-white">Top Managers</h3>
            <p className="text-sm text-gray-400">Updated {getTimeSinceUpdate()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search manager..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <select
          value={winsFilter}
          onChange={(e) => setWinsFilter(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
        >
          <option value="">All Wins</option>
          <option value="10">10+ Wins</option>
          <option value="50">50+ Wins</option>
          <option value="100">100+ Wins</option>
        </select>

        <select
          value={ratingFilter}
          onChange={(e) => setRatingFilter(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
        >
          <option value="">All Ratings</option>
          <option value="50">50+ OVR</option>
          <option value="60">60+ OVR</option>
          <option value="70">70+ OVR</option>
          <option value="80">80+ OVR</option>
          <option value="90">90+ OVR</option>
        </select>

        <input
          type="text"
          placeholder="Team name..."
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
        />

        <select
          value={verifiedFilter}
          onChange={(e) => setVerifiedFilter(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
        >
          <option value="">All Managers</option>
          <option value="verified">Verified Only</option>
          <option value="unverified">Unverified Only</option>
        </select>
      </div>

      {fetchError && (
        <div className="text-center py-6">
          <p className="text-red-400 mb-3">{fetchError}</p>
          <button
            onClick={() => fetchManagers(false)}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {managers.length === 0 && !fetchError ? (
        <div className="text-center py-12">
          <Crown className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-400 mb-2">No managers yet</h3>
          <p className="text-gray-500">No managers match your filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {managers.map((manager, index) => {
            const rank = index + 1;
            const winLossRatio = getWinLossRatio(manager.manager_wins, manager.manager_losses);

            return (
              <div
                key={manager.id}
                onClick={() => navigate(`/profile/${manager.username}`)}
                className="bg-gradient-to-r from-gray-900/80 to-gray-800/80 border border-gray-700 hover:border-gray-600 rounded-xl p-4 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 text-center">
                    <RankChangeIndicator
                      currentRank={rank}
                      previousRank={prevRanksRef.current.get(manager.id)}
                    />
                  </div>

                  <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-800 border-2 border-gray-700 relative">
                    {manager.avatar_url ? (
                      <img
                        src={manager.avatar_url}
                        alt={manager.username}
                        width="64"
                        height="64"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-8 h-8 text-gray-600" />
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full p-1">
                      <Crown className="w-4 h-4 text-black" />
                    </div>
                  </div>

                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-white truncate">
                        @{manager.username}
                      </h3>
                      <span className="px-2 py-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-xs font-bold rounded">
                        M
                      </span>
                      <VerificationBadge
                        isVerified={manager.is_verified}
                        hasSocialBadge={manager.has_social_badge}
                        size="sm"
                      />
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      {manager.team && (
                        <>
                          <span className="text-gray-600">•</span>
                          <span className="text-gray-300">{manager.team}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 flex-shrink-0">
                    <div className="text-center">
                      <div className="text-2xl font-black text-green-400">{manager.manager_wins}</div>
                      <div className="text-xs text-gray-500 font-semibold">WINS</div>
                    </div>

                    <div className="text-center">
                      <div className="text-2xl font-black text-red-400">{manager.manager_losses}</div>
                      <div className="text-xs text-gray-500 font-semibold">LOSSES</div>
                    </div>

                    <div className="text-center">
                      <div className="text-2xl font-black text-cyan-400">{winLossRatio}%</div>
                      <div className="text-xs text-gray-500 font-semibold">W/L RATIO</div>
                    </div>

                    <div className="text-center">
                      <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400">
                        {manager.overall_rating}
                      </div>
                      <div className="text-xs text-gray-500 font-semibold">OVR</div>
                    </div>

                    <div className="text-center">
                      <div className="text-2xl font-black text-yellow-400">{Math.floor(manager.total_battle_earnings)}</div>
                      <div className="text-xs text-gray-500 font-semibold">EARNED</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {loadingMore && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            </div>
          )}

          {!loadingMore && hasMore && managers.length > 0 && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleLoadMore}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-colors border border-white/20"
              >
                Load More
              </button>
            </div>
          )}

          {!hasMore && managers.length > 0 && (
            <p className="text-center text-gray-500 text-sm py-4">All {managers.length} managers loaded</p>
          )}
        </div>
      )}
    </div>
  );
}
