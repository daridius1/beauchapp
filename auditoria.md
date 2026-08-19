# Auditoría Técnica — Beauchapp (2026-08-05) — SUPERADA

> **⚠️ Este documento ya no describe el estado del proyecto.** Se conserva como registro
> histórico del punto de partida y de los incidentes documentados en su momento.
>
> La auditoría vigente es **[`auditoria-2026-08-19.md`](./auditoria-2026-08-19.md)**, que
> incluye el estado de cada una de las 13 recomendaciones de acá (todas resueltas al
> 2026-08-19) y los hallazgos posteriores.
>
> Afirmaciones de este documento que **hoy son falsas**: «Sin CI/CD» (existe
> `.github/workflows/ci.yml`), «Cero suite de pruebas automatizadas» (hay 175 tests),
> «`start.sh` lanza PocketBase con `--dev`» (corregido), «la sesión probablemente no
> persiste en nativo» (corregido con AsyncStorage).

**Fecha:** 2026-08-05
**Alcance:** Monorepo completo (`backend/` PocketBase + Go/Goja hooks, `frontend/` Expo/React Native + TypeScript, migraciones, scripts, documentación).
**Metodología:** Tres revisiones independientes en paralelo (backend/`pb_hooks`, frontend, y repo/migraciones/scripts) posteriormente cruzadas y consolidadas en este documento. Incluye revisión manual línea a línea de los 15 archivos de `backend/pb_hooks/` (2693 líneas), las 73 migraciones de `backend/pb_migrations/` (incl. su historial de commits), los archivos centrales del frontend (`App.tsx`, `services/`, `context/`, componentes y pantallas más grandes), los 21 scripts de `tests/`, `npm audit`, `tsc --noEmit`, y barrido de todo el historial de git en busca de secretos filtrados. No se ejecutó un pentest activo contra un servidor en producción; esta es una auditoría estática de código y configuración.

---

## 1. Resumen Ejecutivo

Beauchapp es una plataforma comunitaria (foro, ránkings ELO/OpenSkill, karma, marketplace, "Tinder" de citas universitarias, actividades) construida por un equipo/desarrollador único sobre PocketBase (Go + SQLite + hooks en JavaScript vía Goja) y un frontend Expo/React Native en TypeScript. El código es funcional y con evidencia de iteración rápida y consciente de seguridad en varios puntos (sanitización de Markdown con DOMPurify + iframe sandbox, SRI en CDNs, redacción de datos de contacto/autoría en registros eliminados). Sin embargo, la auditoría encontró:

- **Un patrón de bug ya diagnosticado y corregido una vez (race condition en `commentCount`, documentado en `docs/comments_counter_bug_solution.md`) que se repite sin corregir en al menos 3 otros hooks** (`activities.pb.js`, `target_meta.pb.js`, notificaciones de match/mención en Tinder).
- **Un cron job de recálculo de Karma con complejidad efectivamente O(usuarios × problemas × ratings) que corre cada 5 minutos**, sin paginación real (límites fijos de 5000), que degradará el rendimiento del único hilo de escritura de SQLite a medida que crezca la base de usuarios.
- **17 vulnerabilidades de dependencias npm en el frontend (1 crítica, 4 altas, 12 moderadas)**.
- **Cero suite de pruebas automatizadas.** La carpeta `tests/` contiene 21 scripts de depuración ad-hoc apuntando a `localhost:8090` con credenciales hardcodeadas (`password123`), no pruebas reales.
- **El script de arranque de producción documentado (`start.sh`) lanza PocketBase con `--dev` habilitado por defecto**, contradiciendo la propia advertencia de `SETUP.md`.
- **La sesión de usuario probablemente no persiste en la app nativa (iOS/Android).** El cliente PocketBase se instancia con el `LocalAuthStore` por defecto del SDK, que depende de `window.localStorage`; no hay ninguna dependencia de `AsyncStorage`/`expo-secure-store` en el proyecto para respaldar la sesión en nativo. Esto sugiere que los usuarios pierden la sesión cada vez que se reinicia el proceso de la app fuera de web.
- Evidencia histórica confirmada en las migraciones de que la regla de actualización compleja de `posts` (necesaria para permitir "likes" de no-autores) fue sobrescrita por completo una vez y tuvo que restaurarse — exactamente el riesgo que `SECURITY_AND_MAINTENANCE.md` advierte no repetir.
- **Un bug de mapeo de bytes en el motor Goja corrompió el campo `tags` en producción**, requiriendo dos intentos de recuperación de datos vía migración (`recover_tags.js` → `recover_tags_final.js`) antes de estabilizarse — evidencia de que la manipulación de strings/arrays no-ASCII dentro de hooks Goja necesita más cautela.
- Al menos 13 migraciones ya aplicadas fueron **editadas en el sitio después de su creación** (en vez de corregirse con una migración nueva), y dos scripts en `tests/` **parchean el archivo SQLite de PocketBase directamente**, ambas prácticas que pueden desincronizar el estado de una base de datos ya desplegada respecto al de una recién creada.

