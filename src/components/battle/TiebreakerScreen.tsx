import { useState, useEffect, useCallback } from 'react';
import { Target, RefreshCw } from 'lucide-react';
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

  if (submitted) {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-2xl mx-auto">
          <div className="glass-container p-8 text-center">
            <Target className="w-12 h-12 text-yellow-400 mx-auto mb-4 animate-pulse" />
            <h1 className="text-2xl font-bold text-white mb-3">Move Submitted!</h1>
            <p className="text-[#B0B8C8] text-sm mb-6">
              Waiting for opponent to submit their tiebreaker move...
            </p>
            <button
              onClick={handleRefreshBattle}
              disabled={refreshing}
              className="flex items-center gap-2 px-5 py-2.5 mx-auto rounded-xl bg-[rgba(0,224,255,0.08)] border border-[rgba(0,224,255,0.2)] text-[#00E0FF] text-sm font-semibold hover:bg-[rgba(0,224,255,0.15)] disabled:opacity-50 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Checking...' : 'Check Result'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const selectedCardObj = availableCards.find((c) => c.id === selectedCard);

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Tiebreaker header */}
        <div className="glass-container p-4 text-center">
          <Target className="w-10 h-10 text-yellow-400 mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-white mb-1">Tiebreaker!</h1>
          <p className="text-[#B0B8C8] text-xs">
            All skills used. Pick one card and one skill for the final showdown.
          </p>
        </div>

        {/* Card + skill panel */}
        <div className="glass-container p-4 space-y-4">

          <h3 className="text-xs font-bold text-[#B0B8C8] uppercase tracking-wide">Select Your Card</h3>

          {/* Horizontal scrollable card row */}
          <div className="overflow-x-auto pb-2 -mx-1 px-1">
            <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
              {availableCards.map((card) => {
                const isSelected = selectedCard === card.id;
                return (
                  <button
                    key={card.id}
                    onClick={() => setSelectedCard(card.id)}
                    className={`flex flex-col items-center w-28 flex-shrink-0 rounded-2xl p-3 border-2 transition-all focus:outline-none ${
                      isSelected
                        ? 'border-[#00E0FF] bg-[rgba(0,224,255,0.08)] scale-105 shadow-[0_0_12px_rgba(0,224,255,0.2)]'
                        : 'border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(0,224,255,0.3)] hover:bg-[rgba(0,224,255,0.04)] opacity-70 hover:opacity-100'
                    }`}
                  >
                    {card.avatar_url ? (
                      <img
                        src={card.avatar_url}
                        alt={card.player_name}
                        className="w-14 h-14 rounded-full object-cover border-2 border-[rgba(0,224,255,0.25)] mb-2"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#00FF85] to-[#00E0FF] flex items-center justify-center mb-2 border-2 border-[rgba(0,224,255,0.25)]">
                        <span className="text-black font-black text-xl">
                          {card.player_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <p className="text-white text-xs font-semibold text-center w-full truncate leading-tight">
                      {card.player_name}
                    </p>
                    <span className="mt-1.5 text-[10px] font-black text-black bg-gradient-to-r from-[#00FF85] to-[#00E0FF] px-2 py-0.5 rounded">
                      {card.overall_rating}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Skill picker */}
          <div>
            <h4 className="text-xs font-bold text-[#B0B8C8] uppercase tracking-wide mb-2.5">
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
                        ? 'bg-gradient-to-r from-[#00FF85] to-[#00E0FF] border-transparent text-black shadow-[0_0_10px_rgba(0,224,255,0.3)]'
                        : 'border-[rgba(0,224,255,0.2)] bg-[rgba(15,24,41,0.85)] text-[#B0B8C8] hover:border-[#00E0FF] hover:text-white'
                    }`}
                  >
                    <span>{skill.code}</span>
                    {value !== null && selectedCard && (
                      <span className={`font-black ${isSelected ? 'text-black' : 'text-white/60'}`}>
                        {value}
                      </span>
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
                ? 'bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black hover:opacity-90 shadow-[0_0_16px_rgba(0,224,255,0.3)]'
                : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
            }`}
          >
            {submitting ? 'Submitting...' : 'Confirm Tiebreaker Selection'}
          </button>

        </div>
      </div>
    </div>
  );
}
