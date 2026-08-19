# Notas de Seguridad y Mantenimiento (Beauchapp)

Este documento contiene un registro de ajustes importantes de seguridad, auditorías y detalles técnicos de los que hay que tener precaución (caveats) en el futuro desarrollo de la aplicación.

## 1. Reglas de Colección en PocketBase (API Rules)

**Problema Histórico:**
Las auditorías de seguridad suelen sugerir bloquear modificaciones a registros sensibles (ej. evitar que se actualicen posts que tienen `deleted = true`). Al aplicar estas restricciones desde migraciones automáticas o sugeridas por IA, es común que se **sobrescriban por completo** las reglas complejas preexistentes.

**Caso de los Likes en `posts`:**
- Para que un usuario distinto al autor pueda dar un "like", la colección de `posts` tiene una `updateRule` compleja que permite actualizaciones a no-autores **solo** si los campos modificados son estrictamente permitidos (ej. `commentCount` o no modificar `content`, `author`, etc.).
- **OJO PARA EL FUTURO:** Si alguna vez se necesita agregar una nueva condición de seguridad a los `posts`, **NUNCA** se debe sobrescribir la regla completa. Se debe usar el operador `&&` y anexar a la regla preexistente.
  - *Regla actual segura:* `"deleted = false && @request.auth.id != '' && (@request.auth.id = author || ((@request.body.author:isset = false || @request.body.author = author) && (@request.body.content:isset = false || @request.body.content = content) && (@request.body.tags:isset = false || @request.body.tags = tags) && (@request.body.replyTo:isset = false || @request.body.replyTo = replyTo) && (@request.body.root:isset = false || @request.body.root = root) && (@request.body.commentCount:isset = false || @request.body.commentCount = commentCount)))"`

---

## 2. Renderizado de Markdown y LaTeX en Frontend (DOMPurify & Sandbox)

**Contexto:**
Para solucionar vulnerabilidades de inyección de código (Stored XSS) en los enunciados y respuestas (ya que cualquier usuario podría poner `<script>` en sus textos), se implementaron dos barreras en el componente `MarkdownRenderer.tsx`:

1. **DOMPurify:** Sanitiza el HTML antes de renderizarlo.
2. **iframe Sandbox:** Aisla el contenido (`sandbox="allow-scripts"` sin `allow-same-origin`) para que no pueda acceder al `localStorage` de la aplicación principal ni robar tokens.

**Efectos Secundarios a tener en cuenta (OJO):**
- **Bloqueo de iframes/videos:** DOMPurify, por defecto, purga (borra) etiquetas como `<iframe>`, `<object>`, `<embed>` o scripts en línea (ej. `onclick="..."`). 
- Si en el futuro un profesor o usuario de Beauchapp se queja de que está intentando incrustar un video de YouTube en el Markdown de un problema y este simplemente "desaparece" o "no se ve", **no es un bug**. Es DOMPurify protegiendo la app.
- **Solución futura (si es necesaria):** Si explícitamente se desea permitir videos de YouTube, se debe configurar DOMPurify en `MarkdownRenderer.tsx` para permitir la etiqueta `iframe` y validar que el dominio de origen (`src`) sea exclusivamente `youtube.com`.

---

## 3. Scripts de CDN Externos (SRI - Subresource Integrity)

**Contexto:**
Los scripts de KaTeX, Marked, Mermaid y DOMPurify se cargan desde CDNs en el renderizador de Markdown. Tienen hashes de integridad (`integrity="sha384-..."`) para evitar ataques de cadena de suministro (Man-in-the-Middle al CDN).

**Efectos Secundarios a tener en cuenta:**
- Las versiones de estos scripts están estrictamente fijadas en la URL (ej. `@5.1.2`). 
- **NUNCA** se debe cambiar el número de versión en el atributo `src` sin actualizar simultáneamente el hash criptográfico del atributo `integrity`. Si se cambian las versiones y no el hash, el navegador se negará a cargar las matemáticas (LaTeX) o el texto en la aplicación, dejando el foro roto.

---

## 4. Usuarios y Estado de Verificación (`verified`)

**Contexto:**
Los hooks de PocketBase en `pb_hooks/main.pb.js` tienen reglas interceptando la creación (`onRecordCreateRequest`) y actualización de usuarios (`onRecordUpdateRequest`).

**OJO PARA EL FUTURO:**
- Los usuarios nuevos forzosamente nacen con `verified = false` a menos que sea un Administrador quien los cree por el panel. 
- La aplicación descarta cualquier intento de un estudiante de enviar `{"verified": true}` desde el frontend (vía el cliente `pb.collection('users').update()`). Esto previene auto-verificaciones fraudulentas.

---

## 5. Páginas HTML de administración servidas por hooks (XSS)

**Contexto:**
Seis rutas de los hooks sirven páginas HTML completas: `/admin/liga`, `/admin/horarios`, `/admin/beaumarket`, `/admin/reviews-import`, `/admin/generate-link` y `/register-org`. Son ~2.360 líneas de HTML/CSS/JS dentro de template strings en archivos `.pb.js`: **no pasan por TypeScript, ni por lint, ni por ningún test**. Es el único código del proyecto sin ninguna red de seguridad automática, y es exactamente donde apareció el único hallazgo alto de la auditoría del 2026-08-19.

