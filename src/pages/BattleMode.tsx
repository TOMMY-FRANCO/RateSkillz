import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords, Trophy, Coins, Clock, ArrowLeft } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { GlassButton } from '../components/ui/GlassButton';
import { ShimmerBar, StaggerItem, SlowLoadMessage } from '../components/ui/Shimmer';
import { BattleArena } from '../components/battle/BattleArena';
import { useAuth } from '../hooks/useAuth';
import {
  Battle,
  getUserBattles,
  checkManagerStatus,
  createBattleChallenge,
  acceptBattleChallenge,
} from '../lib/battleMode';
import { supabase } from '../lib/supabase';

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
  const [managers, setManagers] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      loadData();
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate('/dashboard')}
            className="mb-6 flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          <GlassCard className="p-8 text-center">
            <Swords className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Manager Status Required</h2>
            <p className="text-white/70 mb-6">
              You must be a manager (own 5 or more cards) to participate in Battle Mode.
            </p>
            <GlassButton onClick={() => navigate('/shop')} className="mx-auto">
              Go to Shop
            </GlassButton>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-6 flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
              <Swords className="w-10 h-10 text-red-500" />
              Battle Mode
            </h1>
            <p className="text-white/60">Skill-based card battles</p>
          </div>
          <GlassButton onClick={() => setShowCreateChallenge(true)}>
            Create Challenge
          </GlassButton>
        </div>

        {showCreateChallenge && (
          <GlassCard className="p-6 mb-6">
            <h3 className="text-xl font-bold text-white mb-4">Create Battle Challenge</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-white/70 mb-2">Select Opponent</label>
                <select
                  value={opponentId}
                  onChange={(e) => setOpponentId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                >
                  <option value="">Choose a manager...</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.username}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-white/70 mb-2">Wager Amount (50-200 coins)</label>
                <input
                  type="number"
                  min="50"
                  max="200"
                  value={wagerAmount}
                  onChange={(e) => setWagerAmount(Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                />
              </div>
              <div className="flex gap-3">
                <GlassButton onClick={handleCreateChallenge} disabled={!opponentId}>
                  Create Challenge
                </GlassButton>
                <GlassButton onClick={() => setShowCreateChallenge(false)} variant="outline">
                  Cancel
                </GlassButton>
              </div>
            </div>
          </GlassCard>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <GlassCard className="p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              Pending Challenges
            </h3>
            <div className="space-y-3">
              {battles.filter((b) => b.status === 'waiting').length === 0 ? (
                <p className="text-white/50 text-center py-4">No pending challenges</p>
              ) : (
                battles
                  .filter((b) => b.status === 'waiting')
                  .map((battle) => (
                    <div
                      key={battle.id}
                      className="bg-white/5 border border-white/10 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Coins className="w-4 h-4 text-yellow-500" />
                          <span className="text-white font-semibold">{battle.wager_amount} coins</span>
                        </div>
                        {battle.manager2_id === user?.id && (
                          <GlassButton
                            onClick={() => handleAcceptChallenge(battle.id)}
                            size="sm"
                          >
                            Accept
                          </GlassButton>
                        )}
                      </div>
                      <p className="text-white/60 text-sm">
                        {battle.manager1_id === user?.id ? 'Challenge sent' : 'Challenge received'}
                      </p>
                    </div>
                  ))
              )}
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Battle History
            </h3>
            <div className="space-y-3">
              {battles.filter((b) => b.status === 'completed' || b.status === 'forfeited').length === 0 ? (
                <p className="text-white/50 text-center py-4">No battle history</p>
              ) : (
                battles
                  .filter((b) => b.status === 'completed' || b.status === 'forfeited')
                  .slice(0, 5)
                  .map((battle) => {
                    const isWinner = battle.winner_id === user?.id;
                    return (
                      <div
                        key={battle.id}
                        className="bg-white/5 border border-white/10 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Trophy
                              className={`w-4 h-4 ${isWinner ? 'text-yellow-500' : 'text-red-500'}`}
                            />
                            <span className={`font-semibold ${isWinner ? 'text-green-500' : 'text-red-500'}`}>
                              {isWinner ? 'Victory' : 'Defeat'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Coins className="w-4 h-4 text-yellow-500" />
                            <span className="text-white">{battle.wager_amount} coins</span>
                          </div>
                        </div>
                        <p className="text-white/60 text-sm mt-2">
                          {new Date(battle.completed_at || '').toLocaleDateString()}
                        </p>
                      </div>
                    );
                  })
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
