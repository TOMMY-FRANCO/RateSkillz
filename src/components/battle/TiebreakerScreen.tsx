import { useState, useEffect, useCallback, useRef } from 'react';
import { Swords, Target, Clock, Flag } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { playSound } from '../../lib/sounds';
import {
  Battle,
  PlayerCard,
  getBattle,
  forfeitBattle,
} from '../../lib/battleMode';
import { supabase } from '../../lib/supabase';

interface TiebreakerScreenProps {
  battle: Battle;
  myCards: PlayerCard[];
  opponentCards: PlayerCard[];
  eliminatedCards: string[];
  onComplete: () => void;
}

const SKILLS = [
  { code: 'PAC', name: 'Pace' },
  { code: 'SHO', name: 'Shooting' },
  { code: 'PAS', name: 'Passing' },
  { code: 'DRI', name: 'Dribbling' },
  { code: 'DEF', name: 'Defending' },
  { code: 'PHY', name: 'Physical' },
];

const getSkillValue = (card: PlayerCard, skillCode: string): number => {
  const map: Record<string, number> = {
    PAC: card.pace, SHO: card.shooting, PAS: card.passing,
    DRI: card.dribbling, DEF: card.defending, PHY: card.physical,
  };
  return map[skillCode] || 0;
};

async function chooseTiebreakerFirst(battleId: string, userId: string) {
  const { data, error } = await supabase.rpc('choose_tiebreaker_first_player', {
    p_battle_id: battleId,
    p_user_id: userId,
  });
  if (error) throw error;
  return data;
}

async function submitTiebreakerMove(
  battleId: string,
  userId: string,
  cardId: string,
  skill: string
) {
  const { data, error } = await supabase.rpc('submit_tiebreaker_move', {
    p_battle_id: battleId,
    p_user_id: userId,
    p_card_id: cardId,
    p_skill: skill,
  });
  if (error) throw error;
  return data;
}