Ninguno de los hallazgos indica una brecha de seguridad activa explotada, pero varios son de corrección barata y alto impacto (la reutilización del patrón de hooks síncronos ya validado en `forum.pb.js`, por ejemplo, es un cambio mecánico).

---

## 2. Arquitectura (para contexto)

- **Backend:** Binario precompilado de PocketBase (Go) + SQLite, extendido con hooks JavaScript (motor Goja) en `backend/pb_hooks/*.pb.js`. Sin `go.mod` propio — toda la lógica de negocio vive en JS. 73 migraciones definen el esquema (colecciones: `users`, `posts`, `problems`, `problem_ratings`, `ladders`, `ladder_matches`, `ladder_ranks`, `tinder_profiles`, `tinder_likes`, `tinder_matches`, `activities`, `activity_likes`, `activity_attendees`, `marketplace_items`, `seller_profiles`, `notifications`, `organization_members`, entre otras).
- **Frontend:** Expo 54 + React Native 0.81 + React 19, TypeScript en modo `strict`. Sin librería de estado global (Redux/Zustand); usa un único `AuthContext` (React Context) para sesión, y `DeviceEventEmitter` como bus de eventos ad-hoc para refrescos globales (`onGlobalRefresh`, `onNotificationsRead`). Navegación con `@react-navigation/native-stack`, con deep-linking configurado. 76 archivos TypeScript, ~19 000 líneas solo en `src/screens/`.
- **Despliegue:** PocketBase sirve tanto la API como los estáticos compilados (`pb_public/`) detrás de Caddy (documentado en `SETUP.md`). SMTP vía Resend, almacenamiento de archivos vía Cloudflare R2 (S3-compatible), ambos configurados dinámicamente en `__bootstrap.pb.js` desde variables de entorno.
- **Sin CI/CD:** no existe carpeta `.github/workflows` ni ningún otro pipeline; no hay verificación automática de tipos, lint o tests en cada push.

---

## 3. Hallazgos — Críticos / Altos

### 3.1 [ALTO] `start.sh` despliega PocketBase con `--dev` habilitado por defecto
**Archivo:** `backend/start.sh:20`
```bash
exec "$SCRIPT_DIR/pocketbase" serve --dev "$@"
```
El propio `SETUP.md` advierte: *"En producción, quita el flag `--dev` de `start.sh` para desactivar el modo desarrollo"* — pero el script versionado en git, el mismo que el `systemd` unit de ejemplo invoca directamente (`ExecStart=.../start.sh --http=0.0.0.0:8090`), lo trae activado. `--dev` en PocketBase habilita logging verboso de SQL (potencialmente con parámetros sensibles) y respuestas de error más detalladas. Cualquier despliegue que siga la guía al pie de la letra sin recordar editar el script queda en modo desarrollo en producción.
**Recomendación:** quitar `--dev` de `start.sh` y, si se necesita para desarrollo local, pasarlo explícitamente como argumento (`./start.sh --dev`) o controlarlo con una variable de entorno (`NODE_ENV`/`APP_ENV`).

### 3.2 [ALTO] La sesión probablemente no persiste en la app nativa (iOS/Android)
**Archivos:** `frontend/src/services/pocketbase.ts:36`, `frontend/src/utils/storage.ts`
```ts
// services/pocketbase.ts
export const pb = new PocketBase(getApiUrl()); // usa el AuthStore por defecto del SDK
```
El SDK de PocketBase, sin un `authStore` explícito, usa `LocalAuthStore`, que internamente depende de `window.localStorage`. `frontend/src/utils/storage.ts` confirma que el proyecto no tiene ninguna dependencia de almacenamiento persistente para React Native (`@react-native-async-storage/async-storage`, `expo-secure-store`, etc. no están en `package.json`); ese archivo solo envuelve `window.localStorage` y no hace nada en plataformas nativas. En consecuencia, en un build nativo (o incluso en Expo Go) el token de sesión probablemente **no sobrevive un reinicio del proceso de la app**, forzando un nuevo login en cada apertura.
**Recomendación:** construir el cliente con un `authStore` personalizado respaldado por `expo-secure-store` (recomendado para tokens) o `AsyncStorage` cuando `Platform.OS !== 'web'`.

### 3.3 [ALTO] Patrón de race condition ya corregido una vez, repetido en otros hooks
**Contexto:** `docs/comments_counter_bug_solution.md` documenta que `onRecordAfterCreateSuccess` en PocketBase v0.25+ corre en una goroutine **asíncrona después** de enviar la respuesta HTTP, por lo que un `GET` inmediato del cliente puede leer datos desactualizados. La solución aplicada fue mover el conteo a `onRecordCreateRequest` (síncrono, antes de responder) — y así quedó en `forum.pb.js`.

