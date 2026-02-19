import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { updateAppBadge } from '../lib/appBadge';
import { requestFCMToken, onForegroundMessage } from '../lib/firebase';

export interface DashboardBadgeCounts {
  messages: number;
  profileViews: number;
  transactions: number;
  acceptedFriendRequests: number;
  battleRequests: number;
  notifications: number;
  adAvailable: number;
}

const ZERO: DashboardBadgeCounts = {
  messages: 0,
  profileViews: 0,
  transactions: 0,
  acceptedFriendRequests: 0,
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
    (counts.battleRequests ?? 0) +
    (counts.notifications ?? 0) +
    (counts.adAvailable ?? 0)
  );
}

function utcDateString(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

async function saveFCMToken(userId: string): Promise<void> {
  try {
    const token = await requestFCMToken();
    if (!token) return;
    await supabase
      .from('profiles')
      .update({ fcm_token: token })
      .eq('id', userId);
  } catch (err) {
    console.error('[FCM] Failed to save token:', err);
  }
}

async function sendPushNotification(userId: string, badgeCount: number): Promise<void> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        Apikey: anonKey,
      },
      body: JSON.stringify({ user_id: userId, badge_count: badgeCount }),
    });
  } catch (err) {
    console.error('[FCM] Failed to send push notification:', err);
  }
}

export async function fetchDashboardBadges(userId: string): Promise<DashboardBadgeCounts> {
  try {
    const todayStart = `${utcDateString(new Date())}T00:00:00.000Z`;
    const tomorrowStart = (() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + 1);
      return `${utcDateString(d)}T00:00:00.000Z`;
    })();

    const [
      messagesResult,
      profileResult,
      acceptedFriendsResult,
      battleResult,
      notificationsResult,
      adViewResult,
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

    const adAvailable = (adViewResult.count ?? 0) === 0 ? 1 : 0;

    const result: DashboardBadgeCounts = {
      messages: cap(messagesResult.count ?? 0),
      profileViews: cap(profileResult.data?.unread_profile_views ?? 0),
      transactions: transactionsCount,
      acceptedFriendRequests: cap(acceptedFriendsResult.count ?? 0),
      battleRequests: cap(battleResult.count ?? 0),
      notifications: cap(notificationsResult.count ?? 0),
      adAvailable,
    };

    const total = totalCount(result);
    console.log('[AppBadge] counts:', result, '| total:', total);

    return result;
  } catch (err) {
    console.error('Error fetching dashboard badges:', err);
    return { ...ZERO };
  }
}

export function useDashboardBadges(userId: string | undefined) {
  const [counts, setCounts] = useState<DashboardBadgeCounts>({ ...ZERO });
  const isMountedRef = useRef(true);
  const fcmInitialisedRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!userId) {
      setCounts({ ...ZERO });
      updateAppBadge(0);
      return;
    }

    if (!fcmInitialisedRef.current) {
      fcmInitialisedRef.current = true;
      saveFCMToken(userId);

      onForegroundMessage((payload) => {
        const badgeCount = parseInt(
          (payload.data && payload.data.badge_count) || '0',
          10
        );
        updateAppBadge(badgeCount);
      });
    }

    const fresh = await fetchDashboardBadges(userId);
    if (isMountedRef.current) {
      setCounts(fresh);
      const total = totalCount(fresh);
      updateAppBadge(total);
      sendPushNotification(userId, total);
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
