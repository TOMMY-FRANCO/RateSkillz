importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyA_7JfjP5d5zxoGL_eDK11wFalrUT8rgWY',
  authDomain: 'ratingskill-dc1c2.firebaseapp.com',
  projectId: 'ratingskill-dc1c2',
  storageBucket: 'ratingskill-dc1c2.firebasestorage.app',
  messagingSenderId: '377175599011',
  appId: '1:377175599011:web:7050854ec66cc43d991c16',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  const badgeCount = parseInt((payload.data && payload.data.badge_count) || '0', 10);

  if (badgeCount > 0) {
    navigator.setAppBadge(badgeCount).catch(() => {});
  } else {
    navigator.clearAppBadge().catch(() => {});
  }

  const title = (payload.notification && payload.notification.title) || 'RatingSkill';
  const body = (payload.notification && payload.notification.body) || '';

  if (title || body) {
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
    });
  }
});
