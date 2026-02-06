import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Search, ChevronLeft, ChevronRight, Crown, User, Trophy, CheckCircle2 } from 'lucide-react';
import { displayUsername } from '../../lib/username';
import { VerificationBadge } from '../VerificationBadge';
import { ShimmerBar, StaggerItem, SlowLoadMessage } from '../ui/Shimmer';
import { SkeletonAvatar } from '../ui/SkeletonPresets';

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
  const [totalManagers, setTotalManagers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [winsFilter, setWinsFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchManagers = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('is_manager', true);

      if (searchTerm) {
        query = query.or(`username.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`);
      }

      if (winsFilter) {
        const minWins = parseInt(winsFilter);
        query = query.gte('manager_wins', minWins);
      }

      if (ratingFilter) {
        const minRating = parseInt(ratingFilter);
        query = query.gte('overall_rating', minRating);
      }

      if (teamFilter) {
        query = query.ilike('team', `%${teamFilter}%`);
      }

      if (verifiedFilter === 'verified') {
        query = query.eq('is_verified', true);
      } else if (verifiedFilter === 'unverified') {
        query = query.eq('is_verified', false);
      }

      const { count } = await query;
      setTotalManagers(count || 0);

      const from = (currentPage - 1) * MANAGERS_PER_PAGE;
      const to = from + MANAGERS_PER_PAGE - 1;

      const { data, error } = await query
        .order('manager_wins', { ascending: false })
        .range(from, to);

      if (error) throw error;

      if (data) {
        const formattedManagers: ManagerData[] = data.map((manager: any) => ({
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

        setManagers(formattedManagers);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching managers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManagers();
  }, [currentPage, searchTerm, winsFilter, ratingFilter, teamFilter, verifiedFilter]);

  const totalPages = Math.ceil(totalManagers / MANAGERS_PER_PAGE);

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
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <select
          value={winsFilter}
          onChange={(e) => {
            setWinsFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
        >
          <option value="">All Wins</option>
          <option value="10">10+ Wins</option>
          <option value="50">50+ Wins</option>
          <option value="100">100+ Wins</option>
        </select>

        <select
          value={ratingFilter}
          onChange={(e) => {
            setRatingFilter(e.target.value);
            setCurrentPage(1);
          }}
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
          onChange={(e) => {
            setTeamFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
        />

        <select
          value={verifiedFilter}
          onChange={(e) => {
            setVerifiedFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
        >
          <option value="">All Managers</option>
          <option value="verified">Verified Only</option>
          <option value="unverified">Unverified Only</option>
        </select>
      </div>

      {managers.length === 0 ? (
        <div className="text-center py-12">
          <Crown className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-400 mb-2">No managers yet</h3>
          <p className="text-gray-500">No managers match your filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {managers.map((manager, index) => {
            const rank = (currentPage - 1) * MANAGERS_PER_PAGE + index + 1;
            const winLossRatio = getWinLossRatio(manager.manager_wins, manager.manager_losses);

            return (
              <div
                key={manager.id}
                onClick={() => navigate(`/profile/${manager.username}`)}
                className="bg-gradient-to-r from-gray-900/80 to-gray-800/80 border border-gray-700 hover:border-gray-600 rounded-xl p-4 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 text-center">
                    <span className="text-2xl font-black text-gray-500">#{rank}</span>
                  </div>

                  <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-800 border-2 border-gray-700 relative">
                    {manager.avatar_url ? (
                      <img
                        src={manager.avatar_url}
                        alt={manager.username}
                        className="w-full h-full object-cover"
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
                        {manager.full_name}
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
                      <span>@{displayUsername(manager.username)}</span>
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
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <span className="text-white font-semibold">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
