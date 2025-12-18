import { useState } from 'react';
import { Coins, ShoppingCart, TrendingUp, Tag, X, Check, DollarSign, Lock } from 'lucide-react';
import type { CardOwnership } from '../lib/cardTrading';
import { createCardOffer, listCardForSale, unlistCardFromSale, calculateMinimumPrice, calculatePotentialProfit } from '../lib/cardTrading';
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
  const [listingPrice, setListingPrice] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userBalance, setUserBalance] = useState<number>(0);

  const isOwner = cardOwnership?.owner_id === currentUserId;
  const isCardOfCurrentUser = cardUserId === currentUserId;
  const isListed = cardOwnership?.is_listed_for_sale || false;

  const loadBalance = async () => {
    if (currentUserId) {
      const balance = await getCoinBalance();
      setUserBalance(balance);
    }
  };

  const handleBuyCard = async () => {
    if (!cardOwnership || !currentUserId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await createCardOffer(
        cardUserId,
        currentUserId,
        cardOwnership.asking_price || cardOwnership.current_price,
        'purchase_request'
      );

      if (result.success) {
        setShowBuyModal(false);
        alert('Purchase request sent! Waiting for owner approval.');
        onUpdate();
      } else {
        setError(result.error || 'Failed to create purchase request');
      }
    } catch (err: any) {
      setError(err.message);
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

    setLoading(true);
    setError(null);

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
        alert('Offer sent! Waiting for owner approval.');
        onUpdate();
      } else {
        setError(result.error || 'Failed to create offer');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleListForSale = async () => {
    if (!cardOwnership || !currentUserId) return;

    const price = parseFloat(listingPrice);
    if (isNaN(price) || price <= 0) {
      setError('Please enter a valid listing price');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await listCardForSale(cardUserId, currentUserId, price);

      if (result.success) {
        setShowListModal(false);
        setListingPrice('');
        alert('Card listed for sale successfully!');
        onUpdate();
      } else {
        if (result.minimum_price) {
          setError(`${result.error}. Minimum price: ${result.minimum_price.toFixed(2)} coins`);
        } else {
          setError(result.error || 'Failed to list card');
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlist = async () => {
    if (!cardOwnership || !currentUserId) return;

    if (!confirm('Are you sure you want to remove this card from sale?')) return;

    setLoading(true);
    setError(null);

    try {
      const result = await unlistCardFromSale(cardUserId, currentUserId);

      if (result.success) {
        alert('Card removed from sale!');
        onUpdate();
      } else {
        setError(result.error || 'Failed to unlist card');
        alert(result.error);
      }
    } catch (err: any) {
      setError(err.message);
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

  const minPrice = calculateMinimumPrice(cardOwnership.last_sale_price, cardOwnership.base_price);
  const potentialProfit = cardOwnership.last_sale_price
    ? calculatePotentialProfit(cardOwnership.last_sale_price, minPrice)
    : 0;

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <ShoppingCart className="w-5 h-5 text-cyan-400" />
        Card Trading
      </h3>

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
                onClick={() => {
                  setListingPrice(minPrice.toFixed(2));
                  setShowListModal(true);
                }}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold rounded-lg transition-all"
              >
                <Tag className="w-5 h-5" />
                List for Sale
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
                  You paid: {cardOwnership.last_sale_price.toFixed(2)} | Min sell: {minPrice.toFixed(2)}
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
                <p className="text-sm text-gray-400">Card Price</p>
                <p className="text-2xl font-bold text-cyan-400">
                  {cardOwnership.asking_price?.toFixed(2)} coins
                </p>
              </div>

              <div className="p-4 bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-400">Your Balance</p>
                <p className="text-lg font-semibold text-white">
                  {userBalance.toFixed(2)} coins
                </p>
              </div>

              <div className="p-4 bg-blue-900/20 border border-blue-600/50 rounded-lg">
                <p className="text-sm text-blue-300">
                  After purchase, card will be auto-listed at {(cardOwnership.base_price * 1.10 * 1.20).toFixed(2)} coins
                </p>
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
                disabled={loading || userBalance < (cardOwnership.asking_price || 0)}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Confirm Purchase'}
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
            <h3 className="text-xl font-bold text-white mb-4">List Card for Sale</h3>

            <div className="space-y-4 mb-6">
              {cardOwnership.last_sale_price && (
                <div className="p-4 bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-400">You Paid</p>
                  <p className="text-lg font-semibold text-white">
                    {cardOwnership.last_sale_price.toFixed(2)} coins
                  </p>
                </div>
              )}

              <div className="p-4 bg-blue-900/20 border border-blue-600/50 rounded-lg">
                <p className="text-sm text-blue-300">Minimum Price (20% markup)</p>
                <p className="text-xl font-bold text-blue-400">
                  {minPrice.toFixed(2)} coins
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Asking Price (coins)
                </label>
                <input
                  type="number"
                  value={listingPrice}
                  onChange={(e) => setListingPrice(e.target.value)}
                  placeholder={`Minimum: ${minPrice.toFixed(2)}`}
                  step="0.01"
                  min={minPrice}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {parseFloat(listingPrice) >= minPrice && cardOwnership.last_sale_price && (
                <div className="p-3 bg-green-900/20 border border-green-600/30 rounded-lg">
                  <p className="text-sm text-green-300">Potential Profit</p>
                  <p className="text-lg font-bold text-green-400">
                    +{calculatePotentialProfit(cardOwnership.last_sale_price, parseFloat(listingPrice)).toFixed(2)} coins
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
                  setListingPrice('');
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
                {loading ? 'Listing...' : 'List for Sale'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
