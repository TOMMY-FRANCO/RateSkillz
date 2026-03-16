import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords, Trophy, Coins, Clock, ArrowLeft, ChevronDown, ChevronUp, Shield, Zap, X } from 'lucide-react';
import { ShimmerBar, StaggerItem, SlowLoadMessage } from '../components/ui/Shimmer';
import { BattleArena } from '../components/battle/BattleArena';
import { useAuth } from '../contexts/AuthContext';
import {
  Battle,
  BattleRoyalty,
  BattleSelection,
  getUserBattles,
  checkManagerStatus,
  createBattleChallenge,
  acceptBattleChallenge,
  getBattle,
  getBattleRoyalties,
  chooseFirstPlayer,
  cancelBattle,
} from '../lib/battleMode';
import { supabase } from '../lib/supabase';
import { markNotificationsRead } from '../lib/notifications';

const selectClass = `w-full px-3 py-2.5 rounded-lg text-sm font-semibold
  bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)]
  text-white focus:outline-none focus:border-[#00E0FF]
  appearance-none cursor-pointer transition-colors
  hover:border-[rgba(0,224,255,0.5)]`;

const CHALLENGE_TIMEOUT_SECONDS = 60;
const CHOOSE_TIMEOUT_SECONDS = 60;

function useChallengeCountdown(createdAt: string) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
    return Math.max(0, CHALLENGE_TIMEOUT_SECONDS - elapsed);
  });

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
      setSecondsLeft(Math.max(0, CHALLENGE_TIMEOUT_SECONDS - elapsed));
    }, 1000);
    return () => clearInterval(id);
  }, [createdAt]);

  return secondsLeft;
}

function ChallengeCountdown({ createdAt }: { createdAt: string }) {
  const secondsLeft = useChallengeCountdown(createdAt);
  const isUrgent = secondsLeft <= 15;
  return (
    <div className={`flex items-center gap-1 ${isUrgent ? 'text-red-400' : 'text-yellow-400'}`}>
      <Clock className="w-3 h-3" />
      <span className={`text-[10px] font-bold tabular-nums ${isUrgent ? 'animate-pulse' : ''}`}>
        {secondsLeft}s
      </span>
    </div>
  );
}

interface ChoosingScreenProps {
  battle: Battle;
  userId: string;
  onChosen: (updatedBattle: Battle) => void;
  onTimeout: () => void;
}

