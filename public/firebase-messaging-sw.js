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
  const data = payload.data || {};
  const notif = payload.notification || {};

  const title = notif.title || data.title || 'RatingSkill';
  const body = notif.body || data.body || 'You have new activity';
  const badgeCount = parseInt(data.badge_count || '0', 10);

  if (badgeCount > 0) {
    self.navigator.setAppBadge && self.navigator.setAppBadge(badgeCount).catch(function () {});
  } else {
    self.navigator.clearAppBadge && self.navigator.clearAppBadge().catch(function () {});
  }

  return self.registration.showNotification(title, {
    body: body,
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    data: { url: '/' },
  });
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(target);
      }
    })
  );
});