export function TiebreakerScreen({
  battle: initialBattle,
  myCards,
  opponentCards,
  eliminatedCards,
  onComplete,
}: TiebreakerScreenProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [battle, setBattle] = useState<Battle>(initialBattle);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [choosingFirst, setChoosingFirst] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(75);
  const [lobbyCountdown, setLobbyCountdown] = useState(8);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isMyTurn = battle.current_turn_user_id === user?.id;
  const isAttacker = battle.stuck_card_id === null;
  const isCompleted = battle.status === 'completed' || battle.status === 'forfeited';
  const waitingForFirst = battle.current_turn_user_id === null;

  const myAvailableCards = myCards.filter(c => !eliminatedCards.includes(c.id));
  const opponentAvailableCards = opponentCards.filter(c => !eliminatedCards.includes(c.id));

  // Skills used by me in tiebreaker
  const myUsedSkills = new Set(
    (battle.card_selections || [])
      .filter((m: any) => m.is_tiebreaker && m.user_id === user?.id)
      .map((m: any) => m.skill)
  );

  // Find stuck card move
  const stuckMove = battle.stuck_card_id
    ? [...(battle.card_selections || [])].reverse().find(
        (m: any) => m.card_id === battle.stuck_card_id && m.is_tiebreaker
      )
    : null;

  const stuckCard = stuckMove
    ? [...myCards, ...opponentCards].find(c => c.id === stuckMove.card_id)
    : null;

  const stuckIsMe = stuckMove?.user_id === user?.id;

  // Polling
  useEffect(() => {
    if (isCompleted) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    const poll = async () => {
      try {
        const updated = await getBattle(battle.id);
        setBattle(updated);
      } catch (e) {
        console.error('Poll error:', e);
      }
    };

    poll();
    pollRef.current = setInterval(poll, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [battle.id, isCompleted]);

  // Timer
  useEffect(() => {
    if (!battle.turn_started_at || !isMyTurn) {
      setTimeRemaining(75);
      return;
    }
    const update = () => {
      const elapsed = Math.floor(
        (Date.now() - new Date(battle.turn_started_at!).getTime()) / 1000
      );
      setTimeRemaining(Math.max(0, 75 - elapsed));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [battle.turn_started_at, isMyTurn]);

  // Completed — sounds and lobby countdown
  useEffect(() => {
    if (!isCompleted || !user) return;
    const isWinner = battle.winner_id === user.id;
    playSound(isWinner ? 'win' : 'lose');
    setLobbyCountdown(8);
    const timer = setTimeout(() => onComplete(), 8000);
    const tick = setInterval(() => setLobbyCountdown(c => Math.max(0, c - 1)), 1000);
    return () => {
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, [isCompleted]);

  const handleChooseFirst = async () => {
    if (!user || choosingFirst) return;
    setChoosingFirst(true);
    try {
      const result = await chooseTiebreakerFirst(battle.id, user.id);
      if (!result.success) {
        toast.error(result.error || 'Failed to choose first player');
      } else {
        const updated = await getBattle(battle.id);
        setBattle(updated);
      }
    } catch (e) {
      toast.error('Failed to choose first player');
    } finally {
      setChoosingFirst(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !selectedCard || !selectedSkill || submitting) return;
    setSubmitting(true);
    try {
      const result = await submitTiebreakerMove(
        battle.id,
        user.id,
        selectedCard,
        selectedSkill
      );
      if (!result.success) {
        toast.error(result.error || 'Failed to submit move');
      } else {
        const updated = await getBattle(battle.id);
        setBattle(updated);
        setSelectedCard(null);
        setSelectedSkill(null);
      }
    } catch (e) {
      toast.error('Failed to submit move');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForfeit = async () => {
    if (!user) return;
    if (confirm('Are you sure you want to forfeit?')) {
      try {
        await forfeitBattle(battle.id, user.id);
      } catch (e) {
        toast.error('Failed to forfeit');
      }
    }
  };

  // ── COMPLETED SCREEN ──
  if (isCompleted) {
    const isWinner = battle.winner_id === user?.id;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-6">
        <div className={`rounded-2xl border p-8 text-center max-w-sm w-full ${
          isWinner
            ? 'bg-[rgba(0,255,133,0.06)] border-[rgba(0,255,133,0.2)]'
            : 'bg-red-500/5 border-red-500/20'
        }`}>
          <div className="text-6xl mb-4">{isWinner ? '🏆' : '💔'}</div>
          <h2 className={`text-2xl font-black mb-2 ${isWinner ? 'text-[#00FF85]' : 'text-red-400'}`}>
            {isWinner ? 'You Win!' : 'You Lose!'}
          </h2>
          <p className="text-[#B0B8C8] text-sm mb-4">Tiebreaker complete</p>
          <p className="text-[#B0B8C8] text-xs">
            Returning to lobby in <span className="text-yellow-400 font-bold">{lobbyCountdown}s</span>...
          </p>
        </div>
      </div>
    );
  }

  // ── WHO GOES FIRST SCREEN ──
  if (waitingForFirst) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-40">
          <div className="max-w-2xl mx-auto px-3 h-12 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-yellow-400" />
              <span className="text-white text-sm font-bold">Tiebreaker</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30">
              <Target className="w-3 h-3 text-yellow-400" />
              <span className="text-yellow-400 text-xs font-bold">Final Showdown</span>
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6 max-w-2xl mx-auto w-full">
          <div className="text-center space-y-2">
            <h2 className="text-white text-xl font-black">Who goes first?</h2>
            <p className="text-[#B0B8C8] text-sm">
              First to press goes first — you commit a card and skill, opponent must beat it
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 w-full">
            <button
              onClick={handleChooseFirst}
              disabled={choosingFirst}
              className="py-4 rounded-2xl bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black font-black text-sm hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {choosingFirst ? 'Claiming...' : 'Go First'}
            </button>
            <button
              disabled
              className="py-4 rounded-2xl bg-white/5 border border-white/10 text-white/30 font-black text-sm cursor-not-allowed"
            >
              Go Second
            </button>
          </div>
          <p className="text-[#B0B8C8] text-xs text-center">
            First player to press "Go First" gets the attack. The other player automatically goes second.
          </p>
        </div>
      </div>
    );
  }

  // ── MAIN TIEBREAKER PLAY SCREEN ──
  return (
    <div className="min-h-screen flex flex-col">

      {/* HUD */}
      <div className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-3 h-12 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-yellow-400 shrink-0" />
            <span className="text-white text-sm font-bold">Tiebreaker</span>
          </div>
          <div className="flex items-center gap-3">
            {isMyTurn && (
              <div className={`flex items-center gap-1 ${timeRemaining <= 15 ? 'text-red-400' : 'text-yellow-400'}`}>
                <Clock className="w-3.5 h-3.5" />
                <span className="text-sm font-bold tabular-nums">{timeRemaining}s</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30">
              <Target className="w-3 h-3 text-yellow-400" />
              <span className="text-yellow-400 text-xs font-bold">Final Showdown</span>
            </div>
            <span className="text-[#B0B8C8] text-xs">
              <span className="text-yellow-500 font-bold">{battle.wager_amount}</span> coins
            </span>
            <button
              onClick={handleForfeit}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-all"
            >
              <Flag className="w-3 h-3" />
              Forfeit
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col max-w-2xl w-full mx-auto px-3 py-3 gap-3">

        {/* Pitch */}
        <div
          className="relative rounded-2xl overflow-hidden flex flex-col bg-[#1a4a2e]"
          style={{ minHeight: 420 }}
        >
          {/* Pitch markings */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-3 rounded-xl border-2 border-white/20" />
            <div className="absolute left-4 right-4 border-t-2 border-white/20" style={{ top: '50%' }} />
            <div className="absolute border-2 border-white/20 rounded-full" style={{ top: '50%', left: '50%', width: 80, height: 80, marginTop: -40, marginLeft: -40 }} />
            <div className="absolute rounded-full bg-white/35" style={{ top: '50%', left: '50%', width: 6, height: 6, marginTop: -3, marginLeft: -3 }} />
          </div>

          {/* Opponent card */}
          <div className="relative z-10 flex flex-col items-center pt-3 px-3">
            <p className="text-[rgba(255,255,255,0.4)] text-[10px] font-bold uppercase tracking-widest mb-2">Opponent — Last Card</p>
            <div className="flex gap-2 justify-center">
              {opponentAvailableCards.map(card => (
                <div key={card.id} className="w-16 rounded-xl border border-white/10 bg-black/30 flex flex-col items-center py-2 px-1 gap-1">
                  {card.avatar_url ? (
                    <img src={card.avatar_url} alt={card.player_name} className="w-12 h-12 rounded-full object-cover border border-white/20" loading="lazy" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-orange-400 flex items-center justify-center border border-white/20">
                      <span className="text-white text-sm font-black">{card.player_name.charAt(0)}</span>
                    </div>
                  )}
                  <p className="text-white text-[9px] font-bold truncate w-full text-center">{card.username || card.player_name}</p>
                  <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-white text-[9px] font-black">{card.overall_rating}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Centre pitch zone */}
          <div className="relative z-20 flex flex-col items-stretch px-3 py-2 gap-1.5">
            <div className="bg-black/40 rounded-2xl border border-white/10 p-2 flex items-stretch gap-2">

              {/* Left — opponent card on pitch or empty */}
              <div className="flex-1 rounded-xl bg-black/30 border border-white/10 p-2 flex flex-col items-center justify-center min-w-0">
                {stuckMove && !stuckIsMe && stuckCard ? (
                  <>
                    <p className="text-white text-[9px] font-bold truncate w-full text-center">{stuckCard.username || stuckCard.player_name}</p>
                    <span className="mt-1 px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-[9px] font-black uppercase">{stuckMove.skill}</span>
                    <span className="text-white font-black text-base mt-0.5">{stuckMove.value}</span>
                    <span className="text-white/30 text-[8px] mt-0.5">On Pitch</span>
                  </>
                ) : stuckMove && stuckIsMe ? (
                  <span className="text-white/20 text-[9px] text-center">Waiting for opponent…</span>
                ) : (
                  <span className="text-white/20 text-[9px]">–</span>
                )}
              </div>

              {/* Centre */}
              <div className="flex flex-col items-center justify-center gap-1 shrink-0">
                <div className={`w-12 h-12 rounded-full border-2 flex flex-col items-center justify-center ${timeRemaining <= 15 && isMyTurn ? 'border-red-500/60 bg-red-500/10' : 'border-yellow-500/50 bg-yellow-500/10'}`}>
                  <Target className={`w-5 h-5 ${timeRemaining <= 15 && isMyTurn ? 'text-red-400' : 'text-yellow-400'}`} />
                </div>
                <span className={`text-[8px] font-bold uppercase tracking-wide ${isMyTurn ? 'text-[#00FF85]' : 'text-white/30'}`}>
                  {isMyTurn ? 'Your turn' : 'Opponent'}
                </span>
              </div>

              {/* Right — my card on pitch or empty */}
              <div className="flex-1 rounded-xl bg-black/30 border border-white/10 p-2 flex flex-col items-center justify-center min-w-0">
                {stuckMove && stuckIsMe && stuckCard ? (
                  <>
                    <p className="text-white text-[9px] font-bold truncate w-full text-center">{stuckCard.username || stuckCard.player_name}</p>
                    <span className="mt-1 px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-[9px] font-black uppercase">{stuckMove.skill}</span>
                    <span className="text-white font-black text-base mt-0.5">{stuckMove.value}</span>
                    <span className="text-white/30 text-[8px] mt-0.5">On Pitch</span>
                  </>
                ) : stuckMove && !stuckIsMe ? (
                  <span className="text-white/20 text-[9px] text-center">Waiting for attack…</span>
                ) : (
                  <span className="text-white/20 text-[9px]">–</span>
                )}
              </div>

            </div>

            {/* Turn status */}
            {!isMyTurn && (
              <div className="flex justify-center">
                <div className="px-4 py-1.5 rounded-full border border-white/10 bg-black/20 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/25 animate-pulse" />
                  <span className="text-white/40 text-[10px] font-semibold">Waiting for opponent…</span>
                </div>
              </div>
            )}
          </div>

          {/* Skill selection panel — my turn only */}
          {isMyTurn && !submitting && (
            <div className="relative z-30 mx-3 mb-2 rounded-2xl overflow-hidden bg-[rgba(10,18,35,0.92)] border border-[rgba(255,200,0,0.2)]">
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {isAttacker ? 'Attack — pick your card & skill' : 'Defend — pick any skill to beat ' + (stuckMove?.value ?? '?')}
                  </h3>
                  <p className="text-[#B0B8C8] text-[11px] mt-0.5">
                    {isAttacker
                      ? 'Commit your last card with a skill — opponent must beat it'
                      : `You need strictly greater than ${stuckMove?.value ?? '?'} to win`}
                  </p>
                </div>

                {/* Card row */}
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {myAvailableCards.map(card => (
                    <button
                      key={card.id}
                      onClick={() => setSelectedCard(card.id)}
                      className={`flex flex-col items-center w-24 flex-shrink-0 rounded-2xl p-2.5 border-2 transition-all ${
                        selectedCard === card.id
                          ? 'border-yellow-400/60 bg-yellow-500/10 scale-105'
                          : 'border-white/10 bg-white/3 opacity-70 hover:opacity-100 hover:border-yellow-400/30'
                      }`}
                    >
                      {card.avatar_url ? (
                        <img src={card.avatar_url} alt={card.player_name} className="w-12 h-12 rounded-full object-cover border-2 border-yellow-400/20 mb-1" loading="lazy" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00FF85] to-[#00E0FF] flex items-center justify-center mb-1 border-2 border-yellow-400/20">
                          <span className="text-black font-black text-lg">{card.player_name.charAt(0)}</span>
                        </div>
                      )}
                      <p className="text-white text-[10px] font-semibold text-center truncate w-full">{card.player_name}</p>
                      <span className="mt-1 text-[9px] font-black text-black bg-gradient-to-r from-[#00FF85] to-[#00E0FF] px-2 py-0.5 rounded">{card.overall_rating}</span>
                    </button>
                  ))}
                </div>

                {/* Skill picker */}
                <div>
                  <p className="text-[11px] font-bold text-[#B0B8C8] uppercase tracking-wide mb-2">
                    {selectedCard ? 'Select skill' : 'Select card first'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SKILLS.map(skill => {
                      const card = myAvailableCards.find(c => c.id === selectedCard);
                      const value = card ? getSkillValue(card, skill.code) : null;
                      const isUsed = myUsedSkills.has(skill.code);
                      const isSelected = selectedSkill === skill.code;
                      return (
                        <button
                          key={skill.code}
                          onClick={() => !isUsed && selectedCard && setSelectedSkill(skill.code)}
                          disabled={isUsed || !selectedCard}
                          className={`flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-bold transition-all ${
                            isUsed
                              ? 'border-white/10 bg-white/5 text-white/25 cursor-not-allowed'
                              : isSelected
                              ? 'bg-gradient-to-r from-yellow-400 to-yellow-300 border-transparent text-black'
                              : 'border-yellow-400/20 bg-[rgba(15,24,41,0.85)] text-[#B0B8C8] hover:border-yellow-400/60 hover:text-white'
                          }`}
                        >
                          <span>{skill.code}</span>
                          {value !== null && !isUsed && (
                            <span className={`font-black ${isSelected ? 'text-black' : 'text-white/60'}`}>{value}</span>
                          )}
                          {isUsed && <span className="text-[10px] text-white/25">(used)</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!selectedCard || !selectedSkill || submitting}
                  className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                    selectedCard && selectedSkill && !submitting
                      ? 'bg-gradient-to-r from-yellow-400 to-yellow-300 text-black hover:opacity-90'
                      : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                  }`}
                >
                  {submitting ? 'Submitting…' : 'Confirm'}
                </button>
              </div>
            </div>
          )}

          {/* My card */}
          <div className="relative z-10 flex flex-col items-center pb-3 px-3">
            <div className="flex gap-2 justify-center mb-2">
              {myAvailableCards.map(card => (
                <div key={card.id} className="w-16 rounded-xl border border-[rgba(0,255,133,0.2)] bg-black/30 flex flex-col items-center py-2 px-1 gap-1">
                  {card.avatar_url ? (
                    <img src={card.avatar_url} alt={card.player_name} className="w-12 h-12 rounded-full object-cover border border-[rgba(0,255,133,0.3)]" loading="lazy" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00FF85] to-[#00E0FF] flex items-center justify-center border border-[rgba(0,255,133,0.3)]">
                      <span className="text-black text-sm font-black">{card.player_name.charAt(0)}</span>
                    </div>
                  )}
                  <p className="text-white text-[9px] font-bold truncate w-full text-center">{card.username || card.player_name}</p>
                  <span className="px-1.5 py-0.5 rounded-full bg-[rgba(0,255,133,0.15)] text-[#00FF85] text-[9px] font-black">{card.overall_rating}</span>
                  <div className="grid grid-cols-3 gap-x-1 gap-y-0.5 w-full mt-0.5">
                    {([['PAC', card.pace], ['SHO', card.shooting], ['PAS', card.passing], ['DRI', card.dribbling], ['DEF', card.defending], ['PHY', card.physical]] as [string, number][]).map(([label, val]) => (
                      <div key={label} className="flex flex-col items-center">
                        <span className="text-white/40 text-[7px] font-bold">{label}</span>
                        <span className="text-[#00FF85] text-[8px] font-black">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">You — Last Card</p>
          </div>
        </div>

        {/* Used skills */}
        {myUsedSkills.size > 0 && (
          <div className="glass-card p-3 flex items-center gap-2 flex-wrap">
            <span className="text-[#B0B8C8] text-[10px] font-bold uppercase tracking-wide shrink-0">Your used skills:</span>
            {[...myUsedSkills].map(skill => (
              <span key={skill} className="px-2.5 py-0.5 bg-red-500/15 border border-red-500/40 rounded-full text-red-400 text-[10px] font-semibold">{skill}</span>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}