Sin embargo, el mismo patrón riesgoso sigue en uso donde el cliente típicamente vuelve a leer el registro inmediatamente después de la mutación:
- `backend/pb_hooks/activities.pb.js:7-90` — `like_count` y `attendee_count` se actualizan en `onRecordAfterCreateSuccess`/`onRecordAfterDeleteSuccess`. Es el mismo escenario exacto (contador que "parpadea" o vuelve a 0) que ya se reportó para `commentCount`.
- `backend/pb_hooks/target_meta.pb.js:15-135` — el snapshot `targetMeta` (usado para previsualizar citas/reposts) se genera en `onRecordAfterCreateSuccess` y se graba con un segundo `$app.save(post)`. Si el frontend navega inmediatamente al detalle del post recién creado, puede llegar sin `targetMeta` poblado.
- `backend/pb_hooks/tinder.pb.js:76-118` y `notifications.pb.js:4-44` — la creación de `tinder_matches` (y sus notificaciones) ocurre en `onRecordAfterCreateSuccess`; si el frontend revisa inmediatamente si hubo match tras dar like, puede no verlo aún.

**Recomendación:** aplicar la misma migración que ya se hizo en `forum.pb.js` — mover estos efectos a hooks síncronos (`onRecordCreateRequest`/`onRecordUpdateRequest`/`onRecordDeleteRequest`, o `onRecordCreate`/`onRecordUpdate`/`onRecordDelete`) en los casos donde el cliente puede leer el resultado en la misma sesión de request. Vale la pena una revisión sistemática de todos los usos de `onRecordAfter*Success` en el repo para confirmar cuáles son seguros (ej. notificaciones puramente informativas, donde el delay es aceptable) y cuáles no.

### 3.4 [ALTO] Recalculo de Karma con complejidad no acotada, cada 5 minutos
**Archivo:** `backend/pb_hooks/karma.pb.js:131-167` (cron) y duplicado en líneas 5-129 (create/update/delete)
```js
cronAdd("recalculate_all_user_karma", "*/5 * * * *", () => {
    const allUsers = $app.findRecordsByFilter("users", "id != ''", "-created", 5000, 0);
    for (...) {
        const authorProblems = $app.findRecordsByFilter("problems", "author = {:author}", "-created", 5000, 0, ...);
        for (...) {
            const ratings = $app.findRecordsByFilter("problem_ratings", "problem = {:probId}", "-created", 5000, 0, ...);
            // suma en memoria...
        }
    }
});
```
Este cron recorre **todos** los usuarios, y para cada uno **todos** sus problemas, y para cada problema **todas** sus calificaciones — con límites hardcodeados de 5000 (silenciosamente truncará si se supera). Además, exactamente la misma lógica O(n) por usuario se repite en `onRecordCreate`, `onRecordUpdate` y `onRecordDelete` de `problem_ratings` (recalcula el karma completo del autor en cada calificación individual). SQLite en PocketBase tiene un único escritor; este patrón bloqueará/ralentizará otras escrituras a medida que crezca el volumen de datos, y el cron se solapará consigo mismo si una ejecución tarda más de 5 minutos.
**Recomendación:** mantener un contador incremental de karma (sumar/restar el delta al crear/actualizar/eliminar una calificación, en vez de recalcular todo desde cero) y eliminar o espaciar mucho más el cron de reconciliación completa (usarlo solo como corrección periódica poco frecuente, ej. una vez al día, con paginación real).

### 3.5 [ALTO] Duplicación masiva de lógica en `karma.pb.js`
La misma función de ~35 líneas para calcular karma está copiada **cuatro veces** de forma casi idéntica (`onRecordCreate`, `onRecordUpdate`, `onRecordDelete`, cron). Cualquier corrección de la fórmula de karma requiere editar cuatro copias — ya es un patrón de riesgo confirmado por las ~14 migraciones "fix_"/"restore_" del proyecto. Debería extraerse a una función compartida `recalculateKarmaForAuthor(authorId)` reutilizada en los cuatro hooks.

### 3.6 [ALTO] 17 vulnerabilidades en dependencias del frontend (`npm audit`)
```
17 vulnerabilities (12 moderate, 4 high, 1 critical)
```
Incluye una vulnerabilidad crítica en la cadena de `uuid` (bounds check faltante, arrastrada transitivamente por `@expo/config-plugins` → `expo-constants`/`expo-asset`/`expo-linking`) y una vulnerabilidad en `undici` (inyección de atributos de cookie). La mayoría requiere `npm audit fix --force` (cambios de breaking en Expo), lo cual amerita una ventana de actualización planificada en vez de aplicarse a ciegas.
**Recomendación:** planificar una actualización de Expo SDK (siguiendo su changelog de breaking changes) en un branch dedicado, correr `npm audit fix` para lo no-breaking de inmediato, y agregar `npm audit --audit-level=high` como chequeo de CI.

