import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getNotificationCounts,
  markNotificationsRead,
  dismissAdBadge as dismissAdBadgeLib,
  type NotificationCounts,
  type NotificationType,
} from '../lib/notifications';

const DEFAULT_COUNTS: NotificationCounts = {
  message: 0,
  coin_received: 0,
  coin_request: 0,
  swap_offer: 0,
  purchase_offer: 0,
  card_sold: 0,
  battle_request: 0,
  profile_view: 0,
  transaction: 0,
  rank_update: 0,
  setting_change: 0,
  purchase_request: 0,
  ad_available: 0,
};

export function useNotifications(userId: string | undefined) {
  const [counts, setCounts] = useState<NotificationCounts>(DEFAULT_COUNTS);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);
  const userIdRef = useRef(userId);

  userIdRef.current = userId;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setCounts(DEFAULT_COUNTS);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetch() {
      try {
        setLoading(true);
        const newCounts = await getNotificationCounts(userId!);
        if (!cancelled && isMountedRef.current) {
          setCounts(newCounts);
        }
      } catch (error) {
        console.error('Error fetching notification counts:', error);
      } finally {
        if (!cancelled && isMountedRef.current) {
          setLoading(false);
        }
      }
    }

    fetch();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refetch = useCallback(async () => {
    const currentUserId = userIdRef.current;
    if (!currentUserId) return;

    try {
      const newCounts = await getNotificationCounts(currentUserId);
      if (isMountedRef.current) {
        setCounts(newCounts);
      }
    } catch (error) {
      console.error('Error fetching notification counts:', error);
    }
  }, []);

  const markAsRead = useCallback(
    async (notificationType: NotificationType) => {
      const currentUserId = userIdRef.current;
      if (!currentUserId) return;

      try {
        await markNotificationsRead(currentUserId, notificationType);
        const newCounts = await getNotificationCounts(currentUserId);
        if (isMountedRef.current) {
          setCounts(newCounts);
        }
      } catch (error) {
        console.error('Error marking notifications as read:', error);
      }
    },
    []
  );

  const dismissAdBadge = useCallback(() => {
    dismissAdBadgeLib();
    setCounts((prev) => ({ ...prev, ad_available: 0 }));
  }, []);

  const getCount = useCallback(
    (types: NotificationType[]): number => {
      return types.reduce((sum, type) => sum + (counts[type] || 0), 0);
    },
    [counts]
  );

  return {
    counts,
    loading,
    markAsRead,
    getCount,
    refetch,
    dismissAdBadge,
  };
}
