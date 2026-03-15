import { useState, useEffect, useCallback } from 'react';
import { Target, RefreshCw } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-2xl mx-auto">
          <GlassCard className="p-8 text-center">
            <Target className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-pulse" />
            <h1 className="text-3xl font-bold text-white mb-4">Move Submitted!</h1>
            <p className="text-white/70 text-lg mb-6">
              Waiting for opponent to submit their tiebreaker move...
            </p>
            <button
              onClick={handleRefreshBattle}
              disabled={refreshing}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors mx-auto disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Checking...' : 'Check Result'}</span>
            </button>
          </GlassCard>
        </div>
      </div>
    );
  }

  const selectedCardObj = availableCards.find((c) => c.id === selectedCard);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <GlassCard className="p-6 text-center">
          <Target className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
          <h1 className="text-3xl font-bold text-white mb-2">Tiebreaker!</h1>
          <p className="text-white/60 text-sm">
            All skills used. Pick one card and one skill for the final showdown.
          </p>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-3">Select Your Card</h3>

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
                        ? 'border-[#00FF85] bg-[#00FF85]/10 scale-105'
                        : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10 opacity-75 hover:opacity-100'
                    }`}
                  >
                    {card.avatar_url ? (
                      <img
                        src={card.avatar_url}
                        alt={card.player_name}
                        className="w-14 h-14 rounded-full object-cover border-2 border-white/20 mb-2"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-2 border-2 border-white/20">
                        <span className="text-white/50 text-xl font-bold">
                          {card.player_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <p className="text-white text-xs font-semibold text-center w-full truncate leading-tight">
                      {card.player_name}
                    </p>
                    <span className="mt-1.5 px-2 py-0.5 bg-[#00FF85]/20 text-[#00FF85] text-xs font-bold rounded-full">
                      {card.overall_rating} OVR
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Skill picker */}
          <div className="mt-5">
            <h4 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-3">
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
                    className={`flex items-center gap-2 px-3 py-2 rounded-full border text-sm font-semibold transition-all focus:outline-none ${
                      !selectedCard
                        ? 'border-white/10 bg-white/5 text-white/25 cursor-not-allowed'
                        : isSelected
                        ? 'border-[#00FF85] bg-[#00FF85]/15 text-[#00FF85]'
                        : 'border-white/20 bg-white/5 text-white/80 hover:border-white/40 hover:bg-white/10'
                    }`}
                  >
                    <span>{skill.code}</span>
                    {value !== null && selectedCard && (
                      <span className={`font-black ${isSelected ? 'text-yellow-400' : 'text-white/50'}`}>
                        {value}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <GlassButton
              onClick={handleConfirm}
              disabled={!selectedCard || !selectedSkill || submitting}
              className="w-full"
              size="lg"
            >
              {submitting ? 'Submitting...' : 'Confirm Tiebreaker Selection'}
            </GlassButton>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
