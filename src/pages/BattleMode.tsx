import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { checkManagerStatus, getUserCards, getAvailableChallenges, getUserBattles, Battle } from '../lib/battleMode';
import { ArrowLeft, Swords, Trophy, Clock, Users } from 'lucide-react';
import CardSelectionModal from '../components/battle/CardSelectionModal';
import BattleChallengesList from '../components/battle/BattleChallengesList';
import BattleHistoryList from '../components/battle/BattleHistoryList';
import BattleArena from '../components/battle/BattleArena';

export default function BattleMode() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'challenges' | 'my-battles' | 'create'>('challenges');
  const [userCards, setUserCards] = useState<any[]>([]);
  const [availableChallenges, setAvailableChallenges] = useState<Battle[]>([]);
  const [myBattles, setMyBattles] = useState<Battle[]>([]);
  const [showCardSelection, setShowCardSelection] = useState(false);
  const [activeBattle, setActiveBattle] = useState<Battle | null>(null);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    const managerStatus = await checkManagerStatus(user.id);

    if (!managerStatus) {
      navigate('/dashboard');
      return;
    }

    setIsManager(true);

    const [cards, challenges, battles] = await Promise.all([
      getUserCards(user.id),
      getAvailableChallenges(),
      getUserBattles(user.id),
    ]);

    setUserCards(cards);
    setAvailableChallenges(challenges);
    setMyBattles(battles);
    setLoading(false);
  };

  const handleCreateChallenge = () => {
    setShowCardSelection(true);
  };

  const handleBattleStart = (battle: Battle) => {
    setActiveBattle(battle);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading Battle Mode...</div>
      </div>
    );
  }

  if (!isManager) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Manager Status Required</h1>
          <p className="text-gray-400 mb-6">You need to own 5+ cards to become a manager and access Battle Mode.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-bold rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (activeBattle) {
    return <BattleArena battle={activeBattle} onExit={() => { setActiveBattle(null); loadData(); }} />;
  }

  return (
    <div className="min-h-screen bg-black">
      <nav className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="flex items-center space-x-2">
                <Swords className="w-8 h-8 text-red-500" />
                <h1 className="text-2xl font-bold text-white">Battle Mode</h1>
              </div>
            </div>
            <div className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg">
              <Trophy className="w-5 h-5 text-black" />
              <span className="text-black font-bold">Manager</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">How Battle Mode Works</h2>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-black font-bold">1</span>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Select 5 Cards</h3>
                <p className="text-gray-400">Choose 5 cards from your collection to form your battle team.</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">2</span>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Set Wager (50-200)</h3>
                <p className="text-gray-400">Decide how many coins you want to wager on the battle.</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">3</span>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Battle & Win</h3>
                <p className="text-gray-400">5 rounds of stat comparisons. Winner takes wager minus royalties.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex space-x-2 mb-6 border-b border-gray-800">
          <button
            onClick={() => setActiveTab('challenges')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'challenges'
                ? 'text-white border-b-2 border-green-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>Available Challenges ({availableChallenges.length})</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('my-battles')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'my-battles'
                ? 'text-white border-b-2 border-green-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5" />
              <span>My Battles ({myBattles.length})</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'create'
                ? 'text-white border-b-2 border-green-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Swords className="w-5 h-5" />
              <span>Create Challenge</span>
            </div>
          </button>
        </div>

        {activeTab === 'challenges' && (
          <BattleChallengesList
            challenges={availableChallenges}
            userCards={userCards}
            onRefresh={loadData}
            onBattleStart={handleBattleStart}
          />
        )}

        {activeTab === 'my-battles' && (
          <BattleHistoryList
            battles={myBattles}
            userId={user!.id}
            onRefresh={loadData}
            onBattleStart={handleBattleStart}
          />
        )}

        {activeTab === 'create' && (
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-8">
            <div className="text-center max-w-2xl mx-auto">
              <Swords className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-4">Create a Battle Challenge</h2>
              <p className="text-gray-400 mb-6">
                Select 5 cards from your collection and set your wager amount. Other managers will see your challenge and can accept it to battle.
              </p>
              <button
                onClick={handleCreateChallenge}
                className="px-8 py-4 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-bold rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all hover:scale-105 shadow-lg"
              >
                Select Cards & Create Challenge
              </button>
            </div>
          </div>
        )}
      </main>

      {showCardSelection && (
        <CardSelectionModal
          userCards={userCards}
          onClose={() => setShowCardSelection(false)}
          onSuccess={() => {
            setShowCardSelection(false);
            loadData();
            setActiveTab('my-battles');
          }}
        />
      )}
    </div>
  );
}
