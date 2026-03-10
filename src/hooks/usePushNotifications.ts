import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function usePushNotifications(userId: string | null) {
  useEffect(() => {
    if (!userId) return;

    // Only run on native Android/iOS - check without importing Capacitor
    const isNative = window.hasOwnProperty('Capacitor') && 
      (window as any).Capacitor?.isNativePlatform?.();
    
    if (!isNative) return;

    const registerPush = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;
        
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const permission = await PushNotifications.requestPermissions();
        if (permission.receive !== 'granted') return;

        await PushNotifications.register();

        await PushNotifications.addListener('registration', async (token) => {
          console.log('FCM Token:', token.value);
          await supabase
            .from('profiles')
            .update({ fcm_token: token.value })
            .eq('id', userId);
        });

        await PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration error:', error);
        });

        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push received:', notification);
        });

        await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('Push action:', action);
        });

      } catch (error) {
        console.error('Push notification setup error:', error);
      }
    };

    registerPush();

    return () => {
      import('@capacitor/push-notifications').then(({ PushNotifications }) => {
        PushNotifications.removeAllListeners();
      });
    };
  }, [userId]);
}