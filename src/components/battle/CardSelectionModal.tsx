import { useState } from 'react';
import { X, Check, Lock, Coins } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { createBattleChallenge, BattleCard } from '../../lib/battleMode';
import { useCoinBalance } from '../../hooks/useCoinBalance';

interface CardSelectionModalProps {
  userCards: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function CardSelectionModal({ userCards, onClose, onSuccess }: CardSelectionModalProps) {
  const { user } = useAuth();
  const { balance } = useCoinBalance();
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [wagerAmount, setWagerAmount] = useState<number>(50);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableCards = userCards.filter(card => !card.is_locked_in_battle);

  const toggleCard = (cardId: string) => {
    if (selectedCards.includes(cardId)) {
      setSelectedCards(selectedCards.filter(id => id !== cardId));
    } else if (selectedCards.length < 5) {
      setSelectedCards([...selectedCards, cardId]);
    }
  };

  const handleCreateChallenge = async () => {
    if (selectedCards.length !== 5) {
      setError('You must select exactly 5 cards');
      return;
    }

    if (wagerAmount < 50 || wagerAmount > 200) {
      setError('Wager must be between 50 and 200 coins');
      return;
    }

    if (balance < wagerAmount) {
      setError('Insufficient balance for wager');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const battleCards: BattleCard[] = selectedCards.map(cardId => {
        const card = userCards.find(c => c.id === cardId);
        const profile = card.profiles;

        return {
          id: card.id,
          card_user_id: card.card_user_id,
          player_username: profile.username,
          player_full_name: profile.full_name,
          player_profile_picture: profile.profile_picture_url,
          stats: {
            PAC: profile.pace || 50,
            SHO: profile.shooting || 50,
            PAS: profile.passing || 50,
            DRI: profile.dribbling || 50,
            DEF: profile.defending || 50,
            PHY: profile.physical || 50,
          },
        };
      });

      await createBattleChallenge(user!.id, battleCards, wagerAmount);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create challenge');
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Select Your Battle Team</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <label className="text-white font-semibold mb-2 block">Wager Amount</label>
              <p className="text-sm text-gray-400">Set your wager (50-200 coins)</p>
            </div>
            <div className="flex items-center space-x-2">
              <Coins className="w-5 h-5 text-yellow-500" />
              <span className="text-gray-400">Balance: {balance.toFixed(2)}</span>
            </div>
          </div>
          <input
            type="number"
            min="50"
            max="200"
            step="10"
            value={wagerAmount}
            onChange={(e) => setWagerAmount(Math.min(200, Math.max(50, parseInt(e.target.value) || 50)))}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white text-lg font-bold focus:outline-none focus:border-green-500"
          />
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">
              Selected: {selectedCards.length}/5 Cards
            </h3>
            {selectedCards.length === 5 && (
              <div className="flex items-center space-x-2 text-green-500">
                <Check className="w-5 h-5" />
                <span className="font-semibold">Team Complete</span>
              </div>
            )}
          </div>

          {availableCards.length === 0 && (
            <div className="text-center py-12">
              <Lock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">All your cards are currently locked in battles</p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {availableCards.map((card) => {
              const isSelected = selectedCards.includes(card.id);
              const profile = card.profiles;

              return (
                <button
                  key={card.id}
                  onClick={() => toggleCard(card.id)}
                  disabled={!isSelected && selectedCards.length >= 5}
                  className={`relative p-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-green-500 bg-green-500/10'
                      : selectedCards.length >= 5
                      ? 'border-gray-700 bg-gray-800 opacity-50 cursor-not-allowed'
                      : 'border-gray-700 bg-gray-800 hover:border-green-500 hover:bg-green-500/5'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}

                  <img
                    src={profile.profile_picture_url || '/default-avatar.png'}
                    alt={profile.full_name}
                    className="w-20 h-20 rounded-full mx-auto mb-3 border-2 border-gray-600"
                  />

                  <h4 className="text-white font-semibold text-sm text-center mb-2">
                    {profile.full_name}
                  </h4>

                  <div className="grid grid-cols-3 gap-1 text-xs">
                    <div className="text-center">
                      <div className="text-gray-400">PAC</div>
                      <div className="text-white font-bold">{profile.pace || 50}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-400">SHO</div>
                      <div className="text-white font-bold">{profile.shooting || 50}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-400">DRI</div>
                      <div className="text-white font-bold">{profile.dribbling || 50}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        <div className="flex space-x-4">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateChallenge}
            disabled={selectedCards.length !== 5 || creating || balance < wagerAmount}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-bold rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating Challenge...' : `Create Challenge (${wagerAmount} coins)`}
          </button>
        </div>
      </div>
    </div>
  );
}
