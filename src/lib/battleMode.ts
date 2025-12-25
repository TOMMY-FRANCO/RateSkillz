import { supabase } from './supabase';
import { updateUserActivity } from './activityTracking';

export interface BattleCard {
  id: string;
  card_user_id: string;
  player_username: string;
  player_full_name: string;
  player_profile_picture: string;
  stats: {
    PAC: number;
    SHO: number;
    PAS: number;
    DRI: number;
    DEF: number;
    PHY: number;
  };
}

export interface Battle {
  id: string;
  manager1_id: string;
  manager2_id: string | null;
  manager1_selected_cards: BattleCard[];
  manager2_selected_cards: BattleCard[] | null;
  wager_amount: number;
  status: 'waiting' | 'active' | 'completed' | 'cancelled' | 'expired';
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  winner_id: string | null;
  round_results: RoundResult[];
  penalty_shot_used: boolean;
  manager1_score: number;
  manager2_score: number;
  manager1_profile?: any;
  manager2_profile?: any;
}

export interface RoundResult {
  round_number: number;
  card1: BattleCard;
  card2: BattleCard;
  stat_used: string;
  card1_stat_value: number;
  card2_stat_value: number;
  winner_card_id: string;
  winner_manager_id: string;
}

export async function checkManagerStatus(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_manager')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error checking manager status:', error);
    return false;
  }

  return data?.is_manager === true;
}

export async function getUserCards(userId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('card_ownership')
    .select(`
      id,
      card_user_id,
      is_locked_in_battle,
      locked_since,
      locked_in_battle_id,
      profiles!card_ownership_card_user_id_fkey (
        id,
        username,
        full_name,
        profile_picture_url,
        pace,
        shooting,
        passing,
        dribbling,
        defending,
        physical
      )
    `)
    .eq('owner_id', userId);

  if (error) {
    console.error('Error fetching user cards:', error);
    return [];
  }

  return data || [];
}

export async function createBattleChallenge(
  managerId: string,
  selectedCards: BattleCard[],
  wagerAmount: number
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('create_battle_challenge', {
      p_manager_id: managerId,
      p_selected_cards: selectedCards,
      p_wager_amount: wagerAmount,
    });

    if (error) throw error;

    await updateUserActivity(managerId);

    return data;
  } catch (error: any) {
    console.error('Error creating battle challenge:', error);
    throw new Error(error.message || 'Failed to create battle challenge');
  }
}

export async function acceptBattleChallenge(
  battleId: string,
  managerId: string,
  selectedCards: BattleCard[]
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('accept_battle_challenge', {
      p_battle_id: battleId,
      p_manager_id: managerId,
      p_selected_cards: selectedCards,
    });

    if (error) throw error;

    await updateUserActivity(managerId);

    return data === true;
  } catch (error: any) {
    console.error('Error accepting battle challenge:', error);
    throw new Error(error.message || 'Failed to accept battle challenge');
  }
}

export async function cancelBattleChallenge(
  battleId: string,
  managerId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('cancel_battle_challenge', {
      p_battle_id: battleId,
      p_manager_id: managerId,
    });

    if (error) throw error;

    return data === true;
  } catch (error: any) {
    console.error('Error cancelling battle challenge:', error);
    throw new Error(error.message || 'Failed to cancel battle challenge');
  }
}

export async function getAvailableChallenges(): Promise<Battle[]> {
  const { data, error } = await supabase
    .from('battles')
    .select(`
      *,
      manager1_profile:profiles!battles_manager1_id_fkey(id, username, full_name, profile_picture_url)
    `)
    .eq('status', 'waiting')
    .is('manager2_id', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching available challenges:', error);
    return [];
  }

  return data || [];
}

