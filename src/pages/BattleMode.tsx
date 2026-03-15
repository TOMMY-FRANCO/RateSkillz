import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords, Trophy, Coins, Clock, ArrowLeft } from 'lucide-react';
import { ShimmerBar, StaggerItem, SlowLoadMessage } from '../components/ui/Shimmer';
import { BattleArena } from '../components/battle/BattleArena';
import { useAuth } from '../contexts/AuthContext';
import {
  Battle,
  getUserBattles,
  checkManagerStatus,
  createBattleChallenge,
  acceptBattleChallenge,
} from '../lib/battleMode';
import { supabase } from '../lib/supabase';
import { markNotificationsRead } from '../lib/notifications';

const selectClass = `w-full px-3 py-2.5 rounded-lg text-sm font-semibold
  bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)]
  text-white focus:outline-none focus:border-[#00E0FF]
  appearance-none cursor-pointer transition-colors
  hover:border-[rgba(0,224,255,0.5)]`;

export default function BattleMode() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [battles, setBattles] = useState<Battle[]>([]);
  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeBattle, setActiveBattle] = useState<Battle | null>(null);
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);
  const [opponentId, setOpponentId] = useState('');
  const [wagerAmount, setWagerAmount] = useState(50);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [managers, setManagers] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      loadData();
      markNotificationsRead(user.id, 'battle_request');
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const managerStatus = await checkManagerStatus(user.id);
      setIsManager(managerStatus);

      const userBattles = await getUserBattles(user.id);
      setBattles(userBattles);

      const activeBattleData = userBattles.find(
        (b) => b.status === 'active' && (b.manager1_id === user.id || b.manager2_id === user.id)
      );
      if (activeBattleData) {
        setActiveBattle(activeBattleData);
      }

      const { data: managersData } = await supabase
        .from('searchable_users_cache')
        .select('user_id, username')
        .neq('user_id', user.id);

      setManagers((managersData || []).map((m: any) => ({ id: m.user_id, username: m.username })));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChallenge = async () => {
    if (!user || !opponentId) return;

    try {
      setCheckingBalance(true);
      const { data: profile, error: balanceError } = await supabase
        .from('profiles')
        .select('coin_balance')
        .eq('id', user.id)
        .maybeSingle();

      if (balanceError || !profile) {
        alert('Failed to verify coin balance. Please try again.');
        return;
      }

      if (profile.coin_balance < wagerAmount) {
        alert(`Insufficient coins. You need ${wagerAmount} coins to place this wager.`);
        return;
      }

      setCheckingBalance(false);
      const result = await createBattleChallenge(user.id, opponentId, wagerAmount);
      if (result.success) {
        alert('Challenge created successfully!');
        setShowCreateChallenge(false);
        loadData();
      } else {
        alert(result.error || 'Failed to create challenge');
      }
    } catch (error) {
      console.error('Error creating challenge:', error);
      alert('Failed to create challenge');
    } finally {
      setCheckingBalance(false);
    }
  };

  const handleAcceptChallenge = async (battleId: string) => {
    if (!user) return;

    try {
      const result = await acceptBattleChallenge(battleId, user.id);
      if (result.success) {
        loadData();
      } else {
        alert(result.error || 'Failed to accept challenge');
      }
    } catch (error) {
      console.error('Error accepting challenge:', error);
      alert('Failed to accept challenge');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-5">
          <StaggerItem index={0}>
            <ShimmerBar className="h-8 w-48 rounded-lg" />
          </StaggerItem>
          <StaggerItem index={1} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ShimmerBar className="h-40 rounded-2xl" />
            <ShimmerBar className="h-40 rounded-2xl" />
          </StaggerItem>
          <StaggerItem index={2}>
            <ShimmerBar className="h-12 w-full rounded-xl" speed="slow" />
          </StaggerItem>
          <StaggerItem index={3} className="space-y-3">
            {[0, 1, 2].map((i) => (
              <ShimmerBar key={i} className="h-20 rounded-xl" speed="slow" />
            ))}
          </StaggerItem>
          <SlowLoadMessage loading={true} message="Loading battle arena..." />
        </div>
      </div>
    );
  }

  if (activeBattle) {
    return <BattleArena battle={activeBattle} onComplete={() => {
      setActiveBattle(null);
      loadData();
    }} />;
  }

  if (!isManager) {
    return (
      <div className="min-h-screen">
        <nav className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 h-16">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-[#B0B8C8] hover:text-[#00E0FF] transition-colors"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Swords className="w-5 h-5 text-red-400" />
                Battle Mode
              </h1>
            </div>
          </div>
        </nav>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28">
          <div className="glass-container p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 mb-4 mx-auto">
              <Swords className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Manager Status Required</h2>
            <p className="text-[#B0B8C8] mb-6">
              You must be a manager (own 5 or more cards) to participate in Battle Mode.
            </p>
            <button
              onClick={() => navigate('/shop')}
              className="bg-gradient-to-r from-[#00E0FF] to-[#38BDF8] text-black font-bold px-6 py-2.5 rounded-lg text-sm hover:opacity-90 transition-all shadow-[0_0_12px_rgba(0,224,255,0.35)]"
            >
              Go to Shop
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <nav className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-[#B0B8C8] hover:text-[#00E0FF] transition-colors"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Swords className="w-5 h-5 text-red-400" />
                Battle Mode
              </h1>
            </div>
            <button
              onClick={() => setShowCreateChallenge(true)}
              className="bg-gradient-to-r from-[#00E0FF] to-[#38BDF8] text-black font-bold px-4 py-2 rounded-lg text-sm hover:opacity-90 transition-all shadow-[0_0_12px_rgba(0,224,255,0.35)] flex items-center gap-2"
            >
              <Swords className="w-4 h-4" />
              Create Challenge
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-5">

        {showCreateChallenge && (
          <div className="glass-container p-4 space-y-4">
            <h3 className="text-base font-bold text-white">Create Battle Challenge</h3>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#B0B8C8]">Select Opponent</label>
              <div className="relative">
                <select
                  value={opponentId}
                  onChange={(e) => setOpponentId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Choose a manager...</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.username}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                  <svg className="w-3.5 h-3.5 text-[#B0B8C8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#B0B8C8]">Wager Amount (50–150 coins)</label>
              <div className="flex flex-wrap gap-2">
                {[50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setWagerAmount(amount)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                      wagerAmount === amount
                        ? 'bg-gradient-to-r from-[#00E0FF] to-[#38BDF8] text-black shadow-[0_0_12px_rgba(0,224,255,0.35)]'
                        : 'bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] text-[#B0B8C8] hover:border-[#00E0FF] hover:text-white'
                    }`}
                  >
                    {amount}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCreateChallenge}
                disabled={!opponentId || checkingBalance}
                className="bg-gradient-to-r from-[#00E0FF] to-[#38BDF8] text-black font-bold px-5 py-2.5 rounded-lg text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_12px_rgba(0,224,255,0.35)]"
              >
                {checkingBalance ? 'Checking...' : 'Create Challenge'}
              </button>
              <button
                onClick={() => setShowCreateChallenge(false)}
                className="px-5 py-2.5 rounded-lg text-sm font-bold bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] text-[#B0B8C8] hover:border-[#00E0FF] hover:text-white transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-5">
          <div className="glass-card p-4">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-400" />
              Pending Challenges
            </h3>
            <div className="space-y-3">
              {battles.filter((b) => b.status === 'waiting').length === 0 ? (
                <p className="text-[#B0B8C8]/50 text-center py-4 text-sm">No pending challenges</p>
              ) : (
                battles
                  .filter((b) => b.status === 'waiting')
                  .map((battle) => (
                    <div
                      key={battle.id}
                      className="bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.12)] rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Coins className="w-4 h-4 text-yellow-400" />
                          <span className="text-white font-bold text-sm">{battle.wager_amount} coins</span>
                        </div>
                        {battle.manager2_id === user?.id && (
                          <button
                            onClick={() => handleAcceptChallenge(battle.id)}
                            className="bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black font-bold px-3 py-1.5 rounded-lg text-xs hover:opacity-90 transition-all"
                          >
                            Accept
                          </button>
                        )}
                      </div>
                      <p className="text-[#B0B8C8] text-xs">
                        {battle.manager1_id === user?.id ? 'Challenge sent' : 'Challenge received'}
                      </p>
                    </div>
                  ))
              )}
            </div>
          </div>

          <div className="glass-card p-4">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              Battle History
            </h3>
            <div className="space-y-3">
              {battles.filter((b) => b.status === 'completed' || b.status === 'forfeited').length === 0 ? (
                <p className="text-[#B0B8C8]/50 text-center py-4 text-sm">No battle history</p>
              ) : (
                battles
                  .filter((b) => b.status === 'completed' || b.status === 'forfeited')
                  .slice(0, 5)
                  .map((battle) => {
                    const isWinner = battle.winner_id === user?.id;
                    return (
                      <div
                        key={battle.id}
                        className="bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.12)] rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Trophy
                              className={`w-4 h-4 ${isWinner ? 'text-yellow-400' : 'text-red-400'}`}
                            />
                            <span className={`font-bold text-sm ${isWinner ? 'text-[#00FF85]' : 'text-red-400'}`}>
                              {isWinner ? 'Victory' : 'Defeat'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Coins className="w-3.5 h-3.5 text-yellow-400" />
                            <span className="text-white text-sm">{battle.wager_amount} coins</span>
                          </div>
                        </div>
                        <p className="text-[#B0B8C8]/60 text-xs mt-1.5">
                          {new Date(battle.completed_at || '').toLocaleDateString()}
                        </p>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
