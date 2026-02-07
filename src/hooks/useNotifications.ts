import { useState, useEffect, useCallback } from 'react';
import {
  getNotificationCounts,
  markNotificationsRead,
  dismissAdBadge as dismissAdBadgeLib,
  type NotificationCounts,
  type NotificationType,
} from '../lib/notifications';

export function useNotifications(userId: string | undefined) {
  const [counts, setCounts] = useState<NotificationCounts>({
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
  });
  const [loading, setLoading] = useState(true);

  const fetchCounts = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const newCounts = await getNotificationCounts(userId);
      setCounts(newCounts);
    } catch (error) {
      console.error('Error fetching notification counts:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const markAsRead = useCallback(
    async (notificationType: NotificationType) => {
      if (!userId) return;

      await markNotificationsRead(userId, notificationType);
      await fetchCounts();
    },
    [userId, fetchCounts]
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
    refetch: fetchCounts,
    dismissAdBadge,
  };
}
