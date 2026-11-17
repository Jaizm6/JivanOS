// JivanOS Service Worker & Notification Handler
// Supports background notifications, FCM push payload delivery, and notification action clicks

const CACHE_NAME = 'omnilifeos-v2';
const PRECACHE_ASSETS = [
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

// Fast, non-blocking fetch handler that never intercepts Vite dev/HMR modules or API calls
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Skip cross-origin requests, API routes, websockets, and Vite module/dev requests
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.ts') ||
    url.searchParams.has('t') ||
    url.searchParams.has('v') ||
    url.protocol.startsWith('ws')
  ) {
    return;
  }

  // Navigation requests: network-first with fast offline fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match('/index.html') || await caches.match('/');
        return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
      })
    );
    return;
  }

  // Static production assets (icons, manifest, built assets): Stale-while-revalidate
  if (
    url.pathname.startsWith('/assets/') ||
    PRECACHE_ASSETS.includes(url.pathname)
  ) {
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
  }
});

// Handle incoming Web Push / FCM notifications
self.addEventListener('push', event => {
  let data = {
    title: '⏰ Task Reminder',
    body: 'You have a scheduled task due now in JivanOS.',
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
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    tag: data.tag || 'omnilifeos-task-alert',
    renotify: true,
    requireInteraction: true,
    vibrate: [250, 120, 250, 120, 350],
    data: data.data || {},
    actions: [
      { action: 'complete', title: '✓ Complete' },
      { action: 'snooze', title: '⏱ Snooze 5m' },
      { action: 'open', title: '👀 Open' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Allow main app to delegate showing system OS notifications reliably through SW
self.addEventListener('message', event => {
  const msg = event.data || {};
  if (msg.type === 'SHOW_SYSTEM_NOTIFICATION' && msg.title) {
    event.waitUntil(
      self.registration.showNotification(msg.title, msg.options || {})
    );
  }
});

// Handle Notification Clicks (Focus app or open with action params)
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const action = event.action || 'open';
  const taskId = event.notification.data?.taskId || '';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
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
      if (self.clients.openWindow) {
        const targetUrl =
          taskId && (action === 'snooze' || action === 'complete')
            ? `/?notifAction=${encodeURIComponent(action)}&taskId=${encodeURIComponent(taskId)}`
            : '/';
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
