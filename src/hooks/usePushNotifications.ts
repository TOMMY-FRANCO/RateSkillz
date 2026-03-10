import { useEffect, useState } from 'react';
import { messaging, getToken, onMessage } from '../lib/firebase';
import { supabase } from '../lib/supabase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export function usePushNotifications(userId: string | null) {
  const [token, setToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (!userId) return;
    setPermission(Notification.permission);
  }, [userId]);

  // Request permission and get FCM token
  const requestPermission = async () => {
    if (!userId) return;

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);

      if (permission !== 'granted') {
        console.log('Notification permission denied');
        return;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register(
        '/firebase-messaging-sw.js'
      );

      // Get FCM token
      const fcmToken = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (fcmToken) {
        setToken(fcmToken);
        // Save token to Supabase profiles table
        await supabase
          .from('profiles')
          .update({ fcm_token: fcmToken })
          .eq('id', userId);

        console.log('FCM token saved:', fcmToken);
      }
    } catch (error) {
      console.error('Error getting push notification token:', error);
    }
  };

  // Handle foreground messages (app is open)
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Foreground message received:', payload);

      // Show notification even when app is open
      if (Notification.permission === 'granted' && payload.notification) {
        new Notification(payload.notification.title || 'RatingSkill', {
          body: payload.notification.body,
          icon: '/icons/icon-192x192.png',
        });
      }
    });

    return () => unsubscribe();
  }, [userId]);

  return { token, permission, requestPermission };
}