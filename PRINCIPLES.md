# Principios de Ingeniería — Beauchapp

Este documento existe para que cualquier persona (o IA) que trabaje en Beauchapp entienda **por qué** el código está diseñado como está, y no reintroduzca patrones que ya se descartaron a propósito. No es una guía de estilo visual (eso es [`DESIGN.md`](./DESIGN.md)) ni un checklist de seguridad (eso es [`SECURITY_AND_MAINTENANCE.md`](./SECURITY_AND_MAINTENANCE.md)) — es el "por qué" detrás de ambos.

## Contexto: por qué importan estos principios

Beauchapp es un proyecto comunitario universitario, sin fines de lucro, mantenido por muy poca gente y corriendo sobre infraestructura modesta (un solo servidor PocketBase + SQLite, sin CDN propio más allá de Cloudflare R2, sin equipo de DevOps). No hay presupuesto para escalar horizontalmente ni para absorber facturas grandes de cómputo/ancho de banda. Cada decisión de arquitectura parte de esa realidad. Si una funcionalidad nueva implica más carga en el servidor de la que es estrictamente necesaria, casi siempre hay una forma de evitarlo — y ese es el estándar que se espera.

---

## 1. El servidor hace lo mínimo posible

**Cuál es el servidor, en números medidos (2026-08-20).** No es una metáfora: es un
**Intel Atom x5-Z8300 con 2 GB de RAM**, en la casa del autor, conectado por cable al router.
La conexión da **~300 Mbps de bajada pero solo ~10,6 Mbps de subida**, y servir un sitio
consume subida. Para dimensionar: el pico real de tráfico registrado fue de 268 peticiones por
minuto, y el feed de 20 posts son ~19 KB de JSON (~5 KB comprimido).

Consecuencias prácticas: una petición de más por usuario se multiplica por todos los usuarios;
cualquier cosa que se pueda cachear en Cloudflare deja de costar; y un cómputo pesado en un
hook no compite con "el servidor", compite con los demás usuarios.

**Regla general:** si un cómputo se puede hacer en el cliente (navegador/dispositivo del usuario) en vez del servidor, se hace en el cliente. El servidor es el recurso compartido y escaso; el dispositivo de cada usuario es un recurso que ya está pagado y es proporcional a la cantidad de usuarios.

- **Compresión de imágenes en el cliente, nunca en el servidor.** `frontend/src/utils/imageCompressor.ts` (web, basado en Canvas) y su equivalente `compressImageNative` (nativo/iOS/Android, basado en `expo-image-manipulator`, ya que Canvas/DOM no existen fuera del navegador) redimensionan y comprimen la imagen *antes* de subirla, con reducción progresiva de dimensiones apuntando a ~250KB en la versión web. El servidor jamás recibe ni procesa la imagen original de alta resolución. El formato de salida (WebP vs. JPEG) no es arbitrario — ver el punto sobre thumbnails en la sección 2.
- **Sin cálculos pesados en hooks de request.** Cualquier lógica que corra sincrónicamente en un hook de PocketBase (`onRecordCreateRequest`, `onRecordUpdate`, etc.) bloquea al único hilo de escritura de SQLite. Evita recorrer colecciones completas, hacer joins manuales costosos, o recalcular agregados desde cero en cada escritura.
  - **Caso de estudio (lección real, no teórica):** el sistema de Karma originalmente recalculaba el karma completo de un usuario (recorriendo todos sus problemas y todas las calificaciones de cada uno) en **cada** creación/edición/borrado de una calificación, más un cron cada 5 minutos que repetía el recorrido completo para *todos* los usuarios. Se corrigió a un modelo incremental (sumar/restar el delta de karma que aporta esa única calificación) con un cron de reconciliación una vez al día, paginado. Antes de agregar un contador/agregado nuevo, pregúntate: ¿esto puede mantenerse por delta, o realmente necesito recorrer todo cada vez?
  - **El mismo patrón ya se replicó varias veces** y es el default esperado para cualquier contador derivado de una relación: `activities.pb.js` mantiene `like_count`/`attendee_count` sobre `activity_likes`/`activity_attendees`, `forum.pb.js` mantiene `commentCount`/`quoteCount` sobre `posts`, y `marketplace.pb.js` mantiene `recommendations_count` sobre `seller_recommendations`. Los tres siguen la misma forma: `onRecordCreateRequest`/`onRecordDeleteRequest` (síncrono, antes de que salga la respuesta HTTP) que suman/restan 1 al campo del registro relacionado vía `$app.findRecordById` + `.set()` + `$app.save()`, con `Math.max(0, ...)` al restar. Si vas a mostrar un conteo derivado de una relación (likes, recomendaciones, comentarios, lo que sea), replica este patrón — no lo recalcules leyendo la relación completa en cada request.
