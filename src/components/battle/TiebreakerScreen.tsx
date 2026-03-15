import { useState, useEffect, useCallback } from 'react';
import { Target, RefreshCw, Swords } from 'lucide-react';
import {
  Battle,
  PlayerCard,
  submitTiebreakerMove,
  getBattle,
} from '../../lib/battleMode';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

interface TiebreakerScreenProps {
  battle: Battle;
  myCards: PlayerCard[];
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

export function TiebreakerScreen({
  battle: initialBattle,
  myCards,
  eliminatedCards,
  onComplete,
}: TiebreakerScreenProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [battle, setBattle] = useState(initialBattle);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const availableCards = myCards.filter((card) => !eliminatedCards.includes(card.id));

  const handleRefreshBattle = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const updated = await getBattle(battle.id);
      setBattle(updated);
      if (updated.status === 'completed' || updated.status === 'forfeited') {
        setTimeout(() => onComplete(), 2000);
      }
    } catch (error) {
      console.error('Error refreshing battle:', error);
    } finally {
      setRefreshing(false);
    }
  }, [battle.id, refreshing, onComplete]);

  useEffect(() => {
    if (!user) return;
    const alreadySubmitted = (battle.card_selections || []).some(
      (move: any) => move.is_tiebreaker && move.user_id === user.id
    );
    if (alreadySubmitted) setSubmitted(true);
  }, [battle.card_selections, user]);

  const handleConfirm = async () => {
    if (!user || !selectedCard || !selectedSkill || submitting) return;
    setSubmitting(true);
    try {
      const result = await submitTiebreakerMove(battle.id, user.id, selectedCard, selectedSkill);
      if (result.success) {
        setSubmitted(true);
        if (result.battle_over) {
          const updated = await getBattle(battle.id);
          setBattle(updated);
        }
      } else {
        toast.error(result.error || 'Failed to submit tiebreaker move');
      }
    } catch (error) {
      console.error('Error submitting tiebreaker:', error);
      toast.error('Failed to submit tiebreaker move');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCardObj = availableCards.find((c) => c.id === selectedCard);

  const myTiebreakerMove = (battle.card_selections || []).find(
    (m: any) => m.is_tiebreaker && m.user_id === user?.id
  );
  const opponentTiebreakerMove = (battle.card_selections || []).find(
    (m: any) => m.is_tiebreaker && m.user_id !== user?.id
  );
  const myTiebreakerCard = myTiebreakerMove
    ? myCards.find(c => c.id === myTiebreakerMove.card_id)
    : null;

  const opponentId = battle.manager1_id === user?.id ? battle.manager2_id : battle.manager1_id;

  return (
    <div className="min-h-screen flex flex-col">

      {/* Top HUD bar */}
      <div className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-3 h-12 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-yellow-400 shrink-0" />
            <span className="text-white text-sm font-bold">Tiebreaker</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30">
              <Target className="w-3 h-3 text-yellow-400" />
              <span className="text-yellow-400 text-xs font-bold">Final Showdown</span>
            </div>
            <span className="text-[#B0B8C8] text-xs">
              <span className="text-yellow-500 font-bold">{battle.wager_amount}</span>
              {' '}coins
            </span>
          </div>
        </div>
      </div>

      {/* Pitch */}
      <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto px-3 py-3 gap-3">

        {/* ── PITCH CONTAINER ── */}
        <div
          className="relative flex-1 rounded-2xl overflow-hidden flex flex-col bg-[#1a4a2e]"
          style={{ minHeight: 340 }}
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
          <div className="relative z-10 flex-1 flex flex-col items-center justify-start pt-3 px-3">
            <p className="text-[rgba(255,255,255,0.4)] text-[10px] font-bold uppercase tracking-widest mb-2">
              Opponent
            </p>
            <div className="flex gap-2 flex-wrap justify-center">
              {myCards
                .filter(c => c.user_id === opponentId || c.manager_id === opponentId)
                .map((card) => {
                  const eliminated = eliminatedCards.includes(card.id);
                  return (
                    <div key={card.id} className="relative rotate-180" style={{ opacity: eliminated ? 0.3 : 1 }}>
                      <div className="w-16 rounded-xl border border-white/10 bg-black/30 backdrop-blur-sm flex flex-col items-center py-2 px-1 gap-1">
                        {card.avatar_url ? (
                          <img src={card.avatar_url} alt={card.player_name} className="w-12 h-12 rounded-full object-cover border border-white/20" loading="lazy" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-orange-400 flex items-center justify-center border border-white/20">
                            <span className="text-white text-sm font-black">{card.player_name.charAt(0)}</span>
                          </div>
                        )}
                        <p className="text-white text-[9px] font-bold truncate w-full text-center leading-tight">{card.username || card.player_name}</p>
                        <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-white text-[9px] font-black">{card.overall_rating}</span>
                      </div>
                      {eliminated && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-red-500 font-black text-2xl leading-none">✕</span>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* ── ROW 2: Centre tiebreaker zone ── */}
          <div className="relative z-20 flex flex-col items-stretch px-3 py-1 gap-1.5">

            {submitted ? (
              /* Submitted — show both picks once available, pulsing wait otherwise */
              <div className="bg-black/40 rounded-2xl border border-white/10 p-2 flex items-stretch gap-2">

                {/* My submitted pick */}
                <div className="flex-1 rounded-xl bg-black/30 border border-[rgba(0,255,133,0.2)] backdrop-blur-sm p-2 flex flex-col items-center justify-center min-w-0">
                  {myTiebreakerCard ? (
                    <>
                      {myTiebreakerCard.avatar_url ? (
                        <img src={myTiebreakerCard.avatar_url} alt={myTiebreakerCard.player_name} className="w-8 h-8 rounded-full object-cover border border-[rgba(0,255,133,0.3)] mb-1" loading="lazy" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00FF85] to-[#00E0FF] flex items-center justify-center border border-[rgba(0,255,133,0.3)] mb-1">
                          <span className="text-black text-xs font-black">{myTiebreakerCard.player_name.charAt(0)}</span>
                        </div>
                      )}
                      <p className="text-white text-[9px] font-bold truncate w-full text-center">{myTiebreakerCard.player_name}</p>
                      {myTiebreakerMove?.skill && (
                        <span className="mt-1 px-2 py-0.5 rounded-full bg-[rgba(0,255,133,0.15)] border border-[rgba(0,255,133,0.3)] text-[#00FF85] text-[9px] font-black uppercase tracking-wide">
                          {myTiebreakerMove.skill}
                        </span>
                      )}
                      {myTiebreakerMove?.value != null && (
                        <span className="text-white font-black text-base leading-none mt-0.5">{myTiebreakerMove.value}</span>
                      )}
                      <span className="text-[rgba(255,255,255,0.3)] text-[8px] mt-0.5">YOU</span>
                    </>
                  ) : (
                    <span className="text-[#00FF85]/50 text-[9px] font-semibold">Submitted</span>
                  )}
                </div>

                {/* Centre status */}
                <div className="flex flex-col items-center justify-center gap-1 shrink-0">
                  <div className="w-12 h-12 rounded-full border-2 border-yellow-500/50 bg-yellow-500/10 flex flex-col items-center justify-center">
                    <Target className="w-4 h-4 text-yellow-400" />
                  </div>
                  <span className="text-yellow-400 text-[8px] font-bold uppercase tracking-wide">TB</span>
                </div>

                {/* Opponent pick — shown if resolved, otherwise pulsing wait */}
                <div className="flex-1 rounded-xl bg-black/30 border border-white/10 backdrop-blur-sm p-2 flex flex-col items-center justify-center min-w-0">
                  {opponentTiebreakerMove ? (
                    <>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-400 flex items-center justify-center border border-red-400/30 mb-1">
                        <span className="text-white text-xs font-black">?</span>
                      </div>
                      {opponentTiebreakerMove.skill && (
                        <span className="mt-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[9px] font-black uppercase tracking-wide">
                          {opponentTiebreakerMove.skill}
                        </span>
                      )}
                      {opponentTiebreakerMove.value != null && (
                        <span className="text-white font-black text-base leading-none mt-0.5">{opponentTiebreakerMove.value}</span>
                      )}
                      <span className="text-[rgba(255,255,255,0.3)] text-[8px] mt-0.5">OPP</span>
                    </>
                  ) : (
                    <>
                      <div className="w-5 h-5 rounded-full border border-white/20 flex items-center justify-center mb-1 animate-pulse">
                        <Target className="w-3 h-3 text-white/25" />
                      </div>
                      <span className="text-white/30 text-[9px] font-semibold text-center leading-tight">Waiting for opponent's tiebreaker pick…</span>
                    </>
                  )}
                </div>

              </div>
            ) : (
              /* Not yet submitted — show VS prompt in centre */
              <div className="bg-black/40 rounded-2xl border border-white/10 p-2 flex items-stretch gap-2">
                <div className="flex-1 rounded-xl bg-black/30 border border-[rgba(0,255,133,0.15)] backdrop-blur-sm p-2 flex flex-col items-center justify-center min-w-0">
                  <span className="text-[#00FF85]/50 text-[9px] font-semibold">Pick below</span>
                </div>
                <div className="flex flex-col items-center justify-center gap-1 shrink-0">
                  <div className="w-12 h-12 rounded-full border-2 border-yellow-500/50 bg-yellow-500/10 flex flex-col items-center justify-center">
                    <Target className="w-4 h-4 text-yellow-400" />
                  </div>
                  <span className="text-yellow-400 text-[8px] font-bold uppercase tracking-wide">TB</span>
                </div>
                <div className="flex-1 rounded-xl bg-black/30 border border-white/10 backdrop-blur-sm p-2 flex flex-col items-center justify-center min-w-0">
                  <span className="text-white/20 text-[9px] font-semibold">–</span>
                </div>
              </div>
            )}

            {/* Submitted: check result button */}
            {submitted && !opponentTiebreakerMove && (
              <div className="flex justify-center">
                <button
                  onClick={handleRefreshBattle}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(0,224,255,0.08)] border border-[rgba(0,224,255,0.2)] text-[#00E0FF] text-[10px] font-semibold hover:bg-[rgba(0,224,255,0.15)] disabled:opacity-50 transition-all"
                >
                  <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Checking…' : 'Check Result'}
                </button>
              </div>
            )}

          </div>

          {/* ── INLINE TIEBREAKER SELECTION PANEL (not yet submitted) ── */}
          {!submitted && (
            <div className="relative z-30 mx-3 mb-2 rounded-2xl overflow-hidden bg-[rgba(10,18,35,0.92)] border border-[rgba(255,200,0,0.2)] shadow-[0_0_24px_rgba(255,200,0,0.06)]">
              <div className="p-4 space-y-4">

                <div>
                  <h3 className="text-sm font-bold text-white">Tiebreaker — pick card &amp; skill</h3>
                  <p className="text-[#B0B8C8] text-[11px] mt-0.5">All skills used. Final showdown — any skill allowed.</p>
                </div>

                {/* Horizontal scrollable card row */}
                <div className="overflow-x-auto pb-2 -mx-1 px-1">
                  <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
                    {availableCards.map((card) => {
                      const isSelected = selectedCard === card.id;
                      return (
                        <button
                          key={card.id}
                          onClick={() => setSelectedCard(card.id)}
                          className={`flex flex-col items-center w-24 flex-shrink-0 rounded-2xl p-2.5 border-2 transition-all focus:outline-none ${
                            isSelected
                              ? 'border-yellow-400/60 bg-yellow-500/10 scale-105 shadow-[0_0_12px_rgba(255,200,0,0.2)]'
                              : 'border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] hover:border-yellow-400/30 opacity-70 hover:opacity-100'
                          }`}
                        >
                          {card.avatar_url ? (
                            <img src={card.avatar_url} alt={card.player_name} className="w-12 h-12 rounded-full object-cover border-2 border-[rgba(255,200,0,0.2)] mb-1.5" loading="lazy" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00FF85] to-[#00E0FF] flex items-center justify-center mb-1.5 border-2 border-[rgba(255,200,0,0.2)]">
                              <span className="text-black font-black text-lg">{card.player_name.charAt(0).toUpperCase()}</span>
                            </div>
                          )}
                          <p className="text-white text-[10px] font-semibold text-center w-full truncate leading-tight">{card.player_name}</p>
                          <span className="mt-1 text-[9px] font-black text-black bg-gradient-to-r from-[#00FF85] to-[#00E0FF] px-2 py-0.5 rounded">
                            {card.overall_rating}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Skill picker */}
                <div>
                  <h4 className="text-[11px] font-bold text-[#B0B8C8] uppercase tracking-wide mb-2">
                    {selectedCard ? 'Select skill' : 'Select a card first'}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {SKILLS.map((skill) => {
                      const value = selectedCardObj ? getSkillValue(selectedCardObj, skill.code) : null;
                      const isSelected = selectedSkill === skill.code;

                      return (
                        <button
                          key={skill.code}
                          onClick={() => selectedCard && setSelectedSkill(skill.code)}
                          disabled={!selectedCard}
                          className={`flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-bold transition-all focus:outline-none ${
                            !selectedCard
                              ? 'border-white/10 bg-white/5 text-white/25 cursor-not-allowed'
                              : isSelected
                              ? 'bg-gradient-to-r from-yellow-400 to-yellow-300 border-transparent text-black shadow-[0_0_10px_rgba(255,200,0,0.3)]'
                              : 'border-[rgba(255,200,0,0.2)] bg-[rgba(15,24,41,0.85)] text-[#B0B8C8] hover:border-yellow-400/60 hover:text-white'
                          }`}
                        >
                          <span>{skill.code}</span>
                          {value !== null && selectedCard && (
                            <span className={`font-black ${isSelected ? 'text-black' : 'text-white/60'}`}>{value}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={handleConfirm}
                  disabled={!selectedCard || !selectedSkill || submitting}
                  className={`w-full py-3 rounded-xl text-sm font-bold transition-all focus:outline-none ${
                    selectedCard && selectedSkill && !submitting
                      ? 'bg-gradient-to-r from-yellow-400 to-yellow-300 text-black hover:opacity-90 shadow-[0_0_16px_rgba(255,200,0,0.25)]'
                      : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                  }`}
                >
                  {submitting ? 'Submitting…' : 'Confirm Tiebreaker Selection'}
                </button>

              </div>
            </div>
          )}

          {/* ── ROW 3: My cards zone ── */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-end pb-3 px-3">
            <div className="flex gap-2 flex-wrap justify-center mb-2">
              {myCards.map((card) => {
                const eliminated = eliminatedCards.includes(card.id);
                return (
                  <div key={card.id} className="relative" style={{ opacity: eliminated ? 0.3 : 1 }}>
                    <div className="w-16 rounded-xl border border-white/10 bg-black/30 backdrop-blur-sm flex flex-col items-center py-2 px-1 gap-1">
                      {card.avatar_url ? (
                        <img src={card.avatar_url} alt={card.player_name} className="w-12 h-12 rounded-full object-cover border border-[rgba(0,255,133,0.3)]" loading="lazy" />
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
              You
            </p>
          </div>

        </div>

        {/* Used skills strip */}
        {(battle.used_skills || []).length > 0 && (
          <div className="glass-card p-3 flex items-center gap-2 flex-wrap">
            <span className="text-[#B0B8C8] text-[10px] font-bold uppercase tracking-wide shrink-0">Used:</span>
            {(battle.used_skills || []).map((skill) => (
              <span key={skill} className="px-2.5 py-0.5 bg-red-500/15 border border-red-500/40 rounded-full text-red-400 text-[10px] font-semibold">
                {skill}
              </span>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
