import { useState, useEffect, useCallback, useRef } from 'react';
import { Swords, Clock, Flag, Shield, Zap, ChevronRight, Trophy } from 'lucide-react';
import { SkillSelectionScreen } from './SkillSelectionScreen';
import { TiebreakerScreen } from './TiebreakerScreen';
import { useAuth } from '../../contexts/AuthContext';
import { BattleResultSkeleton, BattleResultReveal } from '../ui/HighValueSkeletons';
import { ShimmerBar, StaggerItem } from '../ui/Shimmer';
import {
  Battle,
  BattleRoyalty,
  BattleSelection,
  PlayerCard,
  getPlayerCards,
  submitBattleMove,
  forfeitBattle,
  getBattle,
  getBattleRoyalties,
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
  const [opponentCards, setOpponentCards] = useState<PlayerCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [submitting, setSubmitting] = useState(false);
  const [roundResult, setRoundResult] = useState<{ attacker_wins: boolean } | null>(null);
  const [lobbyCountdown, setLobbyCountdown] = useState(8);
  const [lastRoundSummary, setLastRoundSummary] = useState<RoundSummary | null>(null);
  const [royalties, setRoyalties] = useState<BattleRoyalty[]>([]);
  const [royaltiesLoading, setRoyaltiesLoading] = useState(false);
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
      setLobbyCountdown(8);
      const timer = setTimeout(() => onComplete(), 8000);
      const tick = setInterval(() => setLobbyCountdown(c => Math.max(0, c - 1)), 1000);
      return () => {
        clearTimeout(timer);
        clearInterval(tick);
      };
    }
  }, [isCompleted, onComplete]);

  useEffect(() => {
    if (!isCompleted) return;
    setRoyaltiesLoading(true);
    getBattleRoyalties(battle.id)
      .then(setRoyalties)
      .finally(() => setRoyaltiesLoading(false));
  }, [isCompleted, battle.id]);

  useEffect(() => {
    if (!battle.turn_started_at || battle.status !== 'active') return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(battle.turn_started_at!).getTime()) / 1000);
      const remaining = Math.max(0, 75 - elapsed);
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
      const opponentId = battle.manager1_id === user.id ? battle.manager2_id : battle.manager1_id;
      const [cards, oppCards] = await Promise.all([
        getPlayerCards(user.id),
        getPlayerCards(opponentId),
      ]);
      setMyCards(cards);
      setOpponentCards(oppCards);
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
    const isManager1 = battle.manager1_id === user?.id;
    const myRemaining = isManager1 ? battle.player1_remaining_cards : battle.player2_remaining_cards;
    const oppRemaining = isManager1 ? battle.player2_remaining_cards : battle.player1_remaining_cards;

    const allCards = [...myCards, ...opponentCards];
    const getCardName = (cardId: string) => allCards.find(c => c.id === cardId)?.player_name || 'Unknown';

    const royaltyRate = 0.05;
    const pot = battle.wager_amount * 2;
    const totalRoyalties = Math.floor(pot * royaltyRate);
    const winnerPayout = pot - totalRoyalties;

    const selections: BattleSelection[] = battle.card_selections || [];
    const rounds: Array<{ roundNum: number; attacker: BattleSelection; defender: BattleSelection }> = [];
    for (let i = 0; i + 1 < selections.length; i += 2) {
      rounds.push({ roundNum: Math.floor(i / 2) + 1, attacker: selections[i], defender: selections[i + 1] });
    }

    const getUsername = (userId: string) => {
      const card = allCards.find(c => c.card_user_id === userId);
      return card?.username || (userId === user?.id ? 'You' : 'Opponent');
    };

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

          <div className="text-center text-[#B0B8C8] text-sm">
            Returning to lobby in <span className="text-yellow-400 font-bold">{lobbyCountdown}s</span>...
          </div>

          {/* Final Score */}
          <div className="glass-card p-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-3 flex items-center gap-2">
              <Trophy className="w-3.5 h-3.5 text-yellow-400" />
              Final Score
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[rgba(0,255,133,0.06)] border border-[rgba(0,255,133,0.15)] p-3 text-center">
                <p className="text-[#B0B8C8] text-[10px] font-bold uppercase tracking-wide mb-1">You</p>
                <p className="text-[#00FF85] text-3xl font-black">{myRemaining}</p>
                <p className="text-[#B0B8C8] text-[10px]">cards remaining</p>
              </div>
              <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-3 text-center">
                <p className="text-[#B0B8C8] text-[10px] font-bold uppercase tracking-wide mb-1">Opponent</p>
                <p className="text-red-400 text-3xl font-black">{oppRemaining}</p>
                <p className="text-[#B0B8C8] text-[10px]">cards remaining</p>
              </div>
            </div>
          </div>

          {/* Payout */}
          <div className="glass-card p-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-3 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              Payout
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[#B0B8C8] text-sm">Total pot</span>
                <span className="text-white font-bold">{pot} coins</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#B0B8C8] text-sm">Royalties paid</span>
                <span className="text-orange-400 font-bold">−{totalRoyalties} coins</span>
              </div>
              <div className="h-px bg-white/10" />
              <div className="flex items-center justify-between">
                <span className="text-white text-sm font-bold">Winner receives</span>
                <span className="text-[#00FF85] font-black text-lg">{winnerPayout} coins</span>
              </div>
              {isWinner && (
                <div className="mt-1 rounded-lg bg-[rgba(0,255,133,0.08)] border border-[rgba(0,255,133,0.2)] px-3 py-2 text-center">
                  <span className="text-[#00FF85] text-xs font-bold">+{winnerPayout} coins added to your balance</span>
                </div>
              )}
              {(royaltiesLoading || royalties.length > 0) && (
                <div className="mt-2 pt-3 border-t border-white/10">
                  <p className="text-[10px] font-bold text-[#B0B8C8] uppercase tracking-widest mb-2">Royalties Paid</p>
                  {royaltiesLoading ? (
                    <div className="space-y-1.5">
                      <div className="h-3 rounded bg-white/[0.05] animate-pulse w-3/4" />
                      <div className="h-3 rounded bg-white/[0.05] animate-pulse w-1/2" />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {royalties.map((r) => (
                        <div key={r.owner_id} className="flex items-center justify-between">
                          <span className="text-[#B0B8C8] text-xs">@{r.username}</span>
                          <span className="text-[#00FF85] text-xs font-bold">{r.amount} coins</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
                        <span className="text-[#B0B8C8] text-xs font-semibold">Total royalties</span>
                        <span className="text-orange-400 text-xs font-bold">{royalties.reduce((s, r) => s + r.amount, 0)} coins</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Round by Round */}
          {rounds.length > 0 && (
            <div className="glass-card p-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-3 flex items-center gap-2">
                <Swords className="w-3.5 h-3.5 text-red-400" />
                Round by Round
              </h3>
              <div className="space-y-2">
                {rounds.map(({ roundNum, attacker, defender }) => {
                  const attackerWins = defender.attacker_wins ?? false;
                  const attackerName = attacker.user_id === user?.id ? 'You' : 'Opponent';
                  const defenderName = defender.user_id === user?.id ? 'You' : 'Opponent';
                  return (
                    <div key={roundNum} className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[#B0B8C8] text-[10px] font-bold uppercase tracking-widest">Round {roundNum}</span>
                        <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full ${attackerWins ? 'bg-red-500/15 text-red-400 border border-red-500/30' : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'}`}>
                          {attackerWins ? 'Attacker Won' : 'Defended'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-black/20 p-2">
                          <p className="text-[#B0B8C8] text-[9px] font-bold uppercase tracking-wide mb-0.5">Attacker · {attackerName}</p>
                          <p className="text-white text-xs font-semibold truncate">{getCardName(attacker.card_id)}</p>
                          {attacker.skill && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[9px] font-bold uppercase">{attacker.skill}</span>
                          )}
                          <p className="text-yellow-400 font-black text-sm mt-1">{attacker.value}</p>
                        </div>
                        <div className="rounded-lg bg-black/20 p-2">
                          <p className="text-[#B0B8C8] text-[9px] font-bold uppercase tracking-wide mb-0.5">Defender · {defenderName}</p>
                          <p className="text-white text-xs font-semibold truncate">{getCardName(defender.card_id)}</p>
                          {attacker.skill && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[9px] font-bold uppercase">{attacker.skill}</span>
                          )}
                          <p className="text-yellow-400 font-black text-sm mt-1">{defender.value}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Skills Used */}
          <div className="glass-card p-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-3 flex items-center gap-2">
              <ChevronRight className="w-3.5 h-3.5 text-[#00E0FF]" />
              Skills Used
            </h3>
            <div className="flex gap-2 flex-wrap">
              {(battle.used_skills || []).map((skill) => (
                <span
                  key={skill}
                  className="px-3 py-1 bg-red-500/15 border border-red-500/40 rounded-full text-red-400 text-xs font-semibold capitalize"
                >
                  {skill}
                </span>
              ))}
              {(!battle.used_skills || battle.used_skills.length === 0) && (
                <p className="text-[#B0B8C8] text-sm">No skills used</p>
              )}
            </div>
          </div>

          <div className="h-4" />
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
              <div className={`flex items-center gap-1 ${timeRemaining <= 15 ? 'text-red-400' : 'text-yellow-400'}`}>
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
              <span className="text-yellow-500 font-bold">{battle.wager_amount}</span>
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
          className="relative flex-1 rounded-2xl overflow-hidden flex flex-col bg-[#1a4a2e]"
          style={{ minHeight: 480 }}
        >
          {/* Pitch line markings */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            {/* Outer pitch border */}
            <div className="absolute inset-3 rounded-xl border-2 border-white/20" />
            {/* Halfway line */}
            <div className="absolute left-4 right-4 border-t-2 border-white/20" style={{ top: '50%' }} />
            {/* Centre circle */}
            <div
              className="absolute border-2 border-white/20 rounded-full"
              style={{
                top: '50%', left: '50%',
                width: 80, height: 80,
                marginTop: -40, marginLeft: -40,
              }}
            />
            {/* Centre dot */}
            <div
              className="absolute rounded-full bg-white/35"
              style={{
                top: '50%', left: '50%',
                width: 6, height: 6,
                marginTop: -3, marginLeft: -3,
              }}
            />
            {/* Top penalty box */}
            <div
              className="absolute border-2 border-white/20"
              style={{
                top: 0, left: '50%',
                width: 160, height: 56,
                marginLeft: -80,
                borderTop: 'none',
                borderRadius: '0 0 8px 8px',
              }}
            />
            {/* Bottom penalty box */}
            <div
              className="absolute border-2 border-white/20"
              style={{
                bottom: 0, left: '50%',
                width: 160, height: 56,
                marginLeft: -80,
                borderBottom: 'none',
                borderRadius: '8px 8px 0 0',
              }}
            />
          </div>

          {/* ── ROW 1: Opponent's cards zone ── */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-start pt-3 px-3" style={{ transform: 'none' }}>
            <p className="text-[rgba(255,255,255,0.4)] text-[10px] font-bold uppercase tracking-widest mb-2">
              Opponent &mdash; {oppRemainingCards} card{oppRemainingCards !== 1 ? 's' : ''} left
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 justify-start w-full scrollbar-hide">
              {opponentCards.map((card) => {
                const eliminated = eliminatedCardIds.includes(card.id);
                return (
                  <div
                    key={card.id}
                    className="relative flex-shrink-0"
                    style={{ opacity: eliminated ? 0.3 : 1, transform: 'rotate(0deg)' }}
                  >
                    <div className="w-16 rounded-xl border border-white/10 bg-black/30 backdrop-blur-sm flex flex-col items-center py-2 px-1 gap-1">
                      {card.avatar_url ? (
                        <img
                          src={card.avatar_url}
                          alt={card.player_name}
                          className="w-12 h-12 rounded-full object-cover border border-white/20"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-orange-400 flex items-center justify-center border border-white/20">
                          <span className="text-white text-sm font-black">{card.player_name.charAt(0)}</span>
                        </div>
                      )}
                      <p className="text-white text-[9px] font-bold truncate w-full text-center leading-tight">{card.username || card.player_name}</p>
                      <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-white text-[9px] font-black">{card.overall_rating}</span>
                      <div className="grid grid-cols-3 gap-x-1 gap-y-0.5 w-full mt-0.5">
                        {([['PAC', card.pace], ['SHO', card.shooting], ['PAS', card.passing], ['DRI', card.dribbling], ['DEF', card.defending], ['PHY', card.physical]] as [string, number][]).map(([label, val]) => (
                          <div key={label} className="flex flex-col items-center">
                            <span className="text-[rgba(255,255,255,0.4)] text-[7px] font-bold leading-none">{label}</span>
                            <span className="text-white text-[8px] font-black leading-none">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {eliminated && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-red-500 font-black text-2xl leading-none">✕</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {opponentCards.length === 0 && (
                <p className="text-white/20 text-xs font-semibold">No cards</p>
              )}
            </div>
          </div>

          {/* ── ROW 2: Centre action zone ── */}
          <div className="relative z-20 flex flex-col items-stretch px-3 py-1 gap-1.5">


            {/* Active round info: attacker card | timer | defender pick */}
            {(() => {
              const selections: BattleSelection[] = battle.card_selections || [];
              const len = selections.length;
              const pendingAttack = len % 2 === 1 ? selections[len - 1] : null;
              const attackerCardId = pendingAttack?.card_id;
              const allCards = [...myCards, ...opponentCards];
              const attackingCard = attackerCardId ? allCards.find(c => c.id === attackerCardId) : null;

              return (
                <div className="bg-black/40 rounded-2xl border border-white/10 p-2 flex items-stretch gap-2">

                  {/* Left: attacker card info */}
                  <div className="flex-1 rounded-xl bg-black/30 border border-white/10 backdrop-blur-sm p-2 flex flex-col items-center justify-center min-w-0">
                    {pendingAttack && attackingCard ? (
                      <>
                        {attackingCard.avatar_url ? (
                          <img src={attackingCard.avatar_url} alt={attackingCard.player_name} className="w-8 h-8 rounded-full object-cover border border-red-400/40 mb-1" loading="lazy" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-400 flex items-center justify-center border border-red-400/40 mb-1">
                            <span className="text-white text-xs font-black">{attackingCard.player_name.charAt(0)}</span>
                          </div>
                        )}
                        <p className="text-white text-[9px] font-bold truncate w-full text-center">{attackingCard.username || attackingCard.player_name}</p>
                        {pendingAttack.skill && (
                          <span className="mt-1 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-[9px] font-black uppercase tracking-wide">
                            {pendingAttack.skill}
                          </span>
                        )}
                        <span className="text-white font-black text-base leading-none mt-0.5">{pendingAttack.value}</span>
                        <span className="text-[rgba(255,255,255,0.3)] text-[8px] mt-0.5">ATK</span>
                      </>
                    ) : (
                      <span className="text-white/20 text-[9px] font-semibold">Waiting…</span>
                    )}
                  </div>

                  {/* Centre: countdown + status */}
                  <div className="flex flex-col items-center justify-center gap-1 shrink-0">
                    <div className={`w-12 h-12 rounded-full border-2 flex flex-col items-center justify-center ${timeRemaining <= 15 ? 'border-red-500/60 bg-red-500/10' : 'border-white/20 bg-black/30'}`}>
                      <span className={`text-2xl font-bold tabular-nums leading-none ${timeRemaining <= 15 ? 'text-red-400' : 'text-yellow-400'}`}>{timeRemaining}</span>
                    </div>
                    <span className={`text-[8px] font-bold uppercase tracking-wide ${isMyTurn ? 'text-[#00FF85]' : 'text-white/30'}`}>
                      {isMyTurn ? 'Your turn' : 'Opponent'}
                    </span>
                  </div>

                  {/* Right: defender response or waiting indicator */}
                  <div className="flex-1 rounded-xl bg-black/30 border border-white/10 backdrop-blur-sm p-2 flex flex-col items-center justify-center min-w-0">
                    {lastRoundSummary ? (
                      <>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center mb-1 ${lastRoundSummary.attackerWins ? 'bg-red-500/20' : 'bg-[rgba(0,255,133,0.15)]'}`}>
                          {lastRoundSummary.attackerWins
                            ? <Zap className="w-3 h-3 text-red-400" />
                            : <Shield className="w-3 h-3 text-[#00FF85]" />}
                        </div>
                        <p className="text-white text-[9px] font-bold truncate w-full text-center">{lastRoundSummary.defenderCardName}</p>
                        <span className="text-white font-black text-base leading-none mt-0.5">{lastRoundSummary.defenderValue}</span>
                        <span className={`text-[9px] font-black mt-0.5 ${lastRoundSummary.attackerWins ? 'text-red-400' : 'text-[#00FF85]'}`}>
                          {lastRoundSummary.attackerWins ? 'Eliminated' : 'Held'}
                        </span>

                      </>
                    ) : pendingAttack ? (
                      <>
                        <div className="w-5 h-5 rounded-full border border-white/20 flex items-center justify-center mb-1 animate-pulse">
                          <Shield className="w-3 h-3 text-white/30" />
                        </div>
                        <span className="text-white/30 text-[9px] font-semibold">Defending…</span>
                      </>
                    ) : (
                      <span className="text-white/20 text-[9px] font-semibold">–</span>
                    )}
                  </div>

                </div>
              );
            })()}

            {/* Round result banner */}
            {lastRoundSummary && (
              <div className={`rounded-lg px-3 py-1.5 border flex items-center justify-center gap-2 ${lastRoundSummary.attackerWins ? 'bg-red-900/40 border-red-500/30' : 'bg-green-900/30 border-[rgba(0,255,133,0.25)]'}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wide ${lastRoundSummary.attackerWins ? 'text-red-400' : 'text-[#00FF85]'}`}>
                  {lastRoundSummary.attackerWins ? 'Card eliminated!' : 'Defense held!'}
                </span>
                <span className="text-white/30 text-[9px]">·</span>
                <span className="text-yellow-400 text-[9px] font-semibold capitalize">{lastRoundSummary.attackerSkill}</span>
                <span className="text-white/30 text-[9px]">{lastRoundSummary.attackerValue} vs {lastRoundSummary.defenderValue}</span>
              </div>
            )}

          </div>

          {/* ── INLINE SKILL SELECTION PANEL (my turn only) ── */}
          {isMyTurn && !submitting && (
            <div className="relative z-30 mx-3 mb-2 rounded-2xl overflow-hidden bg-[rgba(10,18,35,0.92)] border border-[rgba(0,224,255,0.18)] shadow-[0_0_24px_rgba(0,224,255,0.08)]">
              <SkillSelectionScreen
                cards={myCards}
                usedSkills={battle.used_skills || []}
                isAttacker={isAttacker}
                onSelect={handleSkillSelection}
                eliminatedCards={eliminatedCardIds}
                attackerSkill={attackerSkill}
              />
            </div>
          )}

          {/* Waiting indicator when not my turn and no inline panel */}
          {!isMyTurn && !lastRoundSummary && (
            <div className="relative z-10 flex justify-center pb-2">
              <div className="px-4 py-1.5 rounded-full border border-white/10 bg-black/20 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-white/25 animate-pulse" />
                <span className="text-white/40 text-[10px] font-semibold">Waiting for opponent…</span>
              </div>
            </div>
          )}

          {/* ── ROW 3: My cards zone ── */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-end pb-3 px-3">
            <div className="flex gap-2 overflow-x-auto pb-1 justify-start w-full scrollbar-hide mb-2">
              {myCards.map((card) => {
                const eliminated = eliminatedCardIds.includes(card.id);
                return (
                  <div
                    key={card.id}
                    className="relative flex-shrink-0"
                    style={{ opacity: eliminated ? 0.3 : 1 }}
                  >
                    <div className="w-16 rounded-xl border border-white/10 bg-black/30 backdrop-blur-sm flex flex-col items-center py-2 px-1 gap-1">
                      {card.avatar_url ? (
                        <img
                          src={card.avatar_url}
                          alt={card.player_name}
                          className="w-12 h-12 rounded-full object-cover border border-[rgba(0,255,133,0.3)]"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00FF85] to-[#00E0FF] flex items-center justify-center border border-[rgba(0,255,133,0.3)]">
                          <span className="text-black text-sm font-black">{card.player_name.charAt(0)}</span>
                        </div>
                      )}
                      <p className="text-white text-[9px] font-bold truncate w-full text-center leading-tight">{card.username || card.player_name}</p>
                      <span className="px-1.5 py-0.5 rounded-full bg-[rgba(0,255,133,0.15)] text-[#00FF85] text-[9px] font-black">{card.overall_rating}</span>
                      <div className="grid grid-cols-3 gap-x-1 gap-y-0.5 w-full mt-0.5">
                        {([['PAC', card.pace], ['SHO', card.shooting], ['PAS', card.passing], ['DRI', card.dribbling], ['DEF', card.defending], ['PHY', card.physical]] as [string, number][]).map(([label, val]) => (
                          <div key={label} className="flex flex-col items-center">
                            <span className="text-[rgba(255,255,255,0.4)] text-[7px] font-bold leading-none">{label}</span>
                            <span className="text-[#00FF85] text-[8px] font-black leading-none">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {eliminated && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-red-500 font-black text-2xl leading-none">✕</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {myCards.length === 0 && (
                <p className="text-white/20 text-xs font-semibold">No cards</p>
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
