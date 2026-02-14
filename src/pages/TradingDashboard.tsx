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
  getPendingPurchaseRequests,
  approvePurchaseRequest,
  declinePurchaseRequest,
  type CardOwnership,
  type PurchaseRequest
} from '../lib/cardTrading';
import { useCoinBalance } from '../hooks/useCoinBalance';
import { ArrowLeft, Coins, TrendingUp, Tag, ShoppingCart, Bell, Trophy, Check, X, Store, User, Repeat, Trash2, Star, Users, RefreshCw, AlertTriangle } from 'lucide-react';
import { getMultipleUserBalances } from '../lib/balances';
import { formatCoinBalance } from '../lib/formatBalance';
import { ShimmerBar, StaggerItem, SlowLoadMessage } from '../components/ui/Shimmer';
import { SkeletonAvatar } from '../components/ui/SkeletonPresets';
import { SkeletonReceipt } from '../components/ui/HighValueSkeletons';
import CardSwapTab from '../components/CardSwapTab';
import CardDiscardTab from '../components/CardDiscardTab';
import NotBoughtCardsTab from '../components/NotBoughtCardsTab';
import NoManagerCardsTab from '../components/NoManagerCardsTab';
import { markNotificationsReadBatch } from '../lib/notifications';

type TabKey = 'marketplace' | 'portfolio' | 'requests' | 'swap' | 'discard' | 'leaderboards' | 'not-bought' | 'no-manager';

