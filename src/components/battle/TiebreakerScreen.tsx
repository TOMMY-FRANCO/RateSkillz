import { useState } from 'react';
import { Target, Zap } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { Battle, PlayerCard } from '../../lib/battleMode';

interface TiebreakerScreenProps {
  battle: Battle;
  myCards: PlayerCard[];
  eliminatedCards: string[];
  onComplete: () => void;
}

const SKILLS = [
  { code: 'PAC', name: 'Pace', color: 'from-green-500 to-emerald-500' },
  { code: 'SHO', name: 'Shooting', color: 'from-red-500 to-rose-500' },
  { code: 'PAS', name: 'Passing', color: 'from-blue-500 to-cyan-500' },
  { code: 'DRI', name: 'Dribbling', color: 'from-purple-500 to-pink-500' },
  { code: 'DEF', name: 'Defending', color: 'from-orange-500 to-amber-500' },
  { code: 'PHY', name: 'Physical', color: 'from-yellow-500 to-lime-500' },
];

export function TiebreakerScreen({
  battle,
  myCards,
  eliminatedCards,
  onComplete,
}: TiebreakerScreenProps) {
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  const availableCards = myCards.filter((card) => !eliminatedCards.includes(card.id));

  const getSkillValue = (card: PlayerCard, skillCode: string): number => {
    const skillMap: { [key: string]: number } = {
      PAC: card.pace,
      SHO: card.shooting,
      PAS: card.passing,
      DRI: card.dribbling,
      DEF: card.defending,
      PHY: card.physical,
    };
    return skillMap[skillCode] || 0;
  };

  const handleConfirm = async () => {
    if (selectedCard && selectedSkill) {
      onComplete();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <GlassCard className="p-8 text-center mb-6">
          <Target className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-4">Tiebreaker!</h1>
          <p className="text-white/70 text-lg">
            All skills have been used. Choose one card and one skill for the final showdown!
          </p>
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-2xl font-bold text-white mb-6">Select Your Card</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            {availableCards.map((card) => (
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
                  />
                  <h4 className="text-white font-bold text-sm text-center">{card.player_name}</h4>
                  <p className="text-[#00FF85] text-center text-xs">{card.overall_rating} OVR</p>
                </GlassCard>
              </div>
            ))}
          </div>

          {selectedCard && (
            <div>
              <h3 className="text-2xl font-bold text-white mb-6">Select Your Skill</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                {SKILLS.map((skill) => {
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

              <GlassButton
                onClick={handleConfirm}
                disabled={!selectedSkill}
                className="w-full"
                size="lg"
              >
                Confirm Tiebreaker Selection
              </GlassButton>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