- **Paginación siempre.** Ninguna consulta a PocketBase debería pedir una colección completa sin `limit`/`offset`. Si ves un límite fijo tipo `5000` como "no debería llegar nunca a ese tope", trátalo como una bandera roja: o se pagina de verdad, o se documenta explícitamente por qué el límite es seguro.
- **Evita patrones N+1: una consulta bien filtrada, no un loop de N peticiones.** Si necesitas datos relacionados de una lista de registros (comentarios de N posts, perfiles de N vendedores, etc.), arma un único filtro que traiga todo de una vez (`id = "a" || id = "b" || ...`, o mejor aún un campo que agrupe la relación) en vez de iterar y pedir uno por uno.
  - **Caso de estudio:** `PostDetailScreen` armaba la cadena de ancestros de un hilo (post → su padre → el padre de ese → ...) haciendo un `getOne()` secuencial por cada nivel de profundidad — O(profundidad del hilo) requests. Se corrigió aprovechando que `forum.pb.js` ya mantiene un campo `root` en cada post (el id del post raíz del hilo, propagado en creación), lo que permite traer *todo* el hilo en una sola consulta filtrada `(id = rootId || root = rootId)` y reconstruir la cadena en memoria en el cliente. Antes de escribir un loop que hace una consulta por iteración, pregúntate si existe (o vale la pena agregar) un campo que te permita pedirlo todo de una vez.
  - Lo mismo aplica a agregados calculados en vivo con una consulta extra por cada ítem de una lista (ej. contar recomendaciones de cada vendedor mostrado en un listado de productos) — la solución casi siempre es el patrón de contador incremental de arriba, no optimizar el loop.
- **Excluir contenido de una relación del usuario autenticado se hace en la regla de la colección (`listRule`/`viewRule`), no con un filtro extra armado en el cliente.** PocketBase soporta traversal de relación inversa en expresiones de regla vía `<coleccion>_via_<campo>` (documentado en `backend/pb_data/types.d.ts`, comentario de `RecordFieldResolver.resolve`: `screen.project_via_prototype.name`, `@request.auth.someRelation.name`). Esto permite referenciar, desde la regla de cualquier colección, una relación del usuario autenticado sin que el cliente tenga que pedirla aparte y armar un filtro de ids.
  - **Caso de estudio:** el bloqueo de usuarios (`blocked_users`, `backend/pb_migrations/1784200100_add_blocking_rules.js`) excluye contenido de usuarios bloqueados agregando esta cláusula a `listRule`/`viewRule` de cada colección relevante: `campo.id != @request.auth.blocked_users_via_blocker.blocked.id && campo.id != @request.auth.blocked_users_via_blocked.blocker.id`. Una sola cláusula cubre ambas direcciones del bloqueo, funciona igual sobre relaciones simples (`author`) y sobre relaciones múltiples (`team_red`/`team_blue` en `ladder_matches`, hasta 2 usuarios cada una — verificado que `!=` excluye el registro si *cualquiera* de los valores coincide), y con `@request.auth` vacío (petición anónima) se resuelve a "sin match", por lo que no rompe colecciones que ya eran públicas.
  - Antes de usar este patrón por primera vez en una colección nueva, verifícalo con un spike contra una copia aislada de PocketBase (crear el registro relacionado + probar `getList`/`getOne` en ambas direcciones) antes de replicarlo — no hay garantía de que la sintaxis exacta se comporte igual para toda combinación de tipos de relación sin probarla.
- **Peticiones independientes se piden en paralelo, nunca en cadena.** Si dentro de una función de carga (`fetchX`, `loadData`, etc.) hay dos o más llamadas a la red que no dependen del resultado de la otra, se lanzan juntas con `Promise.allSettled` (o `Promise.all` cuando el fallo de una realmente debe abortar toda la operación) en vez de encadenar `await`s uno tras otro — cada `await` secuencial de una llamada independiente sólo suma latencia sin necesidad.
  - Usa `Promise.allSettled` por defecto: preserva el manejo de error individual de cada llamada (una puede fallar en silencio con solo un `console.error`, sin tumbar las demás), replicando exactamente la granularidad que tenía el código secuencial original.
  - Usa `Promise.all` únicamente cuando el fallo de esa llamada específica debe hacer fallar toda la carga de la pantalla (ej. el registro principal de un detalle, sin el cual no hay nada que mostrar).
  - Antes de agregar una nueva llamada a una función de carga existente, revisa si depende genuinamente del resultado de otra `await` de esa misma función, o si solo está ahí porque se escribió en orden — si es lo segundo, únela al `Promise.all`/`allSettled` existente.

