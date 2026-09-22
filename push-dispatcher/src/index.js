import { buildPushPayload } from '@block65/webcrypto-web-push';
import { dispatch } from './dispatch.js';

async function sendPush(entry, env) {
  const payload = await buildPushPayload(
    {
      data: JSON.stringify(entry.notification),
      options: { ttl: 86400 },
    },
    {
      endpoint: entry.endpoint,
      expirationTime: null,
      keys: { p256dh: entry.p256dh, auth: entry.auth },
    },
    {
      subject: env.VAPID_SUBJECT,
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
    }
  );
  const response = await fetch(entry.endpoint, { ...payload, redirect: 'manual' });
  return response.status;
}

export default {
  fetch(request, env) {
    return dispatch(request, env, sendPush);
  },
};
