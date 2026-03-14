import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCoinBalance } from '../hooks/useCoinBalance';
import { getPurchasedCards, type CardOwnership } from '../lib/cardTrading';
import { getManagedCards, proposeCardSwap, checkActiveSwapCooldown } from '../lib/cardSwaps';
import { Coins, Repeat, User, TrendingUp, X, Lock, Clock } from 'lucide-react';
import { ShimmerBar, StaggerItem, SlowLoadMessage } from './ui/Shimmer';
import { SkeletonAvatar } from './ui/SkeletonPresets';
import { GlassCard } from './ui/GlassCard';

interface PurchasedCardsTabProps {
  onSwapRequested?: () => void;
}

export default function PurchasedCardsTab({ onSwapRequested }: PurchasedCardsTabProps) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { balance } = useCoinBalance();
  const [cards, setCards] = useState<CardOwnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showSwapModal, setShowSwapModal] = useState(false);
  const [targetCard, setTargetCard] = useState<CardOwnership | null>(null);
  const [myCards, setMyCards] = useState<CardOwnership[]>([]);
  const [selectedMyCard, setSelectedMyCard] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<{ blocked: boolean; unlocksAt?: Date }>({ blocked: false });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    loadCards();
  }, []);

  useEffect(() => {
    if (!cooldown.blocked) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [cooldown.blocked]);

  const loadCards = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPurchasedCards();
      setCards(data);
    } catch {
      setError('Failed to load purchased cards.');
    } finally {
      setLoading(false);
    }
  };

  const openSwapModal = async (card: CardOwnership) => {
    if (!profile) return;

    const [managedCards, cooldownStatus] = await Promise.all([
      getManagedCards(profile.id),
      checkActiveSwapCooldown(profile.id),
    ]);

    setTargetCard(card);
    setMyCards(managedCards.filter(c => c.card_user_id !== card.card_user_id));
    setSelectedMyCard('');
    setModalError(null);
    setCooldown(cooldownStatus);
    setShowSwapModal(true);
  };

  const handleSubmitSwap = async () => {
    if (!profile || !targetCard || !selectedMyCard) return;

    setSubmitting(true);
    setModalError(null);
    try {
      const result = await proposeCardSwap(profile.id, selectedMyCard, targetCard.card_user_id);
      if (result.success) {
        setShowSwapModal(false);
        setTargetCard(null);
        alert('Swap request sent successfully!');
        if (onSwapRequested) onSwapRequested();
        loadCards();
      } else {
        setModalError(result.error || 'Failed to send swap request.');
      }
    } catch {
      setModalError('An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCountdown = (unlocksAt: Date) => {
    const ms = unlocksAt.getTime() - now;
    if (ms <= 0) return '0s';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  if (loading) {
    return (
      <div className="space-y-3 py-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StaggerItem key={i} index={i}>
            <div className="bg-[rgba(255,255,255,0.04)] border border-[rgba(0,224,255,0.12)] rounded-xl p-4">
              <div className="flex items-center gap-4">
                <SkeletonAvatar size="lg" shape="rounded" />
                <div className="flex-1 space-y-2">
                  <ShimmerBar className="h-4 w-36 rounded" />
                  <ShimmerBar className="h-3 w-24 rounded" speed="slow" />
                </div>
                <ShimmerBar className="h-9 w-32 rounded-lg" />
              </div>
            </div>
          </StaggerItem>
        ))}
        <SlowLoadMessage loading={true} message="Loading purchased cards..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Repeat className="w-6 h-6 text-[#00E0FF]" />
            Purchased Cards
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Cards that have been traded at least once. Request a swap with the card owner.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-[rgba(0,255,133,0.08)] rounded-full border border-[rgba(0,255,133,0.25)]">
          <Coins className="w-5 h-5 text-[#00FF85]" />
          <span className="text-lg font-bold text-[#00FF85]">{balance.toFixed(2)}</span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] rounded-xl text-red-300 text-sm">
          {error}
        </div>
      )}

      {cards.length === 0 ? (
        <GlassCard className="!p-12 text-center">
          <Repeat className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">No purchased cards yet</p>
          <p className="text-slate-500 text-sm mt-2">Cards appear here once they have been traded at least once</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card) => {
            const isOwnCard = card.card_user_id === profile?.id || card.owner_id === profile?.id;
            const isLocked = card.is_locked_in_battle;

            return (
              <div
                key={card.id}
                className={`bg-[rgba(255,255,255,0.04)] backdrop-blur-[15px] border rounded-2xl p-6 transition-all hover:-translate-y-0.5 ${
                  isLocked
                    ? 'border-[rgba(251,191,36,0.3)]'
                    : 'border-[rgba(0,224,255,0.12)] hover:border-[rgba(0,224,255,0.35)] hover:shadow-[0_0_30px_rgba(0,224,255,0.08)]'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-white">
                        @{card.card_user?.username || 'Unknown'}
                      </h3>
                      {isLocked && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-[rgba(251,191,36,0.15)] border border-[rgba(251,191,36,0.4)] rounded text-xs font-semibold text-amber-400">
                          <Lock className="w-3 h-3" />
                          Locked
                        </span>
                      )}
                    </div>
                    {card.owner?.username && (
                      <div className="flex items-center gap-1 mt-1">
                        <User className="w-3 h-3 text-[#00E0FF]/60" />
                        <span className="text-xs text-[#00E0FF]/60">
                          Owner: @{card.owner.username}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => navigate(`/profile/${card.card_user?.username}`)}
                    className="px-3 py-1.5 bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(0,224,255,0.1)] text-slate-300 hover:text-[#00E0FF] text-sm rounded-lg transition-all border border-[rgba(0,224,255,0.15)] hover:border-[rgba(0,224,255,0.3)]"
                  >
                    View
                  </button>
                </div>

                <div className="space-y-2.5 mb-4">
                  <div className="flex justify-between items-center p-3 bg-[rgba(0,224,255,0.06)] rounded-lg border border-[rgba(0,224,255,0.15)]">
                    <span className="text-sm text-[#00E0FF]/80 font-semibold">Current Price</span>
                    <div className="flex items-center gap-1">
                      <Coins className="w-4 h-4 text-[#00E0FF]" />
                      <span className="font-bold text-[#00E0FF]">{card.current_price.toFixed(2)}</span>
                    </div>
                  </div>

                  {card.times_traded > 0 && (
                    <div className="flex justify-between items-center p-2.5 bg-[rgba(251,191,36,0.06)] rounded-lg border border-[rgba(251,191,36,0.15)]">
                      <span className="text-xs text-amber-400/80">Traded {card.times_traded} times</span>
                      <TrendingUp className="w-4 h-4 text-amber-400" />
                    </div>
                  )}
                </div>

                <button
                  onClick={() => openSwapModal(card)}
                  disabled={isOwnCard || isLocked}
                  className={`w-full px-4 py-3 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 text-sm ${
                    isLocked
                      ? 'bg-[rgba(251,191,36,0.08)] text-amber-400/50 cursor-not-allowed border border-[rgba(251,191,36,0.2)]'
                      : isOwnCard
                      ? 'bg-[rgba(255,255,255,0.05)] text-slate-500 cursor-not-allowed border border-[rgba(255,255,255,0.08)]'
                      : 'bg-[rgba(0,224,255,0.1)] hover:bg-[rgba(0,224,255,0.18)] text-[#00E0FF] border border-[rgba(0,224,255,0.3)] hover:border-[rgba(0,224,255,0.5)] hover:shadow-[0_0_20px_rgba(0,224,255,0.12)]'
                  }`}
                >
                  {isLocked ? (
                    <>
                      <Lock className="w-4 h-4" />
                      Locked in Battle
                    </>
                  ) : isOwnCard ? (
                    <>Your Card</>
                  ) : (
                    <>
                      <Repeat className="w-4 h-4" />
                      Request Swap
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showSwapModal && targetCard && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className="bg-[rgba(10,17,40,0.97)] border border-[rgba(0,224,255,0.2)] rounded-2xl max-w-lg w-full p-6 shadow-[0_0_60px_rgba(0,224,255,0.1)]"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Repeat className="w-5 h-5 text-[#00E0FF]" />
                Request Swap
              </h2>
              <button
                onClick={() => setShowSwapModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-[rgba(0,224,255,0.06)] border border-[rgba(0,224,255,0.15)] rounded-xl mb-5">
              <p className="text-xs text-[#00E0FF]/70 mb-1">Target card</p>
              <p className="text-white font-bold">@{targetCard.card_user?.username || 'Unknown'}</p>
              <div className="flex items-center gap-1 mt-1">
                <Coins className="w-3.5 h-3.5 text-[#00E0FF]" />
                <span className="text-sm text-[#00E0FF]">{targetCard.current_price.toFixed(2)} coins</span>
              </div>
              {targetCard.owner?.username && (
                <p className="text-xs text-slate-400 mt-1">Owner: @{targetCard.owner.username}</p>
              )}
            </div>

            {cooldown.blocked && cooldown.unlocksAt ? (
              <div className="p-4 bg-[rgba(251,191,36,0.08)] border border-[rgba(251,191,36,0.3)] rounded-xl text-center">
                <Clock className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                <p className="text-amber-300 font-semibold">You already have a pending swap request</p>
                <p className="text-amber-400/70 text-sm mt-1">
                  You can send another in{' '}
                  <span className="font-bold text-amber-300">{formatCountdown(cooldown.unlocksAt)}</span>
                </p>
                <button
                  onClick={() => setShowSwapModal(false)}
                  className="mt-4 w-full px-4 py-2.5 bg-[rgba(255,255,255,0.06)] text-slate-300 rounded-lg border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.1)] transition-all text-sm font-semibold"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="mb-5">
                  <label className="block text-sm text-slate-400 mb-2 font-semibold">
                    Select your card to offer
                  </label>
                  {myCards.length === 0 ? (
                    <div className="p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-xl text-center text-slate-400 text-sm">
                      You have no managed cards available to offer
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {myCards.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedMyCard(c.card_user_id)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                            selectedMyCard === c.card_user_id
                              ? 'bg-[rgba(0,224,255,0.12)] border-[rgba(0,224,255,0.4)] text-[#00E0FF]'
                              : 'bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.08)] text-slate-300 hover:border-[rgba(0,224,255,0.2)]'
                          }`}
                        >
                          <span className="font-semibold text-sm">@{c.profile?.username || 'unknown'}</span>
                          <div className="flex items-center gap-1">
                            <Coins className="w-3.5 h-3.5" />
                            <span className="text-sm">{c.current_price.toFixed(2)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {modalError && (
                  <div className="mb-4 p-3 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] rounded-lg text-red-300 text-sm">
                    {modalError}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSwapModal(false)}
                    className="flex-1 px-4 py-3 bg-[rgba(255,255,255,0.05)] text-slate-300 rounded-xl border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.08)] transition-all font-semibold text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitSwap}
                    disabled={!selectedMyCard || submitting || myCards.length === 0}
                    className="flex-1 px-4 py-3 bg-[rgba(0,224,255,0.12)] hover:bg-[rgba(0,224,255,0.2)] text-[#00E0FF] rounded-xl border border-[rgba(0,224,255,0.3)] hover:border-[rgba(0,224,255,0.5)] transition-all font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>Sending...</>
                    ) : (
                      <>
                        <Repeat className="w-4 h-4" />
                        Send Request
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