**Incidente confirmado (corregido el 2026-08-19):**
`/admin/liga` armaba las filas del roster con `row.innerHTML = '...' + t.name`, donde `t.name` es el nombre de una cuenta de equipo — texto libre que controla esa cuenta desde su propio perfil. Como la lista muestra **todas** las cuentas de equipo (no solo las del roster propio), cualquier equipo podía ejecutar JavaScript en la sesión de cualquier liga que abriera esa página, y esa página guarda el token de la liga en `localStorage` bajo `liga_auth`, en el mismo origen que la API. XSS almacenada cross-user, no self-XSS.

**Reglas que NO se negocian en estas páginas:**
- **Todo dato que venga de la base va por `textContent` o `document.createTextNode()`, nunca concatenado dentro de `innerHTML`.** El helper `teamCheckboxRow()` de `league.pb.js` es el patrón a copiar.
- Si de verdad hace falta armar una plantilla de string, todo valor interpolado pasa por `esc()` — la definición compartida está en `pb_hooks/lib/adminUi.js` (`clientEscapeHtmlFn()` para el lado cliente, `escapeHtml()` para el servidor). No escribas una copia nueva.
- La paleta compartida también vive en `lib/adminUi.js` (`PALETTE_CSS`). Un cambio de color se hace ahí, no seis veces.
- **Antes de agregar una página nueva de administración, evalúa hacerla como pantalla del frontend Expo**, que sí pasa por `tsc` y por el ciclo de review normal.

**Cuidado con los backticks:** el HTML de estas páginas vive dentro de un template literal. Un backtick suelto en un comentario (por ejemplo escribir la función `` `esc` `` entre backticks) cierra la plantilla y rompe el hook entero con un `SyntaxError` al cargar. Ocurrió durante esta misma refactorización.

---

## 6. Autorización del arbitraje de partidos de liga

**Modelo (vigente desde el 2026-08-19):**
- Mientras el partido está en `confirmed` (en juego), **el código de 6 caracteres es la autorización**. Es deliberado: se dicta en cancha a quien vaya a arbitrar, y la sesión es compartida a propósito — varias personas escriben sobre el mismo `match_reports`.
- Una vez el partido pasa a `played` (resultado oficial), **el código deja de servir**: solo la cuenta de la liga dueña del partido puede corregir el informe. Antes el código valía para siempre, así que cualquiera que lo hubiera tenido alguna vez podía reescribir el marcador de un partido cerrado semanas atrás.
- Toda corrección posterior queda registrada en `match_reports.amendedBy` / `amendedAt`. El campo `referee` sigue siendo quien abrió la sesión y no cambia.
- La regla vive en un solo lugar, `lib/matchEvents.js` → `matchWriteDecision()`, y está cubierta por tests.

**`events` NUNCA se sobrescribe con lo que manda el cliente.** El servidor fusiona con `mergeEvents()` (fusión de tres vías contra lo persistido). Guardarlo tal cual era un *lost update*: dos árbitros simultáneos se borraban eventos entre sí, en silencio y sin error. Es el mismo bug que `ladders.pb.js` ya había resuelto para `confirmations`; si agregas otro campo que varios clientes editen en paralelo, replica ese patrón antes de escribirlo.

---

## 7. Límites de tasa (rate limits)

Están declarados en `pb_hooks/__bootstrap.pb.js`, **no** en el panel `/_/`. Antes vivían solo en el panel, o sea dentro de `pb_data/` (fuera de git): no eran reproducibles ni revisables, y un `pb_data` nuevo arrancaba sin ninguno.

**Caveat verificado a mano:** los valores válidos de `audience` son `""`, `"@guest"` y `"@auth"` — **con arroba**. El `types.d.ts` que trae PocketBase los documenta sin arroba (`"guest"` / `"auth"`), y con esos valores el guardado falla entero con `audience: must be a valid value` y el servidor arranca *sin ningún límite aplicado*, solo dejando una línea en el log. Si tocas estas reglas, revisa el log de arranque.

---

## 8. Aislamiento de VMs en los hooks (Goja)

PocketBase ejecuta **cada `routerAdd` en una VM de Goja aislada**. Una función declarada en el scope del módulo `.pb.js` **no existe** dentro de los handlers: el endpoint responde `X is not defined` en tiempo de ejecución (no al cargar el hook), así que el error aparece recién cuando alguien llama la ruta.

Lo único que cruza esa frontera es un `require()` hecho **dentro** del handler. Por eso:
- La lógica compartida vive en `pb_hooks/lib/*.js` y se importa con `require()` dentro de cada handler.
- Las funciones auxiliares que sí usan `$app` se definen **dentro** de cada `routerAdd` (ver `loadValidBlocks` en `league.pb.js`).
- Relacionado: `team_players.pb.js` documenta que factorizar un `$app.findRecordById` en una función compartida y después volver a llamar a `$app` en quien la invoca revienta con un 400 genérico. Por eso `matchWriteDecision()` recibe valores planos y no toca `$app`.

**Otro caveat del JSVM:** `record.isNew` es un **método**, no una propiedad. `if (!record.isNew)` siempre es falso (una función es truthy) y falla en silencio.
