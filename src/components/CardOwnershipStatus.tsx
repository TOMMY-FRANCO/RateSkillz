import { useState, useEffect } from 'react';
import { Coins, ShoppingCart, TrendingUp, Tag, X, Lock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { CardOwnership } from '../lib/cardTrading';
import { purchaseCardAtFixedPrice, calculatePotentialProfit, getSafeCardValue } from '../lib/cardTrading';
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
    if (showBuyModal) {
      loadBalance();
    }
  }, [showBuyModal]);

  const handleBuyCard = async () => {
    if (!cardOwnership || !currentUserId) return;

    const purchasePrice = safeCardValue;

    if (userBalance < purchasePrice) {
      setError(`Insufficient coins. You need ${purchasePrice.toFixed(2)} coins but only have ${userBalance.toFixed(2)} coins.`);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await purchaseCardAtFixedPrice(cardUserId, currentUserId);

      if (result.success) {
        setShowBuyModal(false);
        setSuccess('Card purchased successfully!');
        onUpdate();
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(result.error || 'Failed to purchase card');
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
              {cardOwnership.current_price.toFixed(2)} coins
            </p>
            <p className="text-xs text-green-300/70 mt-1">Fixed price - no negotiation</p>
          </div>
        )}

        {!currentUserId && (
          <div className="p-4 bg-blue-900/20 border border-blue-600/50 rounded-lg text-center">
            <p className="text-blue-300">Login to trade cards</p>
          </div>
        )}

        {currentUserId && !isCardOfCurrentUser && !isOwner && isListed && (
          <div className="space-y-3">
            <button
              onClick={() => {
                loadBalance();
                setShowBuyModal(true);
              }}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-semibold rounded-lg transition-all"
            >
              <ShoppingCart className="w-5 h-5" />
              Buy Now - {cardOwnership.current_price.toFixed(2)} coins
            </button>
            <p className="text-xs text-center text-gray-400">
              All cards have fixed prices. No negotiation available.
            </p>
          </div>
        )}

        {isOwner && !isCardOfCurrentUser && (
          <div className="space-y-3">
            <div className="p-3 bg-cyan-900/20 rounded-lg border border-cyan-600/30">
              <p className="text-sm text-cyan-300">You own this card</p>
              <p className="text-xl font-bold text-cyan-400 mt-1 flex items-center gap-2">
                <Coins className="w-5 h-5" />
                {cardOwnership.current_price.toFixed(2)} coins
              </p>
              <p className="text-xs text-cyan-300/70 mt-1">
                Card is automatically available for purchase at fixed price
              </p>
            </div>

            {cardOwnership.last_sale_price && potentialProfit > 0 && (
              <div className="p-3 bg-green-900/20 rounded-lg border border-green-600/30">
                <p className="text-sm text-green-300">Your Profit When Sold</p>
                <p className="text-lg font-bold text-green-400 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  +{potentialProfit.toFixed(2)} coins
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  You paid: {cardOwnership.last_sale_price.toFixed(2)} | Current value: {cardOwnership.current_price.toFixed(2)}
                </p>
              </div>
            )}

            <div className="p-3 bg-blue-900/20 border border-blue-600/30 rounded-lg">
              <p className="text-xs text-blue-300">
                When sold, card value increases by 10 coins. You receive payment automatically.
              </p>
            </div>
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
            <h3 className="text-xl font-bold text-white mb-4">Confirm Purchase - Fixed Price</h3>

            <div className="space-y-4 mb-6">
              <div className="p-4 bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-400">You Will Pay</p>
                <p className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
                  <Coins className="w-6 h-6" />
                  {safeCardValue.toFixed(2)} coins
                </p>
                <p className="text-xs text-gray-400 mt-1">Fixed price - no negotiation</p>
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
                disabled={loading || balanceLoading || userBalance < safeCardValue}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Processing...' : 'Confirm Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