### 3.7 [ALTO] Cero pruebas automatizadas reales, y credenciales de administrador hardcodeadas en su lugar
No existe configuración de Jest/Vitest/testing-library en `frontend/package.json` ni en la raíz, ni carpeta `.github/workflows`. La carpeta `tests/` (21 archivos, ~1418 líneas) son en realidad scripts de depuración manual (`check_ranks.js`, `fix_pb_fields.js`, `migrate_unify_ladders.js`, `seed_tinder_mock.js`, etc.), sin `assert`/`expect` ni códigos de salida pass/fail — no son parte de ninguna suite ejecutable en CI, y de hecho no hay CI.

Agravante: **unos 10 de estos scripts** (`create_student.js`, `test_api_mention.js`, `test_mentions.js`, `test_rating_clean.js`, `seed_tinder_mock.js`, `test_inspect_collection.js`, `test_pb_filters.js`, `test_rating.js`, `test_ladder_system.js`) tienen **credenciales de administrador en texto plano** commiteadas, algunas con dominios de aspecto real (`admin@daridius.cl`, `admin@beauchapp.cl`) en vez de valores obviamente falsos. Todos apuntan a `http://127.0.0.1:8090` (confirmado por grep — ninguno apunta a un host remoto/producción), por lo que el radio de impacto inmediato es bajo mientras `BACKEND_URL` nunca se redirija, pero entrena un mal hábito y arriesga la reutilización accidental de esa contraseña en una cuenta de admin real.

Para una aplicación con lógica de negocio no trivial (ELO/OpenSkill, karma, reglas de coincidencia de Tinder, contadores concurrentes) la ausencia de pruebas reales es un riesgo real de regresión silenciosa, agravado por el patrón ya observado de "fix" iterativos en migraciones.
**Recomendación:** como mínimo, cubrir con pruebas unitarias la lógica pura y crítica (`calculateOpenSkillUpdate`, el cálculo de karma, el parseo de menciones) que no depende de un servidor PocketBase corriendo. Renombrar/mover `tests/` a algo como `scripts/dev-tools/` para dejar claro que no son pruebas automatizadas, y reemplazar las credenciales reales por valores obviamente falsos leídos desde variables de entorno.

### 3.8 [ALTO] Incidente confirmado en historial de migraciones: regla de `posts` sobrescrita por completo
**Archivos:** `backend/pb_migrations/1783400040_add_deleted_to_posts.js` → `1783400050_restore_posts_updateRule.js`
La migración `1783400040` reemplazó la `updateRule` compleja de `posts` (necesaria para permitir que un usuario distinto al autor dé "like", modificando solo `commentCount`) por una regla simple `@request.auth.id = author && deleted = false`, rompiendo la funcionalidad de likes. Dos migraciones después (`1783400050`) tuvo que restaurarse la regla completa. Esto es exactamente el incidente que `SECURITY_AND_MAINTENANCE.md` documenta como lección aprendida — y confirma que ya ocurrió en producción, no es solo un riesgo teórico.
**Recomendación:** ninguna acción correctiva inmediata (ya está resuelto), pero refuerza que cualquier cambio futuro a `posts.updateRule` (o reglas igual de complejas en otras colecciones) debería revisarse manualmente contra el valor actual en vez de generarse por una migración automática/asistida por IA sin diff explícito.

### 3.9 [ALTO] Incidente confirmado: corrupción de datos en `tags` por un bug de mapeo de bytes en Goja
**Archivos:** `backend/pb_migrations/1783740200_lowercase_existing_tags.js` → `1783740270_recover_tags.js` → `1783740290_recover_tags_final.js` → `1783740320_clean_accented_and_invalid_tags.js`
Cuatro migraciones en secuencia apretada, con mensajes de commit que confirman el incidente: *"fix: resolve tag VM byte-mapping bug in pb_hooks and restore database tags"* y *"feat: recover corrupted tags from ascii codes back to string array"*. Un bug del motor Goja (JS-en-Go) al manipular el campo `tags` (array de strings) lo convirtió en arrays de códigos ASCII en producción, requiriendo dos pasadas de recuperación más una limpieza final de tags acentuados/inválidos. El bug aparentemente escapó a producción más de una vez antes de estabilizarse.
**Recomendación:** ninguna acción correctiva inmediata (ya está resuelto y los datos recuperados), pero queda como lección para el futuro: cualquier lógica de hooks que manipule campos de tipo array/string vía la VM de Goja debe probarse explícitamente con casos de acentos y caracteres no-ASCII antes de desplegarse, dado que ya causó pérdida/corrupción de datos reales dos veces.

---

## 4. Hallazgos — Medios

