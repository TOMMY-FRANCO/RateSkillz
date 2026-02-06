import { supabase } from './supabase';

export type NotificationType =
  | 'message'
  | 'coin_received'
  | 'coin_request'
  | 'swap_offer'
  | 'purchase_offer'
  | 'card_sold'
  | 'battle_request'
  | 'profile_view'
  | 'transaction'
  | 'rank_update'
  | 'setting_change';

export interface NotificationCount {
  notification_type: NotificationType;
  unread_count: number;
}

export interface NotificationCounts {
  message: number;
  coin_received: number;
  coin_request: number;
  swap_offer: number;
  purchase_offer: number;
  card_sold: number;
  battle_request: number;
  profile_view: number;
  transaction: number;
  rank_update: number;
  setting_change: number;
  ad_available: number;
}

export async function getNotificationCounts(
  userId: string
): Promise<NotificationCounts> {
  try {
    const { data, error } = await supabase.rpc('get_notification_counts', {
      p_user_id: userId,
    });

    if (error) throw error;

    const counts: NotificationCounts = {
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
      ad_available: 0,
    };

    if (data) {
      data.forEach((item: NotificationCount) => {
        counts[item.notification_type] = item.unread_count;
      });
    }

    if (!isAdBadgeDismissed()) {
      const { data: adAvailable } = await supabase.rpc('is_ad_available_today', {
        p_user_id: userId,
      });

      if (adAvailable) {
        counts.ad_available = 1;
      }
    }

    return counts;
  } catch (err) {
    console.error('Error getting notification counts:', err);
    return {
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
      ad_available: 0,
    };
  }
}

export async function markNotificationsRead(
  userId: string,
  notificationType: NotificationType
): Promise<void> {
  try {
    const { error } = await supabase.rpc('mark_notifications_read', {
      p_user_id: userId,
      p_notification_type: notificationType,
    });

    if (error) throw error;
  } catch (err) {
    console.error('Error marking notifications as read:', err);
  }
}

export async function createNotification(
  userId: string,
  notificationType: NotificationType,
  relatedId?: string,
  relatedUserId?: string,
  message?: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('create_notification', {
      p_user_id: userId,
      p_notification_type: notificationType,
      p_related_id: relatedId || null,
      p_related_user_id: relatedUserId || null,
      p_message: message || null,
    });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error creating notification:', err);
    return null;
  }
}

export function getTotalBadgeCount(
  counts: NotificationCounts,
  buttons: Array<keyof NotificationCounts | NotificationType[]>
): Record<string, number> {
  const buttonCounts: Record<string, number> = {};

  buttons.forEach((button) => {
    if (Array.isArray(button)) {
      const total = button.reduce((sum, type) => sum + (counts[type] || 0), 0);
      buttonCounts[button.join('_')] = total;
    }
  });

  return buttonCounts;
}

export function getButtonNotificationCount(
  counts: NotificationCounts,
  types: NotificationType[]
): number {
  return types.reduce((sum, type) => sum + (counts[type] || 0), 0);
}

function getAdBadgeDismissKey(): string {
  const now = new Date();
  const utcDate = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  return `ad_badge_dismissed_${utcDate}`;
}

export function dismissAdBadge(): void {
  try {
    localStorage.setItem(getAdBadgeDismissKey(), 'true');
  } catch {
    // localStorage unavailable
  }
}

export function isAdBadgeDismissed(): boolean {
  try {
    return localStorage.getItem(getAdBadgeDismissKey()) === 'true';
  } catch {
    return false;
  }
}
