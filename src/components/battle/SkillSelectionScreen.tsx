import { useState } from 'react';
import { Shield, AlertCircle } from 'lucide-react';
import { PlayerCard } from '../../lib/battleMode';
import { DefaultAvatar } from '../ui/DefaultAvatar';

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
  const usedSkillSet = new Set(usedSkills);

  if (isAttacker && usedSkillSet.size >= SKILLS.length) {
    return (
      <div className="glass-container p-6 flex flex-col items-center gap-3 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 shrink-0 animate-pulse" />
        <p className="text-white font-bold text-base">No Skills Remaining</p>
        <p className="text-[#B0B8C8] text-sm animate-pulse">Waiting for battle to resolve automatically...</p>
      </div>
    );
  }

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
    <div className="glass-container p-4 space-y-4">
      <div>
        <h3 className="text-base font-bold text-white">
          {isAttacker ? 'Attack — pick card & skill' : 'Defend — pick your card'}
        </h3>

        {!isAttacker && challengedSkill && (
          <div className="flex items-center gap-2.5 mt-3 p-3 bg-red-500/10 border border-red-500/25 rounded-xl">
            <Shield className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-[#B0B8C8] text-xs">
              Opponent challenges with{' '}
              <span className="text-red-400 font-semibold">{challengedSkill.name}</span>{' '}
              — pick the card with the highest value
            </p>
          </div>
        )}

        {isAttacker && (
          <p className="text-[#B0B8C8] text-xs mt-1">
            Choose a card, then pick the skill to challenge your opponent with
          </p>
        )}
      </div>

      {/* Horizontal scrollable card row */}
      <div className="overflow-x-auto pb-2 -mx-1 px-1">
        <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
          {availableCards.map((card) => {
            const defenseValue =
              !isAttacker && attackerSkill ? getSkillValue(card, attackerSkill) : null;
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
                  <DefaultAvatar size={56} className="rounded-full mb-2 border-2 border-[rgba(0,224,255,0.25)]" />
                )}
                <p className="text-white text-xs font-semibold text-center w-full truncate leading-tight">
                  {card.player_name}
                </p>
                <span className="mt-1.5 text-[10px] font-black text-black bg-gradient-to-r from-[#00FF85] to-[#00E0FF] px-2 py-0.5 rounded">
                  {card.overall_rating}
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

      {/* Skill picker — attacker only */}
      {isAttacker && (
        <div>
          <h4 className="text-xs font-bold text-[#B0B8C8] uppercase tracking-wide mb-2.5">
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
                  className={`flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-bold transition-all focus:outline-none ${
                    isUsed
                      ? 'border-white/10 bg-white/5 text-white/25 cursor-not-allowed'
                      : isSelected
                      ? 'bg-gradient-to-r from-[#00FF85] to-[#00E0FF] border-transparent text-black shadow-[0_0_10px_rgba(0,224,255,0.3)]'
                      : 'border-[rgba(0,224,255,0.2)] bg-[rgba(15,24,41,0.85)] text-[#B0B8C8] hover:border-[#00E0FF] hover:text-white'
                  }`}
                >
                  <span>{skill.code}</span>
                  {value !== null && !isUsed && (
                    <span className={`font-black ${isSelected ? 'text-black' : 'text-white/60'}`}>
                      {value}
                    </span>
                  )}
                  {isUsed && <span className="text-[10px] text-white/25">(used)</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={handleConfirm}
        disabled={!canConfirm}
        className={`w-full py-3 rounded-xl text-sm font-bold transition-all focus:outline-none ${
          canConfirm
            ? 'bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black hover:opacity-90 shadow-[0_0_16px_rgba(0,224,255,0.3)]'
            : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
        }`}
      >
        Confirm Selection
      </button>
    </div>
  );
}
