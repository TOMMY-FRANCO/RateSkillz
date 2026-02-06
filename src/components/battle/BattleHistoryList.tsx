import { Trophy, Clock, XCircle, Coins } from 'lucide-react';
import { Battle } from '../../lib/battleMode';

interface BattleHistoryListProps {
  battles: Battle[];
  userId: string;
  onRefresh: () => void;
  onBattleStart: (battle: Battle) => void;
}

export default function BattleHistoryList({ battles, userId, onBattleStart }: BattleHistoryListProps) {
  if (battles.length === 0) {
    return (
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
        <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">No Battles Yet</h3>
        <p className="text-gray-400">Create a challenge or accept one to start battling!</p>
      </div>
    );
  }

  const getStatusBadge = (battle: Battle) => {
    if (battle.status === 'waiting') {
      return (
        <div className="flex items-center space-x-2 px-3 py-1 bg-yellow-500/20 border border-yellow-500/50 rounded-full">
          <Clock className="w-4 h-4 text-yellow-500" />
          <span className="text-yellow-500 text-sm font-semibold">Waiting</span>
        </div>
      );
    }
    if (battle.status === 'active') {
      return (
        <div className="flex items-center space-x-2 px-3 py-1 bg-blue-500/20 border border-blue-500/50 rounded-full">
          <Clock className="w-4 h-4 text-blue-500 animate-pulse" />
          <span className="text-blue-500 text-sm font-semibold">Active</span>
        </div>
      );
    }
    if (battle.status === 'completed' && battle.winner_id === userId) {
      return (
        <div className="flex items-center space-x-2 px-3 py-1 bg-green-500/20 border border-green-500/50 rounded-full">
          <Trophy className="w-4 h-4 text-green-500" />
          <span className="text-green-500 text-sm font-semibold">Won</span>
        </div>
      );
    }
    if (battle.status === 'completed') {
      return (
        <div className="flex items-center space-x-2 px-3 py-1 bg-red-500/20 border border-red-500/50 rounded-full">
          <XCircle className="w-4 h-4 text-red-500" />
          <span className="text-red-500 text-sm font-semibold">Lost</span>
        </div>
      );
    }
    return (
      <div className="flex items-center space-x-2 px-3 py-1 bg-gray-500/20 border border-gray-500/50 rounded-full">
        <span className="text-gray-500 text-sm font-semibold capitalize">{battle.status}</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {battles.map((battle) => {
        const isWinner = battle.winner_id === userId;
        const canStart = battle.status === 'active';

        return (
          <div
            key={battle.id}
            className={`bg-gradient-to-br from-gray-900 to-gray-800 border rounded-xl p-6 ${
              isWinner ? 'border-green-500' : battle.status === 'completed' ? 'border-red-500' : 'border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-yellow-500" />
                <span className="text-white font-bold">{battle.wager_amount} coins</span>
              </div>
              {getStatusBadge(battle)}
            </div>

            {battle.status === 'completed' && (
              <div className="text-center mb-4">
                <div className="text-2xl font-bold text-white">
                  {battle.player1_remaining_cards} - {battle.player2_remaining_cards}
                </div>
                <p className="text-sm text-gray-400">Cards Remaining</p>
              </div>
            )}

            {canStart && (
              <button
                onClick={() => onBattleStart(battle)}
                className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-bold rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all"
              >
                Enter Battle
              </button>
            )}

            {battle.status === 'completed' && (
              <button
                onClick={() => onBattleStart(battle)}
                className="w-full px-6 py-3 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-all"
              >
                View Battle Results
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
