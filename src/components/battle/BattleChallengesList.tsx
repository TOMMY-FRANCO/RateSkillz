import { useState } from 'react';
import { Coins, User, Swords } from 'lucide-react';
import { Battle, acceptBattleChallenge, BattleCard } from '../../lib/battleMode';
import { useAuth } from '../../hooks/useAuth';
import { useCoinBalance } from '../../hooks/useCoinBalance';
import AcceptChallengeModal from './AcceptChallengeModal';

interface BattleChallengesListProps {
  challenges: Battle[];
  userCards: any[];
  onRefresh: () => void;
  onBattleStart: (battle: Battle) => void;
  isManager: boolean;
}

export default function BattleChallengesList({ challenges, userCards, onRefresh, onBattleStart, isManager }: BattleChallengesListProps) {
  const { user } = useAuth();
  const { balance } = useCoinBalance();
  const [selectedChallenge, setSelectedChallenge] = useState<Battle | null>(null);

  if (challenges.length === 0) {
    return (
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
        <Swords className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">No Challenges Available</h3>
        <p className="text-gray-400">Be the first to create a battle challenge!</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {challenges.map((challenge) => (
          <div
            key={challenge.id}
            className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-6 hover:border-green-500 transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <img
                  src={challenge.manager1_profile?.profile_picture_url || '/default-avatar.png'}
                  alt={challenge.manager1_profile?.full_name}
                  className="w-16 h-16 rounded-full border-2 border-green-500"
                />
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {challenge.manager1_profile?.full_name}
                  </h3>
                  <p className="text-gray-400">@{challenge.manager1_profile?.username}</p>
                </div>
              </div>

              <div className="text-right">
                <div className="flex items-center justify-end space-x-2 text-yellow-500 mb-1">
                  <Coins className="w-6 h-6" />
                  <span className="text-2xl font-bold">{challenge.wager_amount}</span>
                </div>
                <p className="text-sm text-gray-400">Wager Amount</p>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2 mb-4">
              {challenge.manager1_selected_cards.map((card: BattleCard, idx: number) => (
                <div key={idx} className="bg-gray-800 rounded-lg p-2 text-center border border-gray-700">
                  <img
                    src={card.player_profile_picture || '/default-avatar.png'}
                    alt={card.player_full_name}
                    className="w-12 h-12 rounded-full mx-auto mb-2"
                  />
                  <p className="text-white text-xs font-semibold truncate">
                    {card.player_full_name}
                  </p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setSelectedChallenge(challenge)}
              disabled={!isManager || balance < challenge.wager_amount}
              title={!isManager ? 'Collect 5 cards to become a manager and accept challenges' : balance < challenge.wager_amount ? 'Not enough coins' : ''}
              className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-bold rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!isManager
                ? 'Become a Manager to Accept'
                : balance < challenge.wager_amount
                ? 'Insufficient Balance'
                : 'Accept Challenge'}
            </button>
          </div>
        ))}
      </div>

      {selectedChallenge && (
        <AcceptChallengeModal
          challenge={selectedChallenge}
          userCards={userCards}
          onClose={() => setSelectedChallenge(null)}
          onSuccess={() => {
            setSelectedChallenge(null);
            onRefresh();
          }}
        />
      )}
    </>
  );
}
