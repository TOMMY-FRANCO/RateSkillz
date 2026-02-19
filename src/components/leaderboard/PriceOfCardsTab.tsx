import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useTierBadges } from '../../hooks/useTierBadges';
import { Search, ChevronLeft, ChevronRight, Coins, User, Trophy } from 'lucide-react';
import { displayUsername } from '../../lib/username';
import { ShimmerBar, StaggerItem, SlowLoadMessage } from '../ui/Shimmer';
import { SkeletonAvatar } from '../ui/SkeletonPresets';
import { RankChangeIndicator } from '../ui/HighValueSkeletons';

interface CardData {
  card_user_id: string;
  current_price: number;
  owner_id: string;
  original_owner_id: string;
  player_username: string;
  player_full_name: string;
  player_avatar_url: string | null;
  player_overall_rating: number;
  player_position: string | null;
  player_team: string | null;
  owner_username: string;
  original_owner_username: string;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
}

const CARDS_PER_PAGE = 20;

export default function PriceOfCardsTab() {
  const navigate = useNavigate();
  const { tiers } = useTierBadges();
  const [cards, setCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCards, setTotalCards] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [minRating, setMinRating] = useState('');
  const [maxRating, setMaxRating] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const prevRanksRef = useRef<Map<string, number>>(new Map());

  const getTierForRating = (rating: number) => {
    return tiers.find(tier =>
      rating >= tier.overall_rating_min && rating <= tier.overall_rating_max
    );
  };

  const fetchCards = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('card_ownership')
        .select(`
          card_user_id,
          current_price,
          owner_id,
          original_owner_id,
          player:card_user_id (
            username,
            full_name,
            avatar_url,
            overall_rating,
            position,
            team
          ),
          owner:owner_id (
            username
          ),
          original_owner:original_owner_id (
            username
          )
        `, { count: 'exact' });

      if (searchTerm) {
        query = query.or(`player.username.ilike.%${searchTerm}%,player.full_name.ilike.%${searchTerm}%`);
      }

      if (positionFilter) {
        query = query.eq('player.position', positionFilter);
      }

      if (teamFilter) {
        query = query.eq('player.team', teamFilter);
      }

      if (minRating) {
        query = query.gte('player.overall_rating', parseInt(minRating));
      }

      if (maxRating) {
        query = query.lte('player.overall_rating', parseInt(maxRating));
      }

      const { count } = await query;
      setTotalCards(Math.min(count || 0, 100));

      const from = (currentPage - 1) * CARDS_PER_PAGE;
      const to = Math.min(from + CARDS_PER_PAGE - 1, 99);

      const { data, error } = await query
        .order('current_price', { ascending: false })
        .range(from, to);

      if (error) throw error;

      if (data) {
        const formattedCards: CardData[] = await Promise.all(
          data.map(async (card: any) => {
            const { data: statsData } = await supabase
              .from('user_stats')
              .select('pac, sho, pas, dri, def, phy')
              .eq('user_id', card.card_user_id)
              .single();

            return {
              card_user_id: card.card_user_id,
              current_price: parseFloat(card.current_price),
              owner_id: card.owner_id,
              original_owner_id: card.original_owner_id,
              player_username: card.player?.username || '',
              player_full_name: card.player?.full_name || '',
              player_avatar_url: card.player?.avatar_url || null,
              player_overall_rating: card.player?.overall_rating || 50,
              player_position: card.player?.position || null,
              player_team: card.player?.team || null,
              owner_username: card.owner?.username || '',
              original_owner_username: card.original_owner?.username || '',
              pac: statsData?.pac || 50,
              sho: statsData?.sho || 50,
              pas: statsData?.pas || 50,
              dri: statsData?.dri || 50,
              def: statsData?.def || 50,
              phy: statsData?.phy || 50,
            };
          })
        );

        let filteredCards = formattedCards;

        if (tierFilter) {
          const tierObj = tiers.find(t => t.tier_name === tierFilter);
          if (tierObj) {
            filteredCards = formattedCards.filter(card =>
              card.player_overall_rating >= tierObj.overall_rating_min &&
              card.player_overall_rating <= tierObj.overall_rating_max
            );
          }
        }

        const newRanks = new Map<string, number>();
        filteredCards.forEach((c, i) => {
          newRanks.set(c.card_user_id, (currentPage - 1) * CARDS_PER_PAGE + i + 1);
        });

        setCards(filteredCards);
        prevRanksRef.current = newRanks;
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching cards:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, [currentPage, searchTerm, positionFilter, teamFilter, tierFilter, minRating, maxRating]);

  const totalPages = Math.ceil(totalCards / CARDS_PER_PAGE);

  const getTimeSinceUpdate = () => {
    const seconds = Math.floor((new Date().getTime() - lastUpdated.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  if (loading && cards.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <StaggerItem key={i} index={i}>
            <div className="bg-gradient-to-r from-gray-900/80 to-gray-800/80 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-4">
                <ShimmerBar className="w-12 h-8 rounded" speed="slow" />
                <SkeletonAvatar size="lg" shape="rounded" />
                <div className="flex-grow space-y-2">
                  <div className="flex items-center gap-2">
                    <ShimmerBar className="h-4 w-32 rounded" />
                    <ShimmerBar className="h-5 w-16 rounded" />
                  </div>
                  <ShimmerBar className="h-3 w-48 rounded" speed="slow" />
                  <ShimmerBar className="h-3 w-36 rounded" speed="slow" />
                </div>
                <div className="hidden md:flex items-center gap-6">
                  <div className="text-center space-y-1">
                    <ShimmerBar className="h-7 w-10 rounded mx-auto" />
                    <ShimmerBar className="h-3 w-8 rounded" speed="slow" />
                  </div>
                  <div className="text-center space-y-1">
                    <ShimmerBar className="h-7 w-14 rounded mx-auto" />
                    <ShimmerBar className="h-3 w-10 rounded" speed="slow" />
                  </div>
                </div>
              </div>
            </div>
          </StaggerItem>
        ))}
        <SlowLoadMessage loading={true} message="Loading card prices..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Coins className="w-6 h-6 text-yellow-400" />
          <div>
            <h3 className="text-lg font-bold text-white">Market Price Rankings</h3>
            <p className="text-sm text-gray-400">Updated {getTimeSinceUpdate()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search player name..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <select
          value={positionFilter}
          onChange={(e) => {
            setPositionFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
        >
          <option value="">All Positions</option>
          <option value="Goalkeeper">Goalkeeper</option>
          <option value="Defender">Defender</option>
          <option value="Midfielder">Midfielder</option>
          <option value="Forward">Forward</option>
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
          value={tierFilter}
          onChange={(e) => {
            setTierFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
        >
          <option value="">All Tiers</option>
          {tiers.map(tier => (
            <option key={tier.id} value={tier.tier_name}>{tier.tier_name}</option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Min OVR"
          value={minRating}
          onChange={(e) => {
            setMinRating(e.target.value);
            setCurrentPage(1);
          }}
          min="1"
          max="100"
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
        />

        <input
          type="number"
          placeholder="Max OVR"
          value={maxRating}
          onChange={(e) => {
            setMaxRating(e.target.value);
            setCurrentPage(1);
          }}
          min="1"
          max="100"
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {cards.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-400 mb-2">No cards available</h3>
          <p className="text-gray-500">No cards match your filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cards.map((card, index) => {
            const tier = getTierForRating(card.player_overall_rating);
            const rank = (currentPage - 1) * CARDS_PER_PAGE + index + 1;

            return (
              <div
                key={card.card_user_id}
                onClick={() => navigate(`/profile/${card.player_username}`)}
                className="bg-gradient-to-r from-gray-900/80 to-gray-800/80 border border-gray-700 hover:border-gray-600 rounded-xl p-4 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 text-center">
                    <RankChangeIndicator
                      currentRank={rank}
                      previousRank={prevRanksRef.current.get(card.card_user_id)}
                    />
                  </div>

                  <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-800 border-2 border-gray-700">
                    {card.player_avatar_url ? (
                      <img
                        src={card.player_avatar_url}
                        alt={card.player_username}
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
                  </div>

                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-white truncate">
                        @{card.player_username}
                      </h3>
                      {tier && (
                        <span
                          className="px-2 py-0.5 text-xs font-bold rounded"
                          style={{
                            background: `linear-gradient(135deg, ${tier.gradient_from}, ${tier.gradient_to})`,
                            color: 'white',
                          }}
                        >
                          {tier.tier_name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      {card.player_position && (
                        <>
                          <span className="text-gray-600">•</span>
                          <span className="text-purple-400 font-semibold">{card.player_position}</span>
                        </>
                      )}
                      {card.player_team && (
                        <>
                          <span className="text-gray-600">•</span>
                          <span className="text-gray-300">{card.player_team}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                      <span>Owner: <span className="text-cyan-400">@{displayUsername(card.owner_username)}</span></span>
                      <span className="text-gray-700">•</span>
                      <span>Original: <span className="text-purple-400">@{displayUsername(card.original_owner_username)}</span></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400">
                        {card.player_overall_rating}
                      </div>
                      <div className="text-xs text-gray-500 font-semibold">OVR</div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-1 text-2xl font-black text-yellow-400">
                        <Coins className="w-5 h-5" />
                        <span>{Math.floor(card.current_price)}</span>
                      </div>
                      <div className="text-xs text-gray-500 font-semibold">PRICE</div>
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
