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
  card_selections: BattleSelection[];
  used_skills: string[];
  player1_remaining_cards: number;
  player2_remaining_cards: number;
  is_tiebreaker: boolean;
}

export interface BattleSelection {
  round?: number;
  user_id: string;
  card_id: string;
  skill: string;
  value: number;
  is_attacker?: boolean;
  is_tiebreaker?: boolean;
  attacker_wins?: boolean;
  eliminated_card_id?: string | null;
  timestamp: string;
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
  if (error) return false;
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

export async function submitBattleMove(
  battleId: string,
  userId: string,
  cardId: string,
  skill: string | null
) {
  const { data, error } = await supabase.rpc('submit_battle_move', {
    p_battle_id: battleId,
    p_user_id: userId,
    p_card_id: cardId,
    p_skill: skill,
  });
  if (error) throw error;
  return data;
}

export async function submitTiebreakerMove(
  battleId: string,
  userId: string,
  cardId: string,
  skill: string
) {
  const { data, error } = await supabase.rpc('submit_tiebreaker_move', {
    p_battle_id: battleId,
    p_user_id: userId,
    p_card_id: cardId,
    p_skill: skill,
  });
  if (error) throw error;
  return data;
}

export async function forfeitBattle(battleId: string, userId: string) {
  const { data, error } = await supabase.rpc('forfeit_battle', {
    p_battle_id: battleId,
    p_user_id: userId,
  });
  if (error) throw error;
  return data;
}

export async function cancelBattle(battleId: string, userId: string) {
  const { data, error } = await supabase.rpc('cancel_battle', {
    p_battle_id: battleId,
    p_user_id: userId,
  });
  if (error) throw error;
  return data;
}

export async function getUserBattles(userId: string): Promise<Battle[]> {
  const { data, error } = await supabase
    .from('battles')
    .select('id, manager1_id, manager2_id, wager_amount, status, created_at, completed_at, winner_id, current_turn_user_id, turn_started_at, first_player_id, card_selections, used_skills, player1_remaining_cards, player2_remaining_cards, is_tiebreaker')
    .or(`manager1_id.eq.${userId},manager2_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data || []) as Battle[];
}

export async function getBattle(battleId: string): Promise<Battle> {
  const { data, error } = await supabase
    .from('battles')
    .select('id, manager1_id, manager2_id, wager_amount, status, created_at, completed_at, winner_id, current_turn_user_id, turn_started_at, first_player_id, card_selections, used_skills, player1_remaining_cards, player2_remaining_cards, is_tiebreaker')
    .eq('id', battleId)
    .single();

  if (error) throw error;
  return data as Battle;
}

export async function getPlayerCards(userId: string): Promise<PlayerCard[]> {
  const { data: cards, error: cardsError } = await supabase
    .from('card_ownership')
    .select('id, card_user_id, owner_id')
    .eq('owner_id', userId)
    .limit(5);

  if (cardsError) throw cardsError;
  if (!cards || cards.length === 0) return [];

  const cardUserIds = cards.map((c: any) => c.card_user_id);
  const { data: profiles, error: profilesError } = await supabase
    .from('profile_summary')
    .select('user_id, username, avatar_url, overall_rating, pac_rating, sho_rating, pas_rating, dri_rating, def_rating, phy_rating')
    .in('user_id', cardUserIds);

  if (profilesError) throw profilesError;

  const profileMap = new Map<string, any>();
  (profiles || []).forEach((p: any) => profileMap.set(p.user_id, p));

  return cards.map((card: any) => {
    const p = profileMap.get(card.card_user_id);
    return {
      id: card.id,
      card_user_id: card.card_user_id,
      owner_id: card.owner_id,
      player_name: p?.username || 'Unknown',
      username: p?.username || 'Unknown',
      avatar_url: p?.avatar_url || '',
      image_url: p?.avatar_url || '',
      overall_rating: p?.overall_rating || 50,
      pace: p?.pac_rating || 50,
      shooting: p?.sho_rating || 50,
      passing: p?.pas_rating || 50,
      dribbling: p?.dri_rating || 50,
      defending: p?.def_rating || 50,
      physical: p?.phy_rating || 50,
    };
  });
}

