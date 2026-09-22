import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatch } from '../src/dispatch.js';

const env = {
  PUSH_DISPATCH_TOKEN: 'secret',
  VAPID_PUBLIC_KEY: 'public',
  VAPID_PRIVATE_KEY: 'private',
  VAPID_SUBJECT: 'mailto:admin@example.com',
};
const entry = (outboxId, subscriptionId) => ({
  outboxId,
  subscriptionId,
  endpoint: `https://fcm.googleapis.com/fcm/send/${subscriptionId}`,
  p256dh: 'A'.repeat(87),
  auth: 'B'.repeat(22),
  notification: { id: outboxId, title: 'Arbitraje', body: 'Partido pendiente', url: '/partidos/abc' },
});
const request = (entries, token = 'secret') => new Request('https://dispatcher.example.com/', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({ entries }),
});

test('rechaza solicitudes sin token y destinos ajenos a los servicios push', async () => {
  assert.equal((await dispatch(request([entry('a', 's')], 'wrong'), env, async () => 201)).status, 401);
  const invalid = entry('a', 's');
  invalid.endpoint = 'https://example.com/private';
  assert.equal((await dispatch(request([invalid]), env, async () => 201)).status, 400);
});

test('un trabajo se entrega solo cuando todos sus dispositivos tuvieron éxito o expiraron', async () => {
  const response = await dispatch(
    request([entry('a', 's1'), entry('a', 's2'), entry('b', 's3')]),
    env,
    async ({ subscriptionId }) => ({ s1: 201, s2: 503, s3: 410 })[subscriptionId]
  );
  assert.deepEqual(await response.json(), {
    deliveredOutboxIds: ['b'],
    invalidSubscriptionIds: ['s3'],
  });
});
