import { useState, useEffect, useCallback } from 'react';
import {
  getNotificationSoundPreferences,
  updateNotificationSoundPreference,
  clearPreferencesCache,
  type NotificationSoundPreferences,
  type NotificationType,
} from '../lib/notificationSoundPreferences';

export function useNotificationSoundPreferences(userId: string | undefined) {
  const [preferences, setPreferences] = useState<NotificationSoundPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const prefs = await getNotificationSoundPreferences(userId);
      setPreferences(prefs);
    } catch (err) {
      console.error('Error fetching notification sound preferences:', err);
      setError('Failed to load sound preferences');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const updatePreference = useCallback(
    async (notificationType: NotificationType | 'ad_available', soundEnabled: boolean) => {
      if (!userId || !preferences) return;

      try {
        setError(null);

        // Optimistically update UI
        setPreferences((prev) => {
          if (!prev) return prev;
          return { ...prev, [notificationType]: soundEnabled };
        });

        // Update in database
        await updateNotificationSoundPreference(userId, notificationType, soundEnabled);
      } catch (err) {
        console.error('Error updating notification sound preference:', err);
        setError('Failed to update sound preference');

        // Revert optimistic update by refetching
        await fetchPreferences();
      }
    },
    [userId, preferences, fetchPreferences]
  );

  const togglePreference = useCallback(
    async (notificationType: NotificationType | 'ad_available') => {
      if (!preferences) return;
      await updatePreference(notificationType, !preferences[notificationType]);
    },
    [preferences, updatePreference]
  );

  const resetToDefaults = useCallback(async () => {
    if (!userId) return;

    try {
      setError(null);

      const notificationTypes: (NotificationType | 'ad_available')[] = [
        'message',
        'coin_received',
        'coin_request',
        'swap_offer',
        'purchase_offer',
        'card_sold',
        'battle_request',
        'profile_view',
        'transaction',
        'rank_update',
        'setting_change',
        'purchase_request',
        'ad_available',
      ];

      // Enable all notification types
      for (const type of notificationTypes) {
        await updateNotificationSoundPreference(userId, type, true);
      }

      // Clear cache and refetch
      clearPreferencesCache();
      await fetchPreferences();
    } catch (err) {
      console.error('Error resetting notification sound preferences:', err);
      setError('Failed to reset preferences');
    }
  }, [userId, fetchPreferences]);

  const disableAll = useCallback(async () => {
    if (!userId) return;

    try {
      setError(null);

      const notificationTypes: (NotificationType | 'ad_available')[] = [
        'message',
        'coin_received',
        'coin_request',
        'swap_offer',
        'purchase_offer',
        'card_sold',
        'battle_request',
        'profile_view',
        'transaction',
        'rank_update',
        'setting_change',
        'purchase_request',
        'ad_available',
      ];

      // Disable all notification types
      for (const type of notificationTypes) {
        await updateNotificationSoundPreference(userId, type, false);
      }

      // Clear cache and refetch
      clearPreferencesCache();
      await fetchPreferences();
    } catch (err) {
      console.error('Error disabling notification sounds:', err);
      setError('Failed to disable all sounds');
    }
  }, [userId, fetchPreferences]);

  return {
    preferences,
    loading,
    error,
    updatePreference,
    togglePreference,
    resetToDefaults,
    disableAll,
    refetch: fetchPreferences,
  };
}
