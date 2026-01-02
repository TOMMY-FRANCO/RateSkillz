import { supabase } from './supabase';

export async function getUserBalance(userId: string): Promise<number> {
  const { data } = await supabase
    .from('profiles')
    .select('coin_balance')
    .eq('id', userId)
    .maybeSingle();

  return Number(data?.coin_balance || 0);
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
