import { useState } from 'react';
import { Shield } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { PlayerCard } from '../../lib/battleMode';

interface SkillSelectionScreenProps {
  cards: PlayerCard[];
  usedSkills: string[];
  isAttacker: boolean;
  onSelect: (cardId: string, skill?: string) => void;
  eliminatedCards: string[];
  attackerSkill?: string | null;
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
  const skillMap: Record<string, number> = {
    PAC: card.pace,
    SHO: card.shooting,
    PAS: card.passing,
    DRI: card.dribbling,
    DEF: card.defending,
    PHY: card.physical,
  };
  return skillMap[skillCode] || 0;
};

export function SkillSelectionScreen({
  cards,
  usedSkills,
  isAttacker,
  onSelect,
  eliminatedCards,
  attackerSkill,
}: SkillSelectionScreenProps) {
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  const availableCards = cards.filter((card) => !eliminatedCards.includes(card.id));
  const availableSkills = SKILLS.filter((skill) => !usedSkills.includes(skill.code));
  const usedSkillSet = new Set(usedSkills);

  const challengedSkill = attackerSkill
    ? SKILLS.find((s) => s.code === attackerSkill)
    : null;

  const handleConfirm = () => {
    if (selectedCard) {
      onSelect(selectedCard, isAttacker ? selectedSkill || undefined : undefined);
    }
  };

  const canConfirm = !!selectedCard && (!isAttacker || !!selectedSkill);

  return (
    <div className="space-y-4">
      <GlassCard className="p-5">
        <h3 className="text-xl font-bold text-white mb-1">
          {isAttacker ? 'Attack — pick card & skill' : 'Defend — pick your card'}
        </h3>

        {!isAttacker && challengedSkill && (
          <div className="flex items-center gap-3 mt-3 mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
            <Shield className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-white/80 text-sm">
              Opponent challenges with <span className="text-red-400 font-semibold">{challengedSkill.name}</span> — pick the card with the highest value
            </p>
          </div>
        )}

        {isAttacker && (
          <p className="text-white/60 text-sm mt-1 mb-4">Choose a card, then pick the skill to challenge your opponent with</p>
        )}

        {/* Horizontal scrollable card row */}
        <div className="overflow-x-auto pb-2 -mx-1 px-1">
          <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
            {availableCards.map((card) => {
              const defenseValue = !isAttacker && attackerSkill
                ? getSkillValue(card, attackerSkill)
                : null;
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
                  {defenseValue !== null && (
                    <p className="text-yellow-400 text-2xl font-black mt-2 leading-none">
                      {defenseValue}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Skill picker — shown to attacker always, hidden for defender */}
        {isAttacker && (
          <div className="mt-5">
            <h4 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-3">
              {selectedCard ? 'Select skill' : 'Select a card first'}
            </h4>
            <div className="flex flex-wrap gap-2">
              {SKILLS.map((skill) => {
                const card = availableCards.find((c) => c.id === selectedCard);
                const value = card ? getSkillValue(card, skill.code) : null;
                const isUsed = usedSkillSet.has(skill.code);
                const isSelected = selectedSkill === skill.code;

                return (
                  <button
                    key={skill.code}
                    onClick={() => !isUsed && selectedCard && setSelectedSkill(skill.code)}
                    disabled={isUsed || !selectedCard}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full border text-sm font-semibold transition-all focus:outline-none ${
                      isUsed
                        ? 'border-white/10 bg-white/5 text-white/25 cursor-not-allowed'
                        : isSelected
                        ? 'border-[#00FF85] bg-[#00FF85]/15 text-[#00FF85]'
                        : 'border-white/20 bg-white/5 text-white/80 hover:border-white/40 hover:bg-white/10'
                    }`}
                  >
                    <span>{skill.code}</span>
                    {value !== null && !isUsed && (
                      <span className={`font-black ${isSelected ? 'text-yellow-400' : 'text-white/50'}`}>
                        {value}
                      </span>
                    )}
                    {isUsed && <span className="text-xs text-white/30">(used)</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-5">
          <GlassButton
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="w-full"
          >
            Confirm Selection
          </GlassButton>
        </div>
      </GlassCard>
    </div>
  );
}
