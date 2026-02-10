import { supabase } from './supabase';
import type { NotificationType } from './notifications';
import type { SoundName } from './sounds';

export interface NotificationSoundPreference {
  notification_type: NotificationType | 'ad_available';
  sound_enabled: boolean;
}

export interface NotificationSoundPreferences {
  message: boolean;
  coin_received: boolean;
  coin_request: boolean;
  swap_offer: boolean;
  purchase_offer: boolean;
  card_sold: boolean;
  battle_request: boolean;
  profile_view: boolean;
  transaction: boolean;
  rank_update: boolean;
  setting_change: boolean;
  purchase_request: boolean;
  ad_available: boolean;
}

const DEFAULT_PREFERENCES: NotificationSoundPreferences = {
  message: true,
  coin_received: true,
  coin_request: true,
  swap_offer: true,
  purchase_offer: true,
  card_sold: true,
  battle_request: true,
  profile_view: true,
  transaction: true,
  rank_update: true,
  setting_change: true,
  purchase_request: true,
  ad_available: true,
};

const NOTIFICATION_TYPE_TO_SOUND: Record<NotificationType | 'ad_available', SoundName> = {
  message: 'message-received',
  coin_received: 'coin-received',
  coin_request: 'notification',
  swap_offer: 'card-swap',
  purchase_offer: 'notification',
  card_sold: 'coin-received',
  battle_request: 'notification',
  profile_view: 'notification',
  transaction: 'coin-received',
  rank_update: 'rank-up',
  setting_change: 'notification',
  purchase_request: 'notification',
  ad_available: 'notification',
};

const PREFS_CACHE_KEY = 'notification_sound_prefs_cache';
const PREFS_CACHE_TIMESTAMP_KEY = 'notification_sound_prefs_cache_timestamp';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

function getCachedPreferences(): NotificationSoundPreferences | null {
  try {
    const cachedData = localStorage.getItem(PREFS_CACHE_KEY);
    const cacheTimestamp = localStorage.getItem(PREFS_CACHE_TIMESTAMP_KEY);

    if (!cachedData || !cacheTimestamp) return null;

    const timestamp = parseInt(cacheTimestamp, 10);
    if (Date.now() - timestamp > CACHE_DURATION_MS) {
      // Cache expired
      return null;
    }

    return JSON.parse(cachedData);
  } catch {
    return null;
  }
}

function setCachedPreferences(preferences: NotificationSoundPreferences): void {
  try {
    localStorage.setItem(PREFS_CACHE_KEY, JSON.stringify(preferences));
    localStorage.setItem(PREFS_CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch {
    // localStorage unavailable
  }
}

export function clearPreferencesCache(): void {
  try {
    localStorage.removeItem(PREFS_CACHE_KEY);
    localStorage.removeItem(PREFS_CACHE_TIMESTAMP_KEY);
  } catch {
    // localStorage unavailable
  }
}

export async function getNotificationSoundPreferences(
  userId: string
): Promise<NotificationSoundPreferences> {
  try {
    // Check cache first
    const cached = getCachedPreferences();
    if (cached) return cached;

    const { data, error } = await supabase.rpc('get_notification_sound_preferences', {
      p_user_id: userId,
    });

    if (error) throw error;

    const preferences: NotificationSoundPreferences = { ...DEFAULT_PREFERENCES };

    if (data && Array.isArray(data)) {
      data.forEach((pref: NotificationSoundPreference) => {
        preferences[pref.notification_type] = pref.sound_enabled;
      });
    }

    // Cache the preferences
    setCachedPreferences(preferences);

    return preferences;
  } catch (error) {
    console.error('Error fetching notification sound preferences:', error);
    return { ...DEFAULT_PREFERENCES };
  }
}

export async function updateNotificationSoundPreference(
  userId: string,
  notificationType: NotificationType | 'ad_available',
  soundEnabled: boolean
): Promise<void> {
  try {
    const { error } = await supabase.rpc('update_notification_sound_preference', {
      p_user_id: userId,
      p_notification_type: notificationType,
      p_sound_enabled: soundEnabled,
    });

    if (error) throw error;

    // Clear cache to force refresh
    clearPreferencesCache();
  } catch (error) {
    console.error('Error updating notification sound preference:', error);
    throw error;
  }
}

export async function isSoundEnabledForNotificationType(
  userId: string,
  notificationType: NotificationType | 'ad_available'
): Promise<boolean> {
  try {
    const preferences = await getNotificationSoundPreferences(userId);
    return preferences[notificationType] ?? true;
  } catch {
    return true; // Default to enabled on error
  }
}

export function getSoundNameForNotificationType(
  notificationType: NotificationType | 'ad_available'
): SoundName {
  return NOTIFICATION_TYPE_TO_SOUND[notificationType] || 'notification';
}

export async function markNotificationSoundPlayed(
  userId: string,
  notificationId: string
): Promise<void> {
  try {
    const { error } = await supabase.rpc('mark_notification_sound_played', {
      p_user_id: userId,
      p_notification_id: notificationId,
    });

    if (error) throw error;
  } catch (error) {
    console.error('Error marking notification sound as played:', error);
  }
}

export async function hasSoundPlayedForNotification(
  userId: string,
  notificationId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('has_sound_played_for_notification', {
      p_user_id: userId,
      p_notification_id: notificationId,
    });

    if (error) throw error;
    return data ?? false;
  } catch {
    return false;
  }
}

export async function playNotificationSound(
  userId: string,
  notificationType: NotificationType | 'ad_available',
  notificationId?: string
): Promise<boolean> {
  try {
    // Check if user has sound enabled for this notification type
    const soundEnabled = await isSoundEnabledForNotificationType(userId, notificationType);
    if (!soundEnabled) return false;

    // If notification ID provided, check if sound already played
    if (notificationId) {
      const alreadyPlayed = await hasSoundPlayedForNotification(userId, notificationId);
      if (alreadyPlayed) return false;
    }

    // Get the sound name for this notification type
    const soundName = getSoundNameForNotificationType(notificationType);

    // Play the sound (imported dynamically to avoid circular dependencies)
    const { playSound } = await import('./sounds');
    playSound(soundName);

    // Mark as played if notification ID provided
    if (notificationId) {
      await markNotificationSoundPlayed(userId, notificationId);
    }

    return true;
  } catch (error) {
    console.error('Error playing notification sound:', error);
    return false;
  }
}

export type { NotificationType };