export async function getUserBattles(userId: string): Promise<Battle[]> {
  const { data, error } = await supabase
    .from('battles')
    .select(`
      *,
      manager1_profile:profiles!battles_manager1_id_fkey(id, username, full_name, profile_picture_url),
      manager2_profile:profiles!battles_manager2_id_fkey(id, username, full_name, profile_picture_url)
    `)
    .or(`manager1_id.eq.${userId},manager2_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching user battles:', error);
    return [];
  }

  return data || [];
}

export async function getBattle(battleId: string): Promise<Battle | null> {
  const { data, error } = await supabase
    .from('battles')
    .select(`
      *,
      manager1_profile:profiles!battles_manager1_id_fkey(id, username, full_name, profile_picture_url),
      manager2_profile:profiles!battles_manager2_id_fkey(id, username, full_name, profile_picture_url)
    `)
    .eq('id', battleId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching battle:', error);
    return null;
  }

  return data;
}

const STATS = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'] as const;

function getRandomStat(): string {
  return STATS[Math.floor(Math.random() * STATS.length)];
}

export async function executeBattle(battleId: string): Promise<RoundResult[]> {
  const battle = await getBattle(battleId);
  if (!battle || battle.status !== 'active') {
    throw new Error('Battle not active');
  }

  const manager1Cards = [...battle.manager1_selected_cards];
  const manager2Cards = [...battle.manager2_selected_cards!];
  const rounds: RoundResult[] = [];

  for (let roundNum = 1; roundNum <= 5; roundNum++) {
    const card1Index = Math.floor(Math.random() * manager1Cards.length);
    const card2Index = Math.floor(Math.random() * manager2Cards.length);

    const card1 = manager1Cards[card1Index];
    const card2 = manager2Cards[card2Index];

    const statUsed = getRandomStat();
    const card1Value = card1.stats[statUsed as keyof typeof card1.stats];
    const card2Value = card2.stats[statUsed as keyof typeof card2.stats];

    const winnerCardId = card1Value > card2Value ? card1.id : card2.id;
    const winnerManagerId = card1Value > card2Value ? battle.manager1_id : battle.manager2_id!;

    const roundResult: RoundResult = {
      round_number: roundNum,
      card1,
      card2,
      stat_used: statUsed,
      card1_stat_value: card1Value,
      card2_stat_value: card2Value,
      winner_card_id: winnerCardId,
      winner_manager_id: winnerManagerId,
    };

    rounds.push(roundResult);

    await supabase.from('battle_rounds').insert({
      battle_id: battleId,
      round_number: roundNum,
      card1_id: card1.id,
      card2_id: card2.id,
      stat_used: statUsed,
      card1_stat_value: card1Value,
      card2_stat_value: card2Value,
      winning_card_id: winnerCardId,
    });

    manager1Cards.splice(card1Index, 1);
    manager2Cards.splice(card2Index, 1);
  }

  const manager1Wins = rounds.filter((r) => r.winner_manager_id === battle.manager1_id).length;
  const manager2Wins = rounds.filter((r) => r.winner_manager_id === battle.manager2_id).length;

  await supabase
    .from('battles')
    .update({
      round_results: rounds,
      manager1_score: manager1Wins,
      manager2_score: manager2Wins,
    })
    .eq('id', battleId);

  return rounds;
}

export async function resolveBattle(battleId: string, winnerId: string | null): Promise<void> {
  const battle = await getBattle(battleId);
  if (!battle) {
    throw new Error('Battle not found');
  }

  const wagerAmount = battle.wager_amount;

  if (winnerId) {
    const loserId = winnerId === battle.manager1_id ? battle.manager2_id : battle.manager1_id;

    const winnerCards = winnerId === battle.manager1_id
      ? battle.manager1_selected_cards
      : battle.manager2_selected_cards!;

    const royaltyAmount = 5;
    const totalRoyalties = winnerCards.length * royaltyAmount;
    const managerProfit = wagerAmount - totalRoyalties;

    const { data: loserBalance } = await supabase
      .from('coins')
      .select('balance')
      .eq('user_id', loserId)
      .maybeSingle();

    const loserCurrentBalance = loserBalance?.balance || 0;

    await supabase
      .from('coins')
      .update({ balance: loserCurrentBalance - wagerAmount })
      .eq('user_id', loserId);

    await supabase.from('coin_transactions').insert({
      user_id: loserId,
      amount: -wagerAmount,
      transaction_type: 'battle_loss',
      description: `Lost battle wager - Battle ID: ${battleId.substring(0, 8)}`,
      running_balance: loserCurrentBalance - wagerAmount,
    });

    const { data: winnerBalance } = await supabase
      .from('coins')
      .select('balance')
      .eq('user_id', winnerId)
      .maybeSingle();

    const winnerCurrentBalance = winnerBalance?.balance || 0;

    await supabase
      .from('coins')
      .update({ balance: winnerCurrentBalance + managerProfit })
      .eq('user_id', winnerId);

    await supabase.from('coin_transactions').insert({
      user_id: winnerId,
      amount: managerProfit,
      transaction_type: 'battle_win',
      description: `Won battle wager (${wagerAmount} - ${totalRoyalties} royalties) - Battle ID: ${battleId.substring(0, 8)}`,
      running_balance: winnerCurrentBalance + managerProfit,
    });

    for (const card of winnerCards) {
      const { data: ownerBalance } = await supabase
        .from('coins')
        .select('balance')
        .eq('user_id', card.card_user_id)
        .maybeSingle();

      const ownerCurrentBalance = ownerBalance?.balance || 0;

      await supabase
        .from('coins')
        .update({ balance: ownerCurrentBalance + royaltyAmount })
        .eq('user_id', card.card_user_id);

      await supabase.from('coin_transactions').insert({
        user_id: card.card_user_id,
        amount: royaltyAmount,
        transaction_type: 'battle_royalty',
        description: `Battle royalty - Your card was used in a winning battle - Battle ID: ${battleId.substring(0, 8)}`,
        running_balance: ownerCurrentBalance + royaltyAmount,
      });

      await supabase.from('battle_royalties').insert({
        battle_id: battleId,
        original_owner_id: card.card_user_id,
        card_id: card.id,
        amount_earned: royaltyAmount,
      });
    }

    await supabase.from('battle_wagers').update({ amount_won: managerProfit }).eq('battle_id', battleId).eq('manager_id', winnerId);
    await supabase.from('battle_wagers').update({ amount_lost: wagerAmount }).eq('battle_id', battleId).eq('manager_id', loserId);
  }

  const allCards = [
    ...battle.manager1_selected_cards,
    ...(battle.manager2_selected_cards || []),
  ];

  for (const card of allCards) {
    await supabase
      .from('card_ownership')
      .update({
        is_locked_in_battle: false,
        locked_since: null,
        locked_in_battle_id: null,
      })
      .eq('id', card.id);
  }

  await supabase
    .from('battles')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      winner_id: winnerId,
    })
    .eq('id', battleId);
}

export async function getBattleLeaderboard(): Promise<any[]> {
  const { data, error } = await supabase.rpc('get_battle_leaderboard');

  if (error) {
    console.error('Error fetching battle leaderboard:', error);
    return [];
  }

  return data || [];
}
