import assert from 'node:assert/strict';
import { generateKeyPairSync, webcrypto } from 'node:crypto';
import test from 'node:test';
import { buildPushPayload } from '@block65/webcrypto-web-push';

test('arma un envío Web Push cifrado y firmado con claves VAPID válidas', async () => {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const vapidJwk = privateKey.export({ format: 'jwk' });
  const vapidPublicKey = Buffer.concat([
    Buffer.from([4]),
    Buffer.from(vapidJwk.x, 'base64url'),
    Buffer.from(vapidJwk.y, 'base64url'),
  ]).toString('base64url');
  const browserKeys = await webcrypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );
  const p256dh = Buffer.from(await webcrypto.subtle.exportKey('raw', browserKeys.publicKey)).toString('base64url');
  const auth = Buffer.from(webcrypto.getRandomValues(new Uint8Array(16))).toString('base64url');

  const payload = await buildPushPayload(
    { data: JSON.stringify({ title: 'Arbitraje', url: '/partidos/abc' }), options: { ttl: 86400 } },
    { endpoint: 'https://fcm.googleapis.com/fcm/send/test', expirationTime: null, keys: { p256dh, auth } },
    { subject: 'mailto:admin@example.com', publicKey: vapidPublicKey, privateKey: vapidJwk.d }
  );

  assert.equal(payload.headers['content-encoding'], 'aes128gcm');
  assert.equal(payload.headers.ttl, '86400');
  assert.match(payload.headers.authorization, /^vapid t=/);
  assert.ok(payload.body.byteLength > 100);
});
