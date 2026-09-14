# Web Push en Beauchapp

La PWA registra `push-sw.js` desde la raíz y guarda una suscripción por navegador en
`push_subscriptions`. PocketBase no envía Web Push directamente: deja cada aviso en
`push_outbox` y el cron `dispatch_web_push` entrega como máximo 25 trabajos por minuto a
un dispatcher externo. Así el Atom no asume la criptografía VAPID ni una llamada de red por
cada seguidor dentro de un hook.

## Variables

En el build del frontend se necesita `EXPO_PUBLIC_PUSH_VAPID_PUBLIC_KEY` con la clave pública
VAPID codificada en base64url. Como cualquier `EXPO_PUBLIC_*`, hay que definirla antes de
compilar el bundle con caché limpia.

En el servidor se necesitan `PUSH_DISPATCH_URL` y `PUSH_DISPATCH_TOKEN`. La clave privada
VAPID queda solamente como secreto del dispatcher. Mientras falte alguna de esas dos variables,
no se crean trabajos de cola ni se intenta enviar nada.

## Contrato del dispatcher

Recibe `POST` con `Authorization: Bearer <PUSH_DISPATCH_TOKEN>` y un cuerpo
`{ entries: [...] }`. Cada entrada incluye `outboxId`, `subscriptionId`, `endpoint`, `p256dh`,
`auth` y `notification` (`id`, `title`, `body`, `url`). Debe enviar cada payload con Web Push
estándar/VAPID y responder:

```json
{
  "deliveredOutboxIds": ["..."],
  "invalidSubscriptionIds": ["..."]
}
```

Un `404` o `410` del proveedor push se informa como suscripción inválida; PocketBase la
desactiva. Errores transitorios se omiten de `deliveredOutboxIds` y la cola reintenta hasta
cinco veces. El servicio debe aceptar solamente esta autenticación y no registrar endpoint,
claves ni contenido de los avisos.

En iOS/iPadOS la persona debe instalar Beauchapp en la pantalla de inicio antes de activar el
permiso. El botón de Configuración nunca pide permiso automáticamente: el navegador lo solicita
solo después de tocarlo.