## 2. Los archivos (imágenes, fotos) se sirven directo desde R2, no proxeados por el servidor

Cloudflare R2 es el único backend de almacenamiento permitido — **nunca se guardan archivos en el disco local del servidor** (`backend/pb_hooks/storage_guard.pb.js` lo garantiza a nivel de hook: si R2/S3 no está configurado y llega un upload, se rechaza explícitamente en vez de caer al disco local).

Más allá de eso, el patrón por diseño es que el **cliente pida las imágenes directo a R2**, sin pasar por PocketBase como intermediario, siempre que sea posible:

```ts
// frontend/src/services/pocketbase.ts — getFileUrl()
// Si hay EXPO_PUBLIC_R2_URL configurado y NO se pide una miniatura,
// se arma la URL directa al CDN de R2 y se evita el proxy de PocketBase.
if (r2Url && !size) {
  return `${base}/${col}/${recordObj.id}/${filename}`;
}
// Solo si se pide un thumbnail (ej. '100x100'), se usa el proxy de
// PocketBase para que lo genere lazily.
```

Esto significa: cada foto de perfil, cada imagen de un post, se descarga desde la red de Cloudflare, no desde el servidor de la app. El servidor de PocketBase solo entra en el camino cuando hace falta un thumbnail generado dinámicamente. Si agregas una funcionalidad nueva que muestra imágenes, usa `getFileUrl()` — no construyas URLs de archivos a mano.

**Regla vigente (2026-08-20): del CDN todo, salvo las miniaturas realmente chicas.**
`getFileUrl(record, filename, size)` — el tercer argumento decide si la petición va directo a
R2 (sin `size`) o pasa por PocketBase (con `size`):

| Qué se muestra | Cómo se pide | Por qué |
|---|---|---|
| Fotos de perfil y escudos en listas (≤ 60 px), tarjetas del marketplace, previews del editor | `'100x100'` / `'300x300'` por el proxy | Son 7-35 KB. Pedir el original serían 30-190 KB para un círculo de 40 px. |
| Todo lo demás: foto de un post en el feed, banners de actividades, fotos de Tinder, galerías, avatares grandes | **sin `size`**, directo a R2 | Salen del CDN de Cloudflare y no tocan el servidor. |

Esto **cambió** respecto de la regla anterior, que decía "en listados siempre pasa un `size`".
El motivo del cambio, medido en producción: las miniaturas también las cachea Cloudflare
(PocketBase las devuelve con `cache-control: max-age=2592000`, y responden `cf-cache-status:
HIT`), así que el proxy casi nunca era el problema real; y a cambio, cada tamaño que se pide
es una oportunidad de equivocarse en silencio (ver los dos párrafos siguientes). El costo del
cambio está medido y aceptado: la foto de un post en el feed pasa de ~52 KB a ~183 KB de
mediana, servidos por el CDN en vez del homeserver.

**Un `?thumb=` puede devolver la imagen original sin avisar, por dos razones distintas.** No
da error, no da warning: devuelve los bytes completos y todo "se ve bien".

1. **El tamaño no está declarado en el campo.** PocketBase solo genera los tamaños listados en
   `thumbs` de ese campo de archivo. Pedir `300x300` a `posts.photo` (que declara `400x0` y
   `800x0`) devolvía la original — 174,8 KB en vez de 52,4 KB. Había dos casos así en el
   código hasta que se corrigieron.
2. **El archivo de origen es WebP** (ver el párrafo siguiente).

La forma de comprobarlo es comparar bytes, no mirar la pantalla:

```bash
curl -so /dev/null -w "%{size_download}\n" "$URL"              # original
curl -so /dev/null -w "%{size_download}\n" "$URL?thumb=400x0"  # si da lo mismo, no hay miniatura
```

