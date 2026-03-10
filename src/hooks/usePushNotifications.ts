import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';

export function usePushNotifications(userId: string | null) {
  useEffect(() => {
    if (!userId) return;
    if (!Capacitor.isNativePlatform()) return; // Only run on Android/iOS

    const registerPush = async () => {
      try {
        // Request permission
        const permission = await PushNotifications.requestPermissions();
        if (permission.receive !== 'granted') return;

        // Register with FCM
        await PushNotifications.register();

        // Get FCM token and save to Supabase
        await PushNotifications.addListener('registration', async (token) => {
          console.log('FCM Token:', token.value);
          await supabase
            .from('profiles')
            .update({ fcm_token: token.value })
            .eq('id', userId);
        });

        // Handle registration errors
        await PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration error:', error);
        });

        // Handle foreground notifications
        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push received:', notification);
        });

        // Handle notification tap
        await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('Push action:', action);
        });

      } catch (error) {
        console.error('Push notification setup error:', error);
      }
    };

    registerPush();

    // Cleanup listeners on unmount
    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [userId]);
}