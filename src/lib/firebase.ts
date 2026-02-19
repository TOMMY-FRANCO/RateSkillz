import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

let messaging: Messaging | null = null;
try {
  messaging = getMessaging(app);
} catch {
  // Messaging not supported in this environment (e.g. SSR / non-browser)
}

export { messaging };

export async function requestFCMToken(): Promise<string | null> {
  try {
    if (!messaging) return null;
    if (!('Notification' in window)) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: await navigator.serviceWorker.ready,
    });
    return token ?? null;
  } catch (err) {
    console.error('[FCM] Failed to get token:', err);
    return null;
  }
}

export function onForegroundMessage(
  handler: (payload: { data?: Record<string, string> }) => void
): () => void {
  if (!messaging) return () => {};
  return onMessage(messaging, handler as any);
}
