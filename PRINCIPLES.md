# Principios de Ingeniería — Beauchapp

Este documento existe para que cualquier persona (o IA) que trabaje en Beauchapp entienda **por qué** el código está diseñado como está, y no reintroduzca patrones que ya se descartaron a propósito. No es una guía de estilo visual (eso es [`DESIGN.md`](./DESIGN.md)) ni un checklist de seguridad (eso es [`SECURITY_AND_MAINTENANCE.md`](./SECURITY_AND_MAINTENANCE.md)) — es el "por qué" detrás de ambos.

## Contexto: por qué importan estos principios

Beauchapp es un proyecto comunitario universitario, sin fines de lucro, mantenido por muy poca gente y corriendo sobre infraestructura modesta (un solo servidor PocketBase + SQLite, sin CDN propio más allá de Cloudflare R2, sin equipo de DevOps). No hay presupuesto para escalar horizontalmente ni para absorber facturas grandes de cómputo/ancho de banda. Cada decisión de arquitectura parte de esa realidad. Si una funcionalidad nueva implica más carga en el servidor de la que es estrictamente necesaria, casi siempre hay una forma de evitarlo — y ese es el estándar que se espera.

---

## 1. El servidor hace lo mínimo posible

**Regla general:** si un cómputo se puede hacer en el cliente (navegador/dispositivo del usuario) en vez del servidor, se hace en el cliente. El servidor es el recurso compartido y escaso; el dispositivo de cada usuario es un recurso que ya está pagado y es proporcional a la cantidad de usuarios.

- **Compresión de imágenes en el cliente, nunca en el servidor.** `frontend/src/utils/imageCompressor.ts` redimensiona y comprime a WebP (con fallback a JPEG si el navegador no soporta exportar WebP) *antes* de subir el archivo, apuntando a ~250KB con reducción progresiva de dimensiones. El servidor jamás recibe ni procesa la imagen original de alta resolución.
- **Sin cálculos pesados en hooks de request.** Cualquier lógica que corra sincrónicamente en un hook de PocketBase (`onRecordCreateRequest`, `onRecordUpdate`, etc.) bloquea al único hilo de escritura de SQLite. Evita recorrer colecciones completas, hacer joins manuales costosos, o recalcular agregados desde cero en cada escritura.
  - **Caso de estudio (lección real, no teórica):** el sistema de Karma originalmente recalculaba el karma completo de un usuario (recorriendo todos sus problemas y todas las calificaciones de cada uno) en **cada** creación/edición/borrado de una calificación, más un cron cada 5 minutos que repetía el recorrido completo para *todos* los usuarios. Se corrigió a un modelo incremental (sumar/restar el delta de karma que aporta esa única calificación) con un cron de reconciliación una vez al día, paginado. Antes de agregar un contador/agregado nuevo, pregúntate: ¿esto puede mantenerse por delta, o realmente necesito recorrer todo cada vez?
- **Paginación siempre.** Ninguna consulta a PocketBase debería pedir una colección completa sin `limit`/`offset`. Si ves un límite fijo tipo `5000` como "no debería llegar nunca a ese tope", trátalo como una bandera roja: o se pagina de verdad, o se documenta explícitamente por qué el límite es seguro.

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
4. ¿Estoy guardando o exponiendo más datos de los que hacen falta?
5. ¿Esto rompe el scroll/viewport en Safari móvil?

Si alguna respuesta es dudosa, ese es exactamente el tipo de decisión que vale la pena parar y preguntar antes de implementar.

---

## Mapa de documentación del proyecto

| Documento | Contenido |
|---|---|
| [`README.md`](./README.md) | Qué es Beauchapp, cómo levantar el proyecto en local |
| [`SETUP.md`](./SETUP.md) | Guía de setup detallada (local y producción), variables de entorno |
| [`PRINCIPLES.md`](./PRINCIPLES.md) | Este documento — por qué el código es como es |
| [`DESIGN.md`](./DESIGN.md) | Guía de diseño visual y UX |
| [`SECURITY_AND_MAINTENANCE.md`](./SECURITY_AND_MAINTENANCE.md) | Reglas de seguridad, caveats técnicos, incidentes pasados |
| [`DEPLOY.md`](./DEPLOY.md) | Cómo desplegar a producción — humano y agente de IA |
| [`.agents/AGENTS.md`](./.agents/AGENTS.md) | Reglas operativas para agentes de IA trabajando en este repo |
| [`docs/comments_counter_bug_solution.md`](./docs/comments_counter_bug_solution.md) | Post-mortem del bug de race condition en contadores |
| [`auditoria.md`](./auditoria.md) | Auditoría técnica completa (2026-08-05) |
