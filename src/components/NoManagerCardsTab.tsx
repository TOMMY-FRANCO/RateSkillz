import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCoinBalance } from '../hooks/useCoinBalance';
import { getNoManagerCards, createPurchaseRequest, type CardWithRatings } from '../lib/cardTrading';
import { Coins, Send, User, Shield, TrendingUp, Trophy, Users } from 'lucide-react';
import { ShimmerBar, StaggerItem, SlowLoadMessage } from './ui/Shimmer';
import { SkeletonAvatar } from './ui/SkeletonPresets';

interface NoManagerCardsTabProps {
  onRequestSent?: () => void;
}

export default function NoManagerCardsTab({ onRequestSent }: NoManagerCardsTabProps) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { balance } = useCoinBalance();
  const [cards, setCards] = useState<CardWithRatings[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    setLoading(true);
    try {
      const data = await getNoManagerCards();
      setCards(data);
    } catch (error) {
      console.error('Error loading no manager cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendPurchaseRequest = async (card: CardWithRatings) => {
    if (!profile) return;

    if (balance < card.current_price) {
      alert(`Insufficient coins! You need ${card.current_price.toFixed(2)} coins to purchase this card.`);
      return;
    }

    if (card.card_user_id === profile.id) {
      alert('Cannot purchase your own card!');
      return;
    }

    const newPrice = card.current_price + 10;
    if (!confirm(`Send purchase request for ${card.card_user?.full_name || card.card_user?.username}'s card?\n\nPrice: ${card.current_price.toFixed(2)} coins\nAfter purchase: ${newPrice.toFixed(2)} coins (+10)\n\nOriginal owner will receive notification to approve or decline.`)) {
      return;
    }

    setSendingRequest(card.id);
    try {
      const result = await createPurchaseRequest(card.card_user_id, profile.id, card.current_price, 'no_manager');

      if (result.success) {
        alert('Purchase request sent successfully! The original owner will be notified.');
        if (onRequestSent) onRequestSent();
        loadCards();
      } else {
        alert(`Failed to send request: ${result.error}`);
      }
    } catch (error) {
      console.error('Error sending purchase request:', error);
      alert('Failed to send purchase request. Please try again.');
    } finally {
      setSendingRequest(null);
    }
  };

  const getTierColor = (tier: string | null) => {
    switch (tier) {
      case 'bronze': return 'text-orange-700 bg-orange-100 border-orange-400';
      case 'silver': return 'text-gray-600 bg-gray-200 border-gray-400';
      case 'gold': return 'text-yellow-600 bg-yellow-100 border-yellow-400';
      case 'platinum': return 'text-cyan-600 bg-cyan-100 border-cyan-400';
      case 'diamond': return 'text-blue-600 bg-blue-100 border-blue-400';
      default: return 'text-gray-500 bg-gray-100 border-gray-300';
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
            <Users className="w-6 h-6 text-cyan-400" />
            No Manager Cards
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Previously purchased cards with no current manager assigned.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 rounded-full border border-yellow-500/20">
          <Coins className="w-5 h-5 text-yellow-500" />
          <span className="text-lg font-bold text-yellow-500">{balance.toFixed(2)}</span>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
          <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">No cards available</p>
          <p className="text-gray-500 text-sm mt-2">All purchased cards have managers assigned</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card) => {
            const isSendingRequest = sendingRequest === card.id;
            const canAfford = balance >= card.current_price;
            const isOwnCard = card.card_user_id === profile?.id;
            const newPrice = card.current_price + 10;

            return (
              <div
                key={card.id}
                className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 hover:border-cyan-500/50 rounded-2xl p-6 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-1">
                      {card.card_user?.full_name || card.card_user?.username}
                    </h3>
                    <p className="text-sm text-gray-400">@{card.card_user?.username}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center gap-1 text-yellow-500">
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
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-all flex items-center gap-1"
                  >
                    <User className="w-4 h-4" />
                    View
                  </button>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-gray-800/50 rounded-lg">
                      <span className="text-xs text-gray-400">Position</span>
                      <p className="text-sm font-semibold text-white">{card.position}</p>
                    </div>
                    <div className="p-2 bg-gray-800/50 rounded-lg">
                      <span className="text-xs text-gray-400">Team</span>
                      <p className="text-sm font-semibold text-white truncate">{card.team}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-600/50 rounded-xl">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-xs text-green-300">PAC</div>
                        <div className="text-lg font-bold text-green-400">{card.pac || 50}</div>
                      </div>
                      <div>
                        <div className="text-xs text-green-300">SHO</div>
                        <div className="text-lg font-bold text-green-400">{card.sho || 50}</div>
                      </div>
                      <div>
                        <div className="text-xs text-green-300">PAS</div>
                        <div className="text-lg font-bold text-green-400">{card.pas || 50}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center mt-2">
                      <div>
                        <div className="text-xs text-green-300">DRI</div>
                        <div className="text-lg font-bold text-green-400">{card.dri || 50}</div>
                      </div>
                      <div>
                        <div className="text-xs text-green-300">DEF</div>
                        <div className="text-lg font-bold text-green-400">{card.def || 50}</div>
                      </div>
                      <div>
                        <div className="text-xs text-green-300">PHY</div>
                        <div className="text-lg font-bold text-green-400">{card.phy || 50}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-lg border border-cyan-600/30">
                    <span className="text-sm text-cyan-300 font-semibold">Current Price</span>
                    <div className="flex items-center gap-1">
                      <Coins className="w-5 h-5 text-cyan-400" />
                      <span className="font-bold text-cyan-400 text-xl">{card.current_price.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded-lg">
                    <span className="text-xs text-gray-400">Current Owner</span>
                    <span className="text-sm text-white font-semibold">{card.owner?.username || 'None'}</span>
                  </div>

                  <div className="flex justify-between items-center p-2 bg-purple-900/20 rounded-lg border border-purple-600/30">
                    <span className="text-xs text-purple-300">Times Traded</span>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-purple-400" />
                      <span className="text-sm font-semibold text-purple-400">{card.times_traded}</span>
                    </div>
                  </div>

                  <div className="p-2 bg-blue-900/20 border border-blue-600/30 rounded-lg text-center">
                    <div className="flex items-center justify-center gap-1 text-xs text-blue-300">
                      <TrendingUp className="w-3 h-3" />
                      <span>After purchase: {newPrice.toFixed(2)} coins (+10)</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleSendPurchaseRequest(card)}
                  disabled={isSendingRequest || !canAfford || isOwnCard}
                  className={`w-full px-4 py-3 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                    isOwnCard
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : !canAfford
                      ? 'bg-red-600/50 text-red-200 cursor-not-allowed'
                      : isSendingRequest
                      ? 'bg-gray-700 text-gray-300 cursor-wait'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white'
                  }`}
                >
                  {isSendingRequest ? (
                    <>Sending Request...</>
                  ) : isOwnCard ? (
                    <>Your Card</>
                  ) : !canAfford ? (
                    <>Insufficient Coins</>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Send Purchase Request
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
