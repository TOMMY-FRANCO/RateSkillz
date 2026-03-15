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
  getIncomingSwapRequests,
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
  const [view, setView] = useState<'offers' | 'history'>('offers');
  const [managedCards, setManagedCards] = useState<CardOwnership[]>([]);
  const [swapListings, setSwapListings] = useState<SwapListing[]>([]);
  const [myListings, setMyListings] = useState<SwapListing[]>([]);
  const [pendingOffers, setPendingOffers] = useState<CardSwap[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<CardSwap[]>([]);
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
      if (view === 'offers') {
        const [offers, incoming] = await Promise.all([
          getPendingSwapOffers(profile.id),
          getIncomingSwapRequests(profile.id),
        ]);
        setPendingOffers(offers);
        setIncomingRequests(incoming);
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

  const sentRequests = pendingOffers.filter(o => o.initiated_by === profile?.id);
  const receivedFromOffers = pendingOffers.filter(o => o.initiated_by !== profile?.id);
  const totalReceived = incomingRequests.length + receivedFromOffers.length;
  const totalBadge = sentRequests.length + totalReceived;

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setView('offers')}
          className={`px-5 py-2.5 rounded-xl font-semibold transition-all text-sm flex items-center gap-2 ${
            view === 'offers'
              ? 'bg-gradient-to-r from-[#00E0FF] to-[#38BDF8] text-black shadow-[0_0_12px_rgba(0,224,255,0.35)]'
              : 'bg-[rgba(15,24,41,0.85)] text-[#B0B8C8] border border-[rgba(0,224,255,0.2)] hover:border-[rgba(0,224,255,0.4)] hover:text-white'
          }`}
        >
          <Repeat className="w-4 h-4" />
          Swap Requests
          {totalBadge > 0 && (
            <span className={`px-1.5 py-0.5 text-xs font-bold rounded-full ${view === 'offers' ? 'bg-black/20 text-black' : 'bg-[rgba(0,224,255,0.2)] text-[#00E0FF] border border-[rgba(0,224,255,0.35)]'}`}>
              {totalBadge}
            </span>
          )}
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

      {error && (
        <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] rounded-xl p-4 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00E0FF]" />
        </div>
      ) : (
        <>
          {view === 'offers' && (
            <div className="space-y-8">
              {sentRequests.length === 0 && totalReceived === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-[rgba(0,224,255,0.06)] border border-[rgba(0,224,255,0.15)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Repeat className="w-8 h-8 text-slate-500" />
                  </div>
                  <p className="text-slate-400 text-lg font-semibold">No active swap requests</p>
                  <p className="text-slate-500 text-sm mt-1">
                    Request swaps from the Purchased Cards tab
                  </p>
                </div>
              ) : (
                <>
                  {sentRequests.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white">Requests Sent</h3>
                        <span className="px-2 py-0.5 bg-[rgba(251,191,36,0.12)] text-amber-400 text-xs font-bold rounded-full border border-[rgba(251,191,36,0.25)]">
                          {sentRequests.length}
                        </span>
                      </div>
                      {sentRequests.map((offer) => {
                        const myCard = offer.manager_a_id === profile?.id ? offer.card_a : offer.card_b;
                        const targetCard = offer.manager_a_id === profile?.id ? offer.card_b : offer.card_a;
                        const targetManager = offer.manager_a_id === profile?.id ? offer.manager_b : offer.manager_a;

                        return (
                          <div
                            key={offer.id}
                            className="bg-[rgba(255,255,255,0.03)] backdrop-blur-[15px] border border-[rgba(0,224,255,0.1)] rounded-2xl p-5"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <div>
                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Sent to</p>
                                <p className="text-white font-bold mt-0.5">
                                  @{targetManager?.username || 'unknown'}
                                </p>
                              </div>
                              <span className="text-xs text-slate-500">
                                {new Date(offer.created_at).toLocaleDateString()}
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-3 items-center mb-5">
                              <div className="bg-[rgba(0,224,255,0.06)] rounded-xl p-3 border border-[rgba(0,224,255,0.15)]">
                                <p className="text-xs text-[#00E0FF]/60 mb-1.5 font-semibold">Your offer</p>
                                <p className="font-bold text-white text-sm">
                                  @{myCard?.profile?.username || 'unknown'}
                                </p>
                                {myCard?.profile?.overall_rating && (
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    OVR {myCard.profile.overall_rating}
                                  </p>
                                )}
                                <p className="text-[#00FF85] font-bold text-sm mt-1.5">
                                  {(myCard?.current_price ?? 0).toFixed(2)} coins
                                </p>
                              </div>

                              <div className="flex flex-col items-center gap-1">
                                <Repeat className="w-5 h-5 text-[#00E0FF]/50" />
                                <span className="text-xs text-slate-600">for</span>
                              </div>

                              <div className="bg-[rgba(255,255,255,0.04)] rounded-xl p-3 border border-[rgba(255,255,255,0.08)]">
                                <p className="text-xs text-slate-400 mb-1.5 font-semibold">Target card</p>
                                <p className="font-bold text-white text-sm">
                                  @{targetCard?.profile?.username || 'unknown'}
                                </p>
                                {targetCard?.profile?.overall_rating && (
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    OVR {targetCard.profile.overall_rating}
                                  </p>
                                )}
                                <p className="text-[#00FF85] font-bold text-sm mt-1.5">
                                  {(targetCard?.current_price ?? 0).toFixed(2)} coins
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 p-2.5 bg-[rgba(251,191,36,0.06)] border border-[rgba(251,191,36,0.15)] rounded-lg mb-4">
                              <span className="text-xs text-amber-400/80">
                                Pending — awaiting response from @{targetManager?.username || 'unknown'}
                              </span>
                            </div>

                            <button
                              onClick={() => handleDeclineSwap(offer.id)}
                              disabled={processing === offer.id}
                              className="w-full px-4 py-2.5 bg-[rgba(239,68,68,0.08)] hover:bg-[rgba(239,68,68,0.14)] text-red-300 rounded-xl border border-[rgba(239,68,68,0.2)] hover:border-[rgba(239,68,68,0.35)] transition-all font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {processing === offer.id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-300" />
                              ) : (
                                <>
                                  <X className="w-4 h-4" />
                                  Cancel Request
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {totalReceived > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white">Requests Received</h3>
                        <span className="px-2 py-0.5 bg-[rgba(0,255,133,0.12)] text-[#00FF85] text-xs font-bold rounded-full border border-[rgba(0,255,133,0.25)]">
                          {totalReceived}
                        </span>
                      </div>

                      {incomingRequests.map((req) => {
                        const offeredCard = req.card_a;
                        const myCard = req.card_b;
                        const requester = req.manager_a;

                        return (
                          <div
                            key={req.id}
                            className="bg-[rgba(0,255,133,0.03)] backdrop-blur-[15px] border border-[rgba(0,255,133,0.15)] rounded-2xl p-5"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <div>
                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Request from</p>
                                <p className="text-white font-bold mt-0.5">@{requester?.username || 'unknown'}</p>
                              </div>
                              <span className="text-xs text-slate-500">
                                {new Date(req.created_at).toLocaleDateString()}
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-3 items-center mb-4">
                              <div className="bg-[rgba(255,255,255,0.04)] rounded-xl p-3 border border-[rgba(255,255,255,0.08)]">
                                <p className="text-xs text-slate-400 mb-1.5 font-semibold">Their offer</p>
                                <p className="font-bold text-white text-sm">
                                  @{offeredCard?.profile?.username || 'unknown'}
                                </p>
                                {offeredCard?.profile?.overall_rating && (
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    OVR {offeredCard.profile.overall_rating}
                                  </p>
                                )}
                                <p className="text-[#00FF85] font-bold text-sm mt-1.5">
                                  {(offeredCard?.current_price ?? 0).toFixed(2)} coins
                                </p>
                              </div>

                              <div className="flex flex-col items-center gap-1">
                                <Repeat className="w-5 h-5 text-[#00FF85]/50" />
                                <span className="text-xs text-slate-600">for</span>
                              </div>

                              <div className="bg-[rgba(0,255,133,0.06)] rounded-xl p-3 border border-[rgba(0,255,133,0.15)]">
                                <p className="text-xs text-[#00FF85]/60 mb-1.5 font-semibold">Your card</p>
                                <p className="font-bold text-white text-sm">
                                  @{myCard?.profile?.username || 'unknown'}
                                </p>
                                {myCard?.profile?.overall_rating && (
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    OVR {myCard.profile.overall_rating}
                                  </p>
                                )}
                                <p className="text-[#00FF85] font-bold text-sm mt-1.5">
                                  {(myCard?.current_price ?? 0).toFixed(2)} coins
                                </p>
                              </div>
                            </div>

                            <div className="p-2.5 bg-[rgba(251,191,36,0.06)] border border-[rgba(251,191,36,0.15)] rounded-lg mb-4">
                              <p className="text-xs text-amber-400/80">
                                Accepting costs a 10 coin opt-out fee. Both cards increase by 10 coins.
                              </p>
                            </div>

                            <div className="flex gap-3">
                              <button
                                onClick={() => handleAcceptSwap(req.id)}
                                disabled={processing === req.id}
                                className="flex-1 px-4 py-2.5 bg-[rgba(0,255,133,0.12)] hover:bg-[rgba(0,255,133,0.2)] text-[#00FF85] rounded-xl border border-[rgba(0,255,133,0.3)] hover:border-[rgba(0,255,133,0.5)] transition-all font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                {processing === req.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#00FF85]" />
                                ) : (
                                  <>
                                    <Check className="w-4 h-4" />
                                    Accept
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleDeclineSwap(req.id)}
                                disabled={processing === req.id}
                                className="flex-1 px-4 py-2.5 bg-[rgba(239,68,68,0.08)] hover:bg-[rgba(239,68,68,0.14)] text-red-300 rounded-xl border border-[rgba(239,68,68,0.2)] hover:border-[rgba(239,68,68,0.35)] transition-all font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                <X className="w-4 h-4" />
                                Decline
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {receivedFromOffers.map((offer) => {
                        const myCard = offer.manager_a_id === profile?.id ? offer.card_a : offer.card_b;
                        const theirCard = offer.manager_a_id === profile?.id ? offer.card_b : offer.card_a;
                        const otherManager = offer.manager_a_id === profile?.id ? offer.manager_b : offer.manager_a;

                        return (
                          <div
                            key={offer.id}
                            className="bg-[rgba(0,255,133,0.03)] backdrop-blur-[15px] border border-[rgba(0,255,133,0.15)] rounded-2xl p-5"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <div>
                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Request from</p>
                                <p className="text-white font-bold mt-0.5">@{otherManager?.username || 'unknown'}</p>
                              </div>
                              <span className="text-xs text-slate-500">
                                {new Date(offer.created_at).toLocaleDateString()}
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-3 items-center mb-4">
                              <div className="bg-[rgba(255,255,255,0.04)] rounded-xl p-3 border border-[rgba(255,255,255,0.08)]">
                                <p className="text-xs text-slate-400 mb-1.5 font-semibold">Their offer</p>
                                <p className="font-bold text-white text-sm">
                                  @{theirCard?.profile?.username || 'unknown'}
                                </p>
                                {theirCard?.profile?.overall_rating && (
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    OVR {theirCard.profile.overall_rating}
                                  </p>
                                )}
                                <p className="text-[#00FF85] font-bold text-sm mt-1.5">
                                  {formatCoinBalance(theirCard?.current_price || 0)}
                                </p>
                              </div>

                              <div className="flex flex-col items-center gap-1">
                                <Repeat className="w-5 h-5 text-[#00FF85]/50" />
                                <span className="text-xs text-slate-600">for</span>
                              </div>

                              <div className="bg-[rgba(0,255,133,0.06)] rounded-xl p-3 border border-[rgba(0,255,133,0.15)]">
                                <p className="text-xs text-[#00FF85]/60 mb-1.5 font-semibold">Your card</p>
                                <p className="font-bold text-white text-sm">
                                  @{myCard?.profile?.username || 'unknown'}
                                </p>
                                {myCard?.profile?.overall_rating && (
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    OVR {myCard.profile.overall_rating}
                                  </p>
                                )}
                                <p className="text-[#00FF85] font-bold text-sm mt-1.5">
                                  {formatCoinBalance(myCard?.current_price || 0)}
                                </p>
                              </div>
                            </div>

                            <div className="p-2.5 bg-[rgba(251,191,36,0.06)] border border-[rgba(251,191,36,0.15)] rounded-lg mb-4">
                              <p className="text-xs text-amber-400/80">
                                Accepting costs a 10 coin opt-out fee. Both cards increase by 10 coins.
                              </p>
                            </div>

                            <div className="flex gap-3">
                              <button
                                onClick={() => handleAcceptSwap(offer.id)}
                                disabled={processing === offer.id}
                                className="flex-1 px-4 py-2.5 bg-[rgba(0,255,133,0.12)] hover:bg-[rgba(0,255,133,0.2)] text-[#00FF85] rounded-xl border border-[rgba(0,255,133,0.3)] hover:border-[rgba(0,255,133,0.5)] transition-all font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                {processing === offer.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#00FF85]" />
                                ) : (
                                  <>
                                    <Check className="w-4 h-4" />
                                    Accept Swap
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleDeclineSwap(offer.id)}
                                disabled={processing === offer.id}
                                className="flex-1 px-4 py-2.5 bg-[rgba(239,68,68,0.08)] hover:bg-[rgba(239,68,68,0.14)] text-red-300 rounded-xl border border-[rgba(239,68,68,0.2)] hover:border-[rgba(239,68,68,0.35)] transition-all font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                <X className="w-4 h-4" />
                                Decline
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {view === 'history' && (
            <div className="space-y-4">
              {swapHistory.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-[rgba(0,224,255,0.06)] border border-[rgba(0,224,255,0.15)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <History className="w-8 h-8 text-slate-500" />
                  </div>
                  <p className="text-slate-400 text-lg font-semibold">No swap history</p>
                  <p className="text-slate-500 text-sm mt-1">Completed swaps will appear here</p>
                </div>
              ) : (
                swapHistory.map((swap) => (
                  <div
                    key={swap.id}
                    className="bg-[rgba(255,255,255,0.03)] backdrop-blur-[15px] border border-[rgba(0,224,255,0.1)] rounded-2xl p-5"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-[rgba(0,255,133,0.15)] border border-[rgba(0,255,133,0.3)] rounded-full flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-[#00FF85]" />
                        </div>
                        <span className="font-bold text-white">Completed Swap</span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {swap.completed_at && new Date(swap.completed_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 items-center">
                      <div className="bg-[rgba(255,255,255,0.04)] rounded-xl p-3 border border-[rgba(255,255,255,0.08)]">
                        <p className="text-xs text-slate-500 mb-1">Card A</p>
                        <p className="font-bold text-white text-sm">
                          @{swap.card_a?.profile?.username || 'unknown'}
                        </p>
                        {swap.card_a?.profile?.overall_rating && (
                          <p className="text-xs text-slate-400 mt-0.5">OVR {swap.card_a.profile.overall_rating}</p>
                        )}
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <Repeat className="w-5 h-5 text-[#00FF85]/60" />
                      </div>

                      <div className="bg-[rgba(255,255,255,0.04)] rounded-xl p-3 border border-[rgba(255,255,255,0.08)]">
                        <p className="text-xs text-slate-500 mb-1">Card B</p>
                        <p className="font-bold text-white text-sm">
                          @{swap.card_b?.profile?.username || 'unknown'}
                        </p>
                        {swap.card_b?.profile?.overall_rating && (
                          <p className="text-xs text-slate-400 mt-0.5">OVR {swap.card_b.profile.overall_rating}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
