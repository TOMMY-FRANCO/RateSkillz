import { useState } from 'react';
import { Target } from 'lucide-react';
import { Battle } from '../../lib/battleMode';
import { useAuth } from '../../hooks/useAuth';

interface PenaltyShotModalProps {
  battle: Battle;
  onComplete: (winnerId: string) => void;
}

export default function PenaltyShotModal({ battle, onComplete }: PenaltyShotModalProps) {
  const { user } = useAuth();
  const [userChoice, setUserChoice] = useState<'red' | 'black' | null>(null);
  const [opponentChoice, setOpponentChoice] = useState<'red' | 'black' | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const isManager1 = battle.manager1_id === user?.id;

  const handleSubmit = () => {
    if (!userChoice) return;

    setSubmitted(true);

    const cpuChoice = Math.random() > 0.5 ? 'red' : 'black';
    setOpponentChoice(cpuChoice);

    setTimeout(() => {
      if (userChoice === 'red' && cpuChoice === 'black') {
        setResult('win');
        onComplete(user!.id);
      } else if (userChoice === 'black' && cpuChoice === 'red') {
        setResult('lose');
        onComplete(isManager1 ? battle.manager2_id! : battle.manager1_id);
      } else {
        setResult('tie');
        setTimeout(() => {
          setUserChoice(null);
          setOpponentChoice(null);
          setSubmitted(false);
          setResult(null);
        }, 2000);
      }
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-yellow-500 rounded-2xl p-8 max-w-2xl w-full">
        <div className="text-center mb-8">
          <Target className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white mb-2">Penalty Shot!</h2>
          <p className="text-gray-400">The battle is tied! Choose your color. Red beats Black!</p>
        </div>

        {!submitted && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <button
                onClick={() => setUserChoice('red')}
                className={`p-8 rounded-xl border-4 transition-all ${
                  userChoice === 'red'
                    ? 'border-red-500 bg-red-500/20 scale-105'
                    : 'border-gray-700 bg-gray-800 hover:border-red-500 hover:bg-red-500/10'
                }`}
              >
                <div className="w-24 h-24 bg-red-500 rounded-full mx-auto mb-4"></div>
                <div className="text-2xl font-bold text-white">Red</div>
              </button>

              <button
                onClick={() => setUserChoice('black')}
                className={`p-8 rounded-xl border-4 transition-all ${
                  userChoice === 'black'
                    ? 'border-gray-500 bg-gray-500/20 scale-105'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-500 hover:bg-gray-500/10'
                }`}
              >
                <div className="w-24 h-24 bg-gray-900 border-4 border-white rounded-full mx-auto mb-4"></div>
                <div className="text-2xl font-bold text-white">Black</div>
              </button>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!userChoice}
              className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-bold text-xl rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {userChoice ? 'Shoot!' : 'Select a Color'}
            </button>
          </div>
        )}

        {submitted && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center">
                <h3 className="text-white font-bold mb-4">Your Choice</h3>
                <div className={`w-24 h-24 rounded-full mx-auto mb-2 ${
                  userChoice === 'red' ? 'bg-red-500' : 'bg-gray-900 border-4 border-white'
                }`}></div>
                <div className="text-xl font-bold text-white capitalize">{userChoice}</div>
              </div>

              <div className="text-center">
                <h3 className="text-white font-bold mb-4">Opponent's Choice</h3>
                {opponentChoice ? (
                  <>
                    <div className={`w-24 h-24 rounded-full mx-auto mb-2 ${
                      opponentChoice === 'red' ? 'bg-red-500' : 'bg-gray-900 border-4 border-white'
                    }`}></div>
                    <div className="text-xl font-bold text-white capitalize">{opponentChoice}</div>
                  </>
                ) : (
                  <div className="w-24 h-24 rounded-full mx-auto mb-2 bg-gray-700 animate-pulse"></div>
                )}
              </div>
            </div>

            {result && (
              <div className={`p-4 rounded-lg text-center text-xl font-bold ${
                result === 'win'
                  ? 'bg-green-500/20 border border-green-500 text-green-500'
                  : result === 'lose'
                  ? 'bg-red-500/20 border border-red-500 text-red-500'
                  : 'bg-yellow-500/20 border border-yellow-500 text-yellow-500'
              }`}>
                {result === 'win' && 'You Win!'}
                {result === 'lose' && 'You Lose!'}
                {result === 'tie' && 'Tie! Shooting Again...'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
