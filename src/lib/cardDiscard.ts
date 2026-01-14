import { supabase } from './supabase';

export interface CardForDiscard {
  id: string;
  card_user_id: string;
  owner_id: string;
  original_owner_id: string | null;
  current_price: number;
  base_price: number;
  times_traded: number;
  acquired_at: string;
  is_locked_in_battle: boolean;
  player_username: string;
  player_full_name: string;
  player_avatar_url: string | null;
  original_owner_username: string | null;
  original_owner_full_name: string | null;
  discard_cost: number;
}

export interface DiscardHistory {
  id: string;
  card_user_id: string;
  original_owner_id: string | null;
  card_price_at_discard: number;
  bonus_amount: number;
  total_paid: number;
  card_value_before: number;
  card_value_after: number;
  created_at: string;
  player_username: string;
  player_full_name: string;
  player_avatar_url: string | null;
  original_owner_username: string | null;
  original_owner_full_name: string | null;
}

export interface DiscardResult {
  success: boolean;
  error?: string;
  discard_id?: string;
  card_user_id?: string;
  total_paid?: number;
  card_price?: number;
  bonus?: number;
  original_owner_id?: string;
  new_card_value?: number;
}

export async function getUserCardsForDiscard(userId: string): Promise<CardForDiscard[]> {
  try {
    const { data, error } = await supabase.rpc('get_user_cards_for_discard', {
      p_user_id: userId,
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching cards for discard:', error);
    return [];
  }
}

export async function discardCard(
  userId: string,
  cardOwnershipId: string
): Promise<DiscardResult> {
  try {
    const { data, error } = await supabase.rpc('discard_card', {
      p_user_id: userId,
      p_card_ownership_id: cardOwnershipId,
    });

    if (error) throw error;

    const result = data as DiscardResult;

    return result;
  } catch (error: any) {
    console.error('Error discarding card:', error);
    return {
      success: false,
      error: error.message || 'Failed to discard card',
    };
  }
}

export async function getDiscardHistory(userId: string): Promise<DiscardHistory[]> {
  try {
    const { data, error } = await supabase.rpc('get_discard_history', {
      p_user_id: userId,
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching discard history:', error);
    return [];
  }
}

export function formatDiscardDate(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / 86400000);

  if (diffInDays === 0) {
    return 'Today';
  } else if (diffInDays === 1) {
    return 'Yesterday';
  } else if (diffInDays < 7) {
    return `${diffInDays} days ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
}