Los tamaños declarados hoy son: `users.avatar` 100x100/500x500 · `users.matchPhoto` y
`team_players.photo` 100x100/300x300 · `posts.photo`, `tinder_profiles.photos` y
`activities.banner` 400x0/800x0 · `marketplace_items.images` 300x300/800x0 ·
`blocked_users.blocked_avatar` 100x100 · `attachments.file` ninguno.

**Optimización pendiente, ya verificada:** las miniaturas que genera PocketBase quedan
guardadas en R2 y **son accesibles directo por el CDN**, en
`{colección}/{registro}/thumbs_{archivo}/{tamaño}_{archivo}` (comprobado: responde 200). O sea
que se podría tener lo mejor de los dos mundos — pocos bytes *y* sin pasar por el servidor. Lo
que falta resolver es que las miniaturas se generan de forma perezosa, en la primera petición
que pasa por el proxy: si nadie pasa nunca por el proxy, la miniatura de una imagen nueva no
existe y el CDN devuelve 404. Hace falta o un `onError` que caiga al proxy, o un hook que
fuerce la generación al subir el archivo.

**Sube imágenes como JPEG (o PNG), no WebP, en cualquier colección con `thumbs` configurado.** El generador de thumbnails de PocketBase (`github.com/disintegration/imaging`) no sabe decodificar WebP como formato de origen — si el archivo almacenado es `.webp`, una petición `?thumb=400x0` sirve el original completo en silencio, sin error, dando una falsa sensación de que el ahorro de datos está funcionando cuando no es así (verificado empíricamente: mismo tamaño de bytes exacto entre "thumb" y original). Por eso `compressImage`/`compressImageNative` se llaman con `format: 'image/jpeg'` explícito en todo lo que sube a `posts`, `marketplace_items`, `activities` y `tinder_profiles` (vía `ImagePicker.tsx`, `MarketplaceItemEditorScreen.tsx`, `TinderScreen.tsx`) — el mismo patrón que ya usaba `SettingsScreen` para avatares, que es la razón por la que esos thumbnails sí funcionaban antes de que el resto se corrigiera. WebP sigue siendo válido únicamente para archivos que no se van a mostrar en miniatura vía PocketBase (ej. adjuntos de `ProblemEditorScreen`, que van a la colección `attachments` sin `thumbs`).

## 3. Minimizar los datos sensibles que se manejan y exponen

- **No pidas ni guardes más de lo que necesitas.** Antes de agregar un campo nuevo a una colección, pregúntate si realmente hace falta guardarlo, o si se puede derivar/calcular.
- **Redacta agresivamente lo que no debería ser visible.** Ejemplos ya implementados: los posts marcados `deleted` se redactan (`content`, `photo`, `author`) para cualquiera que no sea admin (`forum.pb.js`); los datos de contacto de un perfil de Tinder Beauchef (Instagram, WhatsApp, Telegram, Signal) se blanquean para cualquiera que no sea el dueño o tenga un match activo (`tinder.pb.js`).
- **Restringe el acceso por dominio institucional.** El registro solo acepta correos `@ing.uchile.cl` para cuentas de estudiante — es tanto una decisión de producto como una forma de mantener acotada la superficie de datos personales que la app maneja.
- **Protege los campos de auto-escalación de privilegios.** `type`, `subtype` y `verified` en `users` están bloqueados contra escritura por no-superusuarios (`auth.pb.js`) — un estudiante nunca puede auto-verificarse ni auto-asignarse como organización.

## 4. Seguridad por defecto

Ver [`SECURITY_AND_MAINTENANCE.md`](./SECURITY_AND_MAINTENANCE.md) para el detalle de reglas de colección, sanitización de Markdown/LaTeX (DOMPurify + iframe sandboxed) y SRI en scripts de CDN. Resumen de las reglas que no se negocian:

- Nunca sobrescribir de un tirón una `updateRule`/`createRule` compleja existente — siempre anexar con `&&` a la regla actual, revisando el diff a mano.
- Todo filtro de PocketBase se arma con el patrón parametrizado `{:param}` + `.bind()`, nunca interpolando strings directamente en el filtro.
- `start.sh` nunca debe correr con `--dev` en producción (logging verboso de SQL, respuestas de error detalladas).
- Cualquier HTML generado a partir de contenido de usuario pasa por DOMPurify antes de renderizarse.

## 5. Diseño minimalista y utilitario

