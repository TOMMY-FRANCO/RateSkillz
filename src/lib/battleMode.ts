import { supabase } from './supabase';

export interface Battle {
  id: string;
  manager1_id: string;
  manager2_id: string;
  wager_amount: number;
  status: 'waiting' | 'active' | 'completed' | 'forfeited';
  created_at: string;
  completed_at: string | null;
  winner_id: string | null;
  current_turn_user_id: string | null;
  turn_started_at: string | null;
  first_player_id: string | null;
  card_selections: any[];
  used_skills: string[];
  player1_remaining_cards: number;
  player2_remaining_cards: number;
  is_tiebreaker: boolean;
}

export interface BattleMove {
  round: number;
  attacker_id: string;
  defender_id: string;
  attacker_card_id: string;
  defender_card_id: string;
  skill_used: string;
  attacker_value: number;
  defender_value: number;
  winner_id: string;
  card_eliminated_id: string | null;
}

export interface PlayerCard {
  id: string;
  card_user_id: string;
  owner_id: string;
  player_name: string;
  overall_rating: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  image_url: string;
  avatar_url: string;
  username: string;
}

export async function checkManagerStatus(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('check_manager_status', { p_user_id: userId });

  if (error) {
    console.error('Error checking manager status:', error);
    return false;
  }

  return data === true;
}

export async function createBattleChallenge(
  challengerId: string,
  opponentId: string,
  wagerAmount: number
) {
  const { data, error } = await supabase.rpc('create_battle_challenge', {
    p_challenger_id: challengerId,
    p_opponent_id: opponentId,
    p_wager_amount: wagerAmount,
  });

  if (error) throw error;
  return data;
}

export async function acceptBattleChallenge(battleId: string, accepterId: string) {
  const { data, error } = await supabase.rpc('accept_battle_challenge', {
    p_battle_id: battleId,
    p_accepter_id: accepterId,
  });

  if (error) throw error;
  return data;
}

export async function setFirstPlayer(battleId: string, firstPlayerId: string) {
  const { error } = await supabase
    .from('battles')
    .update({
      first_player_id: firstPlayerId,
      current_turn_user_id: firstPlayerId,
      turn_started_at: new Date().toISOString(),
    })
    .eq('id', battleId);

  if (error) throw error;
}

export async function makeBattleMove(
  battleId: string,
  userId: string,
  cardId: string,
  skill: string,
  isAttacker: boolean
) {
  const { data: battle, error: fetchError } = await supabase
    .from('battles')
    .select('*')
    .eq('id', battleId)
    .single();

  if (fetchError) throw fetchError;

  const { data: cardData, error: cardError } = await supabase
    .from('card_ownership')
    .select(`
      id,
      card_user_id,
      user_stats!inner (
        pac,
        sho,
        pas,
        dri,
        def,
        phy
      )
    `)
    .eq('id', cardId)
    .single();

  if (cardError) throw cardError;

  const skillValues: { [key: string]: number } = {
    PAC: cardData.user_stats?.pac || 50,
    SHO: cardData.user_stats?.sho || 50,
    PAS: cardData.user_stats?.pas || 50,
    DRI: cardData.user_stats?.dri || 50,
    DEF: cardData.user_stats?.def || 50,
    PHY: cardData.user_stats?.phy || 50,
  };

  const cardSelections = battle.card_selections || [];
  const newMove: any = {
    round: cardSelections.length + 1,
    user_id: userId,
    card_id: cardId,
    skill: skill,
    skill_value: skillValues[skill],
    is_attacker: isAttacker,
    timestamp: new Date().toISOString(),
  };

  cardSelections.push(newMove);

  const { error: updateError } = await supabase
    .from('battles')
    .update({
      card_selections: cardSelections,
    })
    .eq('id', battleId);

  if (updateError) throw updateError;

  return newMove;
}

export async function processRoundResult(
  battleId: string,
  attackerMove: any,
  defenderMove: any
) {
  const { data: battle, error: fetchError } = await supabase
    .from('battles')
    .select('*')
    .eq('id', battleId)
    .single();

  if (fetchError) throw fetchError;

  const defenderWins = defenderMove.skill_value > attackerMove.skill_value;
  const usedSkills = battle.used_skills || [];
  usedSkills.push(attackerMove.skill);

  let nextTurnUserId: string;
  let player1Remaining = battle.player1_remaining_cards;
  let player2Remaining = battle.player2_remaining_cards;
  let cardEliminated: string | null = null;

  if (defenderWins) {
    nextTurnUserId = defenderMove.user_id;
  } else {
    if (defenderMove.user_id === battle.manager1_id) {
      player1Remaining--;
    } else {
      player2Remaining--;
    }
    cardEliminated = defenderMove.card_id;
    nextTurnUserId = defenderMove.user_id;
  }

  const cardSelections = battle.card_selections || [];
  const lastRound = cardSelections[cardSelections.length - 1];
  if (lastRound) {
    lastRound.defender_wins = defenderWins;
    lastRound.card_eliminated = cardEliminated;
  }

  const updates: any = {
    card_selections: cardSelections,
    used_skills: usedSkills,
    current_turn_user_id: nextTurnUserId,
    turn_started_at: new Date().toISOString(),
    player1_remaining_cards: player1Remaining,
    player2_remaining_cards: player2Remaining,
  };

  if (player1Remaining === 0 || player2Remaining === 0) {
    const winnerId = player1Remaining > 0 ? battle.manager1_id : battle.manager2_id;
    updates.status = 'completed';
    updates.winner_id = winnerId;
    updates.completed_at = new Date().toISOString();
    await distributeBattleWinnings(battleId, winnerId, battle.wager_amount);
  } else if (usedSkills.length === 6) {
    updates.is_tiebreaker = true;
  }

  const { error: updateError } = await supabase
    .from('battles')
    .update(updates)
    .eq('id', battleId);

  if (updateError) throw updateError;
}

