import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Trophy, TrendingUp, TrendingDown, Minus, User, Coins, Crown } from 'lucide-react';
import { getMultipleUserPresence, type UserPresence } from '../lib/presence';
import OnlineStatus from '../components/OnlineStatus';
import PriceOfCardsTab from '../components/leaderboard/PriceOfCardsTab';
import TopManagersTab from '../components/leaderboard/TopManagersTab';
import { markNotificationsRead } from '../lib/notifications';

interface LeaderboardEntry {
  rank: number;
  profile_id: string;
  overall_rating: number;
  previous_rank: number | null;
  username: string;
  full_name: string;
  avatar_url: string | null;
  position: string | null;
  team: string | null;
  gender: string | null;
}

type TabType = 'global' | 'prices' | 'managers';

export default function Leaderboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPresence, setUserPresence] = useState<Map<string, UserPresence>>(new Map());
  const [activeTab, setActiveTab] = useState<TabType>('global');

  useEffect(() => {
    if (activeTab === 'global') {
      fetchLeaderboard();
    }
    if (profile) {
      markNotificationsRead(profile.id, 'rank_update');
    }
  }, [activeTab, profile]);

  const fetchLeaderboard = async () => {
    try {
      // Use leaderboard_cache for optimized query
      const { data, error } = await supabase
        .from('leaderboard_cache')
        .select('*')
        .order('rank', { ascending: true });

      if (error) throw error;

      // Map cache fields to expected interface
      const mappedEntries = (data || []).map((entry: any) => ({
        rank: entry.rank,
        profile_id: entry.user_id,
        overall_rating: entry.overall_rating,
        previous_rank: null,
        username: entry.username,
        full_name: entry.username,
        avatar_url: entry.avatar_url,
        position: entry.position,
        team: entry.team,
        gender: entry.gender || null,
      }));

      setEntries(mappedEntries);

      if (data && data.length > 0) {
        const userIds = data.map((entry: any) => entry.user_id);
        const presence = await getMultipleUserPresence(userIds);
        setUserPresence(presence);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setLoading(false);
    }
  };

  const getRankChange = (entry: LeaderboardEntry) => {
    if (!entry.previous_rank) return null;
    const change = entry.previous_rank - entry.rank;
    if (change > 0) return { type: 'up', value: change };
    if (change < 0) return { type: 'down', value: Math.abs(change) };
    return { type: 'same', value: 0 };
  };

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'from-yellow-400 via-yellow-500 to-orange-500 border-yellow-200';
    if (rank === 2) return 'from-gray-300 via-gray-400 to-gray-500 border-gray-200';
    if (rank === 3) return 'from-orange-600 via-orange-700 to-orange-800 border-orange-400';
    if (rank <= 10) return 'from-purple-600 via-purple-700 to-purple-800 border-purple-400';
    if (rank <= 25) return 'from-blue-600 via-blue-700 to-blue-800 border-blue-400';
    if (rank <= 50) return 'from-green-600 via-green-700 to-green-800 border-green-400';
    return 'from-gray-700 via-gray-800 to-gray-900 border-gray-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading leaderboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <nav className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center space-x-2 text-[#B0B8C8] hover:text-[#00E0FF] transition-colors bg-transparent border-none cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-semibold">Back</span>
            </button>

            <h1 className="text-2xl font-bold text-white heading-glow">
              Leaderboards
            </h1>

            <div className="w-20"></div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <div className="flex justify-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('global')}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all ${
                activeTab === 'global'
                  ? 'btn-primary'
                  : 'btn-ghost'
              }`}
            >
              <Trophy className="w-5 h-5" />
              <span>Global Rankings</span>
            </button>

            <button
              onClick={() => setActiveTab('prices')}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all ${
                activeTab === 'prices'
                  ? 'btn-primary'
                  : 'btn-ghost'
              }`}
            >
              <Coins className="w-5 h-5" />
              <span>Price of Cards</span>
            </button>

            <button
              onClick={() => setActiveTab('managers')}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all ${
                activeTab === 'managers'
                  ? 'btn-primary'
                  : 'btn-ghost'
              }`}
            >
              <Crown className="w-5 h-5" />
              <span>Top Managers</span>
            </button>
          </div>
        </div>

        {activeTab === 'global' && (
          <div className="space-y-3">
            {entries.map((entry) => {
            const isCurrentUser = profile?.id === entry.profile_id;
            const rankChange = getRankChange(entry);
            const rankBadgeColor = getRankBadgeColor(entry.rank);

            return (
              <div
                key={entry.rank}
                onClick={() => navigate(`/profile/${entry.username}`)}
                className={`
                  glass-card p-4 transition-all cursor-pointer
                  ${isCurrentUser
                    ? 'border-2 border-[#00FF85]/50 shadow-lg shadow-[#00FF85]/20 hover:shadow-[#00FF85]/40'
                    : ''
                  }
                `}
              >
                <div className="flex items-center gap-4">
                  <div className={`
                    relative flex-shrink-0 w-16 h-16 rounded-lg flex items-center justify-center
                    bg-gradient-to-br ${rankBadgeColor} border-2 shadow-lg
                  `}>
                    <span className="text-2xl font-black text-white drop-shadow-lg">
                      {entry.rank}
                    </span>
                    {entry.rank <= 3 && (
                      <Trophy className="absolute -top-2 -right-2 w-5 h-5 text-yellow-300" />
                    )}
                  </div>

                  <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-800 border-2 border-gray-700">
                    {entry.avatar_url ? (
                      <img
                        src={entry.avatar_url}
                        alt={entry.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-8 h-8 text-gray-600" />
                      </div>
                    )}
                  </div>

                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-white truncate">
                        {entry.full_name}
                      </h3>
                      {entry.gender && (
                        <span className="px-1.5 py-0.5 bg-gray-700 text-gray-300 text-xs font-bold rounded">
                          {entry.gender === 'male' ? 'M' : 'F'}
                        </span>
                      )}
                      {isCurrentUser && (
                        <span className="px-2 py-0.5 bg-cyan-500 text-black text-xs font-bold rounded">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <span>@{entry.username}</span>
                      {entry.position && (
                        <>
                          <span className="text-gray-600">•</span>
                          <span className="text-purple-400 font-semibold">{entry.position}</span>
                        </>
                      )}
                      {entry.team && (
                        <>
                          <span className="text-gray-600">•</span>
                          <span className="text-gray-300">{entry.team}</span>
                        </>
                      )}
                    </div>
                    <OnlineStatus
                      lastActive={userPresence.get(entry.profile_id)?.last_seen}
                      size="small"
                      className="mt-1"
                    />
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    {rankChange && (
                      <div className="flex items-center gap-1">
                        {rankChange.type === 'up' && (
                          <div className="flex items-center gap-1 text-green-400">
                            <TrendingUp className="w-4 h-4" />
                            <span className="text-sm font-bold">+{rankChange.value}</span>
                          </div>
                        )}
                        {rankChange.type === 'down' && (
                          <div className="flex items-center gap-1 text-red-400">
                            <TrendingDown className="w-4 h-4" />
                            <span className="text-sm font-bold">-{rankChange.value}</span>
                          </div>
                        )}
                        {rankChange.type === 'same' && (
                          <div className="flex items-center gap-1 text-gray-500">
                            <Minus className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="text-right">
                      <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400">
                        {entry.overall_rating}
                      </div>
                      <div className="text-xs text-gray-500 font-semibold">OVR</div>
                    </div>
                  </div>
                </div>
              </div>
            );
            })}

            {entries.length === 0 && (
              <div className="text-center py-12">
                <Trophy className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-400 mb-2">No rankings yet</h3>
                <p className="text-gray-500">Be the first to get rated by your friends!</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'prices' && <PriceOfCardsTab />}

        {activeTab === 'managers' && <TopManagersTab />}
      </main>
    </div>
  );
}