### 4.1 [MEDIO] Interpolación de string en filtro de PocketBase en vez del patrón parametrizado
**Archivo:** `backend/pb_hooks/auth.pb.js:117-120`
```js
const existing = $app.findRecordsByFilter(
    "organization_members",
    `organization = "${orgId}" && user = "${userId}"`
);
```
El resto del archivo (y del proyecto) usa consistentemente el patrón parametrizado `{:param}` con bind por objeto (ej. líneas 496, 508, y prácticamente todos los demás hooks). Aquí `orgId`/`userId` sí se validan previamente como IDs de registros existentes (líneas 99-113), por lo que el riesgo práctico de inyección es bajo, pero es una inconsistencia de patrón que invita a errores si se copia como plantilla en el futuro (como pasó con `mentions.pb.js:38`, ver 4.2).
**Recomendación:** usar `{:orgId}`/`{:userId}` con bind, igual que en el resto del archivo.

### 4.2 [MEDIO] Mismo patrón de interpolación directa en `mentions.pb.js`
**Archivo:** `backend/pb_hooks/mentions.pb.js:38`
```js
const targetUser = $app.findFirstRecordByFilter("users", `username = "${username}"`);
```
`username` proviene de una regex sobre el contenido del post (`[a-zA-Z0-9_-]{3,20}`), por lo que ya está acotado a caracteres seguros y el riesgo de inyección es bajo en la práctica — pero de nuevo rompe la convención parametrizada del resto del código.
**Recomendación:** usar `{:username}` con bind por consistencia y defensa en profundidad.

### 4.3 [MEDIO] Herramientas de administración expuestas como rutas HTML públicas
**Archivo:** `backend/pb_hooks/auth.pb.js:533-997`
`/admin/generate-link` sirve una página HTML completa con su propio formulario de login que llama directamente a `/api/collections/_superusers/auth-with-password`, y guarda el token resultante en `localStorage`. El endpoint que genera el link sí está protegido con `$apis.requireSuperuserAuth()`, pero la página de login personalizada:
- Es un segundo punto de entrada de credenciales de superadmin además del panel oficial `/_/`, sin controles visibles de rate-limiting/CAPTCHA propios (depende enteramente de los límites internos de PocketBase).
- Guarda el token en `localStorage` en vez de un cookie `httpOnly`, aumentando la superficie de robo de token ante un XSS futuro en esa página (hoy no hay XSS conocido ahí, pero es una página estática servida por el propio backend, sin las mismas capas de sanitización que el resto de la app).
**Recomendación:** si esta herramienta es de uso poco frecuente, considerar generarla vía un comando CLI/script de administración en vez de un endpoint HTTP público, o al menos documentarla como superficie de ataque a monitorear.

### 4.4 [MEDIO] Posible pérdida de confirmación en partidos por condición de carrera en JSON
**Archivo:** `backend/pb_hooks/ladders.pb.js:61-88`
El campo `confirmations` es un blob JSON que el cliente lee, modifica (agrega su propia entrada) y reescribe completo vía `PATCH`. Si dos jugadores confirman casi simultáneamente, ambos `PATCH` pueden partir del mismo estado leído y el último en escribir sobrescribe la confirmación del otro (clásico *lost update*).
**Recomendación:** mover la escritura de la confirmación individual a un hook de backend que haga *read-modify-write* atómico sobre el campo (leyendo el registro más reciente dentro del propio hook antes de fusionar), en vez de confiar en que el cliente envíe el blob completo ya fusionado.

### 4.5 [MEDIO] Logging de depuración extenso dejado en producción
`auth.pb.js`, `forum.pb.js`, `enrich_targets.pb.js`, `mentions.pb.js`, `ladders.pb.js`, etc. tienen decenas de `console.log("[DEBUG] ...")` / `[LOAD] ... hook loaded!` que corren en cada request (incluyendo, en `auth.pb.js`, logging del tipo de cuenta y estado de auth en cada registro de usuario). No es una fuga de secretos directa, pero sí ruido innecesario en logs de producción y una superficie menor de exposición de datos internos (usernames, IDs) en logs del servidor.
**Recomendación:** quitar o condicionar estos logs a una variable de entorno de debug (`$os.getenv("DEBUG")`).

### 4.6 [MEDIO] Pantallas "Dios" de más de 1000 líneas
```
2448  TinderScreen.tsx
1398  ProblemDetailScreen.tsx
1217  HomeScreen.tsx
1174  SettingsScreen.tsx
1034  ProblemEditorScreen.tsx
```
Componentes de este tamaño concentran demasiada lógica de estado, efectos y presentación en un solo archivo, dificultan las pruebas, el code review y aumentan el riesgo de re-renders innecesarios. `TinderScreen.tsx` en particular (2448 líneas) es un candidato claro para dividir en subcomponentes (tarjeta de swipe, modal de perfil, panel de reglas, etc.) y hooks personalizados.

