import { useState } from 'react';
import { Zap, Shield } from 'lucide-react';
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
  { code: 'PAC', name: 'Pace', color: 'from-green-500 to-emerald-500' },
  { code: 'SHO', name: 'Shooting', color: 'from-red-500 to-rose-500' },
  { code: 'PAS', name: 'Passing', color: 'from-blue-500 to-cyan-500' },
  { code: 'DRI', name: 'Dribbling', color: 'from-teal-500 to-cyan-500' },
  { code: 'DEF', name: 'Defending', color: 'from-orange-500 to-amber-500' },
  { code: 'PHY', name: 'Physical', color: 'from-yellow-500 to-lime-500' },
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

  const challengedSkill = attackerSkill
    ? SKILLS.find((s) => s.code === attackerSkill)
    : null;

  const handleConfirm = () => {
    if (selectedCard) {
      onSelect(selectedCard, isAttacker ? selectedSkill || undefined : undefined);
    }
  };

  return (
    <div className="space-y-6">
      <GlassCard className="p-6">
        <h3 className="text-2xl font-bold text-white mb-2">
          {isAttacker ? 'Select Your Card & Skill to Attack' : 'Select Your Card to Defend'}
        </h3>

        {!isAttacker && challengedSkill && (
          <div className="flex items-center gap-3 mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <Shield className="w-6 h-6 text-red-400 shrink-0" />
            <div>
              <p className="text-white font-semibold">
                Opponent is challenging with {challengedSkill.name}
              </p>
              <p className="text-white/60 text-sm">
                Pick the card with the highest {challengedSkill.name} stat to defend
              </p>
            </div>
          </div>
        )}

        {isAttacker && (
          <p className="text-white/70 mb-6">
            Choose a card and a skill to challenge your opponent
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          {availableCards.map((card) => {
            const defenseValue = !isAttacker && attackerSkill
              ? getSkillValue(card, attackerSkill)
              : null;

            return (
              <div
                key={card.id}
                onClick={() => setSelectedCard(card.id)}
                className={`cursor-pointer transition-all ${
                  selectedCard === card.id
                    ? 'ring-4 ring-[#00FF85] scale-105'
                    : 'hover:scale-105 opacity-70'
                }`}
              >
                <GlassCard className="p-3">
                  <img
                    src={card.image_url}
                    alt={card.player_name}
                    className="w-full h-32 object-cover rounded-lg mb-2"
                    loading="lazy"
                  />
                  <h4 className="text-white font-bold text-sm text-center">{card.player_name}</h4>
                  <p className="text-[#00FF85] text-center text-xs">{card.overall_rating} OVR</p>
                  {defenseValue !== null && (
                    <p className="text-yellow-400 text-center text-lg font-bold mt-1">
                      {attackerSkill}: {defenseValue}
                    </p>
                  )}
                </GlassCard>
              </div>
            );
          })}
        </div>

        {isAttacker && selectedCard && (
          <div>
            <h4 className="text-xl font-bold text-white mb-4">Select Skill to Challenge</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {availableSkills.map((skill) => {
                const card = availableCards.find((c) => c.id === selectedCard);
                const value = card ? getSkillValue(card, skill.code) : 0;
                return (
                  <div
                    key={skill.code}
                    onClick={() => setSelectedSkill(skill.code)}
                    className={`cursor-pointer transition-all ${
                      selectedSkill === skill.code
                        ? 'ring-4 ring-[#00FF85] scale-105'
                        : 'hover:scale-105'
                    }`}
                  >
                    <GlassCard className="p-4">
                      <div className={`bg-gradient-to-r ${skill.color} rounded-lg p-3 mb-2`}>
                        <Zap className="w-6 h-6 text-white mx-auto" />
                      </div>
                      <h5 className="text-white font-bold text-center mb-1">{skill.name}</h5>
                      <p className="text-[#00FF85] text-center text-2xl font-bold">{value}</p>
                    </GlassCard>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6">
          <GlassButton
            onClick={handleConfirm}
            disabled={!selectedCard || (isAttacker && !selectedSkill)}
            className="w-full"
          >
            Confirm Selection
          </GlassButton>
        </div>
      </GlassCard>
    </div>
  );
}
