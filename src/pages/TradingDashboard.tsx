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
} from '../lib/cardTrading';
import { useCoinBalance } from '../hooks/useCoinBalance';
import { ArrowLeft, Coins, TrendingUp, Tag, ShoppingCart, Bell, Trophy, Check, X, Store, User, Repeat, Trash2, Star, Users, RefreshCw, AlertTriangle } from 'lucide-react';
import { getMultipleUserBalances } from '../lib/balances';
import { formatCoinBalance } from '../lib/formatBalance';
import { ShimmerBar, StaggerItem, SlowLoadMessage } from '../components/ui/Shimmer';
import { SkeletonAvatar } from '../components/ui/SkeletonPresets';
import { SkeletonReceipt } from '../components/ui/HighValueSkeletons';
import { GlassCard } from '../components/ui/GlassCard';
import { GlassButton } from '../components/ui/GlassButton';
import CardSwapTab from '../components/CardSwapTab';
import CardDiscardTab from '../components/CardDiscardTab';
import NotBoughtCardsTab from '../components/NotBoughtCardsTab';
import NoManagerCardsTab from '../components/NoManagerCardsTab';
import { markNotificationsReadBatch } from '../lib/notifications';

type TabKey = 'marketplace' | 'portfolio' | 'swap' | 'discard' | 'leaderboards' | 'not-bought' | 'no-manager';

