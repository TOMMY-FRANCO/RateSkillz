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

export async function canWatchAdToday(): Promise<{
  can_watch: boolean;
  message: string;
  next_available_gmt?: string;
  hours_remaining?: number;
  minutes_remaining?: number;
}> {
  const userId = (await supabase.auth.getUser()).data.user?.id;

  if (!userId) {
    console.error('[canWatchAdToday] No user ID found');
    return { can_watch: false, message: 'Not authenticated' };
  }

  const { data, error } = await supabase.rpc('get_ad_status', {
    p_user_id: userId
  });

  if (error) {
    console.error('[canWatchAdToday] RPC error:', error);
    return { can_watch: false, message: 'Error checking availability' };
  }

  // data is an array with one row
  const status = data?.[0];

  if (!status) {
    console.error('[canWatchAdToday] No status data returned');
    return { can_watch: false, message: 'Error checking availability' };
  }

  const hoursUntilNext = status.hours_until_next || 0;
  const minutesRemaining = Math.floor((hoursUntilNext % 1) * 60);
  const hoursRemaining = Math.floor(hoursUntilNext);

  return {
    can_watch: status.can_watch,
    message: status.message,
    next_available_gmt: status.next_available,
    hours_remaining: hoursRemaining,
    minutes_remaining: minutesRemaining,
  };
}

export async function awardAdCoins(): Promise<{ earned: boolean; amount: number; message?: string; error?: string }> {
  console.log('[awardAdCoins] Calling edge function');
  const headers = await getAuthHeaders();

  const response = await fetch(`${COIN_OPERATIONS_URL}/award-ad`, {
    method: 'POST',
    headers,
  });

  console.log('[awardAdCoins] Response status:', response.status);

  if (!response.ok) {
    const error = await response.json();
    console.error('[awardAdCoins] Error response:', error);
    throw new Error(error.error || 'Failed to award coins');
  }

  const result = await response.json();
  console.log('[awardAdCoins] Success');
  return result;
}

export async function getTransactions(page: number = 1, limit: number = 20): Promise<{
  transactions: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${COIN_OPERATIONS_URL}/transactions?page=${page}&limit=${limit}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch transactions');
    }

    const data = await response.json();
    return {
      transactions: data.transactions || [],
      pagination: data.pagination || {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasMore: false
      }
    };
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
}

export interface CoinPackage {
  id: string;
  price: number;
  coins: number;
  popular?: boolean;
}

export const COIN_PACKAGES: CoinPackage[] = [
  { id: 'starter', price: 1.00, coins: 100 },
  { id: 'value', price: 2.00, coins: 300, popular: true },
];