### 4.7 [MEDIO] Erosión del modo `strict` de TypeScript
`tsconfig.json` tiene `"strict": true`, pero se detectaron:
- **119** anotaciones `: any` y **66** castings `as any` en `src/`.
- **4 errores reales** de `tsc --noEmit` en 3 archivos (`ActivityDetailScreen.tsx:388`, `LadderDetailScreen.tsx:244`, `LoginScreen.tsx:117`) — el proyecto no compila limpio hoy, lo que sugiere que no hay ningún paso (CI o pre-commit) que verifique tipos antes de mergear.
**Recomendación:** corregir los 4 errores actuales, y agregar `tsc --noEmit` como chequeo obligatorio (pre-commit hook o CI) para que no se acumulen más.

### 4.8 [MEDIO] Artefacto de datos con PII real suelto en la raíz del repositorio
`blog_comments_backup.json` (58 líneas / 1.9 KB, commiteado desde `309ddaf`) contiene un volcado crudo de comentarios de blog con **nombres de usuario reales** (p. ej. "Salas", "Daridius") y el contenido de sus mensajes. No es una fuga de credenciales, pero sí un volcado de datos personales de usuarios reales que no debería vivir indefinidamente en el historial de git de un repo de aplicación.
**Recomendación:** quitarlo del árbol de trabajo y agregarlo a `.gitignore`; dado que ya es alcanzable en commits pasados, si el contenido se considera sensible habría que purgarlo también del historial de git (ej. `git filter-repo`), no solo eliminarlo del HEAD actual.

### 4.9 [MEDIO] Polling de notificaciones cada 10 segundos por cliente activo
**Archivo:** `frontend/App.tsx:171-181`
`setInterval(checkUnreadNotifications, 10000)` corre mientras la app esté montada, para todo usuario autenticado. Funciona bien a la escala actual, pero es una petición HTTP constante por cliente activo que no escala tan bien como un mecanismo push/WebSocket (PocketBase soporta *realtime subscriptions* de forma nativa, que encajarían mejor aquí).

### 4.10 [MEDIO] Sin Error Boundary en el frontend
Una búsqueda de `ErrorBoundary` en `frontend/src` no arroja resultados. Una excepción en tiempo de render en cualquiera de las ~30 pantallas deja la app en blanco sin ninguna UI de recuperación.
**Recomendación:** agregar un `ErrorBoundary` de nivel superior envolviendo `<AppContent />` en `App.tsx`.

### 4.11 [MEDIO] Manejo de errores inconsistente, con `catch` silenciosos
La profundidad de `try/catch` es dispareja entre pantallas de complejidad similar (p. ej. `MarketplaceItemDetailScreen.tsx`/`SettingsScreen.tsx` tienen 8 bloques `catch` cada una, otras con volumen de código async comparable solo 1-2). Varios `catch` son silenciosos — `catch (_) {}` en `AuthContext.refreshUser`, `catch (err) { // ignore }` en `App.tsx:166-168` — lo que puede ocultar fallas reales durante desarrollo/QA.
**Recomendación:** al menos loguear (no silenciar) los `catch` vacíos, y estandarizar un patrón de manejo de errores reutilizable (hook `useAsyncAction` o similar) para reducir la dispersión.

### 4.12 [MEDIO] `legacy-peer-deps=true` en `.npmrc` enmascara conflictos de dependencias
`frontend/.npmrc` fuerza `legacy-peer-deps=true`, lo que oculta conflictos de peer-dependencies entre React 19.1.0, `react-native-web` 0.21 y otros paquetes en vez de resolverlos. Funciona hoy, pero es una trampa para el futuro: un `npm install` limpio después de cualquier bump de dependencia puede fallar de forma no evidente.
**Recomendación:** periódicamente correr `npm install` sin el flag para ver qué conflictos reales existen y resolverlos, en vez de dejarlos enmascarados indefinidamente.

### 4.13 [MEDIO] Migraciones ya aplicadas editadas post-hoc en vez de superseded por una nueva
Al menos 13 de las 73 migraciones tienen más de un commit tocándolas después de su creación inicial (no solo el commit que las agregó). Confirmado con diff en `1783900000_add_polymorphic_target_fields.js`: un commit posterior (`11247c2`) reescribió `new SchemaField(...)` → `new Field(...)` (fix de compatibilidad de API de PocketBase) **directamente sobre el archivo existente**, en vez de una migración correctiva nueva. PocketBase registra las migraciones "aplicadas" por nombre de archivo — esto es seguro para entornos que nunca corrieron la versión rota, pero si la versión rota alguna vez se aplicó a un `pb_data` desplegado, la edición en el sitio no hace nada ahí (PocketBase no re-ejecuta una migración ya aplicada), dejando ese entorno con el esquema/regla viejo silenciosamente.
**Recomendación:** tratar toda migración que ya haya tocado un entorno no descartable como inmutable; para cualquier corrección (incluso un typo o un fix de API) enviar una migración nueva, nunca editar la existente.

