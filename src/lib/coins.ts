import { supabase } from './supabase';

const COIN_OPERATIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coin-operations`;

async function getAuthHeaders() {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  if (!token) {
    throw new Error('Not authenticated');
  }

  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function getCoinBalance(): Promise<number> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${COIN_OPERATIONS_URL}/balance`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch balance');
  }

  const data = await response.json();
  return data.balance;
}

export async function awardCommentCoins(profileUserId: string, commentId: string): Promise<{ earned: boolean; amount: number }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${COIN_OPERATIONS_URL}/award-comment`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ profileUserId, commentId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to award coins');
  }

  return await response.json();
}

export async function awardAdCoins(): Promise<{ earned: boolean; amount: number }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${COIN_OPERATIONS_URL}/award-ad`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to award coins');
  }

  return await response.json();
}

export async function getTransactions(): Promise<any[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${COIN_OPERATIONS_URL}/transactions`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch transactions');
  }

  const data = await response.json();
  return data.transactions;
}

export interface CoinPackage {
  id: string;
  price: number;
  coins: number;
  popular?: boolean;
}

export const COIN_PACKAGES: CoinPackage[] = [
  { id: 'starter', price: 1.00, coins: 100 },
  { id: 'basic', price: 2.00, coins: 200 },
  { id: 'popular', price: 5.00, coins: 500, popular: true },
  { id: 'premium', price: 20.00, coins: 2000 },
  { id: 'ultimate', price: 50.00, coins: 5000 },
];

export interface PageViewRewardStats {
  total_views_received: number;
  total_coins_earned: number;
  unique_viewers: number;
}

export async function getPageViewRewardStats(userId: string): Promise<PageViewRewardStats | null> {
  try {
    const { data, error } = await supabase.rpc('get_page_view_reward_stats', {
      p_user_id: userId
    });

    if (error) {
      console.error('Error fetching page view reward stats:', error);
      return null;
    }

    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Exception fetching page view reward stats:', error);
    return null;
  }
}
