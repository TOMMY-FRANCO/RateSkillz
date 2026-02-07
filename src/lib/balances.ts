import { supabase } from './supabase';
import { cache, CacheKeys, CACHE_TTL } from './cache';

export async function getUserBalance(userId: string): Promise<number> {
  // Check cache first
  const cacheKey = CacheKeys.userBalance(userId);
  const cached = cache.get<number>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // Fetch from database
  const { data } = await supabase
    .from('profiles')
    .select('coin_balance')
    .eq('id', userId)
    .maybeSingle();

  const balance = Number(data?.coin_balance || 0);

  // Cache for 30 seconds (balances change frequently with transactions)
  cache.set(cacheKey, balance, CACHE_TTL.SHORT);

  return balance;
}

export async function getMultipleUserBalances(userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const { data } = await supabase
    .from('profiles')
    .select('id, coin_balance')
    .in('id', userIds);

  const balanceMap = new Map<string, number>();

  data?.forEach((row) => {
    balanceMap.set(row.id, Number(row.coin_balance || 0));
  });

  userIds.forEach((userId) => {
    if (!balanceMap.has(userId)) {
      balanceMap.set(userId, 0);
    }
  });

  return balanceMap;
}
