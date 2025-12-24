import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Battle, acceptBattleChallenge, BattleCard } from '../../lib/battleMode';

interface AcceptChallengeModalProps {
  challenge: Battle;
  userCards: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function AcceptChallengeModal({ challenge, userCards, onClose, onSuccess }: AcceptChallengeModalProps) {
  const { user } = useAuth();
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableCards = userCards.filter(card => !card.is_locked_in_battle);

  const toggleCard = (cardId: string) => {
    if (selectedCards.includes(cardId)) {
      setSelectedCards(selectedCards.filter(id => id !== cardId));
    } else if (selectedCards.length < 5) {
      setSelectedCards([...selectedCards, cardId]);
    }
  };

  const handleAccept = async () => {
    if (selectedCards.length !== 5) {
      setError('You must select exactly 5 cards');
      return;
    }

    setAccepting(true);
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

      await acceptBattleChallenge(challenge.id, user!.id, battleCards);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to accept challenge');
      setAccepting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Accept Battle Challenge</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-6 p-4 bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold mb-1">
                {challenge.manager1_profile?.full_name}'s Challenge
              </h3>
              <p className="text-gray-300 text-sm">
                Wager: {challenge.wager_amount} coins
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">
              Select Your 5 Cards: {selectedCards.length}/5
            </h3>
            {selectedCards.length === 5 && (
              <div className="flex items-center space-x-2 text-green-500">
                <Check className="w-5 h-5" />
                <span className="font-semibold">Team Complete</span>
              </div>
            )}
          </div>

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
            onClick={handleAccept}
            disabled={selectedCards.length !== 5 || accepting}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-bold rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {accepting ? 'Accepting...' : `Accept Challenge (${challenge.wager_amount} coins)`}
          </button>
        </div>
      </div>
    </div>
  );
}
