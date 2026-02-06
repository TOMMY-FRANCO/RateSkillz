import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getManagedCards,
  listCardForSwap,
  getActiveSwapListings,
  getMySwapListings,
  getPendingSwapOffers,
  getSwapHistory,
  proposeCardSwap,
  acceptCardSwap,
  declineCardSwap,
  cancelSwapListing,
  type SwapListing,
  type CardSwap,
} from '../lib/cardSwaps';
import { CardOwnership } from '../lib/cardTrading';
import { Repeat, Plus, Filter, History, AlertCircle, Check, X, Coins, User } from 'lucide-react';
import { displayUsername } from '../lib/username';
import { formatCoinBalance } from '../lib/formatBalance';
import { playSound } from '../lib/sounds';

interface CardSwapTabProps {
  onSwapComplete: () => void;
}

export default function CardSwapTab({ onSwapComplete }: CardSwapTabProps) {
  const { profile } = useAuth();
  const [view, setView] = useState<'browse' | 'my-listings' | 'offers' | 'history'>('browse');
  const [managedCards, setManagedCards] = useState<CardOwnership[]>([]);
  const [swapListings, setSwapListings] = useState<SwapListing[]>([]);
  const [myListings, setMyListings] = useState<SwapListing[]>([]);
  const [pendingOffers, setPendingOffers] = useState<CardSwap[]>([]);
  const [swapHistory, setSwapHistory] = useState<CardSwap[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardOwnership | null>(null);
  const [showListModal, setShowListModal] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterOVR, setFilterOVR] = useState<string>('');

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile, view]);

  const loadData = async () => {
    if (!profile) return;

    setLoading(true);
    setError(null);
    try {
      if (view === 'browse') {
        const [listings, managed] = await Promise.all([
          getActiveSwapListings(),
          getManagedCards(profile.id),
        ]);
        setSwapListings(listings.filter(l => l.user_id !== profile.id));
        setManagedCards(managed);
      } else if (view === 'my-listings') {
        const [listings, managed] = await Promise.all([
          getMySwapListings(profile.id),
          getManagedCards(profile.id),
        ]);
        setMyListings(listings);
        setManagedCards(managed);
      } else if (view === 'offers') {
        const offers = await getPendingSwapOffers(profile.id);
        setPendingOffers(offers);
      } else if (view === 'history') {
        const history = await getSwapHistory(profile.id);
        setSwapHistory(history);
      }
    } catch (err) {
      console.error('Error loading swap data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleListCard = async (card: CardOwnership) => {
    if (!profile) return;

    setProcessing(card.id);
    setError(null);
    try {
      const result = await listCardForSwap(profile.id, card.card_user_id);
      if (result.success) {
        setShowListModal(false);
        setSelectedCard(null);
        loadData();
      } else {
        setError(result.error || 'Failed to list card');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setProcessing(null);
    }
  };

  const handleCancelListing = async (listingId: string) => {
    if (!profile) return;

    setProcessing(listingId);
    setError(null);
    try {
      const result = await cancelSwapListing(listingId, profile.id);
      if (result.success) {
        loadData();
      } else {
        setError(result.error || 'Failed to cancel listing');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setProcessing(null);
    }
  };

  const handleProposeSwap = async (myCardUserId: string, targetCardUserId: string) => {
    if (!profile) return;

    setProcessing(targetCardUserId);
    setError(null);
    try {
      const result = await proposeCardSwap(profile.id, myCardUserId, targetCardUserId);
      if (result.success) {
        alert('Swap proposal sent!');
        loadData();
      } else {
        setError(result.error || 'Failed to propose swap');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setProcessing(null);
    }
  };

  const handleAcceptSwap = async (swapId: string) => {
    if (!profile) return;
    if (!confirm('Accept this swap? Each manager will pay a 10 coin opt-out fee, and both cards will increase by 10 coins.')) return;

    setProcessing(swapId);
    setError(null);
    try {
      const result = await acceptCardSwap(swapId, profile.id);
      if (result.success) {
        playSound('card-swap');
        alert('Swap completed successfully!');
        onSwapComplete();
        loadData();
      } else {
        setError(result.error || 'Failed to accept swap');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setProcessing(null);
    }
  };

  const handleDeclineSwap = async (swapId: string) => {
    if (!profile) return;

    setProcessing(swapId);
    setError(null);
    try {
      const result = await declineCardSwap(swapId, profile.id);
      if (result.success) {
        loadData();
      } else {
        setError(result.error || 'Failed to decline swap');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setProcessing(null);
    }
  };

  const filteredListings = swapListings.filter((listing) => {
    if (!filterOVR) return true;
    const ovr = listing.card?.profile?.overall_rating || 0;
    return ovr >= parseInt(filterOVR);
  });

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setView('browse')}
          className={`px-4 py-2 rounded-lg font-bold transition-all ${
            view === 'browse'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          <Filter className="w-4 h-4 inline mr-2" />
          Browse Swaps
        </button>
        <button
          onClick={() => setView('my-listings')}
          className={`px-4 py-2 rounded-lg font-bold transition-all ${
            view === 'my-listings'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          <Plus className="w-4 h-4 inline mr-2" />
          My Listings
        </button>
        <button
          onClick={() => setView('offers')}
          className={`px-4 py-2 rounded-lg font-bold transition-all ${
            view === 'offers'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          <Repeat className="w-4 h-4 inline mr-2" />
          Offers {pendingOffers.length > 0 && `(${pendingOffers.length})`}
        </button>
        <button
          onClick={() => setView('history')}
          className={`px-4 py-2 rounded-lg font-bold transition-all ${
            view === 'history'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          <History className="w-4 h-4 inline mr-2" />
          History
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      ) : (
        <>
          {view === 'browse' && (
            <div className="space-y-6">
              <div className="flex gap-4">
                <input
                  type="number"
                  placeholder="Min OVR"
                  value={filterOVR}
                  onChange={(e) => setFilterOVR(e.target.value)}
                  className="bg-white/10 text-white placeholder-gray-400 rounded-lg px-4 py-2 border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {filteredListings.length === 0 ? (
                <div className="text-center py-12">
                  <Repeat className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">No cards available for swap</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredListings.map((listing) => (
                    <div
                      key={listing.id}
                      className="bg-white/5 rounded-xl p-4 border border-white/10"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-bold text-white text-lg">
                            @{listing.card?.profile?.username || 'unknown'}
                          </h3>
                          <p className="text-sm text-gray-400">
                            {listing.card?.profile?.position} | OVR {listing.card?.profile?.overall_rating}
                          </p>
                          <p className="text-sm text-gray-400">
                            Team: {listing.card?.profile?.team || 'N/A'}
                          </p>
                          <p className="text-yellow-400 font-bold mt-2">
                            {formatCoinBalance(listing.card?.current_price || 0)} coins
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Managed by: @{listing.manager?.username || 'unknown'}
                          </p>
                        </div>
                        <div>
                          {managedCards.length > 0 ? (
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleProposeSwap(e.target.value, listing.card_user_id);
                                  e.target.value = '';
                                }
                              }}
                              disabled={processing === listing.card_user_id}
                              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg font-bold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50"
                            >
                              <option value="">Propose Swap</option>
                              {managedCards.map((card) => (
                                <option key={card.id} value={card.card_user_id}>
                                  @{card.profile?.username || 'unknown'} (
                                  {formatCoinBalance(card.current_price)})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <p className="text-sm text-gray-400">No managed cards to swap</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'my-listings' && (
            <div className="space-y-6">
              <button
                onClick={() => setShowListModal(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-bold hover:from-purple-700 hover:to-pink-700 transition-all flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                List Card for Swap
              </button>

              {myListings.length === 0 ? (
                <div className="text-center py-12">
                  <Repeat className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">You haven't listed any cards for swap</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {myListings.map((listing) => (
                    <div
                      key={listing.id}
                      className="bg-white/5 rounded-xl p-4 border border-white/10"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-bold text-white text-lg">
                            @{listing.card?.profile?.username || 'unknown'}
                          </h3>
                          <p className="text-sm text-gray-400">
                            {listing.card?.profile?.position} | OVR {listing.card?.profile?.overall_rating}
                          </p>
                          <p className="text-yellow-400 font-bold mt-2">
                            {formatCoinBalance(listing.card?.current_price || 0)} coins
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Listed {new Date(listing.listed_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleCancelListing(listing.id)}
                          disabled={processing === listing.id}
                          className="bg-red-500/20 text-red-300 px-4 py-2 rounded-lg font-bold hover:bg-red-500/30 transition-all disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'offers' && (
            <div className="space-y-4">
              {pendingOffers.length === 0 ? (
                <div className="text-center py-12">
                  <Repeat className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">No pending swap offers</p>
                </div>
              ) : (
                pendingOffers.map((offer) => {
                  const isReceiver = offer.initiated_by !== profile?.id;
                  const myCard = offer.manager_a_id === profile?.id ? offer.card_a : offer.card_b;
                  const theirCard = offer.manager_a_id === profile?.id ? offer.card_b : offer.card_a;
                  const otherManager = offer.manager_a_id === profile?.id ? offer.manager_b : offer.manager_a;

                  return (
                    <div
                      key={offer.id}
                      className="bg-white/5 rounded-xl p-6 border border-white/10"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-white text-lg">
                          {isReceiver ? 'Swap Request from' : 'Swap Proposed to'}{' '}
                          @{otherManager?.username || 'unknown'}
                        </h3>
                        <span className="text-xs text-gray-400">
                          {new Date(offer.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="grid md:grid-cols-3 gap-4 items-center">
                        <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/30">
                          <p className="text-xs text-purple-300 mb-2">Your Card</p>
                          <h4 className="font-bold text-white">
                            @{myCard?.profile?.username || 'unknown'}
                          </h4>
                          <p className="text-sm text-gray-400">
                            {myCard?.profile?.position} | OVR {myCard?.profile?.overall_rating}
                          </p>
                          <p className="text-yellow-400 font-bold mt-2">
                            {formatCoinBalance(myCard?.current_price || 0)}
                          </p>
                        </div>

                        <div className="text-center">
                          <Repeat className="w-8 h-8 text-gray-400 mx-auto" />
                        </div>

                        <div className="bg-pink-500/10 rounded-lg p-4 border border-pink-500/30">
                          <p className="text-xs text-pink-300 mb-2">Their Card</p>
                          <h4 className="font-bold text-white">
                            @{theirCard?.profile?.username || 'unknown'}
                          </h4>
                          <p className="text-sm text-gray-400">
                            {theirCard?.profile?.position} | OVR {theirCard?.profile?.overall_rating}
                          </p>
                          <p className="text-yellow-400 font-bold mt-2">
                            {formatCoinBalance(theirCard?.current_price || 0)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                        <p className="text-xs text-yellow-300">
                          <Coins className="w-4 h-4 inline mr-1" />
                          You will pay 10 coins opt-out fee to the original owner of your card.
                          Both cards will increase by 10 coins.
                        </p>
                      </div>

                      {isReceiver && (
                        <div className="flex gap-3 mt-4">
                          <button
                            onClick={() => handleAcceptSwap(offer.id)}
                            disabled={processing === offer.id}
                            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-xl font-bold hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {processing === offer.id ? (
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            ) : (
                              <>
                                <Check className="w-5 h-5" />
                                Accept Swap
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleDeclineSwap(offer.id)}
                            disabled={processing === offer.id}
                            className="flex-1 bg-red-500/20 text-red-300 py-3 rounded-xl font-bold hover:bg-red-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <X className="w-5 h-5" />
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {view === 'history' && (
            <div className="space-y-4">
              {swapHistory.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">No swap history</p>
                </div>
              ) : (
                swapHistory.map((swap) => (
                  <div
                    key={swap.id}
                    className="bg-white/5 rounded-xl p-6 border border-white/10"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-white text-lg">Completed Swap</h3>
                      <span className="text-xs text-gray-400">
                        {swap.completed_at && new Date(swap.completed_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4 items-center">
                      <div className="bg-white/5 rounded-lg p-4">
                        <h4 className="font-bold text-white">
                          @{swap.card_a?.profile?.username || 'unknown'}
                        </h4>
                        <p className="text-sm text-gray-400">
                          OVR {swap.card_a?.profile?.overall_rating}
                        </p>
                      </div>

                      <div className="text-center">
                        <Repeat className="w-8 h-8 text-green-400 mx-auto" />
                      </div>

                      <div className="bg-white/5 rounded-lg p-4">
                        <h4 className="font-bold text-white">
                          @{swap.card_b?.profile?.username || 'unknown'}
                        </h4>
                        <p className="text-sm text-gray-400">
                          OVR {swap.card_b?.profile?.overall_rating}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {showListModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 rounded-2xl border border-white/20 max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">List Card for Swap</h2>
              <button
                onClick={() => setShowListModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {managedCards.length === 0 ? (
              <div className="text-center py-12">
                <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400">You don't have any managed cards to list</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {managedCards.map((card) => (
                  <div
                    key={card.id}
                    className="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center justify-between"
                  >
                    <div>
                      <h3 className="font-bold text-white">
                        @{card.profile?.username || 'unknown'}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {card.profile?.position} | OVR {card.profile?.overall_rating}
                      </p>
                      <p className="text-yellow-400 font-bold mt-1">
                        {formatCoinBalance(card.current_price)} coins
                      </p>
                    </div>
                    <button
                      onClick={() => handleListCard(card)}
                      disabled={processing === card.id}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-lg font-bold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50"
                    >
                      {processing === card.id ? 'Listing...' : 'List'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
