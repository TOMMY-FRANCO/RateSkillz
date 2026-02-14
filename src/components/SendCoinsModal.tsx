import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, Coins, ShieldCheck, AlertCircle, Search, ChevronDown, RefreshCw, User, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { displayUsername } from '../lib/username';
import {
  processCoinTransfer,
  getRemainingSendLimit,
  getRemainingReceiveLimit,
  getAcceptedFriends,
  type FriendOption,
  type TransferErrorCode,
} from '../lib/coinTransfers';
import { ShimmerBar, StaggerContainer, StaggerItem, ContentReveal, SlowLoadMessage } from './ui/Shimmer';
import { SkeletonAvatar, SkeletonText, SkeletonButton, SkeletonLimitRow } from './ui/SkeletonPresets';
import { AnimatedCounter } from './ui/AnimatedCounter';
import { useContentReveal } from '../hooks/useContentReveal';
import { playSound } from '../lib/sounds';

interface SendCoinsModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientId?: string;
  recipientUsername?: string;
  recipientFullName?: string | null;
  recipientIsVerified?: boolean;
  conversationId?: string;
  onTransferComplete?: (amount: number) => void;
}

const QUICK_AMOUNTS = [10, 20, 50, 100] as const;
const MIN_AMOUNT = 10;
const MAX_AMOUNT = 100;
const STEP = 10;

