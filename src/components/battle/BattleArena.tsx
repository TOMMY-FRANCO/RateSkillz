import { useState, useEffect } from 'react';
import { Swords, Clock, Flag, Target } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { SkillSelectionScreen } from './SkillSelectionScreen';
import { TiebreakerScreen } from './TiebreakerScreen';
import { useAuth } from '../../hooks/useAuth';
import {
  Battle,
  PlayerCard,
  getPlayerCards,
  setFirstPlayer,
  makeBattleMove,
  processRoundResult,
  forfeitBattle,
  subscribeToBattle,
} from '../../lib/battleMode';

interface BattleArenaProps {
  battle: Battle;
  onComplete: () => void;
}

export function BattleArena({ battle: initialBattle, onComplete }: BattleArenaProps) {
  const { user } = useAuth();
  const [battle, setBattle] = useState<Battle>(initialBattle);
  const [myCards, setMyCards] = useState<PlayerCard[]>([]);
  const [opponentCards, setOpponentCards] = useState<PlayerCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [showFirstPlayerSelect, setShowFirstPlayerSelect] = useState(false);
  const [showSkillSelection, setShowSkillSelection] = useState(false);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [isAttacker, setIsAttacker] = useState(false);
  const [pendingAttack, setPendingAttack] = useState<any>(null);
  const [eliminatedCards, setEliminatedCards] = useState<string[]>([]);

  useEffect(() => {
    loadCards();
    const channel = subscribeToBattle(battle.id, (updatedBattle) => {
      setBattle(updatedBattle);
      checkBattleState(updatedBattle);
    });

    return () => {
      channel.unsubscribe();
    };
  }, [battle.id]);

  useEffect(() => {
    checkBattleState(battle);
  }, [battle, user]);

  useEffect(() => {
    if (!battle.turn_started_at || !isMyTurn || battle.status !== 'active') return;

    const interval = setInterval(() => {
      const turnStart = new Date(battle.turn_started_at!).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - turnStart) / 1000);
      const remaining = Math.max(0, 60 - elapsed);

      setTimeRemaining(remaining);

      if (remaining === 0) {
        handleForfeit();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [battle.turn_started_at, isMyTurn, battle.status]);

  const loadCards = async () => {
    if (!user) return;

    try {
      const cards = await getPlayerCards(user.id);
      setMyCards(cards);

      const opponentId = battle.manager1_id === user.id ? battle.manager2_id : battle.manager1_id;
      const oppCards = await getPlayerCards(opponentId);
      setOpponentCards(oppCards);
    } catch (error) {
      console.error('Error loading cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkBattleState = (currentBattle: Battle) => {
    if (!user) return;

    if (currentBattle.status === 'completed' || currentBattle.status === 'forfeited') {
      setTimeout(() => onComplete(), 2000);
      return;
    }

    if (!currentBattle.first_player_id) {
      setShowFirstPlayerSelect(true);
      return;
    }

    setShowFirstPlayerSelect(false);

    const myTurn = currentBattle.current_turn_user_id === user.id;
    setIsMyTurn(myTurn);

    if (myTurn) {
      const cardSelections = currentBattle.card_selections || [];
      const lastMove = cardSelections[cardSelections.length - 1];

      if (!lastMove || lastMove.user_id !== user.id) {
        const attacking = !lastMove || lastMove.defender_wins === false;
        setIsAttacker(attacking);
        setShowSkillSelection(true);
      } else {
        if (lastMove.is_attacker) {
          setPendingAttack(lastMove);
          setShowSkillSelection(false);
        }
      }
    } else {
      setShowSkillSelection(false);
    }
  };

  const handleSelectFirstPlayer = async (playerId: string) => {
    try {
      await setFirstPlayer(battle.id, playerId);
    } catch (error) {
      console.error('Error setting first player:', error);
    }
  };

  const handleSkillSelection = async (cardId: string, skill?: string) => {
    if (!user) return;

    try {
      const move = await makeBattleMove(battle.id, user.id, cardId, skill || '', isAttacker);

      if (isAttacker) {
        setPendingAttack(move);
        setShowSkillSelection(false);
      } else {
        const attackMove = pendingAttack || battle.card_selections[battle.card_selections.length - 1];
        await processRoundResult(battle.id, attackMove, move);
        setPendingAttack(null);
      }
    } catch (error) {
      console.error('Error making move:', error);
      alert('Failed to make move');
    }
  };

  const handleForfeit = async () => {
    if (!user) return;

    if (confirm('Are you sure you want to forfeit? You will lose all wagered coins.')) {
      try {
        await forfeitBattle(battle.id, user.id);
      } catch (error) {
        console.error('Error forfeiting:', error);
        alert('Failed to forfeit battle');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00FF85]"></div>
      </div>
    );
  }

  if (battle.is_tiebreaker) {
    return (
      <TiebreakerScreen
        battle={battle}
        myCards={myCards}
        eliminatedCards={eliminatedCards}
        onComplete={onComplete}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <GlassCard className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Swords className="w-8 h-8 text-red-500" />
              <h1 className="text-3xl font-bold text-white">Battle Arena</h1>
            </div>
            <div className="flex items-center gap-4">
              {isMyTurn && (
                <div className="flex items-center gap-2 text-yellow-500">
                  <Clock className="w-5 h-5" />
                  <span className="text-2xl font-bold">{timeRemaining}s</span>
                </div>
              )}
              <GlassButton onClick={handleForfeit} variant="outline" size="sm">
                <Flag className="w-4 h-4 mr-2" />
                Forfeit
              </GlassButton>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-white/60 text-sm mb-1">Your Cards</p>
              <p className="text-3xl font-bold text-[#00FF85]">
                {battle.manager1_id === user?.id
                  ? battle.player1_remaining_cards
                  : battle.player2_remaining_cards}
              </p>
            </div>
            <div>
              <p className="text-white/60 text-sm mb-1">Wager</p>
              <p className="text-3xl font-bold text-yellow-500">{battle.wager_amount}</p>
            </div>
            <div>
              <p className="text-white/60 text-sm mb-1">Opponent Cards</p>
              <p className="text-3xl font-bold text-red-500">
                {battle.manager1_id === user?.id
                  ? battle.player2_remaining_cards
                  : battle.player1_remaining_cards}
              </p>
            </div>
          </div>
        </GlassCard>

        {showFirstPlayerSelect && (
          <GlassCard className="p-6 mb-6">
            <h3 className="text-2xl font-bold text-white mb-4 text-center">
              Press the button to go first!
            </h3>
            <div className="flex gap-4 justify-center">
              <GlassButton onClick={() => handleSelectFirstPlayer(user!.id)}>
                I'll Go First!
              </GlassButton>
            </div>
          </GlassCard>
        )}

        {!showFirstPlayerSelect && !isMyTurn && (
          <GlassCard className="p-6 mb-6 text-center">
            <Target className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white">Opponent's Turn</h3>
            <p className="text-white/70 mt-2">Waiting for opponent to make their move...</p>
          </GlassCard>
        )}

        {isMyTurn && showSkillSelection && (
          <SkillSelectionScreen
            cards={myCards}
            usedSkills={battle.used_skills}
            isAttacker={isAttacker}
            onSelect={handleSkillSelection}
            eliminatedCards={eliminatedCards}
          />
        )}

        {pendingAttack && !isMyTurn && (
          <GlassCard className="p-6">
            <h3 className="text-xl font-bold text-white mb-4">Your Attack</h3>
            <p className="text-white/70">
              Waiting for opponent to defend against your {pendingAttack.skill} challenge...
            </p>
          </GlassCard>
        )}

        <GlassCard className="p-6 mt-6">
          <h3 className="text-xl font-bold text-white mb-4">Skills Used</h3>
          <div className="flex gap-2 flex-wrap">
            {battle.used_skills.map((skill) => (
              <div
                key={skill}
                className="px-3 py-1 bg-red-500/20 border border-red-500 rounded-full text-red-500 text-sm"
              >
                {skill}
              </div>
            ))}
            {battle.used_skills.length === 0 && (
              <p className="text-white/50">No skills used yet</p>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
