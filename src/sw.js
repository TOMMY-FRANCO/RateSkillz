importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

workbox.setConfig({ debug: false });

workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);
workbox.precaching.cleanupOutdatedCaches();

self.skipWaiting();
self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

firebase.initializeApp({
  apiKey: 'AIzaSyA_7JfjP5d5zxoGL_eDK11wFalrUT8rgWY',
  authDomain: 'ratingskill-dc1c2.firebaseapp.com',
  projectId: 'ratingskill-dc1c2',
  storageBucket: 'ratingskill-dc1c2.firebasestorage.app',
  messagingSenderId: '377175599011',
  appId: '1:377175599011:web:7050854ec66cc43d991c16',
});

var messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  var data = payload.data || {};
  var title = data.title || 'RatingSkill';
  var body = data.body || 'You have new activity';
  var badgeCount = parseInt(data.badge_count || '0', 10);

  if (badgeCount > 0) {
    if (self.navigator && self.navigator.setAppBadge) {
      self.navigator.setAppBadge(badgeCount).catch(function () {});
    }
  } else {
    if (self.navigator && self.navigator.clearAppBadge) {
      self.navigator.clearAppBadge().catch(function () {});
    }
  }

  return self.registration.showNotification(title, {
    body: body,
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    tag: 'ratingskill-notification',
    renotify: true,
    data: { url: '/' },
  });
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if ('focus' in client) {
          if ('navigate' in client) {
            client.navigate(target);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(target);
      }
    })
  );
});
