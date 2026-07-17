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