const TABS: { key: TabKey; label: string; icon?: typeof Star }[] = [
  { key: 'marketplace', label: 'Marketplace' },
  { key: 'not-bought', label: 'Not Bought', icon: Star },
  { key: 'no-manager', label: 'No Manager', icon: Users },
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<TabKey>('marketplace');
  const [userBalances, setUserBalances] = useState<Map<string, number>>(new Map());
  const [restrictedCards, setRestrictedCards] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (profile) {
      loadData();
      markNotificationsReadBatch(profile.id, ['swap_offer', 'purchase_offer', 'card_sold', 'purchase_request']);
    }
  }, [profile?.id]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!profile) return;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setLoadError(null);

    try {
      const [cards, valuable, traded, listed] = await Promise.all([
        getCardsOwnedByUser(profile.id),
        getMostValuableCards(10),
        getMostTradedCards(10),
        getListedCardsForSale()
      ]);

      setOwnedCards(cards);
      setPortfolioValue(calculatePortfolioValue(cards));
      setMostValuable(valuable);
      setMostTraded(traded);
      setListedCards(listed);

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

      setUserBalances(balances);

      const cardRestrictions = new Map<string, string>();
      listed.forEach(card => {
        const reason = ownerRestrictions.get(card.owner_id);
        if (reason) {
          cardRestrictions.set(card.id, reason);
        }
      });
      setRestrictedCards(cardRestrictions);
    } catch (error) {
      console.error('Error loading trading data:', error);
      setLoadError('Failed to load trading data. Pull down to try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  const handleRefresh = () => {
    if (refreshing) return;
    loadData(true);
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
      <div className="min-h-screen p-6" style={{ background: 'linear-gradient(180deg, #0A1128 0%, #000000 100%)' }}>
        <div className="max-w-7xl mx-auto space-y-6">
          <StaggerItem index={0} className="flex items-center gap-3">
            <ShimmerBar className="w-8 h-8 rounded" />
            <ShimmerBar className="h-7 w-56 rounded" />
          </StaggerItem>
          <StaggerItem index={1} className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-[rgba(255,255,255,0.05)] backdrop-blur-[15px] border border-[rgba(0,224,255,0.15)] rounded-xl p-4 space-y-2">
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
              <div key={i} className="bg-[rgba(255,255,255,0.05)] backdrop-blur-[15px] border border-[rgba(0,224,255,0.15)] rounded-xl p-4">
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
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0A1128 0%, #000000 100%)' }}>
      <nav className="bg-[rgba(10,17,40,0.9)] backdrop-blur-[20px] border-b border-[rgba(0,224,255,0.15)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-slate-400 hover:text-[#00E0FF] transition-colors bg-none border-none cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-white tracking-wide">Card Trading</h1>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(0,224,255,0.1)] text-slate-300 hover:text-[#00E0FF] rounded-lg transition-all disabled:opacity-50 border border-[rgba(0,224,255,0.2)] hover:border-[rgba(0,224,255,0.4)] backdrop-blur-[15px]"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium hidden sm:inline">
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

        <GlassCard className="mb-8 !p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-4 bg-[rgba(0,255,133,0.06)] border border-[rgba(0,255,133,0.2)] rounded-xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-[rgba(0,255,133,0.15)] border border-[rgba(0,255,133,0.3)] rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-[#00FF85]" />
                </div>
                <span className="text-sm text-slate-400">Cards Owned</span>
              </div>
              <p className="text-3xl font-bold text-white">{ownedCards.length}</p>
            </div>

            <div className="p-4 bg-[rgba(0,224,255,0.06)] border border-[rgba(0,224,255,0.2)] rounded-xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-[rgba(0,224,255,0.15)] border border-[rgba(0,224,255,0.3)] rounded-lg flex items-center justify-center">
                  <Coins className="w-5 h-5 text-[#00E0FF]" />
                </div>
                <span className="text-sm text-slate-400">Portfolio Value</span>
              </div>
              <p className="text-3xl font-bold text-[#00E0FF]">{portfolioValue.toFixed(2)}</p>
            </div>

            <div className="p-4 bg-[rgba(251,191,36,0.06)] border border-[rgba(251,191,36,0.2)] rounded-xl">
  <div className="flex items-center gap-3 mb-2">
    <div className="w-10 h-10 bg-[rgba(251,191,36,0.15)] border border-[rgba(251,191,36,0.3)] rounded-lg flex items-center justify-center">
      <TrendingUp className="w-5 h-5 text-amber-400" />
    </div>
    <span className="text-sm text-slate-400">Total Trades</span>
  </div>
  <p className="text-3xl font-bold text-amber-400">{ownedCards.reduce((t, c) => t + c.times_traded, 0)}</p>
</div>

        <div className="mb-6 flex gap-1 border-b border-[rgba(0,224,255,0.1)] overflow-x-auto scrollbar-hide pb-px">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setSelectedTab(tab.key)}
                className={`px-5 py-3 font-semibold transition-all whitespace-nowrap text-sm relative ${
                  selectedTab === tab.key
                    ? 'text-[#00E0FF] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#00E0FF] after:shadow-[0_0_10px_rgba(0,224,255,0.6)]'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />}
                {tab.label}
                {tab.key === 'requests' && pendingPurchaseRequests.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.5)]">
                    {pendingPurchaseRequests.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {selectedTab === 'marketplace' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
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

            {listedCards.length === 0 ? (
              <GlassCard className="!p-12 text-center">
                <Store className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">No cards listed for sale</p>
                <p className="text-slate-500 text-sm mt-2">Check back later or list your own cards!</p>
              </GlassCard>
            ) : (
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
                      className={`bg-[rgba(255,255,255,0.04)] backdrop-blur-[15px] border rounded-2xl p-6 transition-all hover:-translate-y-0.5 ${
                        isRestricted
                          ? 'border-[rgba(239,68,68,0.3)]'
                          : 'border-[rgba(0,224,255,0.12)] hover:border-[rgba(0,224,255,0.35)] hover:shadow-[0_0_30px_rgba(0,224,255,0.08)]'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white mb-1">
                            {card.card_user?.username || 'Unknown'}
                          </h3>
                          {card.card_user_id && userBalances.has(card.card_user_id) && (
                            <div className="flex items-center gap-1 mt-1">
                              <Coins className="w-3 h-3 text-[#00FF85]/60" />
                              <span className="text-xs text-[#00FF85]/60">
                                {formatCoinBalance(userBalances.get(card.card_user_id) || 0)} balance
                              </span>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => navigate(`/profile/${card.card_user?.username}`)}
                          className="px-3 py-1.5 bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(0,224,255,0.1)] text-slate-300 hover:text-[#00E0FF] text-sm rounded-lg transition-all border border-[rgba(0,224,255,0.15)] hover:border-[rgba(0,224,255,0.3)]"
                        >
                          View
                        </button>
                      </div>

                      <div className="space-y-2.5 mb-4">
                        <div className="flex justify-between items-center p-3 bg-[rgba(0,255,133,0.06)] rounded-lg border border-[rgba(0,255,133,0.15)]">
                          <span className="text-sm text-[#00FF85]/80 font-semibold">Card Value</span>
                          <div className="flex items-center gap-1">
                            <Coins className="w-4 h-4 text-[#00FF85]" />
                            <span className="font-bold text-[#00FF85]" style={{ textShadow: '0 0 10px rgba(0,255,133,0.4)' }}>
                              {card.current_price.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-[rgba(0,224,255,0.06)] rounded-lg border border-[rgba(0,224,255,0.15)]">
                          <span className="text-sm text-[#00E0FF]/80 font-semibold">Fixed Price</span>
                          <div className="flex items-center gap-1">
                            <Coins className="w-4 h-4 text-[#00E0FF]" />
                            <span className="font-bold text-[#00E0FF] text-lg" style={{ textShadow: '0 0 10px rgba(0,224,255,0.4)' }}>
                              {card.current_price?.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-[rgba(255,255,255,0.03)] rounded-lg">
                          <span className="text-xs text-slate-500">After sale</span>
                          <span className="text-sm text-[#00FF85] font-semibold">
                            Value: {(card.current_price + 10).toFixed(2)} (+10)
                          </span>
                        </div>

                        {card.times_traded > 0 && (
                          <div className="flex justify-between items-center p-2 bg-[rgba(251,191,36,0.06)] rounded-lg border border-[rgba(251,191,36,0.15)]">
                            <span className="text-xs text-amber-400/80">Traded {card.times_traded} times</span>
                            <TrendingUp className="w-4 h-4 text-amber-400" />
                          </div>
                        )}

                        {isRestricted && (
                          <div className="p-3 bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.25)] rounded-lg">
                            <div className="flex items-start gap-2">
                              <X className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs font-semibold text-red-300 mb-1">Purchase Restricted</p>
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
            )}
          </div>
        )}

        {selectedTab === 'portfolio' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">Cards I Own</h2>
            {ownedCards.length === 0 ? (
              <GlassCard className="!p-12 text-center">
                <ShoppingCart className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">You don't own any cards yet</p>
                <p className="text-slate-500 text-sm mt-2">Visit other players' profiles to purchase their cards!</p>
              </GlassCard>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {ownedCards.map((card) => {
                  const purchasePrice = card.last_purchase_price || card.last_sale_price || 20;
                  const isFirstSale = card.times_traded === 0;
                  const potentialEarnings = isFirstSale ? card.current_price : purchasePrice + 5;
                  const profit = isFirstSale ? card.current_price : 5;

                  return (
                    <div key={card.id} className="bg-[rgba(255,255,255,0.04)] backdrop-blur-[15px] border border-[rgba(0,224,255,0.12)] rounded-2xl p-6 transition-all hover:border-[rgba(0,224,255,0.3)]">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white mb-1">
                            {card.card_user?.username || 'Unknown'}
                          </h3>
                        </div>
                        <button
                          onClick={() => navigate(`/profile/${card.card_user?.username}`)}
                          className="px-4 py-2 bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(0,224,255,0.1)] text-slate-300 hover:text-[#00E0FF] text-sm rounded-lg transition-all border border-[rgba(0,224,255,0.15)] hover:border-[rgba(0,224,255,0.3)]"
                        >
                          View Card
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        <div className="flex justify-between items-center p-3 bg-[rgba(255,255,255,0.03)] rounded-lg">
                          <span className="text-sm text-slate-400">Current Value</span>
                          <span className="font-semibold text-[#00E0FF]">{card.current_price.toFixed(2)} coins</span>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-[rgba(255,255,255,0.03)] rounded-lg">
                          <span className="text-sm text-slate-400">You Paid</span>
                          <span className="font-semibold text-white">{purchasePrice.toFixed(2)} coins</span>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-[rgba(56,189,248,0.06)] rounded-lg border border-[rgba(56,189,248,0.15)]">
                          <span className="text-sm text-[#38BDF8]/80">If You Sell at {card.current_price.toFixed(2)}</span>
                          <span className="font-semibold text-[#38BDF8]">{potentialEarnings.toFixed(2)} coins</span>
                        </div>

                        {profit > 0 && (
                          <div className="flex justify-between items-center p-3 bg-[rgba(0,255,133,0.06)] rounded-lg border border-[rgba(0,255,133,0.15)]">
                            <span className="text-sm text-[#00FF85]/80">Your Profit</span>
                            <span className="font-semibold text-[#00FF85]" style={{ textShadow: '0 0 8px rgba(0,255,133,0.3)' }}>
                              +{profit.toFixed(2)} coins
                            </span>
                          </div>
                        )}

                        {card.card_user_id === profile?.id && card.owner_id !== profile?.id && (
                          <button
                            onClick={() => handleBuyMyselfOut(card)}
                            disabled={purchasing === card.id || balance < card.current_price + 100}
                            className={`w-full px-4 py-3 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 text-sm mt-2 ${
                              balance < card.current_price + 100
                                ? 'bg-[rgba(239,68,68,0.1)] text-red-300/70 cursor-not-allowed border border-[rgba(239,68,68,0.15)]'
                                : 'bg-[rgba(251,191,36,0.12)] hover:bg-[rgba(251,191,36,0.2)] text-amber-400 border border-[rgba(251,191,36,0.3)] hover:border-[rgba(251,191,36,0.5)]'
                            }`}
                          >
                            <User className="w-4 h-4" />
                            Buy Back ({(card.current_price + 100).toFixed(2)} coins)
                          </button>
                        )}
                        {card.is_listed_for_sale ? (
                          <div className="p-3 bg-[rgba(0,255,133,0.06)] rounded-lg border border-[rgba(0,255,133,0.2)] text-center">
                            <div className="flex items-center justify-center gap-2 text-[#00FF85] mb-1">
                              <Tag className="w-4 h-4" />
                              <span className="text-sm font-semibold">Listed for Sale</span>
                            </div>
                            <p className="text-lg font-bold text-[#00FF85]" style={{ textShadow: '0 0 10px rgba(0,255,133,0.3)' }}>
                              {card.current_price?.toFixed(2)} coins
                            </p>
                          </div>
                        ) : (
                          <GlassButton
                            variant="primary"
                            onClick={() => navigate(`/profile/${card.card_user?.username}`)}
                            className="w-full !py-2.5 !text-xs"
                          >
                            List for Sale at {card.current_price.toFixed(2)} coins
                          </GlassButton>
                        )}
                        
                      </div>

                      {card.times_traded > 0 && (
                        <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
                          <p className="text-xs text-slate-500">Traded {card.times_traded} times</p>
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

        {selectedTab === 'no-manager' && (
          <NoManagerCardsTab onRequestSent={() => {
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
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-amber-400" />
                Most Valuable Cards
              </h2>
              <GlassCard className="!p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[rgba(255,255,255,0.04)] border-b border-[rgba(0,224,255,0.1)]">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Rank</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Player</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Balance</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Owner</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Value</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Trades</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
                      {mostValuable.map((card, index) => (
                        <tr key={card.id} className="hover:bg-[rgba(0,224,255,0.03)] transition-colors">
                          <td className="px-6 py-4">
                            <span className={`font-bold ${index < 3 ? 'text-amber-400' : 'text-slate-500'}`}>
                              #{index + 1}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => navigate(`/profile/${card.card_user?.username}`)}
                              className="text-[#00E0FF] hover:text-[#5FFFFF] font-semibold transition-colors"
                            >
                              {card.card_user?.username || 'Unknown'}
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[#00FF85]/70 font-medium">
                              {card.card_user_id && userBalances.has(card.card_user_id)
                                ? formatCoinBalance(userBalances.get(card.card_user_id) || 0)
                                : '---'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-400">
                            {card.owner?.username || 'Unknown'}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-semibold text-[#00E0FF]">{card.current_price.toFixed(2)}</span>
                          </td>
                          <td className="px-6 py-4 text-slate-400">{card.times_traded}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-[#00FF85]" />
                Most Traded Cards
              </h2>
              <GlassCard className="!p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[rgba(255,255,255,0.04)] border-b border-[rgba(0,224,255,0.1)]">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Rank</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Player</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Balance</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Owner</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Trades</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
                      {mostTraded.map((card, index) => (
                        <tr key={card.id} className="hover:bg-[rgba(0,224,255,0.03)] transition-colors">
                          <td className="px-6 py-4">
                            <span className={`font-bold ${index < 3 ? 'text-[#00FF85]' : 'text-slate-500'}`}>
                              #{index + 1}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => navigate(`/profile/${card.card_user?.username}`)}
                              className="text-[#00E0FF] hover:text-[#5FFFFF] font-semibold transition-colors"
                            >
                              {card.card_user?.username || 'Unknown'}
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[#00FF85]/70 font-medium">
                              {card.card_user_id && userBalances.has(card.card_user_id)
                                ? formatCoinBalance(userBalances.get(card.card_user_id) || 0)
                                : '---'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-400">
                            {card.owner?.username || 'Unknown'}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-semibold text-[#00FF85]">{card.times_traded}</span>
                          </td>
                          <td className="px-6 py-4 text-[#00E0FF]">{card.current_price.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
