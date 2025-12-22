import { supabase } from './supabase';

export async function getUserBalance(userId: string): Promise<number> {
  const { data } = await supabase
    .from('coins')
    .select('balance')
    .eq('user_id', userId)
    .maybeSingle();

  return data?.balance || 0;
}

export async function getMultipleUserBalances(userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const { data } = await supabase
    .from('coins')
    .select('user_id, balance')
    .in('user_id', userIds);

  const balanceMap = new Map<string, number>();

  data?.forEach((row) => {
    balanceMap.set(row.user_id, row.balance || 0);
  });

  userIds.forEach((userId) => {
    if (!balanceMap.has(userId)) {
      balanceMap.set(userId, 0);
    }
  });

  return balanceMap;
}
