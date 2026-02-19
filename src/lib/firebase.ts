let unsubscribeForeground: (() => void) | null = null;

async function getMainSWRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    if (regs.length > 0) {
      const ready = await navigator.serviceWorker.ready;
      return ready;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function requestFCMToken(): Promise<string | null> {
  try {
    if (typeof window === 'undefined') return null;
    if (!('Notification' in window)) return null;
    if (!('serviceWorker' in navigator)) return null;
    if (Notification.permission !== 'granted') return null;

    const { initializeApp, getApps } = await import('firebase/app');
    const { getMessaging, getToken } = await import('firebase/messaging');

    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };

    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const messaging = getMessaging(app);
    const swReg = await getMainSWRegistration();
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
    return token ?? null;
  } catch {
    return null;
  }
}

export async function setupForegroundMessageHandler(
  handler: (payload: { data?: Record<string, string> }) => void
): Promise<void> {
  try {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    if (!('serviceWorker' in navigator)) return;

    if (unsubscribeForeground) {
      unsubscribeForeground();
      unsubscribeForeground = null;
    }

    const { initializeApp, getApps } = await import('firebase/app');
    const { getMessaging, onMessage } = await import('firebase/messaging');

    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };

    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const messaging = getMessaging(app);
    unsubscribeForeground = onMessage(messaging, handler as any);
  } catch {
    // silently ignore — unsupported browser
  }
}

export async function sendTestNotification(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator)) return false;
    if (Notification.permission !== 'granted') return false;
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification('RatingSkill Test', {
      body: 'Push notifications are working correctly!',
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
      tag: 'ratingskill-test',
    });
    return true;
  } catch {
    return false;
  }
}
