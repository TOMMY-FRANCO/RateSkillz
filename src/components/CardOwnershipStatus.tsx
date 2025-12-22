import { useState, useEffect } from 'react';
import { Coins, ShoppingCart, TrendingUp, Tag, X, Check, DollarSign, Lock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { CardOwnership } from '../lib/cardTrading';
import { createCardOffer, listCardForSale, unlistCardFromSale, calculatePotentialProfit, getSafeCardValue } from '../lib/cardTrading';
import { getCoinBalance } from '../lib/coins';

interface CardOwnershipStatusProps {
  cardOwnership: CardOwnership | null;
  currentUserId: string | null;
  cardUserId: string;
  onUpdate: () => void;
}

export default function CardOwnershipStatus({
  cardOwnership,
  currentUserId,
  cardUserId,
  onUpdate
}: CardOwnershipStatusProps) {
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const isOwner = cardOwnership?.owner_id === currentUserId;
  const isCardOfCurrentUser = cardUserId === currentUserId;
  const isListed = cardOwnership?.is_listed_for_sale || false;
  const safeCardValue = getSafeCardValue(cardOwnership);

  const loadBalance = async () => {
    if (currentUserId) {
      setBalanceLoading(true);
      try {
        const balance = await getCoinBalance();
        setUserBalance(balance);
      } catch (err) {
        console.error('Error loading balance:', err);
      } finally {
        setBalanceLoading(false);
      }
    }
  };

  useEffect(() => {
    if (showBuyModal || showOfferModal) {
      loadBalance();
    }
  }, [showBuyModal, showOfferModal]);

  const handleBuyCard = async () => {
    if (!cardOwnership || !currentUserId) return;

    const purchasePrice = cardOwnership.asking_price || safeCardValue;

    if (userBalance < purchasePrice) {
      setError(`Insufficient coins. You need ${purchasePrice.toFixed(2)} coins but only have ${userBalance.toFixed(2)} coins.`);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await createCardOffer(
        cardUserId,
        currentUserId,
        purchasePrice,
        'purchase_request'
      );

      if (result.success) {
        setShowBuyModal(false);
        setSuccess('Purchase request sent successfully!');
        onUpdate();
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(result.error || 'Failed to create purchase request');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleMakeOffer = async () => {
    if (!cardOwnership || !currentUserId) return;

    const amount = parseFloat(offerAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid offer amount');
      return;
    }

    if (amount > userBalance) {
      setError(`Insufficient coins. You need ${amount.toFixed(2)} coins but only have ${userBalance.toFixed(2)} coins.`);
      return;
    }

    if (amount < safeCardValue) {
      setError(`Offer must be at least ${safeCardValue.toFixed(2)} coins (current card value)`);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await createCardOffer(
        cardUserId,
        currentUserId,
        amount,
        'offer',
        offerMessage || null
      );

      if (result.success) {
        setShowOfferModal(false);
        setOfferAmount('');
        setOfferMessage('');
        setSuccess('Offer sent successfully!');
        onUpdate();
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(result.error || 'Failed to create offer');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleListForSale = async () => {
    if (!cardOwnership || !currentUserId) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await listCardForSale(cardUserId, currentUserId, safeCardValue);

      if (result.success) {
        setShowListModal(false);
        setSuccess(`Card listed for sale at ${safeCardValue.toFixed(2)} coins!`);
        onUpdate();
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(result.error || 'Failed to list card');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlist = async () => {
    if (!cardOwnership || !currentUserId) return;

    if (!confirm('Are you sure you want to remove this card from sale?')) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await unlistCardFromSale(cardUserId, currentUserId);

      if (result.success) {
        setSuccess('Card removed from sale successfully!');
        onUpdate();
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(result.error || 'Failed to unlist card');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!cardOwnership) {
    return (
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
        <p className="text-gray-400 text-center">Card ownership information not available</p>
      </div>
    );
  }

  const potentialProfit = cardOwnership.last_sale_price
    ? calculatePotentialProfit(cardOwnership.last_sale_price, cardOwnership.current_price)
    : 0;

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <ShoppingCart className="w-5 h-5 text-cyan-400" />
        Card Trading
      </h3>

      {success && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-600/50 rounded-lg flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-green-300 text-sm">{success}</p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-600/50 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
          <div>
            <p className="text-sm text-gray-400">Card Owner</p>
            <p className="text-lg font-semibold text-white">
              {isCardOfCurrentUser ? 'You' : cardOwnership.owner?.username || 'Unknown'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Current Value</p>
            <p className="text-lg font-bold text-cyan-400 flex items-center gap-1">
              <Coins className="w-4 h-4" />
              {cardOwnership.current_price.toFixed(2)}
            </p>
          </div>
        </div>

        {cardOwnership.times_traded > 0 && (
          <div className="flex items-center justify-between p-3 bg-purple-900/20 rounded-lg border border-purple-600/30">
            <span className="text-sm text-purple-300">Times Traded</span>
            <span className="font-semibold text-purple-400">{cardOwnership.times_traded}</span>
          </div>
        )}

        {isListed && (
          <div className="p-3 bg-green-900/20 rounded-lg border border-green-600/30">
            <div className="flex items-center gap-2 text-green-400 mb-1">
              <Tag className="w-4 h-4" />
              <span className="font-semibold">Listed for Sale</span>
            </div>
            <p className="text-2xl font-bold text-green-300">
              {cardOwnership.asking_price?.toFixed(2)} coins
            </p>
          </div>
        )}

        {!currentUserId && (
          <div className="p-4 bg-blue-900/20 border border-blue-600/50 rounded-lg text-center">
            <p className="text-blue-300">Login to trade cards</p>
          </div>
        )}

        {currentUserId && !isCardOfCurrentUser && !isOwner && (
          <div className="space-y-3">
            {isListed ? (
              <button
                onClick={() => {
                  loadBalance();
                  setShowBuyModal(true);
                }}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-semibold rounded-lg transition-all"
              >
                <ShoppingCart className="w-5 h-5" />
                Buy for {cardOwnership.asking_price?.toFixed(2)} coins
              </button>
            ) : (
              <button
                onClick={() => {
                  loadBalance();
                  setShowOfferModal(true);
                }}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-400 hover:to-purple-400 text-white font-semibold rounded-lg transition-all"
              >
                <DollarSign className="w-5 h-5" />
                Make Offer
              </button>
            )}
          </div>
        )}

        {isOwner && !isCardOfCurrentUser && (
          <div className="space-y-3">
            {isListed ? (
              <div className="space-y-3">
                <div className="p-3 bg-yellow-900/20 rounded-lg border border-yellow-600/30">
                  <p className="text-sm text-yellow-300">Your card is listed for sale</p>
                  <p className="text-xl font-bold text-yellow-400 mt-1">
                    {cardOwnership.asking_price?.toFixed(2)} coins
                  </p>
                </div>
                {cardOwnership.card_user_id !== currentUserId && (
                  <button
                    onClick={handleUnlist}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
                  >
                    <X className="w-5 h-5" />
                    Remove from Sale
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowListModal(true)}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold rounded-lg transition-all"
              >
                <Tag className="w-5 h-5" />
                List for Sale at {cardOwnership.current_price.toFixed(2)} coins
              </button>
            )}

            {cardOwnership.last_sale_price && potentialProfit > 0 && (
              <div className="p-3 bg-green-900/20 rounded-lg border border-green-600/30">
                <p className="text-sm text-green-300">Potential Profit</p>
                <p className="text-lg font-bold text-green-400 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  +{potentialProfit.toFixed(2)} coins
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  You paid: {cardOwnership.last_sale_price.toFixed(2)} | Current value: {cardOwnership.current_price.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        )}

        {isCardOfCurrentUser && (
          <div className="p-4 bg-blue-900/20 border border-blue-600/50 rounded-lg">
            <div className="flex items-center gap-2 text-blue-300 mb-2">
              <Lock className="w-4 h-4" />
              <span className="font-semibold">This is your card</span>
            </div>
            <p className="text-sm text-gray-400">
              {isOwner
                ? "You currently own your card. Once someone purchases it, you cannot buy it back."
                : "Someone else owns your card. You can make an offer to buy it back!"}
            </p>
          </div>
        )}
      </div>

      {showBuyModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Confirm Purchase</h3>

            <div className="space-y-4 mb-6">
              <div className="p-4 bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-400">You Will Pay</p>
                <p className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
                  <Coins className="w-6 h-6" />
                  {(cardOwnership.asking_price || safeCardValue).toFixed(2)} coins
                </p>
              </div>

              <div className="p-4 bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-400">Your Balance</p>
                {balanceLoading ? (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading...</span>
                  </div>
                ) : (
                  <p className="text-lg font-semibold text-white">
                    {userBalance.toFixed(2)} coins
                  </p>
                )}
              </div>

              <div className="p-4 bg-purple-900/20 border border-purple-600/50 rounded-lg space-y-2">
                <p className="text-sm font-semibold text-purple-300">Payment Breakdown:</p>
                {cardOwnership.times_traded === 0 ? (
                  <div className="space-y-1">
                    <p className="text-sm text-gray-300">
                      Seller receives: <span className="font-semibold text-white">{safeCardValue.toFixed(2)} coins</span> (100%)
                    </p>
                    <p className="text-xs text-gray-400 italic">First time this card is being sold - seller is the original owner</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-300">
                      Current seller receives: <span className="font-semibold text-white">{(safeCardValue - 5).toFixed(2)} coins</span>
                    </p>
                    <p className="text-xs text-gray-400 ml-4">
                      = Their investment + 5 coin profit
                    </p>
                    <p className="text-sm text-gray-300">
                      Original owner royalty: <span className="font-semibold text-green-400">+5.00 coins</span>
                    </p>
                    <div className="pt-2 mt-2 border-t border-purple-600/30">
                      <p className="text-xs text-gray-400 italic">Your {safeCardValue.toFixed(2)} coins split: {(safeCardValue - 5).toFixed(2)} to seller + 5.00 to original owner</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-blue-900/20 border border-blue-600/50 rounded-lg">
                <p className="text-sm text-blue-300">
                  After purchase, card value increases by <span className="font-bold">10 coins</span> to <span className="font-bold">{(safeCardValue + 10).toFixed(2)} coins</span>
                </p>
                {cardOwnership.times_traded > 0 && (
                  <p className="text-xs text-blue-300/70 mt-1">
                    When you resell, you'll get your {safeCardValue.toFixed(2)} back + 5 coin profit
                  </p>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-900/20 border border-red-600/50 rounded-lg">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowBuyModal(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleBuyCard}
                disabled={loading || balanceLoading || userBalance < (cardOwnership.asking_price || 0)}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Processing...' : 'Confirm Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showOfferModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Make an Offer</h3>

            <div className="space-y-4 mb-6">
              <div className="p-4 bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Current Card Value</p>
                <p className="text-lg font-bold text-cyan-400">
                  {cardOwnership.current_price.toFixed(2)} coins
                </p>
              </div>

              <div className="p-4 bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Your Balance</p>
                <p className="text-lg font-semibold text-white">
                  {userBalance.toFixed(2)} coins
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Offer Amount (coins)
                </label>
                <input
                  type="number"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  placeholder="Enter amount"
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Message (optional)
                </label>
                <textarea
                  value={offerMessage}
                  onChange={(e) => setOfferMessage(e.target.value)}
                  placeholder="Add a message to your offer..."
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-900/20 border border-red-600/50 rounded-lg">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowOfferModal(false);
                  setOfferAmount('');
                  setOfferMessage('');
                  setError(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleMakeOffer}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-400 hover:to-purple-400 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Offer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showListModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Confirm Listing</h3>

            <div className="space-y-4 mb-6">
              {cardOwnership.last_sale_price && (
                <div className="p-4 bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-400">You Paid</p>
                  <p className="text-lg font-semibold text-white">
                    {cardOwnership.last_sale_price.toFixed(2)} coins
                  </p>
                </div>
              )}

              <div className="p-4 bg-cyan-900/20 border border-cyan-600/50 rounded-lg">
                <p className="text-sm text-cyan-300 mb-2">This card will be listed for sale at:</p>
                <p className="text-3xl font-bold text-cyan-400 flex items-center gap-2">
                  <Coins className="w-8 h-8" />
                  {cardOwnership.current_price.toFixed(2)} coins
                </p>
                <p className="text-xs text-cyan-300/70 mt-2">Fixed price based on current card value</p>
              </div>

              <div className="p-3 bg-blue-900/20 border border-blue-600/30 rounded-lg">
                <p className="text-xs text-blue-300">
                  Cards sell at their current value only. Price cannot be changed.
                  After sale, the card value will increase by 10 coins.
                </p>
              </div>

              {cardOwnership.last_sale_price && (
                <div className="p-3 bg-green-900/20 border border-green-600/30 rounded-lg">
                  <p className="text-sm text-green-300">Your Profit When Sold</p>
                  <p className="text-lg font-bold text-green-400">
                    +{calculatePotentialProfit(cardOwnership.last_sale_price, cardOwnership.current_price).toFixed(2)} coins
                  </p>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-900/20 border border-red-600/50 rounded-lg">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowListModal(false);
                  setError(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleListForSale}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
              >
                {loading ? 'Listing...' : 'Confirm Listing'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
