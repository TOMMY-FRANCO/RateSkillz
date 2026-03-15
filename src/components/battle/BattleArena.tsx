import { useState, useEffect, useCallback, useRef } from 'react';
import { Swords, Clock, Flag, Target, Shield, Zap, ChevronRight } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { SkillSelectionScreen } from './SkillSelectionScreen';
import { TiebreakerScreen } from './TiebreakerScreen';
import { useAuth } from '../../contexts/AuthContext';
import { BattleResultSkeleton, BattleResultReveal } from '../ui/HighValueSkeletons';
import { ShimmerBar, StaggerItem } from '../ui/Shimmer';
import {
  Battle,
  BattleSelection,
  PlayerCard,
  getPlayerCards,
  submitBattleMove,
  forfeitBattle,
  getBattle,
} from '../../lib/battleMode';

interface RoundSummary {
  attackerCardName: string;
  attackerSkill: string;
  attackerValue: number;
  defenderCardName: string;
  defenderValue: number;
  attackerWins: boolean;
}

interface BattleArenaProps {
  battle: Battle;
  onComplete: () => void;
}

export function BattleArena({ battle: initialBattle, onComplete }: BattleArenaProps) {
  const { user } = useAuth();
  const [battle, setBattle] = useState<Battle>(initialBattle);
  const [myCards, setMyCards] = useState<PlayerCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [submitting, setSubmitting] = useState(false);
  const [roundResult, setRoundResult] = useState<{ attacker_wins: boolean } | null>(null);
  const [lastRoundSummary, setLastRoundSummary] = useState<RoundSummary | null>(null);
  const prevSelectionsLenRef = useRef<number>(initialBattle.card_selections?.length ?? 0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isMyTurn = battle.current_turn_user_id === user?.id;
  const isAttacker = (battle.card_selections?.length ?? 0) % 2 === 0;
  const isCompleted = battle.status === 'completed' || battle.status === 'forfeited';

  const eliminatedCardIds = (battle.card_selections || [])
    .filter((move: any) => move.eliminated_card_id)
    .map((move: any) => move.eliminated_card_id as string);

  const attackerSkill = !isAttacker && battle.card_selections?.length > 0
    ? battle.card_selections[battle.card_selections.length - 1]?.skill
    : null;

  useEffect(() => {
    loadCards();
  }, [battle.id]);

  useEffect(() => {
    const selections: BattleSelection[] = battle.card_selections || [];
    const len = selections.length;
    const prev = prevSelectionsLenRef.current;

    if (len >= 2 && len % 2 === 0 && len > prev) {
      const attacker = selections[len - 2];
      const defender = selections[len - 1];
      const attackerCard = myCards.find(c => c.id === attacker.card_id);
      const defenderCard = myCards.find(c => c.id === defender.card_id);
      setLastRoundSummary({
        attackerCardName: attackerCard?.player_name || 'Attacker',
        attackerSkill: attacker.skill || 'overall',
        attackerValue: attacker.value,
        defenderCardName: defenderCard?.player_name || 'Defender',
        defenderValue: defender.value,
        attackerWins: defender.attacker_wins ?? false,
      });
    } else if (len % 2 === 1 && len > prev) {
      setLastRoundSummary(null);
    }

    prevSelectionsLenRef.current = len;
  }, [battle.card_selections, myCards]);

  useEffect(() => {
    if (isCompleted) {
      const timer = setTimeout(() => onComplete(), 3000);
      return () => clearTimeout(timer);
    }
  }, [isCompleted, onComplete]);

  useEffect(() => {
    if (!battle.turn_started_at || battle.status !== 'active') return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(battle.turn_started_at!).getTime()) / 1000);
      const remaining = Math.max(0, 60 - elapsed);
      setTimeRemaining(remaining);
      if (remaining === 0 && isMyTurn) {
        handleAutoForfeit();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [battle.turn_started_at, isMyTurn, battle.status]);

  useEffect(() => {
    if (battle.status !== 'active' || isMyTurn) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const updated = await getBattle(battle.id);
        setBattle(updated);
      } catch (error) {
        console.error('Error polling battle:', error);
      }
    }, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [battle.status, isMyTurn, battle.id]);

  const loadCards = async () => {
    if (!user) return;
    try {
      const cards = await getPlayerCards(user.id);
      setMyCards(cards);
    } catch (error) {
      console.error('Error loading cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSkillSelection = useCallback(async (cardId: string, skill?: string) => {
    if (!user || submitting) return;
    setSubmitting(true);
    try {
      const result = await submitBattleMove(
        battle.id,
        user.id,
        cardId,
        isAttacker ? (skill || null) : null
      );
      if (!result.success) {
        alert(result.error || 'Failed to submit move');
      } else if (!result.is_attacker) {
        setRoundResult({ attacker_wins: result.attacker_wins });
        setTimeout(() => setRoundResult(null), 2000);
      }
      const updated = await getBattle(battle.id);
      setBattle(updated);
    } catch (error) {
      console.error('Error submitting move:', error);
      alert('Failed to submit move');
    } finally {
      setSubmitting(false);
    }
  }, [user, submitting, battle.id, isAttacker]);

  const handleAutoForfeit = useCallback(async () => {
    if (!user) return;
    try {
      await forfeitBattle(battle.id, user.id);
    } catch (error) {
      console.error('Error auto-forfeiting:', error);
    }
  }, [user, battle.id]);

  const handleManualForfeit = async () => {
    if (!user) return;
    if (confirm('Are you sure you want to forfeit? You will lose your wagered coins.')) {
      try {
        await forfeitBattle(battle.id, user.id);
      } catch (error) {
        console.error('Error forfeiting:', error);
        alert('Failed to forfeit battle');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <StaggerItem index={0}>
            <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <ShimmerBar className="w-8 h-8 rounded" />
                  <ShimmerBar className="h-7 w-40 rounded" />
                </div>
                <ShimmerBar className="h-9 w-24 rounded-lg" speed="slow" />
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-1">
                    <ShimmerBar className="h-3 w-20 rounded mx-auto" speed="slow" />
                    <ShimmerBar className="h-8 w-12 rounded mx-auto" speed="slow" />
                  </div>
                ))}
              </div>
            </div>
          </StaggerItem>
          <BattleResultSkeleton visible={true} />
        </div>
      </div>
    );
  }

  if (battle.is_tiebreaker && !isCompleted) {
    return (
      <TiebreakerScreen
        battle={battle}
        myCards={myCards}
        eliminatedCards={eliminatedCardIds}
        onComplete={onComplete}
      />
    );
  }

  if (isCompleted) {
    const isWinner = battle.winner_id === user?.id;
    const myRemaining = battle.manager1_id === user?.id
      ? battle.player1_remaining_cards
      : battle.player2_remaining_cards;
    const oppRemaining = battle.manager1_id === user?.id
      ? battle.player2_remaining_cards
      : battle.player1_remaining_cards;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <BattleResultReveal
            isWinner={isWinner}
            myScore={myRemaining}
            opponentScore={oppRemaining}
            wagerAmount={battle.wager_amount}
            opponentName="Opponent"
          />
          <GlassCard className="p-6">
            <h3 className="text-xl font-bold text-white mb-4">Skills Used</h3>
            <div className="flex gap-2 flex-wrap">
              {(battle.used_skills || []).map((skill) => (
                <div
                  key={skill}
                  className="px-3 py-1 bg-red-500/20 border border-red-500 rounded-full text-red-500 text-sm"
                >
                  {skill}
                </div>
              ))}
              {(!battle.used_skills || battle.used_skills.length === 0) && (
                <p className="text-white/50">No skills used</p>
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <GlassCard className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Swords className="w-8 h-8 text-red-500" />
              <h1 className="text-3xl font-bold text-white">Battle Arena</h1>
            </div>
            <div className="flex items-center gap-4">
              {battle.status === 'active' && (
                <div className="flex items-center gap-2 text-yellow-500">
                  <Clock className="w-5 h-5" />
                  <span className="text-2xl font-bold">{timeRemaining}s</span>
                </div>
              )}
              <GlassButton onClick={handleManualForfeit} variant="outline" size="sm">
                <Flag className="w-4 h-4 mr-2" />
                Forfeit
              </GlassButton>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-white/60 text-sm mb-1">Your Cards</p>
              <p className="text-3xl font-bold text-[#00FF85]">
                {battle.manager1_id === user?.id
                  ? battle.player1_remaining_cards
                  : battle.player2_remaining_cards}
              </p>
            </div>
            <div>
              <p className="text-white/60 text-sm mb-1">Wager</p>
              <p className="text-3xl font-bold text-yellow-500">{battle.wager_amount}</p>
            </div>
            <div>
              <p className="text-white/60 text-sm mb-1">Opponent Cards</p>
              <p className="text-3xl font-bold text-red-500">
                {battle.manager1_id === user?.id
                  ? battle.player2_remaining_cards
                  : battle.player1_remaining_cards}
              </p>
            </div>
          </div>
        </GlassCard>

        {lastRoundSummary && (
          <GlassCard className={`p-5 mb-6 border-2 ${
            lastRoundSummary.attackerWins ? 'border-red-500 bg-red-500/10' : 'border-[#00FF85] bg-[#00FF85]/10'
          }`}>
            <div className="flex items-center gap-2 mb-4">
              {lastRoundSummary.attackerWins ? (
                <Zap className="w-5 h-5 text-red-500" />
              ) : (
                <Shield className="w-5 h-5 text-[#00FF85]" />
              )}
              <h3 className={`text-lg font-bold ${lastRoundSummary.attackerWins ? 'text-red-500' : 'text-[#00FF85]'}`}>
                {lastRoundSummary.attackerWins ? 'Card Eliminated!' : 'Defense Held!'}
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-white/5 rounded-xl p-3 text-center">
                <p className="text-white/50 text-xs uppercase tracking-wide mb-1">Attacker</p>
                <p className="text-white font-semibold text-sm truncate">{lastRoundSummary.attackerCardName}</p>
                <p className="text-yellow-400 text-xs capitalize mt-1">{lastRoundSummary.attackerSkill}</p>
                <p className="text-2xl font-bold text-white mt-1">{lastRoundSummary.attackerValue}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/40 flex-shrink-0" />
              <div className="flex-1 bg-white/5 rounded-xl p-3 text-center">
                <p className="text-white/50 text-xs uppercase tracking-wide mb-1">Defender</p>
                <p className="text-white font-semibold text-sm truncate">{lastRoundSummary.defenderCardName}</p>
                <p className="text-yellow-400 text-xs capitalize mt-1">{lastRoundSummary.attackerSkill}</p>
                <p className="text-2xl font-bold text-white mt-1">{lastRoundSummary.defenderValue}</p>
              </div>
            </div>
            <p className="text-center text-white/60 text-sm mt-3">
              {lastRoundSummary.attackerWins
                ? `Attacker's ${lastRoundSummary.attackerValue} beat Defender's ${lastRoundSummary.defenderValue}`
                : `Defender's ${lastRoundSummary.defenderValue} held against Attacker's ${lastRoundSummary.attackerValue}`}
            </p>
          </GlassCard>
        )}

        {!isMyTurn && !lastRoundSummary && (
          <GlassCard className="p-6 mb-6 text-center">
            <Target className="w-12 h-12 text-yellow-500 mx-auto mb-4 animate-pulse" />
            <h3 className="text-2xl font-bold text-white">Opponent's Turn</h3>
            <p className="text-white/70 mt-2">
              Opponent's Turn - {timeRemaining}s remaining
            </p>
          </GlassCard>
        )}

        {isMyTurn && !submitting && (
          <SkillSelectionScreen
            cards={myCards}
            usedSkills={battle.used_skills || []}
            isAttacker={isAttacker}
            onSelect={handleSkillSelection}
            eliminatedCards={eliminatedCardIds}
            attackerSkill={attackerSkill}
          />
        )}

        {submitting && (
          <GlassCard className="p-6 mb-6 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-[#00FF85] rounded-full mx-auto mb-4" />
            <p className="text-white/70">Submitting move...</p>
          </GlassCard>
        )}

        <GlassCard className="p-6 mt-6">
          <h3 className="text-xl font-bold text-white mb-4">Skills Used</h3>
          <div className="flex gap-2 flex-wrap">
            {(battle.used_skills || []).map((skill) => (
              <div
                key={skill}
                className="px-3 py-1 bg-red-500/20 border border-red-500 rounded-full text-red-500 text-sm"
              >
                {skill}
              </div>
            ))}
            {(!battle.used_skills || battle.used_skills.length === 0) && (
              <p className="text-white/50">No skills used yet</p>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
