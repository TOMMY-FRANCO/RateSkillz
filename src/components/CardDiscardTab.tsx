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
import { Trash2, Clock, AlertCircle, User, Coins, History } from 'lucide-react';
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
            <div className="glass-card p-4">
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
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setView('cards')}
            className={`px-5 py-2.5 rounded-xl font-semibold transition-all text-sm flex items-center gap-2 ${
              view === 'cards'
                ? 'bg-gradient-to-r from-[#00E0FF] to-[#38BDF8] text-black shadow-[0_0_12px_rgba(0,224,255,0.35)]'
                : 'bg-[rgba(15,24,41,0.85)] text-[#B0B8C8] border border-[rgba(0,224,255,0.2)] hover:border-[rgba(0,224,255,0.4)] hover:text-white'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            Discard Cards
          </button>
          <button
            onClick={() => setView('history')}
            className={`px-5 py-2.5 rounded-xl font-semibold transition-all text-sm flex items-center gap-2 ${
              view === 'history'
                ? 'bg-gradient-to-r from-[#00E0FF] to-[#38BDF8] text-black shadow-[0_0_12px_rgba(0,224,255,0.35)]'
                : 'bg-[rgba(15,24,41,0.85)] text-[#B0B8C8] border border-[rgba(0,224,255,0.2)] hover:border-[rgba(0,224,255,0.4)] hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            History
          </button>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 bg-[rgba(0,224,255,0.08)] rounded-full border border-[rgba(0,224,255,0.25)]">
          <Coins className="w-5 h-5 text-[#00E0FF]" />
          <span className="font-semibold text-[#00E0FF]">{formatCoinBalance(balance)}</span>
        </div>
      </div>

      <div className="bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#00E0FF] mt-0.5 flex-shrink-0" />
          <div className="text-sm text-[#B0B8C8]">
            <p className="font-semibold mb-1 text-white">How Card Discard Works:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>You pay the card's current price + 10 coins bonus to the original owner</li>
              <li>The card value increases by 10 coins</li>
              <li>The card is removed from your inventory</li>
              <li>Cannot discard cards locked in battles</li>
            </ul>
          </div>
        </div>
      </div>

      {view === 'cards' && (
        <div>
          {cards.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Trash2 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-[#B0B8C8] font-medium">No cards available to discard</p>
              <p className="text-sm text-slate-500 mt-2">
                Purchase cards from the marketplace to get started
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className="glass-card p-5"
                >
                  <div className="flex items-center gap-3 mb-4">
                    {card.player_avatar_url ? (
                      <img
                        src={card.player_avatar_url}
                        alt={card.player_username}
                        width="48"
                        height="48"
                        className="w-12 h-12 rounded-full object-cover border border-[rgba(0,224,255,0.2)]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] flex items-center justify-center">
                        <User className="w-6 h-6 text-[#B0B8C8]" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">
                        @{card.player_username}
                      </h3>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm p-2.5 bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.15)] rounded-lg">
                      <span className="text-[#B0B8C8]">Current Price:</span>
                      <span className="font-semibold text-[#00E0FF]">{formatCoinBalance(card.current_price)}</span>
                    </div>
                    <div className="flex justify-between text-sm p-2.5 bg-[rgba(15,24,41,0.85)] border border-[rgba(0,255,133,0.15)] rounded-lg">
                      <span className="text-[#B0B8C8]">Discard Bonus:</span>
                      <span className="font-semibold text-[#00FF85]">+{formatCoinBalance(10)}</span>
                    </div>
                    <div className="flex justify-between text-sm p-2.5 bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] rounded-lg">
                      <span className="text-white font-medium">Total Cost:</span>
                      <span className="font-bold text-lg text-[#00E0FF]">{formatCoinBalance(card.discard_cost)}</span>
                    </div>
                    {card.original_owner_username && (
                      <div className="flex justify-between text-sm text-[#B0B8C8]">
                        <span>Original Owner:</span>
                        <span className="font-medium text-white">@{card.original_owner_username}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm text-[#B0B8C8]">
                      <span>Times Traded:</span>
                      <span className="text-white">{card.times_traded}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDiscardClick(card)}
                    disabled={discarding === card.id || balance < card.discard_cost}
                    className={`w-full py-2.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm ${
                      discarding === card.id
                        ? 'bg-[rgba(255,255,255,0.05)] text-slate-500 cursor-not-allowed border border-[rgba(255,255,255,0.08)]'
                        : balance < card.discard_cost
                        ? 'bg-[rgba(239,68,68,0.1)] text-red-300/70 cursor-not-allowed border border-[rgba(239,68,68,0.2)]'
                        : 'bg-[rgba(239,68,68,0.12)] hover:bg-[rgba(239,68,68,0.2)] text-red-300 border border-[rgba(239,68,68,0.3)] hover:border-[rgba(239,68,68,0.5)] transition-all'
                    }`}
                  >
                    {discarding === card.id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-400"></div>
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

      {view === 'history' && (
        <div>
          {history.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Clock className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-[#B0B8C8] font-medium">No discard history</p>
              <p className="text-sm text-slate-500 mt-2">
                Cards you discard will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="glass-card p-5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {item.player_avatar_url ? (
                        <img
                          src={item.player_avatar_url}
                          alt={item.player_username}
                          width="40"
                          height="40"
                          className="w-10 h-10 rounded-full object-cover border border-[rgba(0,224,255,0.2)]"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] flex items-center justify-center">
                          <User className="w-5 h-5 text-[#B0B8C8]" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h4 className="font-semibold text-white">
                          @{item.player_username}
                        </h4>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-1 text-red-400 font-semibold">
                        <Coins className="w-4 h-4" />
                        -{formatCoinBalance(item.total_paid)}
                      </div>
                      <p className="text-xs text-[#B0B8C8] mt-1">
                        {formatDiscardDate(item.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[rgba(0,224,255,0.1)] grid grid-cols-2 gap-3 text-sm">
                    <div className="p-2.5 bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.15)] rounded-lg">
                      <p className="text-[#B0B8C8] text-xs">Card Price:</p>
                      <p className="font-semibold text-[#00E0FF]">{formatCoinBalance(item.card_price_at_discard)}</p>
                    </div>
                    <div className="p-2.5 bg-[rgba(15,24,41,0.85)] border border-[rgba(0,255,133,0.15)] rounded-lg">
                      <p className="text-[#B0B8C8] text-xs">Bonus Paid:</p>
                      <p className="font-semibold text-[#00FF85]">+{formatCoinBalance(item.bonus_amount)}</p>
                    </div>
                    <div className="p-2.5 bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.15)] rounded-lg">
                      <p className="text-[#B0B8C8] text-xs">Value Change:</p>
                      <p className="font-semibold text-[#00E0FF] text-xs">
                        {formatCoinBalance(item.card_value_before)} → {formatCoinBalance(item.card_value_after)}
                      </p>
                    </div>
                    {item.original_owner_username && (
                      <div className="p-2.5 bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.15)] rounded-lg">
                        <p className="text-[#B0B8C8] text-xs">Paid To:</p>
                        <p className="font-semibold text-white">@{item.original_owner_username}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showConfirmation && selectedCard && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[rgba(10,17,40,0.97)] border border-[rgba(0,224,255,0.2)] rounded-2xl max-w-md w-full p-6 shadow-[0_0_60px_rgba(0,224,255,0.1)]">
            <h3 className="text-xl font-bold text-white mb-4">
              Confirm Card Discard
            </h3>

            <div className="bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                {selectedCard.player_avatar_url ? (
                  <img
                    src={selectedCard.player_avatar_url}
                    alt={selectedCard.player_username}
                    width="48"
                    height="48"
                    className="w-12 h-12 rounded-full object-cover border border-[rgba(0,224,255,0.2)]"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[rgba(0,224,255,0.06)] border border-[rgba(0,224,255,0.2)] flex items-center justify-center">
                    <User className="w-6 h-6 text-[#B0B8C8]" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-white">@{selectedCard.player_username}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between p-2 bg-[rgba(0,224,255,0.04)] rounded-lg">
                  <span className="text-[#B0B8C8]">Card Price:</span>
                  <span className="font-semibold text-[#00E0FF]">{formatCoinBalance(selectedCard.current_price)}</span>
                </div>
                <div className="flex justify-between p-2 bg-[rgba(0,255,133,0.04)] rounded-lg">
                  <span className="text-[#B0B8C8]">Discard Bonus:</span>
                  <span className="font-semibold text-[#00FF85]">+{formatCoinBalance(10)}</span>
                </div>
                <div className="flex justify-between p-2 bg-[rgba(0,224,255,0.08)] border border-[rgba(0,224,255,0.2)] rounded-lg">
                  <span className="font-medium text-white">Total Payment:</span>
                  <span className="font-bold text-lg text-[#00E0FF]">{formatCoinBalance(selectedCard.discard_cost)}</span>
                </div>
                {selectedCard.original_owner_username && (
                  <div className="flex justify-between text-[#B0B8C8]">
                    <span>Payment goes to:</span>
                    <span className="font-medium text-white">@{selectedCard.original_owner_username}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[rgba(251,191,36,0.08)] border border-[rgba(251,191,36,0.25)] rounded-xl p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-300/80">
                  This action cannot be undone. The card will be removed from your inventory.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancelDiscard}
                className="flex-1 px-4 py-2.5 bg-[rgba(255,255,255,0.05)] text-slate-300 rounded-xl border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.08)] font-semibold transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDiscard}
                className="flex-1 px-4 py-2.5 bg-[rgba(239,68,68,0.12)] hover:bg-[rgba(239,68,68,0.2)] text-red-300 rounded-xl border border-[rgba(239,68,68,0.3)] hover:border-[rgba(239,68,68,0.5)] font-semibold transition-all flex items-center justify-center gap-2 text-sm"
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