function ChoosingScreen({ battle, userId, onChosen, onTimeout }: ChoosingScreenProps) {
  const [secondsLeft, setSecondsLeft] = useState(CHOOSE_TIMEOUT_SECONDS);
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timedOutRef = useRef(false);

  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsLeft(s => {
        const next = s - 1;
        if (next <= 0 && !timedOutRef.current) {
          timedOutRef.current = true;
          clearInterval(tick);
          onTimeout();
        }
        return Math.max(0, next);
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [onTimeout]);

  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const updated = await getBattle(battle.id);
        if (updated.status === 'active') {
          if (pollRef.current) clearInterval(pollRef.current);
          onChosen(updated);
        } else if (updated.status === 'forfeited' || updated.status === 'completed') {
          if (pollRef.current) clearInterval(pollRef.current);
          onTimeout();
        }
      } catch {
      }
    }, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [battle.id, onChosen, onTimeout]);

  const handleChoose = async (goFirst: boolean) => {
    if (choosing) return;
    setChoosing(true);
    setError(null);
    try {
      await chooseFirstPlayer(battle.id, userId, goFirst);
      const updated = await getBattle(battle.id);
      if (updated.status === 'active') {
        if (pollRef.current) clearInterval(pollRef.current);
        onChosen(updated);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to choose. Try again.');
      setChoosing(false);
    }
  };

  const isUrgent = secondsLeft <= 15;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-sm w-full glass-container p-6 space-y-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30">
            <Swords className="w-7 h-7 text-yellow-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Choose Your Position</h2>
          <p className="text-[#B0B8C8] text-sm">
            The first player to press <span className="text-[#00FF85] font-bold">Go First</span> will attack first.<br />
            <span className="text-[#B0B8C8]/60 text-xs">Both players must choose before the battle begins.</span>
          </p>
        </div>

        <div className={`flex items-center justify-center gap-2 ${isUrgent ? 'text-red-400' : 'text-yellow-400'}`}>
          <Clock className={`w-4 h-4 ${isUrgent ? 'animate-pulse' : ''}`} />
          <span className={`text-lg font-black tabular-nums ${isUrgent ? 'animate-pulse' : ''}`}>{secondsLeft}s</span>
          <span className="text-[#B0B8C8] text-xs">remaining</span>
        </div>

        {error && (
          <p className="text-red-400 text-xs font-semibold bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleChoose(true)}
            disabled={choosing || secondsLeft <= 0}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-[#00FF85]/10 to-[#00E0FF]/10 border border-[#00FF85]/30 hover:border-[#00FF85]/60 hover:bg-[#00FF85]/15 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Zap className="w-6 h-6 text-[#00FF85]" />
            <span className="text-[#00FF85] font-bold text-sm">Go First</span>
            <span className="text-[#B0B8C8] text-[10px]">Attack first</span>
          </button>
          <button
            onClick={() => handleChoose(false)}
            disabled={choosing || secondsLeft <= 0}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-400/10 border border-blue-500/30 hover:border-blue-400/60 hover:bg-blue-500/15 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Shield className="w-6 h-6 text-blue-400" />
            <span className="text-blue-400 font-bold text-sm">Go Second</span>
            <span className="text-[#B0B8C8] text-[10px]">Attack second</span>
          </button>
        </div>

        {choosing && (
          <div className="flex items-center justify-center gap-2 text-[#B0B8C8] text-sm">
            <div className="w-4 h-4 border-2 border-[#00E0FF]/40 border-t-[#00E0FF] rounded-full animate-spin" />
            <span>Waiting for opponent...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BattleMode() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [battles, setBattles] = useState<Battle[]>([]);
  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeBattle, setActiveBattle] = useState<Battle | null>(null);
  const [choosingBattle, setChoosingBattle] = useState<Battle | null>(null);
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);
  const [opponentId, setOpponentId] = useState('');
  const [wagerAmount, setWagerAmount] = useState(50);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [managers, setManagers] = useState<any[]>([]);
  const [expandedBreakdowns, setExpandedBreakdowns] = useState<Record<string, boolean>>({});
  const [breakdownData, setBreakdownData] = useState<Record<string, Battle>>({});
  const [breakdownLoading, setBreakdownLoading] = useState<Record<string, boolean>>({});
  const [breakdownRoyalties, setBreakdownRoyalties] = useState<Record<string, BattleRoyalty[]>>({});
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const battlePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasPendingChallengeRef = useRef(false);

  const handleToggleBreakdown = async (battleId: string) => {
    const nowOpen = !expandedBreakdowns[battleId];
    setExpandedBreakdowns(prev => ({ ...prev, [battleId]: nowOpen }));
    if (nowOpen && !breakdownData[battleId]) {
      setBreakdownLoading(prev => ({ ...prev, [battleId]: true }));
      try {
        const [full, royals] = await Promise.all([
          getBattle(battleId),
          getBattleRoyalties(battleId),
        ]);
        setBreakdownData(prev => ({ ...prev, [battleId]: full }));
        setBreakdownRoyalties(prev => ({ ...prev, [battleId]: royals }));
      } catch {
      } finally {
        setBreakdownLoading(prev => ({ ...prev, [battleId]: false }));
      }
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
      markNotificationsRead(user.id, 'battle_request');
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const hasPending = battles.some(
      (b) =>
        b.status === 'waiting' &&
        (b.manager1_id === user.id || b.manager2_id === user.id)
    );
    const hasChoosing = battles.find(
      (b) => b.status === 'choosing' &&
      (b.manager1_id === user.id || b.manager2_id === user.id)
    );
    const hasActive = battles.find(
      (b) => b.status === 'active' &&
      (b.manager1_id === user.id || b.manager2_id === user.id)
    );

    if (hasChoosing) {
      setChoosingBattle(hasChoosing);
      return;
    }
    if (hasActive) {
      setActiveBattle(hasActive);
      return;
    }

    hasPendingChallengeRef.current = hasPending;
  }, [battles, user]);

  useEffect(() => {
    if (battlePollRef.current) {
      clearInterval(battlePollRef.current);
      battlePollRef.current = null;
    }

    if (!user || !isManager) return;

    battlePollRef.current = setInterval(async () => {
      if (!hasPendingChallengeRef.current) return;
      try {
        const updated = await getUserBattles(user.id);
        setBattles(updated);

        const nowChoosing = updated.find(
          (b) => b.status === 'choosing' &&
          (b.manager1_id === user.id || b.manager2_id === user.id)
        );
        if (nowChoosing) {
          setChoosingBattle(nowChoosing);
          hasPendingChallengeRef.current = false;
          return;
        }

        const nowActive = updated.find(
          (b) => b.status === 'active' &&
          (b.manager1_id === user.id || b.manager2_id === user.id)
        );
        if (nowActive) {
          setActiveBattle(nowActive);
          hasPendingChallengeRef.current = false;
        }
      } catch (error) {
        console.error('Error polling battles:', error);
      }
    }, 3000);

    return () => {
      if (battlePollRef.current) {
        clearInterval(battlePollRef.current);
        battlePollRef.current = null;
      }
    };
  }, [user?.id, isManager]);

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const managerStatus = await checkManagerStatus(user.id);
      setIsManager(managerStatus);

      const userBattles = await getUserBattles(user.id);
      setBattles(userBattles);

      const { data: managersData } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('is_manager', true)
        .neq('id', user.id)
        .eq('is_banned', false);

      setManagers((managersData || []).map((m: any) => ({ id: m.id, username: m.username })));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChallenge = async () => {
    if (!user || !opponentId) return;

    try {
      setCheckingBalance(true);
      const { data: profile, error: balanceError } = await supabase
        .from('profiles')
        .select('coin_balance')
        .eq('id', user.id)
        .maybeSingle();

      if (balanceError || !profile) {
        alert('Failed to verify coin balance. Please try again.');
        return;
      }

      if (profile.coin_balance < wagerAmount) {
        alert(`Insufficient coins. You need ${wagerAmount} coins to place this wager.`);
        return;
      }

      setCheckingBalance(false);
      const result = await createBattleChallenge(user.id, opponentId, wagerAmount);
      if (result.success) {
        alert('Challenge created successfully!');
        setShowCreateChallenge(false);
        loadData();
      } else {
        alert(result.error || 'Failed to create challenge');
      }
    } catch (error) {
      console.error('Error creating challenge:', error);
      alert('Failed to create challenge');
    } finally {
      setCheckingBalance(false);
    }
  };

  const handleAcceptChallenge = async (battleId: string, createdAt: string) => {
    if (!user) return;
    const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
    if (elapsed >= CHALLENGE_TIMEOUT_SECONDS) {
      alert('This challenge has expired.');
      loadData();
      return;
    }

    try {
      const result = await acceptBattleChallenge(battleId, user.id);
      if (result.success) {
        loadData();
      } else {
        alert(result.error || 'Failed to accept challenge');
      }
    } catch (error) {
      console.error('Error accepting challenge:', error);
      alert('Failed to accept challenge');
    }
  };

  const handleCancelChallenge = async (battleId: string) => {
    if (!user || cancellingId) return;
    setCancellingId(battleId);
    try {
      await cancelBattle(battleId, user.id);
      loadData();
    } catch (error) {
      console.error('Error cancelling challenge:', error);
      alert('Failed to cancel challenge');
    } finally {
      setCancellingId(null);
    }
  };

  const handleChooseComplete = useCallback((updatedBattle: Battle) => {
    setChoosingBattle(null);
    setActiveBattle(updatedBattle);
  }, []);

  const handleChooseTimeout = useCallback(() => {
    setChoosingBattle(null);
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-5">
          <StaggerItem index={0}>
            <ShimmerBar className="h-8 w-48 rounded-lg" />
          </StaggerItem>
          <StaggerItem index={1} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ShimmerBar className="h-40 rounded-2xl" />
            <ShimmerBar className="h-40 rounded-2xl" />
          </StaggerItem>
          <StaggerItem index={2}>
            <ShimmerBar className="h-12 w-full rounded-xl" speed="slow" />
          </StaggerItem>
          <StaggerItem index={3} className="space-y-3">
            {[0, 1, 2].map((i) => (
              <ShimmerBar key={i} className="h-20 rounded-xl" speed="slow" />
            ))}
          </StaggerItem>
          <SlowLoadMessage loading={true} message="Loading battle arena..." />
        </div>
      </div>
    );
  }

  if (activeBattle) {
    return <BattleArena battle={activeBattle} onComplete={() => {
      setActiveBattle(null);
      loadData();
    }} />;
  }

  if (choosingBattle && user) {
    return (
      <ChoosingScreen
        battle={choosingBattle}
        userId={user.id}
        onChosen={handleChooseComplete}
        onTimeout={handleChooseTimeout}
      />
    );
  }

  if (!isManager) {
    return (
      <div className="min-h-screen">
        <nav className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 h-16">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-[#B0B8C8] hover:text-[#00E0FF] transition-colors"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Swords className="w-5 h-5 text-red-400" />
                Battle Mode
              </h1>
            </div>
          </div>
        </nav>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28">
          <div className="glass-container p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 mb-4 mx-auto">
              <Swords className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Manager Status Required</h2>
            <p className="text-[#B0B8C8] mb-6">
              You must be a manager (own 5 or more cards) to participate in Battle Mode.
            </p>
            <button
              onClick={() => navigate('/shop')}
              className="bg-gradient-to-r from-[#00E0FF] to-[#38BDF8] text-black font-bold px-6 py-2.5 rounded-lg text-sm hover:opacity-90 transition-all shadow-[0_0_12px_rgba(0,224,255,0.35)]"
            >
              Go to Shop
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <nav className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-[#B0B8C8] hover:text-[#00E0FF] transition-colors"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Swords className="w-5 h-5 text-red-400" />
                Battle Mode
              </h1>
            </div>
            <button
              onClick={() => setShowCreateChallenge(true)}
              className="bg-gradient-to-r from-[#00E0FF] to-[#38BDF8] text-black font-bold px-4 py-2 rounded-lg text-sm hover:opacity-90 transition-all shadow-[0_0_12px_rgba(0,224,255,0.35)] flex items-center gap-2"
            >
              <Swords className="w-4 h-4" />
              Create Challenge
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-5">

        {showCreateChallenge && (
          <div className="glass-container p-4 space-y-4">
            <h3 className="text-base font-bold text-white">Create Battle Challenge</h3>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#B0B8C8]">Select Opponent</label>
              <div className="relative">
                <select
                  value={opponentId}
                  onChange={(e) => setOpponentId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Choose a manager...</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.username}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                  <svg className="w-3.5 h-3.5 text-[#B0B8C8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#B0B8C8]">Wager Amount (50–150 coins)</label>
              <div className="flex flex-wrap gap-2">
                {[50, 100, 150, 200].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setWagerAmount(amount)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                      wagerAmount === amount
                        ? 'bg-gradient-to-r from-[#00E0FF] to-[#38BDF8] text-black shadow-[0_0_12px_rgba(0,224,255,0.35)]'
                        : 'bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] text-[#B0B8C8] hover:border-[#00E0FF] hover:text-white'
                    }`}
                  >
                    {amount}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCreateChallenge}
                disabled={!opponentId || checkingBalance}
                className="bg-gradient-to-r from-[#00E0FF] to-[#38BDF8] text-black font-bold px-5 py-2.5 rounded-lg text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_12px_rgba(0,224,255,0.35)]"
              >
                {checkingBalance ? 'Checking...' : 'Create Challenge'}
              </button>
              <button
                onClick={() => setShowCreateChallenge(false)}
                className="px-5 py-2.5 rounded-lg text-sm font-bold bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] text-[#B0B8C8] hover:border-[#00E0FF] hover:text-white transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-5">
          <div className="glass-card p-4">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-400" />
              Pending Challenges
            </h3>
            <div className="space-y-3">
              {battles.filter((b) => b.status === 'waiting').length === 0 ? (
                <p className="text-[#B0B8C8]/50 text-center py-4 text-sm">No pending challenges</p>
              ) : (
                battles
                  .filter((b) => b.status === 'waiting')
                  .map((battle) => {
                    const elapsed = Math.floor((Date.now() - new Date(battle.created_at).getTime()) / 1000);
                    const isExpired = elapsed >= CHALLENGE_TIMEOUT_SECONDS;
                    const isOpponent = battle.manager2_id === user?.id;
                    const isChallenger = battle.manager1_id === user?.id;

                    return (
                      <div
                        key={battle.id}
                        className="bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.12)] rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <Coins className="w-4 h-4 text-yellow-400" />
                            <span className="text-white font-bold text-sm">{battle.wager_amount} coins</span>
                            <ChallengeCountdown createdAt={battle.created_at} />
                          </div>
                          <div className="flex items-center gap-2">
                            {isOpponent && (
                              isExpired ? (
                                <span className="text-[#B0B8C8] text-xs font-bold px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                                  Expired
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleAcceptChallenge(battle.id, battle.created_at)}
                                  className="bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black font-bold px-3 py-1.5 rounded-lg text-xs hover:opacity-90 transition-all"
                                >
                                  Accept
                                </button>
                              )
                            )}
                            {isChallenger && (
                              <button
                                onClick={() => handleCancelChallenge(battle.id)}
                                disabled={cancellingId === battle.id}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-all disabled:opacity-50"
                              >
                                <X className="w-3 h-3" />
                                {cancellingId === battle.id ? '...' : 'Cancel'}
                              </button>
                            )}
                          </div>
                        </div>
                        {isChallenger ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                            <span className="text-yellow-400 text-[10px] font-semibold text-xs">Waiting for opponent to accept...</span>
                          </div>
                        ) : (
                          <p className="text-[#B0B8C8] text-xs">Challenge received</p>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          <div className="glass-card p-4">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              Battle History
            </h3>
            <div className="space-y-3">
              {battles.filter((b) => b.status === 'completed' || b.status === 'forfeited').length === 0 ? (
                <p className="text-[#B0B8C8]/50 text-center py-4 text-sm">No battle history</p>
              ) : (
                battles
                  .filter((b) => b.status === 'completed' || b.status === 'forfeited')
                  .slice(0, 5)
                  .map((battle) => {
                    const isWinner = battle.winner_id === user?.id;
                    const isOpen = expandedBreakdowns[battle.id] ?? false;
                    const isLoadingBreakdown = breakdownLoading[battle.id] ?? false;
                    const detail = breakdownData[battle.id] ?? battle;
                    const royaltyRows: BattleRoyalty[] = breakdownRoyalties[battle.id] ?? [];
                    const pot = detail.wager_amount * 2;
                    const royalties = Math.floor(pot * 0.05);
                    const winnerPayout = pot - royalties;
                    const isManager1 = detail.manager1_id === user?.id;
                    const myRemaining = isManager1 ? detail.player1_remaining_cards : detail.player2_remaining_cards;
                    const oppRemaining = isManager1 ? detail.player2_remaining_cards : detail.player1_remaining_cards;
                    const selections: BattleSelection[] = detail.card_selections || [];
                    const rounds: Array<{ roundNum: number; attacker: BattleSelection; defender: BattleSelection }> = [];
                    for (let i = 0; i + 1 < selections.length; i += 2) {
                      rounds.push({ roundNum: Math.floor(i / 2) + 1, attacker: selections[i], defender: selections[i + 1] });
                    }
                    return (
                      <div key={battle.id}>
                        <div className="bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.12)] rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Trophy className={`w-4 h-4 ${isWinner ? 'text-yellow-400' : 'text-red-400'}`} />
                              <span className={`font-bold text-sm ${isWinner ? 'text-[#00FF85]' : 'text-red-400'}`}>
                                {isWinner ? 'Victory' : 'Defeat'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1.5">
                                <Coins className="w-3.5 h-3.5 text-yellow-400" />
                                <span className="text-white text-sm">{battle.wager_amount} coins</span>
                              </div>
                              <button
                                onClick={() => handleToggleBreakdown(battle.id)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.05] border border-white/[0.1] text-[#B0B8C8] hover:text-white hover:border-white/20 transition-all text-[11px] font-semibold"
                              >
                                {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                {isOpen ? 'Hide' : 'Breakdown'}
                              </button>
                            </div>
                          </div>
                          <p className="text-[#B0B8C8]/60 text-xs mt-1.5">
                            {new Date(battle.completed_at || '').toLocaleDateString()}
                          </p>
                        </div>

                        {isOpen && (
                          <div className="mt-1 rounded-xl bg-[rgba(10,18,35,0.9)] border border-[rgba(0,224,255,0.1)] p-4 space-y-4">
                            {isLoadingBreakdown ? (
                              <div className="space-y-2">
                                <div className="h-3 rounded bg-white/[0.05] animate-pulse w-3/4" />
                                <div className="h-3 rounded bg-white/[0.05] animate-pulse w-1/2" />
                                <div className="h-3 rounded bg-white/[0.05] animate-pulse w-2/3" />
                              </div>
                            ) : (
                              <>
                                <div>
                                  <p className="text-[10px] font-bold text-[#B0B8C8] uppercase tracking-widest mb-2">Final Score</p>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="rounded-lg bg-[rgba(0,255,133,0.05)] border border-[rgba(0,255,133,0.12)] p-2 text-center">
                                      <p className="text-[#B0B8C8] text-[9px] uppercase tracking-wide mb-0.5">You</p>
                                      <p className="text-[#00FF85] text-xl font-black">{myRemaining}</p>
                                      <p className="text-[#B0B8C8] text-[9px]">cards left</p>
                                    </div>
                                    <div className="rounded-lg bg-red-500/5 border border-red-500/15 p-2 text-center">
                                      <p className="text-[#B0B8C8] text-[9px] uppercase tracking-wide mb-0.5">Opponent</p>
                                      <p className="text-red-400 text-xl font-black">{oppRemaining}</p>
                                      <p className="text-[#B0B8C8] text-[9px]">cards left</p>
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <p className="text-[10px] font-bold text-[#B0B8C8] uppercase tracking-widest mb-2">Payout</p>
                                  <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 space-y-1.5">
                                    <div className="flex justify-between text-xs">
                                      <span className="text-[#B0B8C8]">Total pot</span>
                                      <span className="text-white font-semibold">{pot} coins</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                      <span className="text-[#B0B8C8]">Royalties</span>
                                      <span className="text-orange-400 font-semibold">−{royalties} coins</span>
                                    </div>
                                    <div className="h-px bg-white/10" />
                                    <div className="flex justify-between text-xs">
                                      <span className="text-white font-bold">Winner receives</span>
                                      <span className="text-[#00FF85] font-black">{winnerPayout} coins</span>
                                    </div>
                                    {!isLoadingBreakdown && royaltyRows.length > 0 && (
                                      <div className="mt-2 pt-2 border-t border-white/[0.06] space-y-1">
                                        <p className="text-[9px] font-bold text-[#B0B8C8] uppercase tracking-widest mb-1.5">Royalties Paid</p>
                                        {royaltyRows.map((r) => (
                                          <div key={r.owner_id} className="flex justify-between text-xs">
                                            <span className="text-[#B0B8C8]">@{r.username}</span>
                                            <span className="text-[#00FF85] font-bold">{r.amount} coins</span>
                                          </div>
                                        ))}
                                        <div className="flex justify-between text-xs pt-1 border-t border-white/[0.04]">
                                          <span className="text-[#B0B8C8] font-semibold">Total royalties</span>
                                          <span className="text-orange-400 font-bold">{royaltyRows.reduce((s, r) => s + r.amount, 0)} coins</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {rounds.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-bold text-[#B0B8C8] uppercase tracking-widest mb-2">Round by Round</p>
                                    <div className="space-y-2">
                                      {rounds.map(({ roundNum, attacker, defender }) => {
                                        const attackerWins = defender.attacker_wins ?? false;
                                        const attackerIsMe = attacker.user_id === user?.id;
                                        const defenderIsMe = defender.user_id === user?.id;
                                        return (
                                          <div key={roundNum} className="rounded-lg bg-white/[0.02] border border-white/[0.05] p-2.5">
                                            <div className="flex items-center justify-between mb-2">
                                              <span className="text-[#B0B8C8] text-[9px] font-bold uppercase tracking-widest">Round {roundNum}</span>
                                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${attackerWins ? 'bg-red-500/15 text-red-400 border border-red-500/25' : 'bg-blue-500/15 text-blue-400 border border-blue-500/25'}`}>
                                                {attackerWins ? 'Attacker Won' : 'Defended'}
                                              </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-1.5">
                                              <div className="rounded-md bg-black/20 p-1.5">
                                                <p className="text-[#B0B8C8] text-[8px] font-bold uppercase mb-0.5">
                                                  Attacker · {attackerIsMe ? 'You' : 'Opp'}
                                                </p>
                                                {attacker.skill && (
                                                  <span className="inline-block mb-1 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[8px] font-bold uppercase">{attacker.skill}</span>
                                                )}
                                                <p className="text-yellow-400 font-black text-xs">{attacker.value}</p>
                                              </div>
                                              <div className="rounded-md bg-black/20 p-1.5">
                                                <p className="text-[#B0B8C8] text-[8px] font-bold uppercase mb-0.5">
                                                  Defender · {defenderIsMe ? 'You' : 'Opp'}
                                                </p>
                                                <div className="flex items-center gap-1 mb-1">
                                                  {attackerWins
                                                    ? <Zap className="w-2.5 h-2.5 text-red-400 shrink-0" />
                                                    : <Shield className="w-2.5 h-2.5 text-blue-400 shrink-0" />}
                                                </div>
                                                <p className="text-yellow-400 font-black text-xs">{defender.value}</p>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {(detail.used_skills || []).length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-bold text-[#B0B8C8] uppercase tracking-widest mb-2">Skills Used</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {detail.used_skills.map((skill) => (
                                        <span key={skill} className="px-2.5 py-1 bg-red-500/15 border border-red-500/30 rounded-full text-red-400 text-[10px] font-semibold capitalize">
                                          {skill}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
