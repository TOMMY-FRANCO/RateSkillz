import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getCardsOwnedByUser,
  calculatePortfolioValue,
  getMostValuableCards,
  getMostTradedCards,
  getListedCardsForSale,
  purchaseCardAtFixedPrice,
  checkPurchaseRestrictionsBatch,
  buyMyselfOut,
  type CardOwnership,
  type CardSortBy,
} from '../lib/cardTrading';
import { useCoinBalance } from '../hooks/useCoinBalance';
import { ArrowLeft, Coins, TrendingUp, Tag, ShoppingCart, Trophy, Store, User, X, Repeat, Trash2, Star, RefreshCw, AlertTriangle, Lock } from 'lucide-react';
import { getMultipleUserBalances } from '../lib/balances';
import { formatCoinBalance } from '../lib/formatBalance';
import { ShimmerBar, StaggerItem, SlowLoadMessage } from '../components/ui/Shimmer';
import { SkeletonAvatar } from '../components/ui/SkeletonPresets';
import { SkeletonReceipt } from '../components/ui/HighValueSkeletons';
import CardSwapTab from '../components/CardSwapTab';
import CardDiscardTab from '../components/CardDiscardTab';
import NotBoughtCardsTab from '../components/NotBoughtCardsTab';
import PurchasedCardsTab from '../components/PurchasedCardsTab';
import { markNotificationsReadBatch } from '../lib/notifications';

type TabKey = 'marketplace' | 'portfolio' | 'swap' | 'discard' | 'leaderboards' | 'not-bought' | 'purchased';

const TABS: { key: TabKey; label: string; icon?: typeof Star }[] = [
  { key: 'marketplace', label: 'Marketplace' },
  { key: 'not-bought', label: 'Not Bought', icon: Star },
  { key: 'purchased', label: 'Purchased Cards', icon: Repeat },
  { key: 'portfolio', label: 'My Portfolio' },
  { key: 'swap', label: 'Swap', icon: Repeat },
  { key: 'discard', label: 'Discard', icon: Trash2 },
  { key: 'leaderboards', label: 'Leaderboards' },
];

