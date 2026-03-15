import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCoinBalance } from '../hooks/useCoinBalance';
import { getNotBoughtCards, purchaseCardAtFixedPrice, type CardWithRatings, type CardSortBy } from '../lib/cardTrading';
import { Coins, ShoppingCart, User, TrendingUp, Trophy, Star, RefreshCw } from 'lucide-react';
import { ShimmerBar, StaggerItem, SlowLoadMessage } from './ui/Shimmer';
import { SkeletonAvatar } from './ui/SkeletonPresets';

const PAGE_LIMIT = 20;

interface NotBoughtCardsTabProps {
  onRequestSent?: () => void;
}

export default function NotBoughtCardsTab({ onRequestSent }: NotBoughtCardsTabProps) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { balance } = useCoinBalance();
  const [cards, setCards] = useState<CardWithRatings[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<CardSortBy>('last_seen');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    loadCards(0, 'last_seen', false);
  }, []);

  const loadCards = async (nextOffset: number, sort: CardSortBy, append: boolean) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const result = await getNotBoughtCards(nextOffset, PAGE_LIMIT, sort);
      if (append) {
        setCards(prev => [...prev, ...result.data]);
      } else {
        setCards(result.data);
      }
      setHasMore(result.hasMore);
      setOffset(nextOffset);
    } catch (error) {
      console.error('Error loading not bought cards:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSortChange = (sort: CardSortBy) => {
    setSortBy(sort);
    loadCards(0, sort, false);
  };

  const handleLoadMore = () => {
    loadCards(offset + PAGE_LIMIT, sortBy, true);
  };

  const handlePurchaseCard = async (card: CardWithRatings) => {
    if (!profile) return;

    if (balance < 20) {
      alert('Insufficient coins');
      return;
    }

    if (card.card_user_id === profile.id) {
      alert('Cannot purchase your own card');
      return;
    }

    setPurchasing(card.id);
    try {
      const result = await purchaseCardAtFixedPrice(card.card_user_id, profile.id);

      if (result.success) {
        alert('Card purchased successfully');
        if (onRequestSent) onRequestSent();
        loadCards();
      } else {
        alert(result.error);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to purchase card. Please try again.';
      alert(message);
    } finally {
      setPurchasing(null);
    }
  };

  const getTierColor = (tier: string | null) => {
    switch (tier) {
      case 'bronze': return 'text-orange-400 bg-[rgba(251,146,60,0.1)] border-[rgba(251,146,60,0.3)]';
      case 'silver': return 'text-slate-300 bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.2)]';
      case 'gold': return 'text-yellow-400 bg-[rgba(234,179,8,0.1)] border-[rgba(234,179,8,0.3)]';
      case 'platinum': return 'text-[#00E0FF] bg-[rgba(0,224,255,0.08)] border-[rgba(0,224,255,0.25)]';
      case 'diamond': return 'text-blue-300 bg-[rgba(59,130,246,0.1)] border-[rgba(59,130,246,0.3)]';
      default: return 'text-[#B0B8C8] bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.1)]';
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 py-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <StaggerItem key={i} index={i}>
            <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-4">
                <SkeletonAvatar size="lg" shape="rounded" />
                <div className="flex-1 space-y-2">
                  <ShimmerBar className="h-4 w-36 rounded" />
                  <ShimmerBar className="h-3 w-24 rounded" speed="slow" />
                </div>
                <ShimmerBar className="h-9 w-28 rounded-lg" />
              </div>
            </div>
          </StaggerItem>
        ))}
        <SlowLoadMessage loading={true} message="Loading cards..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Star className="w-6 h-6 text-yellow-400" />
            Not Bought Cards
          </h2>
          <p className="text-[#B0B8C8] text-sm mt-1">
            Newly released cards that have never been purchased. Fixed price: 20 coins.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-[rgba(0,224,255,0.08)] rounded-full border border-[rgba(0,224,255,0.25)]">
          <Coins className="w-5 h-5 text-[#00E0FF]" />
          <span className="text-lg font-bold text-[#00E0FF]">{balance.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex gap-2">
        {(['last_seen', 'price_high', 'ovr_low'] as CardSortBy[]).map((s) => {
          const labels: Record<CardSortBy, string> = { last_seen: 'Last Seen', price_high: 'Price High to Low', ovr_low: 'OVR Low to High' };
          return (
            <button
              key={s}
              onClick={() => handleSortChange(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                sortBy === s
                  ? 'bg-[rgba(0,224,255,0.15)] border-[rgba(0,224,255,0.45)] text-[#00E0FF]'
                  : 'bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.1)] text-slate-400 hover:border-[rgba(0,224,255,0.25)] hover:text-slate-200'
              }`}
            >
              {labels[s]}
            </button>
          );
        })}
      </div>

      {cards.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Star className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-[#B0B8C8] text-lg">No cards available</p>
          <p className="text-slate-500 text-sm mt-2">All cards have been purchased at least once</p>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card) => {
            const isPurchasing = purchasing === card.id;
            const canAfford = balance >= 20;
            const isOwnCard = card.card_user_id === profile?.id;

            return (
              <div
                key={card.id}
                className="glass-card p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-1">
                      @{card.card_user?.username || 'unknown'}
                    </h3>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center gap-1 text-[#00E0FF]">
                        <Trophy className="w-4 h-4" />
                        <span className="font-bold text-lg">{card.overall_rating}</span>
                      </div>
                      {card.tier_badge && (
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded border capitalize ${getTierColor(card.tier_badge)}`}>
                          {card.tier_badge}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/profile/${card.card_user?.username}`)}
                    className="px-3 py-1.5 bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(0,224,255,0.1)] text-slate-300 hover:text-[#00E0FF] text-sm rounded-lg transition-all border border-[rgba(0,224,255,0.15)] hover:border-[rgba(0,224,255,0.3)] flex items-center gap-1"
                  >
                    <User className="w-4 h-4" />
                    View
                  </button>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] rounded-lg">
                      <span className="text-xs text-[#B0B8C8]">Position</span>
                      <p className="text-sm font-semibold text-white">{card.position}</p>
                    </div>
                    <div className="p-2 bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] rounded-lg">
                      <span className="text-xs text-[#B0B8C8]">Team</span>
                      <p className="text-sm font-semibold text-white truncate">{card.team}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-[rgba(15,24,41,0.85)] border border-[rgba(0,255,133,0.2)] rounded-xl">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-xs text-[#00FF85]/70">PAC</div>
                        <div className="text-lg font-bold text-[#00FF85]">{card.pac || 50}</div>
                      </div>
                      <div>
                        <div className="text-xs text-[#00FF85]/70">SHO</div>
                        <div className="text-lg font-bold text-[#00FF85]">{card.sho || 50}</div>
                      </div>
                      <div>
                        <div className="text-xs text-[#00FF85]/70">PAS</div>
                        <div className="text-lg font-bold text-[#00FF85]">{card.pas || 50}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center mt-2">
                      <div>
                        <div className="text-xs text-[#00FF85]/70">DRI</div>
                        <div className="text-lg font-bold text-[#00FF85]">{card.dri || 50}</div>
                      </div>
                      <div>
                        <div className="text-xs text-[#00FF85]/70">DEF</div>
                        <div className="text-lg font-bold text-[#00FF85]">{card.def || 50}</div>
                      </div>
                      <div>
                        <div className="text-xs text-[#00FF85]/70">PHY</div>
                        <div className="text-lg font-bold text-[#00FF85]">{card.phy || 50}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-[rgba(15,24,41,0.85)] rounded-lg border border-[rgba(0,224,255,0.2)]">
                    <span className="text-sm text-[#B0B8C8] font-semibold">Fixed Price</span>
                    <div className="flex items-center gap-1">
                      <Coins className="w-5 h-5 text-[#00E0FF]" />
                      <span className="font-bold text-[#00E0FF] text-xl">20.00</span>
                    </div>
                  </div>

                  <div className="p-2 bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.15)] rounded-lg text-center">
                    <div className="flex items-center justify-center gap-1 text-xs text-[#B0B8C8]">
                      <TrendingUp className="w-3 h-3 text-[#00E0FF]" />
                      <span>After purchase: 30 coins (+10)</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handlePurchaseCard(card)}
                  disabled={isPurchasing || !canAfford || isOwnCard}
                  className={`w-full px-4 py-3 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 text-sm ${
                    isOwnCard
                      ? 'bg-[rgba(255,255,255,0.05)] text-slate-500 cursor-not-allowed border border-[rgba(255,255,255,0.08)]'
                      : !canAfford
                      ? 'bg-[rgba(239,68,68,0.1)] text-red-300/70 cursor-not-allowed border border-[rgba(239,68,68,0.15)]'
                      : isPurchasing
                      ? 'bg-gray-700 text-gray-300 cursor-wait border border-gray-600'
                      : 'bg-[rgba(0,255,133,0.12)] hover:bg-[rgba(0,255,133,0.2)] text-[#00FF85] border border-[rgba(0,255,133,0.3)] hover:border-[rgba(0,255,133,0.5)] hover:shadow-[0_0_20px_rgba(0,255,133,0.15)]'
                  }`}
                >
                  {isPurchasing ? (
                    <>Purchasing...</>
                  ) : isOwnCard ? (
                    <>Your Card</>
                  ) : !canAfford ? (
                    <>Insufficient Coins</>
                  ) : (
                    <>
                      <ShoppingCart className="w-5 h-5" />
                      Buy for 20 coins
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {hasMore && (
          <div className="flex justify-center mt-6">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-8 py-3 bg-[rgba(0,224,255,0.08)] hover:bg-[rgba(0,224,255,0.15)] text-[#00E0FF] font-semibold rounded-xl border border-[rgba(0,224,255,0.25)] hover:border-[rgba(0,224,255,0.45)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
            >
              {loadingMore ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Loading...
                </>
              ) : (
                'Load More'
              )}
            </button>
          </div>
        )}
        </>
      )}
    </div>
  );
}