export default function TradingDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { balance, refetch: refetchBalance } = useCoinBalance();
  const [ownedCards, setOwnedCards] = useState<CardOwnership[]>([]);
  const [pendingPurchaseRequests, setPendingPurchaseRequests] = useState<PurchaseRequest[]>([]);
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
      const [cards, purchaseReqs, valuable, traded, listed] = await Promise.all([
        getCardsOwnedByUser(profile.id),
        getPendingPurchaseRequests(profile.id),
        getMostValuableCards(10),
        getMostTradedCards(10),
        getListedCardsForSale()
      ]);

      setOwnedCards(cards);
      setPendingPurchaseRequests(purchaseReqs);
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

  const handleApprovePurchaseRequest = async (requestId: string) => {
    if (!confirm('Approve this purchase request? The card will be transferred to the buyer.')) return;

    try {
      const result = await approvePurchaseRequest(requestId);
      if (result.success) {
        alert('Purchase request approved! Card transferred successfully.');
        refetchBalance();
        loadData(true);
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error approving request:', error);
      alert('Failed to approve request. Please try again.');
    }
  };

  const handleDeclinePurchaseRequest = async (requestId: string) => {
    try {
      const result = await declinePurchaseRequest(requestId);
      if (result.success) {
        alert('Purchase request declined.');
        loadData(true);
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error declining request:', error);
      alert('Failed to decline request. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <StaggerItem index={0} className="flex items-center gap-3">
            <ShimmerBar className="w-8 h-8 rounded" />
            <ShimmerBar className="h-7 w-56 rounded" />
          </StaggerItem>
          <StaggerItem index={1} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-2">
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
              <div key={i} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
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
    <div className="min-h-screen bg-black">
      <nav className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/settings')}
                className="text-gray-300 hover:text-cyan-400 transition-colors bg-none border-none cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-white">Card Trading</h1>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg transition-all disabled:opacity-50 border border-gray-700"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium hidden sm:inline">
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loadError && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-sm flex-1">{loadError}</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition-all"
            >
              Retry
            </button>
          </div>
        )}

        <div className="mb-8 bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-600/50 rounded-xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-black" />
                </div>
                <span className="text-sm text-gray-400">Cards Owned</span>
              </div>
              <p className="text-3xl font-bold text-white">{ownedCards.length}</p>
            </div>

            <div className="p-4 bg-gradient-to-br from-cyan-900/30 to-blue-900/30 border border-cyan-600/50 rounded-xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
                  <Coins className="w-5 h-5 text-black" />
                </div>
                <span className="text-sm text-gray-400">Portfolio Value</span>
              </div>
              <p className="text-3xl font-bold text-cyan-400">{portfolioValue.toFixed(2)}</p>
            </div>

            <div className="p-4 bg-gradient-to-br from-amber-900/30 to-orange-900/30 border border-amber-600/50 rounded-xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center">
                  <Bell className="w-5 h-5 text-black" />
                </div>
                <span className="text-sm text-gray-400">Pending Requests</span>
              </div>
              <p className="text-3xl font-bold text-white">{pendingPurchaseRequests.length}</p>
            </div>
          </div>
        </div>

        <div className="mb-6 flex gap-4 border-b border-gray-800 overflow-x-auto">
          <button
            onClick={() => setSelectedTab('marketplace')}
            className={`px-6 py-3 font-semibold transition-all whitespace-nowrap ${
              selectedTab === 'marketplace'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Marketplace
          </button>
          <button
            onClick={() => setSelectedTab('not-bought')}
            className={`px-6 py-3 font-semibold transition-all whitespace-nowrap ${
              selectedTab === 'not-bought'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Star className="w-4 h-4 inline mr-1" />
            Not Bought
          </button>
          <button
            onClick={() => setSelectedTab('no-manager')}
            className={`px-6 py-3 font-semibold transition-all whitespace-nowrap ${
              selectedTab === 'no-manager'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 inline mr-1" />
            No Manager
          </button>
          <button
            onClick={() => setSelectedTab('portfolio')}
            className={`px-6 py-3 font-semibold transition-all whitespace-nowrap ${
              selectedTab === 'portfolio'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            My Portfolio
          </button>
          <button
            onClick={() => setSelectedTab('requests')}
            className={`px-6 py-3 font-semibold transition-all relative whitespace-nowrap ${
              selectedTab === 'requests'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Requests
            {pendingPurchaseRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                {pendingPurchaseRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setSelectedTab('swap')}
            className={`px-6 py-3 font-semibold transition-all whitespace-nowrap ${
              selectedTab === 'swap'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Repeat className="w-4 h-4 inline mr-1" />
            Swap
          </button>
          <button
            onClick={() => setSelectedTab('discard')}
            className={`px-6 py-3 font-semibold transition-all whitespace-nowrap ${
              selectedTab === 'discard'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Trash2 className="w-4 h-4 inline mr-1" />
            Discard
          </button>
          <button
            onClick={() => setSelectedTab('leaderboards')}
            className={`px-6 py-3 font-semibold transition-all whitespace-nowrap ${
              selectedTab === 'leaderboards'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Leaderboards
          </button>
        </div>

        {selectedTab === 'marketplace' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Store className="w-6 h-6 text-cyan-400" />
                Cards for Sale
              </h2>
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 rounded-full border border-yellow-500/20">
                <Coins className="w-5 h-5 text-yellow-500" />
                <span className="text-lg font-bold text-yellow-500">{balance.toFixed(2)}</span>
              </div>
            </div>

            {listedCards.length === 0 ? (
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
                <Store className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No cards listed for sale</p>
                <p className="text-gray-500 text-sm mt-2">Check back later or list your own cards!</p>
              </div>
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
                    <div key={card.id} className={`bg-gradient-to-br from-gray-900 to-gray-800 border rounded-2xl p-6 transition-all ${
                      isRestricted ? 'border-red-500/50' : 'border-gray-700 hover:border-cyan-500/50'
                    }`}>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white mb-1">
                            {card.card_user?.username || 'Unknown'}
                          </h3>
                          {card.card_user_id && userBalances.has(card.card_user_id) && (
                            <div className="flex items-center gap-1 mt-1">
                              <Coins className="w-3 h-3 text-yellow-500/70" />
                              <span className="text-xs text-yellow-500/70">
                                {formatCoinBalance(userBalances.get(card.card_user_id) || 0)} balance
                              </span>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => navigate(`/profile/${card.card_user?.username}`)}
                          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-all"
                        >
                          View
                        </button>
                      </div>

                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between items-center p-3 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 rounded-lg border border-yellow-500/30">
                          <span className="text-sm text-yellow-300 font-semibold">Card Value</span>
                          <div className="flex items-center gap-1">
                            <Coins className="w-4 h-4 text-yellow-400" />
                            <span className="font-bold text-yellow-400">{card.current_price.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-cyan-900/20 rounded-lg border border-cyan-600/30">
                          <span className="text-sm text-cyan-300 font-semibold">Fixed Price</span>
                          <div className="flex items-center gap-1">
                            <Coins className="w-4 h-4 text-cyan-400" />
                            <span className="font-bold text-cyan-400 text-lg">{card.current_price?.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
                          <span className="text-xs text-gray-400">After sale</span>
                          <span className="text-sm text-green-400 font-semibold">
                            Value: {(card.current_price + 10).toFixed(2)} (+10)
                          </span>
                        </div>

                        {card.times_traded > 0 && (
                          <div className="flex justify-between items-center p-2 bg-amber-900/20 rounded-lg">
                            <span className="text-xs text-amber-300">Traded {card.times_traded} times</span>
                            <TrendingUp className="w-4 h-4 text-amber-400" />
                          </div>
                        )}

                        {isRestricted && (
                          <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
                            <div className="flex items-start gap-2">
                              <X className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs font-semibold text-red-300 mb-1">Purchase Restricted</p>
                                <p className="text-xs text-red-200">{restrictionReason}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handlePurchaseCard(card)}
                        disabled={!canAfford || isOwnCard || isRestricted}
                        className={`w-full px-4 py-3 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                          isRestricted
                            ? 'bg-red-600/30 text-red-300 cursor-not-allowed border border-red-500/30'
                            : isOwnCard
                            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            : !canAfford
                            ? 'bg-red-600/50 text-red-200 cursor-not-allowed'
                            : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white'
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
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
                <ShoppingCart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">You don't own any cards yet</p>
                <p className="text-gray-500 text-sm mt-2">Visit other players' profiles to purchase their cards!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {ownedCards.map((card) => {
                  const purchasePrice = card.last_purchase_price || card.last_sale_price || 20;
                  const isFirstSale = card.times_traded === 0;
                  const potentialEarnings = isFirstSale ? card.current_price : purchasePrice + 5;
                  const profit = isFirstSale ? card.current_price : 5;

                  return (
                    <div key={card.id} className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white mb-1">
                            {card.card_user?.username || 'Unknown'}
                          </h3>
                        </div>
                        <button
                          onClick={() => navigate(`/profile/${card.card_user?.username}`)}
                          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-all"
                        >
                          View Card
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
                          <span className="text-sm text-gray-400">Current Value</span>
                          <span className="font-semibold text-cyan-400">{card.current_price.toFixed(2)} coins</span>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
                          <span className="text-sm text-gray-400">You Paid</span>
                          <span className="font-semibold text-white">{purchasePrice.toFixed(2)} coins</span>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-blue-900/20 rounded-lg border border-blue-600/30">
                          <span className="text-sm text-blue-300">If You Sell at {card.current_price.toFixed(2)}</span>
                          <span className="font-semibold text-blue-400">{potentialEarnings.toFixed(2)} coins</span>
                        </div>

                        {profit > 0 && (
                          <div className="flex justify-between items-center p-3 bg-green-900/20 rounded-lg border border-green-600/30">
                            <span className="text-sm text-green-300">Your Profit</span>
                            <span className="font-semibold text-green-400">+{profit.toFixed(2)} coins</span>
                          </div>
                        )}

                        {card.is_listed_for_sale ? (
                          <div className="p-3 bg-green-900/20 rounded-lg border border-green-600/30 text-center">
                            <div className="flex items-center justify-center gap-2 text-green-400 mb-1">
                              <Tag className="w-4 h-4" />
                              <span className="text-sm font-semibold">Listed for Sale</span>
                            </div>
                            <p className="text-lg font-bold text-green-300">{card.current_price?.toFixed(2)} coins</p>
                          </div>
                        ) : (
                          <button
                            onClick={() => navigate(`/profile/${card.card_user?.username}`)}
                            className="w-full px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold rounded-lg transition-all"
                          >
                            List for Sale at {card.current_price.toFixed(2)} coins
                          </button>
                        )}
                      </div>

                      {card.times_traded > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                          <p className="text-xs text-gray-500">Traded {card.times_traded} times</p>
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

        {selectedTab === 'requests' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">Purchase Requests</h2>

            {pendingPurchaseRequests.length > 0 && (
              <div className="space-y-4">
                {pendingPurchaseRequests.map((request) => (
                  <div key={request.id} className="bg-gradient-to-br from-gray-900 to-gray-800 border border-cyan-600/50 rounded-2xl p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center">
                            <Star className="w-5 h-5 text-black" />
                          </div>
                          <div>
                            <p className="text-white font-semibold">
                              {request.buyer?.username || 'Unknown'} wants to buy {request.card_user?.username || 'Unknown'}'s card
                            </p>
                            <p className="text-sm text-gray-400">
                              {new Date(request.created_at).toLocaleDateString()} at {new Date(request.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 p-4 bg-gray-800/50 rounded-lg">
                          <p className="text-sm text-gray-400 mb-1">Fixed Price</p>
                          <p className="text-2xl font-bold text-cyan-400">{request.requested_price.toFixed(2)} coins</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {request.request_type === 'not_bought' ? 'First sale (Fixed price)' : 'Current fixed card price'}
                          </p>
                        </div>
                      </div>

                      <div className="flex md:flex-col gap-3">
                        <button
                          onClick={() => handleApprovePurchaseRequest(request.id)}
                          className="flex-1 md:w-32 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-semibold rounded-lg transition-all"
                        >
                          <Check className="w-5 h-5" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleDeclinePurchaseRequest(request.id)}
                          className="flex-1 md:w-32 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg transition-all"
                        >
                          <X className="w-5 h-5" />
                          Decline
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pendingPurchaseRequests.length === 0 && (
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
                <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No pending requests</p>
                <p className="text-gray-500 text-sm mt-2">When someone wants to buy your cards, you'll see their requests here</p>
              </div>
            )}
          </div>
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
                <Trophy className="w-6 h-6 text-yellow-400" />
                Most Valuable Cards
              </h2>
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-800 border-b border-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Rank</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Player</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Balance</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Owner</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Value</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Trades</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {mostValuable.map((card, index) => (
                        <tr key={card.id} className="hover:bg-gray-800/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className={`font-bold ${index < 3 ? 'text-yellow-400' : 'text-gray-400'}`}>
                              #{index + 1}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => navigate(`/profile/${card.card_user?.username}`)}
                              className="text-cyan-400 hover:text-cyan-300 font-semibold"
                            >
                              {card.card_user?.username || 'Unknown'}
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-yellow-500 font-medium">
                              {card.card_user_id && userBalances.has(card.card_user_id)
                                ? formatCoinBalance(userBalances.get(card.card_user_id) || 0)
                                : '---'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-300">
                            {card.owner?.username || 'Unknown'}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-semibold text-cyan-400">{card.current_price.toFixed(2)}</span>
                          </td>
                          <td className="px-6 py-4 text-gray-300">{card.times_traded}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-green-400" />
                Most Traded Cards
              </h2>
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-800 border-b border-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Rank</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Player</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Balance</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Owner</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Trades</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {mostTraded.map((card, index) => (
                        <tr key={card.id} className="hover:bg-gray-800/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className={`font-bold ${index < 3 ? 'text-green-400' : 'text-gray-400'}`}>
                              #{index + 1}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => navigate(`/profile/${card.card_user?.username}`)}
                              className="text-cyan-400 hover:text-cyan-300 font-semibold"
                            >
                              {card.card_user?.username || 'Unknown'}
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-yellow-500 font-medium">
                              {card.card_user_id && userBalances.has(card.card_user_id)
                                ? formatCoinBalance(userBalances.get(card.card_user_id) || 0)
                                : '---'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-300">
                            {card.owner?.username || 'Unknown'}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-semibold text-green-400">{card.times_traded}</span>
                          </td>
                          <td className="px-6 py-4 text-cyan-400">{card.current_price.toFixed(2)}</td>
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
