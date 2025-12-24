import { useState, useEffect } from 'react';
import { ArrowLeft, Trophy, Coins } from 'lucide-react';
import { Battle, executeBattle, resolveBattle, RoundResult } from '../../lib/battleMode';
import { useAuth } from '../../hooks/useAuth';
import PenaltyShotModal from './PenaltyShotModal';

interface BattleArenaProps {
  battle: Battle;
  onExit: () => void;
}

export default function BattleArena({ battle, onExit }: BattleArenaProps) {
  const { user } = useAuth();
  const [currentRound, setCurrentRound] = useState(0);
  const [rounds, setRounds] = useState<RoundResult[]>(battle.round_results || []);
  const [battling, setBattling] = useState(false);
  const [showPenaltyShot, setShowPenaltyShot] = useState(false);
  const [battleComplete, setBattleComplete] = useState(battle.status === 'completed');
  const [winner, setWinner] = useState<string | null>(battle.winner_id);

  const isManager1 = battle.manager1_id === user?.id;
  const manager1Score = rounds.filter(r => r.winner_manager_id === battle.manager1_id).length;
  const manager2Score = rounds.filter(r => r.winner_manager_id === battle.manager2_id).length;

  const startBattle = async () => {
    if (rounds.length > 0 || battle.status === 'completed') return;

    setBattling(true);

    try {
      const battleRounds = await executeBattle(battle.id);
      setRounds(battleRounds);

      for (let i = 0; i < battleRounds.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        setCurrentRound(i + 1);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      const m1Score = battleRounds.filter(r => r.winner_manager_id === battle.manager1_id).length;
      const m2Score = battleRounds.filter(r => r.winner_manager_id === battle.manager2_id).length;

      if (m1Score === m2Score) {
        setShowPenaltyShot(true);
      } else {
        const winnerId = m1Score > m2Score ? battle.manager1_id : battle.manager2_id!;
        await resolveBattle(battle.id, winnerId);
        setWinner(winnerId);
        setBattleComplete(true);
      }

      setBattling(false);
    } catch (error) {
      console.error('Battle error:', error);
      setBattling(false);
    }
  };

  const handlePenaltyShotComplete = async (winnerId: string) => {
    await resolveBattle(battle.id, winnerId);
    setWinner(winnerId);
    setShowPenaltyShot(false);
    setBattleComplete(true);
  };

  const isUserWinner = winner === user?.id;
  const royaltyPerCard = 5;
  const totalRoyalties = 5 * royaltyPerCard;
  const managerEarnings = battle.wager_amount - totalRoyalties;

  return (
    <div className="min-h-screen bg-black">
      <nav className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={onExit}
              disabled={battling}
              className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <ArrowLeft className="w-6 h-6" />
              <span>Back to Battle Mode</span>
            </button>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-yellow-500">
                <Coins className="w-5 h-5" />
                <span className="font-bold">{battle.wager_amount} coins</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!battling && rounds.length === 0 && !battleComplete && (
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">Battle Arena</h1>
            <p className="text-gray-400 mb-8">5 rounds of intense card battles await!</p>
            <button
              onClick={startBattle}
              className="px-12 py-4 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold text-xl rounded-lg hover:from-red-400 hover:to-orange-400 transition-all hover:scale-105 shadow-lg"
            >
              Start Battle
            </button>
          </div>
        )}

        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-8">
            <div className="text-center">
              <img
                src={battle.manager1_profile?.profile_picture_url || '/default-avatar.png'}
                alt={battle.manager1_profile?.full_name}
                className="w-24 h-24 rounded-full border-4 border-green-500 mb-2"
              />
              <h3 className="text-white font-bold">{battle.manager1_profile?.username}</h3>
              <div className="text-3xl font-bold text-green-500 mt-2">{manager1Score}</div>
            </div>

            <div className="text-4xl font-bold text-gray-600">VS</div>

            <div className="text-center">
              <img
                src={battle.manager2_profile?.profile_picture_url || '/default-avatar.png'}
                alt={battle.manager2_profile?.full_name}
                className="w-24 h-24 rounded-full border-4 border-blue-500 mb-2"
              />
              <h3 className="text-white font-bold">{battle.manager2_profile?.username}</h3>
              <div className="text-3xl font-bold text-blue-500 mt-2">{manager2Score}</div>
            </div>
          </div>
        </div>

        {rounds.length > 0 && (
          <div className="space-y-6">
            {rounds.map((round, idx) => (
              <div
                key={idx}
                className={`bg-gradient-to-br from-gray-900 to-gray-800 border-2 rounded-xl p-6 transition-all ${
                  idx < currentRound
                    ? round.winner_manager_id === battle.manager1_id
                      ? 'border-green-500'
                      : 'border-blue-500'
                    : 'border-gray-700 opacity-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-center flex-1">
                    <img
                      src={round.card1.player_profile_picture || '/default-avatar.png'}
                      alt={round.card1.player_full_name}
                      className="w-20 h-20 rounded-full mx-auto mb-2 border-2 border-green-500"
                    />
                    <h4 className="text-white font-bold">{round.card1.player_full_name}</h4>
                    <div className="text-2xl font-bold text-green-500 mt-2">
                      {round.card1_stat_value}
                    </div>
                  </div>

                  <div className="text-center px-6">
                    <div className="text-gray-400 text-sm mb-2">Round {round.round_number}</div>
                    <div className="px-4 py-2 bg-gray-700 rounded-lg">
                      <div className="text-white font-bold">{round.stat_used}</div>
                    </div>
                    {idx < currentRound && (
                      <div className="mt-2">
                        {round.winner_card_id === round.card1.id ? (
                          <div className="text-green-500 font-bold">Manager 1 Wins!</div>
                        ) : (
                          <div className="text-blue-500 font-bold">Manager 2 Wins!</div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="text-center flex-1">
                    <img
                      src={round.card2.player_profile_picture || '/default-avatar.png'}
                      alt={round.card2.player_full_name}
                      className="w-20 h-20 rounded-full mx-auto mb-2 border-2 border-blue-500"
                    />
                    <h4 className="text-white font-bold">{round.card2.player_full_name}</h4>
                    <div className="text-2xl font-bold text-blue-500 mt-2">
                      {round.card2_stat_value}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {battleComplete && (
          <div className="mt-12 bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-yellow-500 rounded-2xl p-8">
            <div className="text-center mb-6">
              <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-white mb-2">Battle Complete!</h2>
              <p className="text-2xl text-yellow-500 font-bold">
                {isUserWinner
                  ? 'You Won!'
                  : winner === battle.manager1_id
                  ? `${battle.manager1_profile?.username} Wins!`
                  : `${battle.manager2_profile?.username} Wins!`}
              </p>
            </div>

            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <h3 className="text-white font-bold mb-4 text-center">Earnings Breakdown</h3>
              <div className="space-y-2 text-gray-300">
                <div className="flex justify-between">
                  <span>Wager Amount:</span>
                  <span className="text-yellow-500 font-bold">{battle.wager_amount} coins</span>
                </div>
                <div className="flex justify-between">
                  <span>Royalties (5 cards × {royaltyPerCard} coins):</span>
                  <span className="text-red-400">-{totalRoyalties} coins</span>
                </div>
                <div className="border-t border-gray-700 pt-2 mt-2 flex justify-between">
                  <span className="font-bold">Manager Earnings:</span>
                  <span className="text-green-500 font-bold">+{managerEarnings} coins</span>
                </div>
              </div>
            </div>

            <button
              onClick={onExit}
              className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-bold rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all"
            >
              Return to Battle Mode
            </button>
          </div>
        )}
      </main>

      {showPenaltyShot && (
        <PenaltyShotModal
          battle={battle}
          onComplete={handlePenaltyShotComplete}
        />
      )}
    </div>
  );
}