export default function SendCoinsModal({
  isOpen,
  onClose,
  recipientId: preselectedRecipientId,
  recipientUsername: preselectedUsername,
  recipientFullName: preselectedFullName,
  recipientIsVerified: preselectedVerified,
  conversationId,
  onTransferComplete,
}: SendCoinsModalProps) {
  const [selectedAmount, setSelectedAmount] = useState(10);
  const [senderBalance, setSenderBalance] = useState(0);
  const [remainingSendLimit, setRemainingSendLimit] = useState(100);
  const [remainingReceiveLimit, setRemainingReceiveLimit] = useState(100);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<TransferErrorCode | null>(null);
  const [success, setSuccess] = useState(false);

  const [friends, setFriends] = useState<FriendOption[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FriendOption | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const balance = useContentReveal();
  const limits = useContentReveal();

  const filteredFriends = useMemo(() => {
    if (!searchQuery) return friends;
    const q = searchQuery.toLowerCase();
    return friends.filter(
      (f) =>
        f.username.toLowerCase().includes(q) ||
        (f.full_name && f.full_name.toLowerCase().includes(q))
    );
  }, [friends, searchQuery]);

  useEffect(() => {
    if (isOpen) {
      resetState();
      loadFriends();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (selectedFriend) {
      loadLimitsForRecipient(selectedFriend.id);
    }
  }, [selectedFriend]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const resetState = () => {
    setSelectedAmount(10);
    setError(null);
    setErrorCode(null);
    setSuccess(false);
    setSearchQuery('');
    setDropdownOpen(false);
    setSelectedFriend(null);
    setToast(null);
    balance.reset();
    limits.reset();
  };

  const loadFriends = async () => {
    setFriendsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [friendsList, balanceResult] = await Promise.all([
        getAcceptedFriends(user.id),
        supabase.from('profiles').select('coin_balance').eq('id', user.id).maybeSingle(),
      ]);

      setFriends(friendsList);
      setSenderBalance(Number(balanceResult.data?.coin_balance) || 0);
      balance.reveal();

      const sendLimit = await getRemainingSendLimit(user.id);
      setRemainingSendLimit(sendLimit);

      if (preselectedRecipientId) {
        const preselected = friendsList.find((f) => f.id === preselectedRecipientId);
        if (preselected) {
          setSelectedFriend(preselected);
        } else if (preselectedUsername) {
          setSelectedFriend({
            id: preselectedRecipientId,
            username: preselectedUsername,
            full_name: preselectedFullName || null,
            avatar_url: null,
            is_verified: preselectedVerified || false,
          });
        }
      }
    } catch {
      setError('Failed to load friends list');
    } finally {
      setFriendsLoading(false);
    }
  };

  const loadLimitsForRecipient = useCallback(async (recipientId: string) => {
    setLoading(true);
    limits.reset();
    try {
      const recvLimit = await getRemainingReceiveLimit(recipientId);
      setRemainingReceiveLimit(recvLimit);
      limits.reveal();
    } catch {
      setRemainingReceiveLimit(0);
      limits.reveal();
    } finally {
      setLoading(false);
    }
  }, [limits]);

  const handleSelectFriend = (friend: FriendOption) => {
    setSelectedFriend(friend);
    setSearchQuery('');
    setDropdownOpen(false);
    setError(null);
    setErrorCode(null);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.round(Number(e.target.value) / STEP) * STEP;
    setSelectedAmount(Math.max(MIN_AMOUNT, Math.min(MAX_AMOUNT, val)));
  };

  const handleSendCoins = async () => {
    if (!selectedFriend) return;

    setProcessing(true);
    setError(null);
    setErrorCode(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in');
        setProcessing(false);
        return;
      }

      const { data: freshBalance } = await supabase
        .from('profiles')
        .select('coin_balance')
        .eq('id', user.id)
        .maybeSingle();

      const currentBalance = Number(freshBalance?.coin_balance) || 0;
      if (currentBalance < selectedAmount) {
        setError(`Insufficient balance. You have ${currentBalance.toFixed(1)} coins.`);
        setErrorCode('insufficient_balance');
        setSenderBalance(currentBalance);
        setProcessing(false);
        return;
      }

      const result = await processCoinTransfer(
        user.id,
        selectedFriend.id,
        selectedAmount,
        conversationId
      );

      if (!result.success) {
        setError(result.error || 'Transfer failed');
        setErrorCode(result.errorCode || 'unknown');
        setProcessing(false);
        return;
      }

      setSuccess(true);
      playSound('coin-received');
      if (result.remaining_send_limit !== undefined) {
        setRemainingSendLimit(Number(result.remaining_send_limit));
      }
      if (result.remaining_receive_limit !== undefined) {
        setRemainingReceiveLimit(Number(result.remaining_receive_limit));
      }

      const { data: updatedBalance } = await supabase
        .from('profiles')
        .select('coin_balance')
        .eq('id', user.id)
        .maybeSingle();
      if (updatedBalance) {
        setSenderBalance(Number(updatedBalance.coin_balance) || 0);
      }

      setToast({ message: `Sent ${selectedAmount} coins to @${selectedFriend.username}`, type: 'success' });
      onTransferComplete?.(selectedAmount);

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch {
      setError('An unexpected error occurred');
      setErrorCode('unknown');
    } finally {
      setProcessing(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setErrorCode(null);
    handleSendCoins();
  };

  if (!isOpen) return null;

  const canAfford = senderBalance >= selectedAmount;
  const withinSendLimit = remainingSendLimit >= selectedAmount;
  const withinReceiveLimit = remainingReceiveLimit >= selectedAmount;
  const canSend =
    !!selectedFriend &&
    canAfford &&
    withinSendLimit &&
    withinReceiveLimit &&
    !loading &&
    !processing &&
    !friendsLoading;

  return (
    <>
      {toast && (
        <div className="fixed top-5 right-5 z-[60] animate-slide-in">
          <div
            className={`rounded-xl shadow-2xl px-5 py-3 border backdrop-blur-sm flex items-center gap-3 ${
              toast.type === 'success'
                ? 'bg-emerald-900/90 border-emerald-500/40 text-emerald-100'
                : 'bg-red-900/90 border-red-500/40 text-red-100'
            }`}
          >
            {toast.type === 'success' ? (
              <Check className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400" />
            )}
            <span className="font-medium text-sm">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-gray-900 via-gray-850 to-gray-900 rounded-2xl border border-white/10 max-w-md w-full shadow-2xl overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-white/10 flex justify-between items-center">
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
                <Coins className="w-5 h-5 text-amber-400" />
              </div>
              Send Coins
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              disabled={processing}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6">
            {friendsLoading ? (
              <SendCoinsLoadingSkeleton loading={friendsLoading} />
            ) : success ? (
              <div className="text-center py-8 animate-content-reveal">
                <div className="w-16 h-16 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-4 ring-4 ring-emerald-500/10">
                  <Check className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Transfer Complete</h3>
                <p className="text-gray-300">
                  Sent {selectedAmount} coins to{' '}
                  @{selectedFriend?.username || 'unknown'}
                </p>
              </div>
            ) : (
              <div className="animate-content-reveal">
                <div className="mb-5" ref={dropdownRef}>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Send to
                  </label>
                  {selectedFriend ? (
                    <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                      <div className="flex items-center gap-3">
                        {selectedFriend.avatar_url ? (
                          <img
                            src={selectedFriend.avatar_url}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
                            <User className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div>
                          <p className="text-white font-semibold text-sm flex items-center gap-1.5">
                            @{selectedFriend.username}
                            {selectedFriend.is_verified && (
                              <ShieldCheck className="w-4 h-4 text-blue-400" />
                            )}
                          </p>
                          <p className="text-gray-500 text-xs">
                            @{selectedFriend.username.toLowerCase()}
                          </p>
                        </div>
                      </div>
                      {!preselectedRecipientId && (
                        <button
                          onClick={() => {
                            setSelectedFriend(null);
                            setSearchQuery('');
                            setTimeout(() => searchRef.current?.focus(), 50);
                          }}
                          className="text-gray-500 hover:text-white text-xs px-2 py-1 rounded-md hover:bg-white/10 transition-colors"
                          disabled={processing}
                        >
                          Change
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      <div
                        className={`flex items-center bg-white/5 rounded-xl border transition-colors ${
                          dropdownOpen ? 'border-amber-500/50' : 'border-white/10'
                        }`}
                      >
                        <Search className="w-4 h-4 text-gray-500 ml-4" />
                        <input
                          ref={searchRef}
                          type="text"
                          placeholder="Search friends..."
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setDropdownOpen(true);
                          }}
                          onFocus={() => setDropdownOpen(true)}
                          className="flex-1 bg-transparent text-white placeholder-gray-500 px-3 py-3 text-sm focus:outline-none"
                        />
                        <button
                          onClick={() => setDropdownOpen(!dropdownOpen)}
                          className="px-3 text-gray-500 hover:text-white transition-colors"
                        >
                          <ChevronDown
                            className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </div>

                      {dropdownOpen && (
                        <div className="absolute z-10 mt-1.5 w-full bg-gray-800 rounded-xl border border-white/10 shadow-2xl max-h-48 overflow-y-auto">
                          {filteredFriends.length === 0 ? (
                            <div className="px-4 py-6 text-center text-gray-500 text-sm">
                              {friends.length === 0
                                ? 'No friends yet'
                                : 'No friends match your search'}
                            </div>
                          ) : (
                            filteredFriends.map((friend, idx) => (
                              <button
                                key={friend.id}
                                onClick={() => handleSelectFriend(friend)}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left animate-stagger-fade-in"
                                style={{ animationDelay: `${idx * 30}ms` }}
                              >
                                {friend.avatar_url ? (
                                  <img
                                    src={friend.avatar_url}
                                    alt=""
                                    className="w-8 h-8 rounded-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
                                    <User className="w-3.5 h-3.5 text-white" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-sm font-medium truncate flex items-center gap-1.5">
                                    @{friend.username}
                                    {friend.is_verified && (
                                      <ShieldCheck className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                                    )}
                                  </p>
                                  <p className="text-gray-500 text-xs truncate">
                                    @{friend.username.toLowerCase()}
                                  </p>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {selectedFriend && (
                  <>
                    <div className="mb-5">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-gray-400">Amount</label>
                        <ContentReveal
                          visible={balance.revealed}
                          fallback={<ShimmerBar className="h-4 w-24 rounded" />}
                        >
                          <span className="text-sm text-gray-500">
                            Balance:{' '}
                            <AnimatedCounter value={senderBalance} className="text-amber-400 font-semibold" />
                          </span>
                        </ContentReveal>
                      </div>

                      <div className="flex gap-2 mb-4">
                        {QUICK_AMOUNTS.map((amount) => (
                          <button
                            key={amount}
                            onClick={() => setSelectedAmount(amount)}
                            disabled={processing}
                            className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${
                              selectedAmount === amount
                                ? 'bg-amber-500 text-gray-900 shadow-lg shadow-amber-500/20'
                                : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                            } disabled:opacity-50`}
                          >
                            {amount}
                          </button>
                        ))}
                      </div>

                      <div className="relative px-1">
                        <input
                          type="range"
                          min={MIN_AMOUNT}
                          max={MAX_AMOUNT}
                          step={STEP}
                          value={selectedAmount}
                          onChange={handleSliderChange}
                          disabled={processing}
                          className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-400
                            [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-amber-500/30
                            [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform
                            [&::-webkit-slider-thumb]:hover:scale-110
                            [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5
                            [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-amber-400
                            [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer
                            disabled:opacity-50"
                        />
                        <div className="flex justify-between mt-1.5 text-xs text-gray-600">
                          <span>10</span>
                          <span>50</span>
                          <span>100</span>
                        </div>
                      </div>

                      <div className="text-center mt-3">
                        <span className="text-3xl font-bold text-white">{selectedAmount}</span>
                        <span className="text-gray-400 ml-2 text-sm">coins</span>
                      </div>
                    </div>

                    <div className="bg-white/5 rounded-xl p-4 mb-5 border border-white/5 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">You can send today</span>
                        <ContentReveal
                          visible={limits.revealed && !loading}
                          fallback={<ShimmerBar className="h-4 w-24 rounded" speed="slow" />}
                        >
                          <span className={`font-semibold ${withinSendLimit ? 'text-emerald-400' : 'text-red-400'}`}>
                            {remainingSendLimit} coins left
                          </span>
                        </ContentReveal>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">
                          @{selectedFriend.username} can
                          receive
                        </span>
                        <ContentReveal
                          visible={limits.revealed && !loading}
                          fallback={<ShimmerBar className="h-4 w-24 rounded" speed="slow" />}
                        >
                          <span className={`font-semibold ${withinReceiveLimit ? 'text-emerald-400' : 'text-red-400'}`}>
                            {remainingReceiveLimit} coins left
                          </span>
                        </ContentReveal>
                      </div>
                      {selectedAmount > 0 && limits.revealed && !loading && (
                        <div className="flex justify-between text-sm pt-1 border-t border-white/5 animate-content-reveal">
                          <span className="text-gray-500">After transfer</span>
                          <span className="text-gray-300 font-semibold">
                            {Math.max(0, senderBalance - selectedAmount).toFixed(1)} coins
                          </span>
                        </div>
                      )}
                    </div>

                    {error && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 mb-4 flex items-start gap-2.5 animate-content-reveal">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-red-300 text-sm">{error}</p>
                          {errorCode && errorCode !== 'insufficient_balance' && (
                            <button
                              onClick={handleRetry}
                              disabled={processing}
                              className="mt-2 text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5 transition-colors"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Retry
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {!canAfford && !error && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 mb-4 flex items-start gap-2.5">
                        <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-amber-300 text-sm">
                          Insufficient balance. You have {senderBalance.toFixed(1)} coins.
                        </p>
                      </div>
                    )}

                    {!withinSendLimit && canAfford && !error && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 mb-4 flex items-start gap-2.5">
                        <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-amber-300 text-sm">
                          Daily send limit reached. You can send {remainingSendLimit} more coins
                          today.
                        </p>
                      </div>
                    )}

                    {!withinReceiveLimit && canAfford && withinSendLimit && !error && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 mb-4 flex items-start gap-2.5">
                        <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-amber-300 text-sm">
                          @{selectedFriend.username} can
                          only receive {remainingReceiveLimit} more coins today.
                        </p>
                      </div>
                    )}
                  </>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={onClose}
                    disabled={processing}
                    className="flex-1 bg-white/5 text-gray-300 py-3 rounded-xl font-semibold hover:bg-white/10 transition-all disabled:opacity-50 border border-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendCoins}
                    disabled={!canSend}
                    className={`flex-1 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 relative overflow-hidden ${
                      canSend
                        ? 'bg-amber-500 text-gray-900 hover:bg-amber-400 shadow-lg shadow-amber-500/20'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {!canSend && !processing && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent animate-shimmer-slow" />
                    )}
                    {processing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-900/30 border-t-gray-900"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Coins className="w-4 h-4" />
                        Send {selectedAmount} Coins
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function SendCoinsLoadingSkeleton({ loading }: { loading: boolean }) {
  return (
    <div className="space-y-5">
      <div>
        <StaggerContainer>
          <SkeletonText width={56} />
        </StaggerContainer>
        <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-3 space-y-3 mt-2">
          {[0, 1, 2, 3].map((i) => (
            <StaggerItem key={i} index={i} className="flex items-center gap-3">
              <SkeletonAvatar />
              <StaggerItem index={i} interval={100} className="flex-1 space-y-1.5">
                <ShimmerBar className="h-3.5 rounded" style={{ width: `${110 - i * 12}px` }} />
                <ShimmerBar className="h-2.5 w-16 rounded" />
              </StaggerItem>
            </StaggerItem>
          ))}
        </div>
      </div>

      <StaggerContainer baseDelay={300}>
        <div className="flex items-center justify-between mb-3">
          <SkeletonText width={56} />
          <SkeletonText width={96} />
        </div>
        <div className="flex gap-2 mb-4">
          {[0, 1, 2, 3].map((i) => (
            <StaggerItem key={i} index={i} interval={40} className="flex-1">
              <ShimmerBar className="h-10 rounded-lg" />
            </StaggerItem>
          ))}
        </div>
        <ShimmerBar className="h-2 rounded-full mx-1" speed="slow" />
        <div className="text-center mt-4">
          <ShimmerBar className="h-8 w-16 rounded-lg mx-auto" />
        </div>
      </StaggerContainer>

      <StaggerContainer baseDelay={450} className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.04] space-y-2.5">
        <SkeletonLimitRow />
        <SkeletonLimitRow />
      </StaggerContainer>

      <StaggerContainer baseDelay={500} className="flex gap-3 pt-1">
        <div className="flex-1 h-12 rounded-xl bg-white/[0.03] border border-white/[0.06]" />
        <SkeletonButton className="flex-1" />
      </StaggerContainer>

      <SlowLoadMessage loading={loading} message="Loading friends..." />
    </div>
  );
}
