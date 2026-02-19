import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { updateAppBadge } from '../lib/appBadge';

export interface DashboardBadgeCounts {
  messages: number;
  profileViews: number;
  transactions: number;
  acceptedFriendRequests: number;
  battleRequests: number;
  adAvailable: number;
}

const ZERO: DashboardBadgeCounts = {
  messages: 0,
  profileViews: 0,
  transactions: 0,
  acceptedFriendRequests: 0,
  battleRequests: 0,
  adAvailable: 0,
};

function cap(n: number): number {
  return Math.min(n, 99);
}

function totalCount(counts: DashboardBadgeCounts): number {
  return (
    counts.messages +
    counts.profileViews +
    counts.transactions +
    counts.acceptedFriendRequests +
    counts.battleRequests +
    counts.adAvailable
  );
}

export async function fetchDashboardBadges(userId: string): Promise<DashboardBadgeCounts> {
  try {
    const [
      messagesResult,
      profileResult,
      acceptedFriendsResult,
      battleResult,
      adResult,
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

      supabase.rpc('get_ad_status', { p_user_id: userId }),
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

    const adStatus = adResult.data?.[0];
    const adAvailable = adStatus?.can_watch === true ? 1 : 0;

    return {
      messages: cap(messagesResult.count ?? 0),
      profileViews: cap(profileResult.data?.unread_profile_views ?? 0),
      transactions: transactionsCount,
      acceptedFriendRequests: cap(acceptedFriendsResult.count ?? 0),
      battleRequests: cap(battleResult.count ?? 0),
      adAvailable,
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
      updateAppBadge(0);
      return;
    }
    const fresh = await fetchDashboardBadges(userId);
    if (isMountedRef.current) {
      setCounts(fresh);
      updateAppBadge(totalCount(fresh));
    }
  }, [userId]);

  const clearBadge = useCallback((key: keyof DashboardBadgeCounts) => {
    setCounts((prev) => {
      const next = { ...prev, [key]: 0 };
      updateAppBadge(totalCount(next));
      return next;
    });
  }, []);

  return { counts, refetch, clearBadge };
}
