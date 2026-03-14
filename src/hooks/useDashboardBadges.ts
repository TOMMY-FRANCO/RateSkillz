import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { updateAppBadge } from '../lib/appBadge';
import { withCache, CACHE_TTL, cache } from '../lib/cache';

export interface DashboardBadgeCounts {
  messages: number;
  profileViews: number;
  transactions: number;
  acceptedFriendRequests: number;
  pendingFriendRequests: number;
  battleRequests: number;
  notifications: number;
  adAvailable: number;
}

const ZERO: DashboardBadgeCounts = {
  messages: 0,
  profileViews: 0,
  transactions: 0,
  acceptedFriendRequests: 0,
  pendingFriendRequests: 0,
  battleRequests: 0,
  notifications: 0,
  adAvailable: 0,
};

function cap(n: number): number {
  return Math.min(n, 99);
}

function totalCount(counts: DashboardBadgeCounts): number {
  return (
    (counts.messages ?? 0) +
    (counts.profileViews ?? 0) +
    (counts.transactions ?? 0) +
    (counts.acceptedFriendRequests ?? 0) +
    (counts.pendingFriendRequests ?? 0) +
    (counts.battleRequests ?? 0) +
    (counts.notifications ?? 0) +
    (counts.adAvailable ?? 0)
  );
}

function utcDateString(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export async function fetchDashboardBadges(userId: string): Promise<DashboardBadgeCounts> {
  return withCache(`dashboard-badges-${userId}`, CACHE_TTL.SHORT, async () => {
    try {
      const todayStart = `${utcDateString(new Date())}T00:00:00.000Z`;
      const tomorrowStart = (() => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + 1);
        return `${utcDateString(d)}T00:00:00.000Z`;
      })();

      const profileTxResult = await supabase
        .from('profiles')
        .select('last_visited_transactions')
        .eq('id', userId)
        .maybeSingle();

      const lastVisitedTransactions: string | null =
        profileTxResult.data?.last_visited_transactions ?? null;

      const [
        messagesResult,
        profileViewResult,
        acceptedFriendsResult,
        pendingFriendsResult,
        battleResult,
        notificationsResult,
        adViewResult,
        txResult,
      ] = await Promise.all([
        supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('recipient_id', userId)
          .eq('is_read', false),

        supabase
          .from('profile_view_cache')
          .select('unread_profile_views')
          .eq('user_id', userId)
          .maybeSingle(),

        supabase
          .from('friends')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'accepted')
          .eq('seen_by_sender', false),

        supabase
          .from('friends')
          .select('id', { count: 'exact', head: true })
          .eq('friend_id', userId)
          .eq('status', 'pending'),

        supabase
          .from('battles')
          .select('id', { count: 'exact', head: true })
          .eq('manager2_id', userId)
          .eq('status', 'waiting'),

        supabase
          .from('user_notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_read', false),

        supabase
          .from('ad_views')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', todayStart)
          .lt('created_at', tomorrowStart),

        lastVisitedTransactions
          ? supabase
              .from('coin_transactions')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId)
              .gt('created_at', lastVisitedTransactions)
          : supabase
              .from('coin_transactions')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId),
      ]);

      const adAvailable = (adViewResult.count ?? 0) === 0 ? 1 : 0;

      return {
        messages: cap(messagesResult.count ?? 0),
        profileViews: cap(profileViewResult.data?.unread_profile_views ?? 0),
        transactions: cap(txResult.count ?? 0),
        acceptedFriendRequests: cap(acceptedFriendsResult.count ?? 0),
        pendingFriendRequests: cap(pendingFriendsResult.count ?? 0),
        battleRequests: cap(battleResult.count ?? 0),
        notifications: cap(notificationsResult.count ?? 0),
        adAvailable,
      };
    } catch {
      return { ...ZERO };
    }
  });
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

    cache.delete(`dashboard-badges-${userId}`);
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
