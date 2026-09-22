# Web Push en Beauchapp

La PWA registra `push-sw.js` desde la raíz y guarda una suscripción por navegador en
`push_subscriptions`. PocketBase no envía Web Push directamente: deja cada aviso en
`push_outbox` y el cron `dispatch_web_push` entrega hasta 25 trabajos por minuto a
`push-dispatcher/`, con un máximo de 50 dispositivos por lote. Así el Atom no asume la
criptografía VAPID ni una llamada de red por cada seguidor dentro de un hook.

## Variables

En el build del frontend se necesita `EXPO_PUBLIC_PUSH_VAPID_PUBLIC_KEY` con la clave pública
VAPID codificada en base64url. Como cualquier `EXPO_PUBLIC_*`, hay que definirla antes de
compilar el bundle con caché limpia.

En el servidor se necesitan `PUSH_DISPATCH_URL` y `PUSH_DISPATCH_TOKEN`. La clave privada
VAPID queda solamente como secreto del dispatcher. Mientras falte alguna de esas dos variables,
no se crean trabajos de cola ni se intenta enviar nada.

## Preparación del dispatcher

`push-dispatcher/` es un Cloudflare Worker independiente del sitio. Instala sus dependencias
con `pnpm install`, genera un par de claves VAPID con `pnpm keys` y configura estos cuatro
secretos del Worker con `wrangler secret put <NOMBRE>`:

- `PUSH_DISPATCH_TOKEN`: token aleatorio compartido solo con PocketBase.
- `VAPID_PUBLIC_KEY`: clave pública del mismo par usado en el build del frontend.
- `VAPID_PRIVATE_KEY`: clave privada del par; nunca va al frontend ni a PocketBase.
- `VAPID_SUBJECT`: contacto `mailto:` del responsable del servicio.

Tras desplegar el Worker, usa su URL HTTPS como `PUSH_DISPATCH_URL` en el servidor y
recompila el frontend con `EXPO_PUBLIC_PUSH_VAPID_PUBLIC_KEY` y caché limpia. El botón de
Configuración solo puede activar avisos cuando la clave pública está en el bundle.
La URL y el token deben estar listos antes de habilitar el botón para usuarios reales.
El Worker de producción de este proyecto quedó en
`https://beauchapp-push-dispatcher.daridius.workers.dev` y tiene desactivadas las URL de
vista previa.

Antes de activar producción, comprueba un envío en un dispositivo Android y uno iOS
instalado, con la app cerrada, y que el toque abra el partido correcto. No reutilices
una clave VAPID nueva para suscripciones viejas: habría que volver a suscribir esos
navegadores.

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
desactiva. Un trabajo solo figura como entregado cuando todos sus dispositivos aceptaron
el aviso o devolvieron `404`/`410`. Errores transitorios se omiten de `deliveredOutboxIds`
y la cola reintenta hasta cinco veces. El servicio acepta solamente esta autenticación y
no registra endpoint, claves ni contenido de los avisos. El lote se limita a 50 envíos
para caber en el límite de solicitudes externas de Workers Free.

En iOS/iPadOS la persona debe agregar Beauchapp a la pantalla de inicio antes de activar el
permiso. En Android compatible puede hacerlo desde el navegador sin instalarla. El botón de
Configuración nunca pide permiso automáticamente: el navegador lo solicita solo después de
tocarlo. Al cerrar sesión, la suscripción de ese navegador se da de baja; si otra persona
inicia sesión en el mismo dispositivo, debe activar sus propios avisos.