Ver [`DESIGN.md`](./DESIGN.md) para la guía completa (paleta, tipografía, prohibiciones). La idea de fondo: contraste sobre adornos, sin sombras ni gradientes, esquinas poco redondeadas, cero distracciones. Esto también es, indirectamente, una decisión de rendimiento: menos efectos visuales complejos = menos trabajo de renderizado, especialmente relevante en dispositivos móviles de gama baja.

## 6. Es una PWA — compatibilidad con Safari y Chrome es un requisito, no un nice-to-have

Beauchapp se usa mayoritariamente desde el navegador móvil (instalada como PWA), y una parte significativa de los usuarios está en iOS/Safari. Esto impone restricciones concretas ya resueltas en el código — no las reinventes ni las rompas:

- **Scroll defensivo:** el contenedor raíz fuerza `100dvh` (dynamic viewport height) para no cortarse detrás de las barras de navegación móviles, y `overscroll-behavior-y: contain` / `overscroll-behavior-x: none` para bloquear el rebote elástico y los gestos de swipe-back del navegador. Ver `frontend/public/index.html` (el `<style id="expo-reset">` inicial) y la reinyección equivalente en `App.tsx` para cuando Expo remonta el DOM.
- **Meta tags específicas de iOS Safari** para el modo PWA instalado (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `theme-color`, `manifest.json`, íconos `apple-touch-icon` y maskable) ya están en `frontend/public/`. No agregues una segunda fuente de verdad para esto.
- **Layout responsivo por ancho, no por user-agent:** el punto de corte desktop/móvil es `useWindowDimensions` a los 800px (sidebar anclado vs. cajón flotante), no detección de plataforma.
- **Feedback visual estandarizado:** usa siempre `withMinimumDelay(asyncFn, 400)` (`frontend/src/utils/refresh.ts`) en llamadas de refresco, para que los spinners no parpadeen en redes rápidas ni se sientan más lentos de lo necesario en redes lentas. Pull-to-refresh usa el indicador nativo superior; refresco por botón de header o carga inicial usa el `ActivityIndicator` central de pantalla completa.

## 7. Antes de escribir código nuevo

Pregúntate, en orden:
1. ¿Esto puede vivir en el cliente en vez del servidor?
2. ¿Esto ya se sirve/calcula en otro lado y lo estoy duplicando?
3. ¿Esta consulta está paginada / es incremental, o recorre todo cada vez?
4. ¿Estoy haciendo N peticiones donde una sola, bien filtrada, alcanzaría?
5. ¿Hay llamadas independientes en esta función que debería paralelizar con `Promise.all`/`allSettled` en vez de encadenar `await`s?
6. Si esto muestra una imagen: ¿estoy pidiendo el tamaño más chico que la vista necesita, y subiendo en un formato (JPEG) del que PocketBase pueda generar thumbnails?
7. ¿Estoy guardando o exponiendo más datos de los que hacen falta?
8. ¿Esto rompe el scroll/viewport en Safari móvil?

Si alguna respuesta es dudosa, ese es exactamente el tipo de decisión que vale la pena parar y preguntar antes de implementar.

---

## Mapa de documentación del proyecto

| Documento | Contenido |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Orientación para una sesión nueva: arquitectura, dónde está cada cosa, trampas conocidas |
| [`README.md`](./README.md) | Qué es Beauchapp, cómo levantar el proyecto en local |
| [`SETUP.md`](./SETUP.md) | Guía de setup detallada (local y producción), variables de entorno |
| [`PRINCIPLES.md`](./PRINCIPLES.md) | Este documento — por qué el código es como es |
| [`DESIGN.md`](./DESIGN.md) | Guía de diseño visual y UX |
| [`SECURITY_AND_MAINTENANCE.md`](./SECURITY_AND_MAINTENANCE.md) | Reglas de seguridad, caveats técnicos, incidentes pasados |
| [`DEPLOY.md`](./DEPLOY.md) | Cómo desplegar a producción — humano y agente de IA |
| [`.agents/AGENTS.md`](./.agents/AGENTS.md) | Reglas operativas para agentes de IA trabajando en este repo |
| [`docs/comments_counter_bug_solution.md`](./docs/comments_counter_bug_solution.md) | Post-mortem del bug de race condition en contadores |
| [`auditoria-2026-08-19.md`](./auditoria-2026-08-19.md) | **Auditoría técnica vigente** (2026-08-19) |
| [`auditoria.md`](./auditoria.md) | Auditoría anterior (2026-08-05), superada — se conserva como registro histórico |
