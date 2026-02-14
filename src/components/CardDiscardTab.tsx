import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getUserCardsForDiscard,
  discardCard,
  getDiscardHistory,
  formatDiscardDate,
  type CardForDiscard,
  type DiscardHistory
} from '../lib/cardDiscard';
import { useCoinBalance } from '../hooks/useCoinBalance';
import { Trash2, TrendingUp, Clock, AlertCircle, CheckCircle, User, Coins } from 'lucide-react';
import { formatCoinBalance } from '../lib/formatBalance';
import { ShimmerBar, StaggerItem, SlowLoadMessage } from './ui/Shimmer';
import { SkeletonAvatar } from './ui/SkeletonPresets';

export default function CardDiscardTab() {
  const { profile } = useAuth();
  const { balance, refetch: refetchBalance } = useCoinBalance();
  const [cards, setCards] = useState<CardForDiscard[]>([]);
  const [history, setHistory] = useState<DiscardHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [discarding, setDiscarding] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardForDiscard | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [view, setView] = useState<'cards' | 'history'>('cards');

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const [cardsData, historyData] = await Promise.all([
        getUserCardsForDiscard(profile.id),
        getDiscardHistory(profile.id)
      ]);

      setCards(cardsData);
      setHistory(historyData);
    } catch (error) {
      console.error('Error loading discard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscardClick = (card: CardForDiscard) => {
    setSelectedCard(card);
    setShowConfirmation(true);
  };

  const handleConfirmDiscard = async () => {
    if (!profile || !selectedCard) return;

    setDiscarding(selectedCard.id);
    setShowConfirmation(false);

    try {
      const result = await discardCard(profile.id, selectedCard.id);

      if (result.success) {
        alert(`Card discarded successfully!\n\nYou paid: ${formatCoinBalance(result.total_paid || 0)}\nCard value increased to: ${formatCoinBalance(result.new_card_value || 0)}`);
        await loadData();
        await refetchBalance();
      } else {
        alert(`Error: ${result.error || 'Failed to discard card'}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message || 'Failed to discard card'}`);
    } finally {
      setDiscarding(null);
      setSelectedCard(null);
    }
  };

  const handleCancelDiscard = () => {
    setShowConfirmation(false);
    setSelectedCard(null);
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
                  <ShimmerBar className="h-4 w-32 rounded" />
                  <ShimmerBar className="h-3 w-20 rounded" speed="slow" />
                </div>
                <ShimmerBar className="h-9 w-24 rounded-lg" />
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
      {/* Header with Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setView('cards')}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              view === 'cards'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Discard Cards
            </div>
          </button>
          <button
            onClick={() => setView('history')}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              view === 'history'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              History
            </div>
          </button>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Coins className="w-5 h-5 text-yellow-500" />
          <span className="font-semibold">{formatCoinBalance(balance)}</span>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">How Card Discard Works:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>You pay the card's current price + 10 coins bonus to the original owner</li>
              <li>The card value increases by 10 coins</li>
              <li>The card is removed from your inventory</li>
              <li>Cannot discard cards locked in battles</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Cards View */}
      {view === 'cards' && (
        <div>
          {cards.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Trash2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No cards available to discard</p>
              <p className="text-sm text-gray-500 mt-2">
                Purchase cards from the marketplace to get started
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow"
                >
                  {/* Card Header */}
                  <div className="flex items-center gap-3 mb-4">
                    {card.player_avatar_url ? (
                      <img
                        src={card.player_avatar_url}
                        alt={card.player_username}
                        className="w-12 h-12 rounded-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        @{card.player_username}
                      </h3>
                    </div>
                  </div>

                  {/* Card Details */}
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Current Price:</span>
                      <span className="font-semibold">{formatCoinBalance(card.current_price)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Discard Bonus:</span>
                      <span className="font-semibold text-green-600">+{formatCoinBalance(10)}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="text-gray-900 font-medium">Total Cost:</span>
                      <span className="font-bold text-lg">{formatCoinBalance(card.discard_cost)}</span>
                    </div>
                    {card.original_owner_username && (
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Original Owner:</span>
                        <span className="font-medium">@{card.original_owner_username}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Times Traded:</span>
                      <span>{card.times_traded}</span>
                    </div>
                  </div>

                  {/* Discard Button */}
                  <button
                    onClick={() => handleDiscardClick(card)}
                    disabled={discarding === card.id || balance < card.discard_cost}
                    className={`w-full py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                      discarding === card.id
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : balance < card.discard_cost
                        ? 'bg-red-100 text-red-400 cursor-not-allowed'
                        : 'bg-red-500 text-white hover:bg-red-600'
                    }`}
                  >
                    {discarding === card.id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Discarding...
                      </>
                    ) : balance < card.discard_cost ? (
                      <>
                        <AlertCircle className="w-4 h-4" />
                        Insufficient Coins
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Discard Card
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History View */}
      {view === 'history' && (
        <div>
          {history.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No discard history</p>
              <p className="text-sm text-gray-500 mt-2">
                Cards you discard will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {item.player_avatar_url ? (
                        <img
                          src={item.player_avatar_url}
                          alt={item.player_username}
                          className="w-10 h-10 rounded-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">
                          @{item.player_username}
                        </h4>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-1 text-red-600 font-semibold">
                        <Coins className="w-4 h-4" />
                        -{formatCoinBalance(item.total_paid)}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDiscardDate(item.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Card Price:</p>
                      <p className="font-semibold">{formatCoinBalance(item.card_price_at_discard)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Bonus Paid:</p>
                      <p className="font-semibold text-green-600">+{formatCoinBalance(item.bonus_amount)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Value Change:</p>
                      <p className="font-semibold text-blue-600">
                        {formatCoinBalance(item.card_value_before)} → {formatCoinBalance(item.card_value_after)}
                      </p>
                    </div>
                    {item.original_owner_username && (
                      <div>
                        <p className="text-gray-600">Paid To:</p>
                        <p className="font-semibold">@{item.original_owner_username}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmation && selectedCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Confirm Card Discard
            </h3>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                {selectedCard.player_avatar_url ? (
                  <img
                    src={selectedCard.player_avatar_url}
                    alt={selectedCard.player_username}
                    className="w-12 h-12 rounded-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-900">@{selectedCard.player_username}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Card Price:</span>
                  <span className="font-semibold">{formatCoinBalance(selectedCard.current_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Discard Bonus:</span>
                  <span className="font-semibold text-green-600">+{formatCoinBalance(10)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-medium text-gray-900">Total Payment:</span>
                  <span className="font-bold text-lg">{formatCoinBalance(selectedCard.discard_cost)}</span>
                </div>
                {selectedCard.original_owner_username && (
                  <div className="flex justify-between text-gray-600">
                    <span>Payment goes to:</span>
                    <span className="font-medium">@{selectedCard.original_owner_username}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-yellow-800">
                  This action cannot be undone. The card will be removed from your inventory.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancelDiscard}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDiscard}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Discard Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