### 4.14 [MEDIO] Parcheo directo del archivo SQLite fuera del sistema de migraciones
**Archivos:** `tests/fix_pb_fields.js`, `tests/add_target_fields_to_sqlite.js`
Ambos scripts abren `backend/pb_data/data.db` directamente vía `node:sqlite` y editan a mano el JSON de `_collections.fields` (p. ej. inyectando un campo `mode` con un `id` elegido manualmente: `'lrk_mode_01'`). Esto evade por completo el sistema de migraciones/versionado de PocketBase — si se corre contra una base cuyo caché de esquema en memoria (o una instancia de PocketBase corriendo en paralelo) no coincide con la edición cruda, puede desincronizar el caché de esquema respecto a la tabla `_collections` de SQLite. En este caso ya existe una migración formal (`1783800500_add_mode_to_ladder_ranks_and_unify_sports.js`) que aparentemente formaliza el mismo cambio, dejando estos scripts obsoletos/redundantes.
**Recomendación:** eliminar estos scripts ahora que están superados por una migración real; nunca editar `_collections` vía SQL crudo mientras PocketBase esté corriendo.

### 4.15 [MEDIO] `deploy.sh` con detalles de infraestructura hardcodeados y sin respaldo antes de sobrescribir
**Archivo:** `deploy.sh` (raíz del repo)
El script hardcodea `SERVER="salas@192.168.0.6"` (IP de LAN + usuario) y hace `scp`/`ssh -t` sin contraseña asumiendo que la autenticación por llave ya está configurada. No es un secreto público en sí (es una IP de LAN), pero acopla el script a una infraestructura específica y filtra un nombre de usuario/topología. Además, copia el build del frontend directamente a `pb_public` y reinicia el servicio systemd **sin respaldar** `pb_public`/`pb_data` antes de sobrescribir — si el nuevo build o una migración están rotos, no hay forma de volver atrás automáticamente.
**Recomendación:** parametrizar `SERVER`/rutas vía variables de entorno o un `.env` de despliegue, y tomar un snapshot de `pb_data`/`pb_public` antes de cada sobrescritura.

---

## 5. Hallazgos — Bajos / Informativos

- **[BAJO]** `MarkdownRenderer.tsx:175` usa `window.parent.postMessage({...}, '*')` (origen comodín) para comunicar la altura del iframe sandboxed. El payload no es sensible (solo un número de altura) y el iframe corre con `sandbox="allow-scripts"` sin `allow-same-origin`, así que el riesgo es mínimo, pero por buena práctica se podría restringir el origen destino.
- **[BAJO]** El cálculo de OpenSkill está reimplementado como una función anónima autoejecutada de ~150 líneas dentro de `ladders.pb.js` (líneas 94-272), en vez de vivir en un archivo/función aislada y testeable. Entendible dado que Goja no soporta módulos ES fácilmente, pero dificulta escribir un test unitario puro de la fórmula.
- **[BAJO]** 3 `console.log` sueltos en el frontend: `services/pocketbase.ts:34` (imprime la URL del backend en cada carga — exposición menor de detalles de red interna, no sensible pero innecesaria en producción), `context/AuthContext.tsx`, `screens/SettingsScreen.tsx`.
- **[BAJO]** `App.tsx:52-146` repite tres bloques de estilo casi idénticos para `BaseToast`/`ErrorToast`; se podrían extraer a un único objeto de estilo compartido.
- **[BAJO]** Dos migraciones (`1784000500_add_organization_subtype.js` y `1784000500_increase_tinder_photo_max_size.js`) comparten el mismo prefijo numérico de timestamp. Inofensivo hoy (el nombre completo del archivo sigue ordenando de forma determinista), pero indica que el timestamp no se genera desde un reloj real — vale la pena una convención para que una futura colisión no reordene migraciones silenciosamente.
- **[INFO]** No se encontró ningún secreto real filtrado en el historial de git (`backend/.env`, `frontend/.env`, `backend/pb_data/`, el binario `backend/pocketbase` nunca fueron trackeados; solo existen los `.env.example` con placeholders). El `.gitignore` está bien configurado.
- **[INFO]** El hook de redacción de contenido eliminado (`forum.pb.js:168-184`, `problems.pb.js`) y el de privacidad de contactos en Tinder (`tinder.pb.js:5-49`) están bien diseñados: comprueban expresamente `isAdmin`/propietario/match antes de exponer datos, y limpian tanto el campo plano como el `expand` anidado.
- **[INFO]** No existe pipeline de CI/CD (no hay `.github/workflows` ni equivalente). Cualquier verificación (tipos, lint, build) depende hoy 100% de que el desarrollador la corra localmente.
- **[INFO]** `.agents/AGENTS.md` documenta reglas internas para desarrollo asistido por IA en este proyecto (verificar siempre contra la versión moderna de PocketBase antes de tocar hooks/migraciones, nunca dejar scripts de prueba sueltos fuera de `tests/`, convenciones de diseño y UX). Es un buen ejemplo de gobernanza de proyecto, aunque no impide que `tests/` acumule scripts obsoletos indefinidamente (ver 3.7/4.14).

