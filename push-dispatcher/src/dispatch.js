const allowedHosts = new Set([
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
]);

const validEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return false;
  if (typeof entry.outboxId !== 'string' || !entry.outboxId) return false;
  if (typeof entry.subscriptionId !== 'string' || !entry.subscriptionId) return false;
  if (typeof entry.p256dh !== 'string' || !/^[A-Za-z0-9_-]{40,255}$/.test(entry.p256dh)) return false;
  if (typeof entry.auth !== 'string' || !/^[A-Za-z0-9_-]{16,255}$/.test(entry.auth)) return false;
  if (!entry.notification || typeof entry.notification !== 'object') return false;
  if (typeof entry.notification.title !== 'string' || typeof entry.notification.body !== 'string') return false;
  if (typeof entry.notification.url !== 'string' || !entry.notification.url.startsWith('/') || entry.notification.url.startsWith('//')) return false;
  try {
    const url = new URL(entry.endpoint);
    return url.protocol === 'https:' && allowedHosts.has(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
};

export async function dispatch(request, env, sendPush) {
  if (request.method !== 'POST') return new Response('Método no permitido', { status: 405 });
  if (!env.PUSH_DISPATCH_TOKEN || request.headers.get('Authorization') !== `Bearer ${env.PUSH_DISPATCH_TOKEN}`) {
    return new Response('No autorizado', { status: 401 });
  }
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    return new Response('Configuración incompleta', { status: 503 });
  }

  let entries;
  try {
    const body = await request.json();
    entries = body.entries;
  } catch {
    return new Response('JSON inválido', { status: 400 });
  }
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 50 || !entries.every(validEntry)) {
    return new Response('Lote inválido', { status: 400 });
  }

  const failedOutboxIds = new Set();
  const allOutboxIds = new Set(entries.map((entry) => entry.outboxId));
  const invalidSubscriptionIds = new Set();
  // Lotes acotados para evitar que muchos envíos criptográficos compitan a la vez.
  for (let offset = 0; offset < entries.length; offset += 6) {
    const results = await Promise.all(entries.slice(offset, offset + 6).map(async (entry) => {
      try {
        return await sendPush(entry, env);
      } catch {
        return 0;
      }
    }));
    results.forEach((status, index) => {
      const entry = entries[offset + index];
      if (status === 404 || status === 410) invalidSubscriptionIds.add(entry.subscriptionId);
      else if (status < 200 || status >= 300) failedOutboxIds.add(entry.outboxId);
    });
  }

  return Response.json({
    deliveredOutboxIds: [...allOutboxIds].filter((id) => !failedOutboxIds.has(id)),
    invalidSubscriptionIds: [...invalidSubscriptionIds],
  });
}
