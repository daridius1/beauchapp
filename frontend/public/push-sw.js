/* global self, clients */

// Este worker no contiene credenciales ni decide permisos: recibe un payload cifrado
// por Web Push, muestra un aviso visible y abre una ruta interna ya validada por el
// servidor. Mantenerlo como archivo estático de raíz le da alcance sobre toda la PWA.
self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {};
  const title = typeof payload.title === 'string' ? payload.title : 'Beauchapp';
  const body = typeof payload.body === 'string' ? payload.body : 'Tienes una nueva notificación.';
  const url = typeof payload.url === 'string' && payload.url.startsWith('/') ? payload.url : '/notifications';
  const notificationId = typeof payload.id === 'string' ? payload.id : '';

  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: notificationId ? `beauchapp-${notificationId}` : undefined,
    data: { url },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/notifications';

  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (windows.length > 0) {
      await windows[0].navigate(url);
      return windows[0].focus();
    }
    return clients.openWindow(url);
  })());
});