---

## 6. Aspectos positivos observados

- Sanitización de Markdown/LaTeX con DOMPurify + iframe `sandbox="allow-scripts"` (sin `allow-same-origin`) para prevenir robo de tokens vía XSS almacenado — bien pensado y documentado.
- SRI (`integrity="sha384-..."`) en todos los scripts de CDN (KaTeX, Marked, DOMPurify, Mermaid).
- Protección consistente contra auto-verificación y escalación de privilegios: los campos `type`, `subtype` y `verified` de `users` están protegidos contra escritura por no-superusuarios en `auth.pb.js:67-86`, revirtiendo el valor si un cliente intenta cambiarlos.
- El incidente de la regla de `posts` y el bug de `commentCount` están genuinamente documentados con causa raíz y solución (`SECURITY_AND_MAINTENANCE.md`, `docs/comments_counter_bug_solution.md`) — buena práctica de bitácora institucional, poco común en proyectos de este tamaño.
- Uso correcto y consistente de PocketBase con queries parametrizadas (`{:param}`) en la gran mayoría de los ~40+ usos de `findRecordsByFilter`/`findFirstRecordByFilter` del código.
- Guardas explícitas contra subida de archivos al disco local si R2/S3 no está configurado (`storage_guard.pb.js`), evitando que el servidor termine sirviendo archivos desde un disco no persistente/no respaldado.
- Buena cobertura de rollback en las migraciones: 71 de 73 archivos en `pb_migrations/` definen tanto la función `up` como `down`; solo 2 migraciones tempranas son irreversibles.
- `frontend/dist/` (salida de build) está correctamente excluido de git (`git ls-files frontend/dist` no devuelve nada) — no se commitean artefactos de build.
- No se encontraron secretos ni URLs sensibles hardcodeadas en `frontend/src` o `app.json`; las únicas URLs embebidas son de cara pública por diseño (CDNs con SRI, enlaces de WhatsApp/Instagram/Telegram, ayuda de uchile.cl).
- El incidente de corrupción de `tags` (ver 3.9), aunque grave, terminó bien documentado y recuperado por completo vía migraciones trazables en vez de un parche silencioso — buena respuesta a incidentes aunque el bug original no debió llegar a producción.

---

## 7. Recomendaciones priorizadas

1. Quitar `--dev` de `start.sh` (5 minutos, alto impacto).
2. Arreglar la persistencia de sesión en nativo: dar al cliente PocketBase un `authStore` respaldado por `expo-secure-store`/`AsyncStorage` cuando `Platform.OS !== 'web'` — hoy los usuarios de la app móvil probablemente pierden sesión en cada reinicio.
3. Auditar y migrar los hooks `onRecordAfter*Success` que afectan datos leídos inmediatamente por el cliente (`activities.pb.js`, `target_meta.pb.js`) al patrón síncrono ya validado en `forum.pb.js`.
4. Refactorizar `karma.pb.js`: karma incremental en vez de recálculo completo, y una sola función compartida en vez de 4 copias.
5. Aplicar `npm audit fix` para las vulnerabilidades no-breaking; planificar la actualización mayor de Expo para las 5 vulnerabilidades altas/críticas restantes.
6. Agregar un mínimo de CI: `tsc --noEmit` + `npm audit --audit-level=high` en cada push, para que los 4 errores de tipos actuales (y futuros) no pasen desapercibidos.
7. Cubrir con pruebas unitarias puras la lógica crítica sin dependencias de red (OpenSkill, karma, parseo de menciones); renombrar `tests/` a algo como `scripts/dev-tools/` y reemplazar las credenciales de administrador reales por valores falsos vía variables de entorno.
8. Eliminar `tests/fix_pb_fields.js` y `tests/add_target_fields_to_sqlite.js` (parches SQLite crudos ya superados por una migración formal); tratar toda migración aplicada como inmutable de ahí en adelante — corregir con una migración nueva, nunca editando la existente.
9. Purgar `blog_comments_backup.json` (contiene PII real) del árbol de trabajo y, si corresponde, del historial de git.
10. Agregar un `ErrorBoundary` de nivel superior en `App.tsx` y eliminar los `catch` silenciosos en `AuthContext`/`App.tsx`.
11. Dividir las pantallas de más de 1000 líneas (`TinderScreen.tsx` primero) en subcomponentes.
12. Homologar todas las queries de PocketBase al patrón parametrizado `{:param}` (dos instancias detectadas usan interpolación directa).
13. Parametrizar `deploy.sh` (host/rutas vía variables de entorno) y agregar respaldo de `pb_data`/`pb_public` antes de sobrescribir en cada despliegue.
