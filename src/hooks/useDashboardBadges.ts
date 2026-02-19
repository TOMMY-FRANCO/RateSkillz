import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export interface DashboardBadgeCounts {
  messages: number;
  profileViews: number;
  transactions: number;
  acceptedFriendRequests: number;
  battleRequests: number;
}

const ZERO: DashboardBadgeCounts = {
  messages: 0,
  profileViews: 0,
  transactions: 0,
  acceptedFriendRequests: 0,
  battleRequests: 0,
};

function cap(n: number): number {
  return Math.min(n, 99);
}

export async function fetchDashboardBadges(userId: string): Promise<DashboardBadgeCounts> {
  try {
    const [
      messagesResult,
      profileResult,
      acceptedFriendsResult,
      battleResult,
    ] = await Promise.all([
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('is_read', false),

      supabase
        .from('profiles')
        .select('unread_profile_views, last_visited_transactions')
        .eq('id', userId)
        .maybeSingle(),

      supabase
        .from('friends')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'accepted')
        .eq('seen_by_sender', false),

      supabase
        .from('battles')
        .select('id', { count: 'exact', head: true })
        .eq('manager2_id', userId)
        .eq('status', 'waiting'),
    ]);

    const lastVisitedTransactions: string | null =
      profileResult.data?.last_visited_transactions ?? null;

    let transactionsCount = 0;
    if (lastVisitedTransactions) {
      const txResult = await supabase
        .from('coin_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gt('created_at', lastVisitedTransactions);
      transactionsCount = cap(txResult.count ?? 0);
    } else {
      const txResult = await supabase
        .from('coin_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      transactionsCount = cap(txResult.count ?? 0);
    }

    return {
      messages: cap(messagesResult.count ?? 0),
      profileViews: cap(profileResult.data?.unread_profile_views ?? 0),
      transactions: transactionsCount,
      acceptedFriendRequests: cap(acceptedFriendsResult.count ?? 0),
      battleRequests: cap(battleResult.count ?? 0),
    };
  } catch (err) {
    console.error('Error fetching dashboard badges:', err);
    return { ...ZERO };
  }
}

export function useDashboardBadges(userId: string | undefined) {
  const [counts, setCounts] = useState<DashboardBadgeCounts>({ ...ZERO });
  const isMountedRef = useRef(true);

  const refetch = useCallback(async () => {
    if (!userId) {
      setCounts({ ...ZERO });
      return;
    }
    const fresh = await fetchDashboardBadges(userId);
    if (isMountedRef.current) {
      setCounts(fresh);
    }
  }, [userId]);

  const clearBadge = useCallback((key: keyof DashboardBadgeCounts) => {
    setCounts((prev) => ({ ...prev, [key]: 0 }));
  }, []);

  return { counts, refetch, clearBadge };
}