export default function TradingDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { balance, refetch: refetchBalance } = useCoinBalance();
  const [ownedCards, setOwnedCards] = useState<CardOwnership[]>([]);
  const [listedCards, setListedCards] = useState<CardOwnership[]>([]);
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [mostValuable, setMostValuable] = useState<CardOwnership[]>([]);
  const [mostTraded, setMostTraded] = useState<CardOwnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadMore, setLoadMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<TabKey>('marketplace');
  const [userBalances, setUserBalances] = useState<Map<string, number>>(new Map());
  const [restrictedCards, setRestrictedCards] = useState<Map<string, string>>(new Map());
  const [marketSortBy, setMarketSortBy] = useState<CardSortBy>('last_seen');
  const [marketOffset, setMarketOffset] = useState(0);
  const [marketHasMore, setMarketHasMore] = useState(false);

  const MARKET_LIMIT = 20;

  useEffect(() => {
    if (profile) {
      setMarketOffset(0);
      loadData(false, 0, marketSortBy);
      markNotificationsReadBatch(profile.id, ['swap_offer', 'purchase_offer', 'card_sold', 'purchase_request']);
    }
  }, [profile?.id]);

  const loadData = useCallback(async (isRefresh = false, appendOffset = 0, sort: CardSortBy = 'last_seen') => {
    if (!profile) return;

    const isAppend = appendOffset > 0;

    if (isRefresh) {
      setRefreshing(true);
    } else if (isAppend) {
      setLoadMore(true);
    } else {
      setLoading(true);
    }
    setLoadError(null);

    try {
      const [cards, valuable, traded, listedResult] = await Promise.all([
        getCardsOwnedByUser(profile.id),
        getMostValuableCards(10),
        getMostTradedCards(10),
        getListedCardsForSale(appendOffset, MARKET_LIMIT, sort)
      ]);

      setOwnedCards(cards);
      setPortfolioValue(calculatePortfolioValue(cards));
      setMostValuable(valuable);
      setMostTraded(traded);
      setMarketHasMore(listedResult.hasMore);

      const listed = listedResult.data;
      if (isAppend) {
        setListedCards(prev => [...prev, ...listed]);
      } else {
        setListedCards(listed);
      }

      const allUserIds = new Set<string>();
      listed.forEach(card => {
        if (card.owner_id) allUserIds.add(card.owner_id);
        if (card.card_user_id) allUserIds.add(card.card_user_id);
      });
      cards.forEach(card => {
        if (card.card_user_id) allUserIds.add(card.card_user_id);
      });

      const ownerIdsForRestrictions = listed
        .filter(c => c.owner_id && c.owner_id !== profile.id)
        .map(c => c.owner_id);

      const [balances, ownerRestrictions] = await Promise.all([
        allUserIds.size > 0
          ? getMultipleUserBalances(Array.from(allUserIds))
          : Promise.resolve(new Map<string, number>()),
        ownerIdsForRestrictions.length > 0
          ? checkPurchaseRestrictionsBatch(ownerIdsForRestrictions, profile.id)
          : Promise.resolve(new Map<string, string>()),
      ]);

      if (isAppend) {
        setUserBalances(prev => new Map([...prev, ...balances]));
        setRestrictedCards(prev => {
          const next = new Map(prev);
          listed.forEach(card => {
            const reason = ownerRestrictions.get(card.owner_id);
            if (reason) next.set(card.id, reason);
          });
          return next;
        });
      } else {
        setUserBalances(balances);
        const cardRestrictions = new Map<string, string>();
        listed.forEach(card => {
          const reason = ownerRestrictions.get(card.owner_id);
          if (reason) cardRestrictions.set(card.id, reason);
        });
        setRestrictedCards(cardRestrictions);
      }
    } catch (error) {
      console.error('Error loading trading data:', error);
      setLoadError('Failed to load trading data. Pull down to try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadMore(false);
    }
  }, [profile?.id]);

  const handleRefresh = () => {
    if (refreshing) return;
    setMarketOffset(0);
    loadData(true, 0, marketSortBy);
  };

  const handleMarketSort = (sort: CardSortBy) => {
    setMarketSortBy(sort);
    setMarketOffset(0);
    loadData(false, 0, sort);
  };

  const handleMarketLoadMore = () => {
    const nextOffset = marketOffset + MARKET_LIMIT;
    setMarketOffset(nextOffset);
    loadData(false, nextOffset, marketSortBy);
  };

  const handleBuyMyselfOut = async (card: CardOwnership) => {
    if (!profile) return;

    const totalCost = card.current_price + 100;

    if (balance < totalCost) {
      alert(`Insufficient coins! You need ${totalCost.toFixed(2)} coins (card price ${card.current_price.toFixed(2)} + 100 compensation).`);
      return;
    }

    if (!confirm(`Buy back your card?\n\nCard price: ${card.current_price.toFixed(2)} coins\nCompensation to holder: 100 coins\nTotal cost: ${totalCost.toFixed(2)} coins`)) return;

    setPurchasing(card.id);
    try {
      const result = await buyMyselfOut(card.card_user_id, profile.id);
      if (result.success) {
        alert(`Card bought back successfully!\n\nTotal paid: ${result.total_cost?.toFixed(2)} coins`);
        refetchBalance();
        loadData(true);
      } else {
        alert(`Buyout failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error buying out card:', error);
      alert('Buyout failed. Please try again.');
    } finally {
      setPurchasing(null);
    }
  };

  const handlePurchaseCard = async (card: CardOwnership) => {
    if (!profile) return;

    if (balance < card.current_price) {
      alert(`Insufficient coins! You have ${balance.toFixed(2)} coins but need ${card.current_price.toFixed(2)} coins.`);
      return;
    }

    const confirmMsg = `Purchase this card at fixed price of ${card.current_price.toFixed(2)} coins?\n\nCurrent card value: ${card.current_price.toFixed(2)} coins\nAfter purchase, card value will increase to: ${(card.current_price + 10).toFixed(2)} coins`;

    if (!confirm(confirmMsg)) return;

    setPurchasing(card.id);
    try {
      const result = await purchaseCardAtFixedPrice(card.card_user_id, profile.id);

      if (result.success) {
        alert(`Card purchased successfully!\n\nYou paid: ${result.sale_price?.toFixed(2)} coins\nCard value increased: ${result.previous_value?.toFixed(2)} → ${result.new_value?.toFixed(2)} coins (+10 coins)`);
        refetchBalance();
        loadData(true);
      } else {
        alert(`Purchase failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error purchasing card:', error);
      alert('Purchase failed. Please try again.');
    } finally {
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <StaggerItem index={0} className="flex items-center gap-3">
            <ShimmerBar className="w-8 h-8 rounded" />
            <ShimmerBar className="h-7 w-56 rounded" />
          </StaggerItem>
          <StaggerItem index={1} className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass-card p-4 space-y-2">
                <ShimmerBar className="h-3 w-20 rounded" speed="slow" />
                <ShimmerBar className="h-7 w-24 rounded" />
              </div>
            ))}
          </StaggerItem>
          <StaggerItem index={2}>
            <ShimmerBar className="h-10 w-full rounded-xl" speed="slow" />
          </StaggerItem>
          <StaggerItem index={3} className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass-card p-4">
                <div className="flex items-center gap-4">
                  <SkeletonAvatar size="lg" shape="rounded" />
                  <div className="flex-1 space-y-2">
                    <ShimmerBar className="h-4 w-32 rounded" />
                    <ShimmerBar className="h-3 w-20 rounded" speed="slow" />
                  </div>
                  <ShimmerBar className="h-8 w-20 rounded" />
                </div>
              </div>
            ))}
          </StaggerItem>
          <SlowLoadMessage loading={true} message="Loading trading data..." />
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
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-white">Card Trading</h1>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[rgba(0,224,255,0.08)] border border-[rgba(0,224,255,0.2)] text-[#00E0FF] hover:bg-[rgba(0,224,255,0.15)] transition-all disabled:opacity-50 text-sm font-semibold"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loadError && (
          <div className="mb-6 p-4 bg-[rgba(239,68,68,0.1)] backdrop-blur-[15px] border border-[rgba(239,68,68,0.3)] rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-sm flex-1">{loadError}</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-[rgba(239,68,68,0.2)] hover:bg-[rgba(239,68,68,0.3)] text-red-300 hover:text-red-200 text-sm font-semibold rounded-lg transition-all border border-[rgba(239,68,68,0.3)]"
            >
              Retry
            </button>
          </div>
        )}

        <div className="glass-container p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] rounded-xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-[rgba(0,255,133,0.12)] border border-[rgba(0,255,133,0.25)] rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4 text-[#00FF85]" />
                </div>
                <span className="text-sm text-[#B0B8C8]">Cards Owned</span>
              </div>
              <p className="text-3xl font-bold text-white">{ownedCards.length}</p>
            </div>

            <div className="p-4 bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] rounded-xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-[rgba(0,224,255,0.12)] border border-[rgba(0,224,255,0.25)] rounded-lg flex items-center justify-center">
                  <Coins className="w-4 h-4 text-[#00E0FF]" />
                </div>
                <span className="text-sm text-[#B0B8C8]">Portfolio Value</span>
              </div>
              <p className="text-3xl font-bold text-[#00E0FF]">{portfolioValue.toFixed(2)}</p>
            </div>

            <div className="p-4 bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] rounded-xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-[rgba(251,191,36,0.12)] border border-[rgba(251,191,36,0.25)] rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                </div>
                <span className="text-sm text-[#B0B8C8]">Total Trades</span>
              </div>
              <p className="text-3xl font-bold text-amber-400">{ownedCards.reduce((t, c) => t + c.times_traded, 0)}</p>
            </div>
          </div>
        </div>
        <div className="mb-6 flex gap-2 overflow-x-auto scrollbar-hide pb-1 flex-wrap">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setSelectedTab(tab.key)}
                className={`px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap text-xs flex items-center gap-1.5 ${
                  selectedTab === tab.key
                    ? 'bg-gradient-to-r from-[#00E0FF] to-[#38BDF8] text-black shadow-[0_0_12px_rgba(0,224,255,0.35)]'
                    : 'bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] text-[#B0B8C8] hover:border-[#00E0FF] hover:text-white'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {tab.label}
              </button>
            );
          })}
        </div>

        {selectedTab === 'marketplace' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Store className="w-6 h-6 text-[#00E0FF]" />
                Cards for Sale
              </h2>
              <div className="flex items-center gap-2 px-4 py-2 bg-[rgba(0,255,133,0.08)] rounded-full border border-[rgba(0,255,133,0.25)]">
                <Coins className="w-5 h-5 text-[#00FF85]" />
                <span className="text-lg font-bold text-[#00FF85]" style={{ textShadow: '0 0 12px rgba(0,255,133,0.4)' }}>
                  {balance.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex gap-2 mb-4 flex-wrap">
              {(['last_seen', 'price_high', 'ovr_low'] as CardSortBy[]).map((s) => {
                const labels: Record<CardSortBy, string> = { last_seen: 'Last Seen', price_high: 'Price High to Low', ovr_low: 'OVR Low to High' };
                return (
                  <button
                    key={s}
                    onClick={() => handleMarketSort(s)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                      marketSortBy === s
                        ? 'bg-gradient-to-r from-[#00E0FF] to-[#38BDF8] text-black shadow-[0_0_12px_rgba(0,224,255,0.35)]'
                        : 'bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] text-[#B0B8C8] hover:border-[#00E0FF] hover:text-white'
                    }`}
                  >
                    {labels[s]}
                  </button>
                );
              })}
            </div>

            {listedCards.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <Store className="w-14 h-14 text-[#B0B8C8]/20 mx-auto mb-4" />
                <p className="text-[#B0B8C8] text-base font-semibold">No cards listed for sale</p>
                <p className="text-[#B0B8C8]/50 text-sm mt-1">Check back later or list your own cards!</p>
              </div>
            ) : (
              <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {listedCards.map((card) => {
                  const isPurchasing = purchasing === card.id;
                  const canAfford = balance >= (card.current_price || 0);
                  const isOwnCard = card.owner_id === profile?.id;
                  const isRestricted = restrictedCards.has(card.id);
                  const restrictionReason = restrictedCards.get(card.id);

                  if (isPurchasing) {
                    return (
                      <SkeletonReceipt key={card.id} visible={true} />
                    );
                  }

                  return (
                    <div
                      key={card.id}
                      className={`glass-card p-5 ${isRestricted ? 'border-red-500/30' : ''}`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-base font-bold text-white mb-1">
                            {card.card_user?.username || 'Unknown'}
                          </h3>
                          {card.owner?.username && card.owner_id !== card.card_user_id && (
                            <div className="flex items-center gap-1 mt-1">
                              <User className="w-3 h-3 text-[#00E0FF]/60" />
                              <span className="text-xs text-[#B0B8C8]">
                                Managed by{' '}
                                <button
                                  onClick={() => navigate(`/profile/${card.owner!.username}`)}
                                  className="text-[#00E0FF] hover:text-white transition-colors"
                                >
                                  @{card.owner.username}
                                </button>
                              </span>
                            </div>
                          )}
                          {card.card_user_id && userBalances.has(card.card_user_id) && (
                            <div className="flex items-center gap-1 mt-1">
                              <Coins className="w-3 h-3 text-[#00FF85]/60" />
                              <span className="text-xs text-[#B0B8C8]">
                                {formatCoinBalance(userBalances.get(card.card_user_id) || 0)} balance
                              </span>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => navigate(`/profile/${card.card_user?.username}`)}
                          className="p-2 rounded-lg bg-[rgba(0,224,255,0.08)] border border-[rgba(0,224,255,0.2)] text-[#00E0FF] hover:bg-[rgba(0,224,255,0.15)] transition-all text-xs font-semibold px-3"
                        >
                          View
                        </button>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between items-center p-2.5 bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] rounded-lg">
                          <span className="text-xs text-[#B0B8C8] font-semibold">Card Value</span>
                          <div className="flex items-center gap-1">
                            <Coins className="w-3.5 h-3.5 text-[#00FF85]" />
                            <span className="font-bold text-[#00FF85] text-sm">
                              {card.current_price.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center p-2.5 bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] rounded-lg">
                          <span className="text-xs text-[#B0B8C8] font-semibold">Fixed Price</span>
                          <div className="flex items-center gap-1">
                            <Coins className="w-3.5 h-3.5 text-[#00E0FF]" />
                            <span className="font-bold text-[#00E0FF] text-sm">
                              {card.current_price?.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center p-2.5 bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] rounded-lg">
                          <span className="text-xs text-[#B0B8C8]">After sale</span>
                          <span className="text-xs text-[#00FF85] font-semibold">
                            {(card.current_price + 10).toFixed(2)} (+10)
                          </span>
                        </div>

                        {card.times_traded > 0 && (
                          <div className="flex justify-between items-center p-2 bg-[rgba(15,24,41,0.85)] border border-[rgba(251,191,36,0.2)] rounded-lg">
                            <span className="text-xs text-amber-400/80">Traded {card.times_traded}x</span>
                            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                          </div>
                        )}

                        {card.is_locked_in_battle && (
                          <div className="flex items-center gap-1.5 p-2 bg-[rgba(15,24,41,0.85)] border border-[rgba(251,191,36,0.3)] rounded-lg">
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-xs font-semibold text-amber-400">Locked in Battle</span>
                          </div>
                        )}

                        {isRestricted && (
                          <div className="p-2.5 bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.25)] rounded-lg">
                            <div className="flex items-start gap-2">
                              <X className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs font-semibold text-red-300 mb-0.5">Purchase Restricted</p>
                                <p className="text-xs text-red-300/70">{restrictionReason}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handlePurchaseCard(card)}
                        disabled={!canAfford || isOwnCard || isRestricted}
                        className={`w-full px-4 py-3 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 text-sm ${
                          isRestricted
                            ? 'bg-[rgba(239,68,68,0.1)] text-red-300/70 cursor-not-allowed border border-[rgba(239,68,68,0.2)]'
                            : isOwnCard
                            ? 'bg-[rgba(255,255,255,0.05)] text-slate-500 cursor-not-allowed border border-[rgba(255,255,255,0.08)]'
                            : !canAfford
                            ? 'bg-[rgba(239,68,68,0.1)] text-red-300/70 cursor-not-allowed border border-[rgba(239,68,68,0.15)]'
                            : 'bg-[rgba(0,255,133,0.12)] hover:bg-[rgba(0,255,133,0.2)] text-[#00FF85] border border-[rgba(0,255,133,0.3)] hover:border-[rgba(0,255,133,0.5)] hover:shadow-[0_0_20px_rgba(0,255,133,0.15)]'
                        }`}
                      >
                        {isRestricted ? (
                          <>
                            <X className="w-5 h-5" />
                            Purchase Restricted
                          </>
                        ) : isOwnCard ? (
                          <>Your Card</>
                        ) : !canAfford ? (
                          <>Insufficient Coins</>
                        ) : (
                          <>
                            <ShoppingCart className="w-5 h-5" />
                            Buy for {card.current_price?.toFixed(2)}
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
              {marketHasMore && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={handleMarketLoadMore}
                    disabled={loadMore}
                    className="px-8 py-3 bg-[rgba(0,224,255,0.08)] hover:bg-[rgba(0,224,255,0.15)] text-[#00E0FF] font-semibold rounded-xl border border-[rgba(0,224,255,0.25)] hover:border-[rgba(0,224,255,0.45)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                  >
                    {loadMore ? (
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
        )}

        {selectedTab === 'portfolio' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Cards I Own</h2>
            {ownedCards.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <ShoppingCart className="w-14 h-14 text-[#B0B8C8]/20 mx-auto mb-4" />
                <p className="text-[#B0B8C8] text-base font-semibold">You don't own any cards yet</p>
                <p className="text-[#B0B8C8]/50 text-sm mt-1">Visit other players' profiles to purchase their cards!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {ownedCards.map((card) => {
                  const purchasePrice = card.last_purchase_price || card.last_sale_price || 20;
                  const isFirstSale = card.times_traded === 0;
                  const potentialEarnings = isFirstSale ? card.current_price : purchasePrice + 5;
                  const profit = isFirstSale ? card.current_price : 5;

                  return (
                    <div key={card.id} className="glass-card p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-base font-bold text-white mb-1">
                            {card.card_user?.username || 'Unknown'}
                          </h3>
                          {card.owner?.username && card.owner_id !== card.card_user_id && (
                            <div className="flex items-center gap-1 mt-1">
                              <User className="w-3 h-3 text-[#00E0FF]/60" />
                              <span className="text-xs text-[#B0B8C8]">
                                Managed by{' '}
                                <button
                                  onClick={() => navigate(`/profile/${card.owner!.username}`)}
                                  className="text-[#00E0FF] hover:text-white transition-colors"
                                >
                                  @{card.owner.username}
                                </button>
                              </span>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => navigate(`/profile/${card.card_user?.username}`)}
                          className="p-2 rounded-lg bg-[rgba(0,224,255,0.08)] border border-[rgba(0,224,255,0.2)] text-[#00E0FF] hover:bg-[rgba(0,224,255,0.15)] transition-all text-xs font-semibold px-3"
                        >
                          View Card
                        </button>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-2.5 bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] rounded-lg">
                          <span className="text-xs text-[#B0B8C8]">Current Value</span>
                          <span className="font-semibold text-[#00E0FF] text-sm">{card.current_price.toFixed(2)} coins</span>
                        </div>

                        <div className="flex justify-between items-center p-2.5 bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] rounded-lg">
                          <span className="text-xs text-[#B0B8C8]">You Paid</span>
                          <span className="font-semibold text-white text-sm">{purchasePrice.toFixed(2)} coins</span>
                        </div>

                        <div className="flex justify-between items-center p-2.5 bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] rounded-lg">
                          <span className="text-xs text-[#B0B8C8]">If You Sell at {card.current_price.toFixed(2)}</span>
                          <span className="font-semibold text-[#38BDF8] text-sm">{potentialEarnings.toFixed(2)} coins</span>
                        </div>

                        {profit > 0 && (
                          <div className="flex justify-between items-center p-2.5 bg-[rgba(15,24,41,0.85)] border border-[rgba(0,255,133,0.2)] rounded-lg">
                            <span className="text-xs text-[#B0B8C8]">Your Profit</span>
                            <span className="font-semibold text-[#00FF85] text-sm">
                              +{profit.toFixed(2)} coins
                            </span>
                          </div>
                        )}

                        {card.card_user_id === profile?.id && card.owner_id !== profile?.id && (
                          <button
                            onClick={() => handleBuyMyselfOut(card)}
                            disabled={purchasing === card.id || balance < card.current_price + 100}
                            className={`w-full px-4 py-2.5 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 text-xs mt-1 ${
                              balance < card.current_price + 100
                                ? 'bg-[rgba(239,68,68,0.08)] text-red-300/70 cursor-not-allowed border border-[rgba(239,68,68,0.2)]'
                                : 'bg-[rgba(251,191,36,0.1)] hover:bg-[rgba(251,191,36,0.18)] text-amber-400 border border-[rgba(251,191,36,0.3)] hover:border-[rgba(251,191,36,0.5)]'
                            }`}
                          >
                            <User className="w-3.5 h-3.5" />
                            Buy Back ({(card.current_price + 100).toFixed(2)} coins)
                          </button>
                        )}
                        {card.is_listed_for_sale ? (
                          <div className="p-2.5 bg-[rgba(15,24,41,0.85)] border border-[rgba(0,255,133,0.2)] rounded-lg text-center">
                            <div className="flex items-center justify-center gap-2 text-[#00FF85] mb-1">
                              <Tag className="w-3.5 h-3.5" />
                              <span className="text-xs font-semibold">Listed for Sale</span>
                            </div>
                            <p className="text-sm font-bold text-[#00FF85]">
                              {card.current_price?.toFixed(2)} coins
                            </p>
                          </div>
                        ) : (
                          <button
                            onClick={() => navigate(`/profile/${card.card_user?.username}`)}
                            className="w-full px-4 py-2.5 bg-[rgba(0,224,255,0.08)] hover:bg-[rgba(0,224,255,0.15)] text-[#00E0FF] border border-[rgba(0,224,255,0.2)] hover:border-[rgba(0,224,255,0.4)] rounded-lg transition-all font-semibold text-xs"
                          >
                            List for Sale at {card.current_price.toFixed(2)} coins
                          </button>
                        )}
                      </div>

                      {card.times_traded > 0 && (
                        <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
                          <p className="text-xs text-[#B0B8C8]/60">Traded {card.times_traded} times</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {selectedTab === 'not-bought' && (
          <NotBoughtCardsTab onRequestSent={() => {
            refetchBalance();
            loadData(true);
          }} />
        )}

        {selectedTab === 'purchased' && (
          <PurchasedCardsTab onSwapRequested={() => {
            refetchBalance();
            loadData(true);
          }} />
        )}

        {selectedTab === 'swap' && (
          <CardSwapTab
            onSwapComplete={() => {
              refetchBalance();
              loadData(true);
            }}
          />
        )}

        {selectedTab === 'discard' && (
          <CardDiscardTab />
        )}

        {selectedTab === 'leaderboards' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                Most Valuable Cards
              </h2>
              <div className="glass-container overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[rgba(15,24,41,0.85)] border-b border-[rgba(0,224,255,0.15)]">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-bold text-[#B0B8C8] uppercase tracking-wider">Rank</th>
                        <th className="px-5 py-3 text-left text-xs font-bold text-[#B0B8C8] uppercase tracking-wider">Player</th>
                        <th className="px-5 py-3 text-left text-xs font-bold text-[#B0B8C8] uppercase tracking-wider">Balance</th>
                        <th className="px-5 py-3 text-left text-xs font-bold text-[#B0B8C8] uppercase tracking-wider">Owner</th>
                        <th className="px-5 py-3 text-left text-xs font-bold text-[#B0B8C8] uppercase tracking-wider">Value</th>
                        <th className="px-5 py-3 text-left text-xs font-bold text-[#B0B8C8] uppercase tracking-wider">Trades</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(0,224,255,0.08)]">
                      {mostValuable.map((card, index) => (
                        <tr key={card.id} className="hover:bg-[rgba(0,224,255,0.04)] transition-colors">
                          <td className="px-5 py-3.5">
                            <span className={`font-bold text-sm ${index < 3 ? 'text-amber-400' : 'text-[#B0B8C8]/50'}`}>
                              #{index + 1}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <button
                              onClick={() => navigate(`/profile/${card.card_user?.username}`)}
                              className="text-[#00E0FF] hover:text-white font-semibold text-sm transition-colors"
                            >
                              {card.card_user?.username || 'Unknown'}
                            </button>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-[#00FF85] font-medium text-sm">
                              {card.card_user_id && userBalances.has(card.card_user_id)
                                ? formatCoinBalance(userBalances.get(card.card_user_id) || 0)
                                : '---'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-[#B0B8C8] text-sm">
                            {card.owner?.username || 'Unknown'}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="font-semibold text-[#00E0FF] text-sm">{card.current_price.toFixed(2)}</span>
                          </td>
                          <td className="px-5 py-3.5 text-[#B0B8C8] text-sm">{card.times_traded}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#00FF85]" />
                Most Traded Cards
              </h2>
              <div className="glass-container overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[rgba(15,24,41,0.85)] border-b border-[rgba(0,224,255,0.15)]">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-bold text-[#B0B8C8] uppercase tracking-wider">Rank</th>
                        <th className="px-5 py-3 text-left text-xs font-bold text-[#B0B8C8] uppercase tracking-wider">Player</th>
                        <th className="px-5 py-3 text-left text-xs font-bold text-[#B0B8C8] uppercase tracking-wider">Balance</th>
                        <th className="px-5 py-3 text-left text-xs font-bold text-[#B0B8C8] uppercase tracking-wider">Owner</th>
                        <th className="px-5 py-3 text-left text-xs font-bold text-[#B0B8C8] uppercase tracking-wider">Trades</th>
                        <th className="px-5 py-3 text-left text-xs font-bold text-[#B0B8C8] uppercase tracking-wider">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(0,224,255,0.08)]">
                      {mostTraded.map((card, index) => (
                        <tr key={card.id} className="hover:bg-[rgba(0,224,255,0.04)] transition-colors">
                          <td className="px-5 py-3.5">
                            <span className={`font-bold text-sm ${index < 3 ? 'text-[#00FF85]' : 'text-[#B0B8C8]/50'}`}>
                              #{index + 1}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <button
                              onClick={() => navigate(`/profile/${card.card_user?.username}`)}
                              className="text-[#00E0FF] hover:text-white font-semibold text-sm transition-colors"
                            >
                              {card.card_user?.username || 'Unknown'}
                            </button>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-[#00FF85] font-medium text-sm">
                              {card.card_user_id && userBalances.has(card.card_user_id)
                                ? formatCoinBalance(userBalances.get(card.card_user_id) || 0)
                                : '---'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-[#B0B8C8] text-sm">
                            {card.owner?.username || 'Unknown'}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="font-semibold text-[#00FF85] text-sm">{card.times_traded}</span>
                          </td>
                          <td className="px-5 py-3.5 text-[#00E0FF] text-sm">{card.current_price.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