export async function forfeitBattle(battleId: string, userId: string) {
  const { data: battle, error: fetchError } = await supabase
    .from('battles')
    .select('*')
    .eq('id', battleId)
    .single();

  if (fetchError) throw fetchError;

  const winnerId = userId === battle.manager1_id ? battle.manager2_id : battle.manager1_id;

  const { error: updateError } = await supabase
    .from('battles')
    .update({
      status: 'forfeited',
      winner_id: winnerId,
      completed_at: new Date().toISOString(),
    })
    .eq('id', battleId);

  if (updateError) throw updateError;

  await distributeBattleWinnings(battleId, winnerId, battle.wager_amount);
}

async function distributeBattleWinnings(battleId: string, winnerId: string, wagerAmount: number) {
  const { data: battle } = await supabase
    .from('battles')
    .select('manager1_id, manager2_id')
    .eq('id', battleId)
    .single();

  if (!battle) return;

  const loserId = winnerId === battle.manager1_id ? battle.manager2_id : battle.manager1_id;

  const { data: winnerCards } = await supabase
    .from('card_ownership')
    .select('id, original_owner_id')
    .eq('owner_id', winnerId)
    .limit(5);

  const { data: loserCards } = await supabase
    .from('card_ownership')
    .select('id, original_owner_id')
    .eq('owner_id', loserId)
    .limit(5);

  const allCards = [...(winnerCards || []), ...(loserCards || [])];
  const totalRoyalties = allCards.length * 5;

  for (const card of allCards) {
    await supabase.from('battle_royalties').insert({
      battle_id: battleId,
      card_id: card.id,
      owner_id: card.original_owner_id,
      amount: 5,
    });

    await supabase.from('coin_transactions').insert({
      user_id: card.original_owner_id,
      amount: 5,
      transaction_type: 'battle_royalty',
      description: `Battle royalty from card in match`,
    });
  }

  const winnerPayout = wagerAmount - totalRoyalties;

  await supabase.from('coin_transactions').insert([
    {
      user_id: winnerId,
      amount: winnerPayout,
      transaction_type: 'battle_win',
      description: `Won battle (${wagerAmount} - ${totalRoyalties} royalties)`,
    },
    {
      user_id: loserId,
      amount: -wagerAmount,
      transaction_type: 'battle_loss',
      description: `Lost battle wager`,
    },
  ]);
}

export async function getUserBattles(userId: string) {
  const { data, error } = await supabase
    .from('battles')
    .select('*')
    .or(`manager1_id.eq.${userId},manager2_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Battle[];
}

export async function getBattle(battleId: string) {
  const { data, error } = await supabase
    .from('battles')
    .select('*')
    .eq('id', battleId)
    .single();

  if (error) throw error;
  return data as Battle;
}

export async function getPlayerCards(userId: string): Promise<PlayerCard[]> {
  const { data, error } = await supabase
    .from('card_ownership')
    .select(`
      id,
      card_user_id,
      owner_id,
      profiles!card_ownership_card_user_id_fkey (
        username,
        avatar_url,
        overall_rating
      ),
      user_stats!inner (
        pac,
        sho,
        pas,
        dri,
        def,
        phy
      )
    `)
    .eq('owner_id', userId)
    .limit(5);

  if (error) throw error;

  return (data || []).map((item: any) => ({
    id: item.id,
    card_user_id: item.card_user_id,
    owner_id: item.owner_id,
    player_name: item.profiles?.username || 'Unknown Player',
    username: item.profiles?.username || 'Unknown',
    avatar_url: item.profiles?.avatar_url || '',
    image_url: item.profiles?.avatar_url || '',
    overall_rating: item.profiles?.overall_rating || 50,
    pace: item.user_stats?.pac || 50,
    shooting: item.user_stats?.sho || 50,
    passing: item.user_stats?.pas || 50,
    dribbling: item.user_stats?.dri || 50,
    defending: item.user_stats?.def || 50,
    physical: item.user_stats?.phy || 50,
  }));
}

export async function subscribeToBattle(battleId: string, callback: (battle: Battle) => void) {
  const channel = supabase
    .channel(`battle:${battleId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'battles',
        filter: `id=eq.${battleId}`,
      },
      (payload) => {
        callback(payload.new as Battle);
      }
    )
    .subscribe();

  return channel;
}
