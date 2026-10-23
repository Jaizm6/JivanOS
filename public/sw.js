// OmniLifeOS Service Worker & Notification Handler
// Supports background notifications, FCM push payload delivery, and notification action clicks

const CACHE_NAME = 'omnilifeos-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// Cache-first / Stale-while-revalidate fetch handler
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Skip API or websocket requests
  if (url.pathname.startsWith('/api') || url.protocol.startsWith('ws')) {
    return;
  }

  // Navigation requests: network-first with cache fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match('/index.html') || await caches.match('/');
        return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
      })
    );
    return;
  }

  // Static assets: Stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

// Handle incoming Web Push / FCM notifications
self.addEventListener('push', event => {
  let data = {
    title: '⏰ Task Reminder',
    body: 'You have a scheduled task due now in OmniLifeOS.',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: 'omnilifeos-task-alert',
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      if (payload.notification) {
        data.title = payload.notification.title || data.title;
        data.body = payload.notification.body || data.body;
        data.icon = payload.notification.icon || data.icon;
      } else if (payload.title) {
        data = { ...data, ...payload };
      }
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon.svg',
    badge: data.badge || '/icon.svg',
    tag: data.tag || 'omnilifeos-task-alert',
    renotify: true,
    requireInteraction: true, // Keeps alert visible until acted upon
    vibrate: [300, 150, 300, 150, 400],
    data: data.data || {},
    actions: [
      { action: 'open', title: '👀 View Task' },
      { action: 'snooze', title: '⏱ Snooze 5m' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle Notification Clicks (Focus app or handle snooze/open)
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const action = event.action;
  const taskId = event.notification.data?.taskId;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // If a client window is already open, focus it and post a message
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (action === 'snooze') {
            client.postMessage({ type: 'NOTIFICATION_ACTION_SNOOZE', taskId });
          } else if (action === 'complete') {
            client.postMessage({ type: 'NOTIFICATION_ACTION_COMPLETE', taskId });
          }
          return;
        }
      }
      // If no window is open, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
