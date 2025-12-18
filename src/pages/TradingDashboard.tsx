import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getCardsOwnedByUser,
  getPendingCardOffers,
  getPortfolioValue,
  getMostValuableCards,
  getMostTradedCards,
  acceptCardOffer,
  denyCardOffer,
  listCardForSale,
  calculateMinimumPrice,
  calculatePotentialProfit,
  type CardOwnership,
  type CardOffer
} from '../lib/cardTrading';
import { ArrowLeft, Coins, TrendingUp, Tag, ShoppingCart, Bell, Trophy, Check, X } from 'lucide-react';

export default function TradingDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [ownedCards, setOwnedCards] = useState<CardOwnership[]>([]);
  const [pendingOffers, setPendingOffers] = useState<CardOffer[]>([]);
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [mostValuable, setMostValuable] = useState<CardOwnership[]>([]);
  const [mostTraded, setMostTraded] = useState<CardOwnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'portfolio' | 'offers' | 'leaderboards'>('portfolio');

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const [cards, offers, value, valuable, traded] = await Promise.all([
        getCardsOwnedByUser(profile.id),
        getPendingCardOffers(profile.id),
        getPortfolioValue(profile.id),
        getMostValuableCards(10),
        getMostTradedCards(10)
      ]);

      setOwnedCards(cards);
      setPendingOffers(offers);
      setPortfolioValue(value);
      setMostValuable(valuable);
      setMostTraded(traded);
    } catch (error) {
      console.error('Error loading trading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOffer = async (offerId: string) => {
    if (!confirm('Accept this offer? The card will be transferred to the buyer.')) return;

    const result = await acceptCardOffer(offerId);
    if (result.success) {
      alert('Offer accepted! Card transferred successfully.');
      loadData();
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  const handleDenyOffer = async (offerId: string) => {
    const result = await denyCardOffer(offerId);
    if (result.success) {
      alert('Offer denied.');
      loadData();
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading trading dashboard...</div>
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
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
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

            <div className="p-4 bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-600/50 rounded-xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <Bell className="w-5 h-5 text-black" />
                </div>
                <span className="text-sm text-gray-400">Pending Offers</span>
              </div>
              <p className="text-3xl font-bold text-white">{pendingOffers.length}</p>
            </div>
          </div>
        </div>

        <div className="mb-6 flex gap-4 border-b border-gray-800">
          <button
            onClick={() => setSelectedTab('portfolio')}
            className={`px-6 py-3 font-semibold transition-all ${
              selectedTab === 'portfolio'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            My Portfolio
          </button>
          <button
            onClick={() => setSelectedTab('offers')}
            className={`px-6 py-3 font-semibold transition-all relative ${
              selectedTab === 'offers'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Offers
            {pendingOffers.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                {pendingOffers.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setSelectedTab('leaderboards')}
            className={`px-6 py-3 font-semibold transition-all ${
              selectedTab === 'leaderboards'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Leaderboards
          </button>
        </div>

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
                  const minPrice = calculateMinimumPrice(card.last_sale_price, card.base_price);
                  const profit = card.last_sale_price ? calculatePotentialProfit(card.last_sale_price, minPrice) : 0;

                  return (
                    <div key={card.id} className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white mb-1">
                            {card.card_user?.full_name || card.card_user?.username}
                          </h3>
                          <p className="text-sm text-gray-400">@{card.card_user?.username}</p>
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

                        {card.last_sale_price && (
                          <div className="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
                            <span className="text-sm text-gray-400">You Paid</span>
                            <span className="font-semibold text-white">{card.last_sale_price.toFixed(2)} coins</span>
                          </div>
                        )}

                        {profit > 0 && (
                          <div className="flex justify-between items-center p-3 bg-green-900/20 rounded-lg border border-green-600/30">
                            <span className="text-sm text-green-300">Min Profit (20% markup)</span>
                            <span className="font-semibold text-green-400">+{profit.toFixed(2)} coins</span>
                          </div>
                        )}

                        {card.is_listed_for_sale ? (
                          <div className="p-3 bg-green-900/20 rounded-lg border border-green-600/30 text-center">
                            <div className="flex items-center justify-center gap-2 text-green-400 mb-1">
                              <Tag className="w-4 h-4" />
                              <span className="text-sm font-semibold">Listed for Sale</span>
                            </div>
                            <p className="text-lg font-bold text-green-300">{card.asking_price?.toFixed(2)} coins</p>
                          </div>
                        ) : (
                          <button
                            onClick={() => navigate(`/profile/${card.card_user?.username}`)}
                            className="w-full px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold rounded-lg transition-all"
                          >
                            List for Sale (Min: {minPrice.toFixed(2)})
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

        {selectedTab === 'offers' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">Pending Offers</h2>
            {pendingOffers.length === 0 ? (
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
                <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No pending offers</p>
                <p className="text-gray-500 text-sm mt-2">When someone wants to buy your cards, you'll see their offers here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingOffers.map((offer) => (
                  <div key={offer.id} className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                            <ShoppingCart className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-white font-semibold">
                              {offer.buyer?.username} wants to buy {offer.card_user?.full_name || offer.card_user?.username}'s card
                            </p>
                            <p className="text-sm text-gray-400">
                              {new Date(offer.created_at).toLocaleDateString()} at {new Date(offer.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 p-4 bg-gray-800/50 rounded-lg">
                          <p className="text-sm text-gray-400 mb-1">Offer Amount</p>
                          <p className="text-2xl font-bold text-cyan-400">{offer.offer_amount.toFixed(2)} coins</p>
                        </div>

                        {offer.message && (
                          <div className="mt-3 p-3 bg-blue-900/20 border border-blue-600/30 rounded-lg">
                            <p className="text-sm text-blue-300">Message:</p>
                            <p className="text-white">{offer.message}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex md:flex-col gap-3">
                        <button
                          onClick={() => handleAcceptOffer(offer.id)}
                          className="flex-1 md:w-32 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-semibold rounded-lg transition-all"
                        >
                          <Check className="w-5 h-5" />
                          Accept
                        </button>
                        <button
                          onClick={() => handleDenyOffer(offer.id)}
                          className="flex-1 md:w-32 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg transition-all"
                        >
                          <X className="w-5 h-5" />
                          Deny
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
                              {card.card_user?.full_name || card.card_user?.username}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-gray-300">
                            {card.owner?.username}
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
                              {card.card_user?.full_name || card.card_user?.username}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-gray-300">
                            {card.owner?.username}
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
