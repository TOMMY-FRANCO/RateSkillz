import { useState, useEffect, useCallback, useRef } from 'react';
import { Swords, Clock, Flag, Shield, Zap, ChevronRight } from 'lucide-react';
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
      <div className="min-h-screen p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <StaggerItem index={0}>
            <div className="glass-container p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <ShimmerBar className="w-8 h-8 rounded" />
                  <ShimmerBar className="h-6 w-36 rounded" />
                </div>
                <ShimmerBar className="h-8 w-20 rounded-lg" speed="slow" />
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-1">
                    <ShimmerBar className="h-3 w-16 rounded mx-auto" speed="slow" />
                    <ShimmerBar className="h-7 w-10 rounded mx-auto" speed="slow" />
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
      <div className="min-h-screen p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <BattleResultReveal
            isWinner={isWinner}
            myScore={myRemaining}
            opponentScore={oppRemaining}
            wagerAmount={battle.wager_amount}
            opponentName="Opponent"
          />
          <div className="glass-card p-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-3">Skills Used</h3>
            <div className="flex gap-2 flex-wrap">
              {(battle.used_skills || []).map((skill) => (
                <span
                  key={skill}
                  className="px-3 py-1 bg-red-500/15 border border-red-500/40 rounded-full text-red-400 text-xs font-semibold"
                >
                  {skill}
                </span>
              ))}
              {(!battle.used_skills || battle.used_skills.length === 0) && (
                <p className="text-[#B0B8C8] text-sm">No skills used</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const myRemainingCards = battle.manager1_id === user?.id
    ? battle.player1_remaining_cards
    : battle.player2_remaining_cards;
  const oppRemainingCards = battle.manager1_id === user?.id
    ? battle.player2_remaining_cards
    : battle.player1_remaining_cards;

  const availableMyCards = myCards.filter(c => !eliminatedCardIds.includes(c.id));

  return (
    <div className="min-h-screen flex flex-col">

      {/* Top HUD bar */}
      <div className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-3 h-12 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-white text-sm font-bold">Battle Arena</span>
          </div>
          <div className="flex items-center gap-3">
            {battle.status === 'active' && (
              <div className={`flex items-center gap-1 ${timeRemaining <= 10 ? 'text-red-400' : 'text-yellow-400'}`}>
                <Clock className="w-3.5 h-3.5" />
                <span className="text-sm font-bold tabular-nums">{timeRemaining}s</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#00FF85] font-black">{myRemainingCards}</span>
              <span className="text-white/30">vs</span>
              <span className="text-red-400 font-black">{oppRemainingCards}</span>
            </div>
            <span className="text-[#B0B8C8] text-xs">
              <span className="text-yellow-400 font-bold">{battle.wager_amount}</span>
              {' '}coins
            </span>
            <button
              onClick={handleManualForfeit}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-all"
            >
              <Flag className="w-3 h-3" />
              Forfeit
            </button>
          </div>
        </div>
      </div>

      {/* Pitch */}
      <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto px-3 py-3 gap-3">

        {/* ── PITCH CONTAINER ── */}
        <div
          className="relative flex-1 rounded-2xl overflow-hidden flex flex-col"
          style={{
            background: 'linear-gradient(180deg, #0a2e14 0%, #0d3a1a 40%, #0d3a1a 60%, #0a2e14 100%)',
            minHeight: 340,
          }}
        >
          {/* Pitch line markings */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            {/* Halfway line */}
            <div
              className="absolute left-4 right-4"
              style={{ top: '50%', height: 1, background: 'rgba(255,255,255,0.18)' }}
            />
            {/* Centre circle */}
            <div
              className="absolute"
              style={{
                top: '50%', left: '50%',
                width: 80, height: 80,
                marginTop: -40, marginLeft: -40,
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: '50%',
              }}
            />
            {/* Centre dot */}
            <div
              className="absolute"
              style={{
                top: '50%', left: '50%',
                width: 6, height: 6,
                marginTop: -3, marginLeft: -3,
                background: 'rgba(255,255,255,0.35)',
                borderRadius: '50%',
              }}
            />
            {/* Top penalty box */}
            <div
              className="absolute"
              style={{
                top: 0, left: '50%',
                width: 160, height: 56,
                marginLeft: -80,
                border: '1px solid rgba(255,255,255,0.18)',
                borderTop: 'none',
                borderRadius: '0 0 8px 8px',
              }}
            />
            {/* Bottom penalty box */}
            <div
              className="absolute"
              style={{
                bottom: 0, left: '50%',
                width: 160, height: 56,
                marginLeft: -80,
                border: '1px solid rgba(255,255,255,0.18)',
                borderBottom: 'none',
                borderRadius: '8px 8px 0 0',
              }}
            />
            {/* Outer pitch border */}
            <div
              className="absolute inset-3 rounded-xl"
              style={{ border: '1px solid rgba(255,255,255,0.13)' }}
            />
          </div>

          {/* ── ROW 1: Opponent's cards zone ── */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-start pt-4 px-4">
            <p className="text-[rgba(255,255,255,0.4)] text-[10px] font-bold uppercase tracking-widest mb-2">
              Opponent &mdash; {oppRemainingCards} card{oppRemainingCards !== 1 ? 's' : ''} left
            </p>
            {/* Opponent card placeholders — count matches remaining cards */}
            <div className="flex gap-2 flex-wrap justify-center">
              {Array.from({ length: Math.max(0, oppRemainingCards) }).map((_, i) => (
                <div
                  key={i}
                  className="w-10 h-14 rounded-lg border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] flex items-center justify-center"
                >
                  <span className="text-[rgba(255,255,255,0.2)] text-lg font-black">?</span>
                </div>
              ))}
              {oppRemainingCards === 0 && (
                <p className="text-red-400/60 text-xs font-semibold">No cards left</p>
              )}
            </div>
          </div>

          {/* ── ROW 2: Centre action zone ── */}
          <div className="relative z-10 flex flex-col items-center justify-center py-3 px-4">
            {lastRoundSummary ? (
              /* Last round result */
              <div
                className={`w-full max-w-xs rounded-xl p-3 border text-center ${
                  lastRoundSummary.attackerWins
                    ? 'bg-red-900/40 border-red-500/40'
                    : 'bg-green-900/40 border-[rgba(0,255,133,0.35)]'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  {lastRoundSummary.attackerWins
                    ? <Zap className="w-3.5 h-3.5 text-red-400" />
                    : <Shield className="w-3.5 h-3.5 text-[#00FF85]" />}
                  <span className={`text-xs font-bold uppercase tracking-wide ${lastRoundSummary.attackerWins ? 'text-red-400' : 'text-[#00FF85]'}`}>
                    {lastRoundSummary.attackerWins ? 'Card Eliminated!' : 'Defense Held!'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-center">
                    <p className="text-white text-xs font-semibold truncate">{lastRoundSummary.attackerCardName}</p>
                    <p className="text-yellow-400 text-[10px] capitalize">{lastRoundSummary.attackerSkill}</p>
                    <p className="text-white font-black text-lg">{lastRoundSummary.attackerValue}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-white/30 shrink-0" />
                  <div className="flex-1 text-center">
                    <p className="text-white text-xs font-semibold truncate">{lastRoundSummary.defenderCardName}</p>
                    <p className="text-yellow-400 text-[10px] capitalize">{lastRoundSummary.attackerSkill}</p>
                    <p className="text-white font-black text-lg">{lastRoundSummary.defenderValue}</p>
                  </div>
                </div>
              </div>
            ) : (
              /* Turn status pill */
              <div
                className={`px-4 py-2 rounded-full border text-xs font-bold flex items-center gap-2 ${
                  isMyTurn
                    ? 'bg-[rgba(0,255,133,0.12)] border-[rgba(0,255,133,0.35)] text-[#00FF85]'
                    : 'bg-[rgba(255,255,255,0.06)] border-[rgba(255,255,255,0.12)] text-[rgba(255,255,255,0.5)]'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${isMyTurn ? 'bg-[#00FF85] animate-pulse' : 'bg-white/30'}`}
                />
                {isMyTurn ? 'Your turn — make a move' : `Opponent's turn · ${timeRemaining}s`}
              </div>
            )}
          </div>

          {/* ── ROW 3: My cards zone ── */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-end pb-4 px-4">
            <div className="flex gap-2 flex-wrap justify-center mb-2">
              {availableMyCards.map((card) => (
                <div
                  key={card.id}
                  className="w-10 h-14 rounded-lg border border-[rgba(0,224,255,0.2)] bg-[rgba(0,224,255,0.06)] flex flex-col items-center justify-center gap-0.5"
                >
                  {card.avatar_url ? (
                    <img
                      src={card.avatar_url}
                      alt={card.player_name}
                      className="w-7 h-7 rounded-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#00FF85] to-[#00E0FF] flex items-center justify-center">
                      <span className="text-black text-[9px] font-black">{card.player_name.charAt(0)}</span>
                    </div>
                  )}
                  <span className="text-[8px] font-black text-[#00FF85]">{card.overall_rating}</span>
                </div>
              ))}
              {availableMyCards.length === 0 && (
                <p className="text-red-400/60 text-xs font-semibold">No cards left</p>
              )}
            </div>
            <p className="text-[rgba(255,255,255,0.4)] text-[10px] font-bold uppercase tracking-widest">
              You &mdash; {myRemainingCards} card{myRemainingCards !== 1 ? 's' : ''} left
            </p>
          </div>
        </div>

        {/* Used skills strip */}
        {(battle.used_skills || []).length > 0 && (
          <div className="glass-card p-3 flex items-center gap-2 flex-wrap">
            <span className="text-[#B0B8C8] text-[10px] font-bold uppercase tracking-wide shrink-0">Used:</span>
            {(battle.used_skills || []).map((skill) => (
              <span
                key={skill}
                className="px-2.5 py-0.5 bg-red-500/15 border border-red-500/40 rounded-full text-red-400 text-[10px] font-semibold"
              >
                {skill}
              </span>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
