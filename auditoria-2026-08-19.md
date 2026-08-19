# Auditoría Técnica — Beauchapp (estado actual)

**Fecha:** 2026-08-19
**Alcance:** Monorepo completo. Sucede a [`auditoria.md`](./auditoria.md) (2026-08-05), que queda como registro histórico.
**Delta cubierto:** 55 commits desde la auditoría anterior — principalmente el sistema de ligas, horarios de equipos, arbitraje de partidos y roster de jugadores.
**Metodología:** revisión estática de los 28 hooks de `backend/pb_hooks/` (8.263 líneas incl. `lib/`), las 125 migraciones, `frontend/src` (45.784 líneas, 48 pantallas), scripts de despliegue y documentación. Ejecución real de `npm run test:backend`, `npx tsc --noEmit` y `npm audit`. Verificación uno por uno de los 13 puntos priorizados de la auditoría anterior. No se hizo pentest activo contra producción.

> **Estado de implementación: 12 de 13 recomendaciones aplicadas y verificadas** contra
> una instancia real de PocketBase el mismo 2026-08-19. Ver [§9](#9-estado-de-implementación)
> al final del documento para el detalle, lo que quedó fuera y por qué.

---

## 1. Resumen ejecutivo

**El proyecto mejoró sustancialmente desde la auditoría anterior.** De las 13 recomendaciones priorizadas, **10 están completamente resueltas**, 2 parcialmente y 1 pendiente. Lo más significativo:

- Existe **CI real** (`.github/workflows/ci.yml`: typecheck + audit + tests) donde antes no había ninguno.
- Existe una **suite de pruebas real**: 154 tests que pasan, sobre lógica pura extraída a `pb_hooks/lib/` (OpenSkill, karma, beaudle, beaumarket, menciones, eventos de partido, horarios).
- `tsc --noEmit` **compila limpio** (antes: 4 errores).
- El logging de depuración en hooks pasó de "decenas" a **8 `console.log`**, y el frontend a **cero**.
- Se corrigieron: `--dev` en producción, persistencia de sesión nativa (AsyncStorage), karma incremental + cron nocturno paginado, hooks asíncronos migrados a síncronos, `deploy.sh` parametrizado con backups rotados, credenciales de `tests/` movidas a variables de entorno, scripts de parcheo crudo de SQLite eliminados.

El código nuevo (ligas/horarios/arbitraje) es de **calidad claramente superior al promedio del repo**: comentarios que explican el *por qué*, autorización verificada en cada endpoint, lógica pura extraída y testeada, transacciones donde corresponde, y hallazgos operativos de PocketBase documentados en el propio archivo.

Dicho eso, la auditoría encontró **1 vulnerabilidad alta nueva** y un conjunto de deudas nuevas concentradas en el mismo código nuevo:

- **XSS almacenado cross-user en `/admin/liga`**: el nombre de una cuenta de equipo se inyecta sin escapar vía `innerHTML` en la página de gestión de la liga, cuyo token de sesión vive en `localStorage` del mismo origen que la API.
- **La lección de concurrencia ya aprendida en `ladders.pb.js` no se replicó en el arbitraje**: `match_reports.events` se sobrescribe completo en cada push, sin merge — dos árbitros simultáneos se pisan los eventos.
- **Consultas sin límite que crecen monótonamente**: cada propuesta de partido escanea *todos* los partidos jugados históricos; `/api/beaumarket/markets` hace hasta ~200 consultas por carga de pantalla.
- **~2.360 líneas de HTML/CSS/JS embebidas dentro de hooks** (29% de todo el código de backend), repartidas en 5 páginas de administración, cada una con su propio formulario de login.
- Las vulnerabilidades altas de npm **subieron de 4 a 10**, y el gate de CI está en `critical`, por lo que no las detiene.

Ninguna de las deudas indicaba una brecha explotada. **Todas fueron corregidas el mismo día** — ver [§9](#9-estado-de-implementación) para el detalle de cada una y de lo que quedó deliberadamente fuera.

---

## 2. Estado de las recomendaciones de la auditoría anterior

| # | Recomendación (2026-08-05) | Estado | Evidencia |
|---|---|---|---|
| 1 | Quitar `--dev` de `start.sh` | ✅ Resuelto | `backend/start.sh:21` — `exec pocketbase serve "$@"`, con comentario que indica pasar `--dev` explícito en local |
| 2 | Persistencia de sesión en nativo | ✅ Resuelto | `frontend/src/services/pocketbase.ts:11-17` — `AsyncStorage` como `authStore` |
| 3 | Migrar `onRecordAfter*Success` a hooks síncronos | ✅ Resuelto | `activities.pb.js:11,31,52,72` y `target_meta.pb.js:17` ahora usan `onRecordCreateRequest`/`DeleteRequest`. Los `onRecordAfter*` que quedan (notificaciones, blocking, reports, org invites) son informativos — uso correcto |
| 4 | Karma incremental + función compartida | ✅ Resuelto | `lib/karma.js` (`karmaDeltaForRating`, con tests); cron pasó de `*/5 * * * *` a `17 4 * * *` y ahora pagina por 200 usuarios |
| 5 | `npm audit fix` no-breaking | ⚠️ Parcial | 0 críticas (antes 1), pero **10 altas** (antes 4). Todas en tooling de build (metro, postcss, image-size, nanoid). `nanoid` se arregla sin breaking changes; el resto requiere Expo 54→57 |
| 6 | CI con `tsc --noEmit` + audit | ✅ Resuelto | `.github/workflows/ci.yml`. `tsc --noEmit` pasa limpio hoy. El gate de audit está en `critical` (documentado y justificado en el propio YAML) |
| 7 | Tests unitarios + limpiar `tests/` | ✅ Resuelto | 154 tests en 8 archivos bajo `pb_hooks/lib/__tests__/`, todos pasan. `tests/README.md` aclara que son scripts de depuración; credenciales por `process.env` con fallback `admin@example.test` |
| 8 | Eliminar parches SQLite crudos; migraciones inmutables | ✅ Resuelto | `fix_pb_fields.js` y `add_target_fields_to_sqlite.js` eliminados. Ninguna de las 52 migraciones nuevas fue editada post-creación (las 14 con múltiples commits son todas anteriores a agosto) |
| 9 | Purgar `blog_comments_backup.json` (PII) | ❌ Pendiente | Sigue trackeado en la raíz del repo |
| 10 | `ErrorBoundary` + eliminar `catch` silenciosos | ⚠️ Parcial | `ErrorBoundary` implementado y montado (`App.tsx:568`). Quedan **9 `catch` vacíos** en `src/` |
| 11 | Dividir pantallas >1000 líneas | ⚠️ Parcial | `TinderScreen` bajó de 2448 → 1316 líneas (extrajo `screens/tinder/`). Siguen **6 pantallas >1000 líneas**, y el nuevo `LeagueMatchArbitratorScreen` nació con 1038 |
| 12 | Homologar queries a `{:param}` | ✅ Resuelto | Solo queda `tinder.pb.js:277`, que arma un `OR` de ids internos ya validados — no hay entrada de usuario |
| 13 | Parametrizar `deploy.sh` + backups | ✅ Resuelto | `DEPLOY_SERVER` obligatorio vía env; `deploy.sh:27` hace tar de `pb_data`/`pb_public` con timestamp y rota conservando 10 |

También resuelto sin estar en la lista: **4.5 (logging de depuración)** — de "decenas" de `[DEBUG]` en hooks a 8 `console.log` totales (bootstrap, tags, config, problems), y **0** en todo el frontend.

---

## 3. Hallazgos nuevos — Alto

### 3.1 [ALTO] XSS almacenado en `/admin/liga` vía el nombre de una cuenta de equipo

**Archivos:** `backend/pb_hooks/league.pb.js:254` y `backend/pb_hooks/league.pb.js:393`

```js
row.innerHTML = '<input type="checkbox" value="' + t.id + '" ' + checked + '> ' + (t.name || t.username || t.id);
```

`t.name` viene de `users.name` de una cuenta de organización con `subtype = "team"`, editable libremente por esa cuenta desde `EditTeamScreen` (`frontend/src/screens/EditTeamScreen.tsx:166`) sin ninguna sanitización en el hook de `users`. Se inyecta crudo en `innerHTML` en dos puntos de la página de gestión de ligas.

**Por qué importa (cadena completa):**
1. La cuenta de un equipo cualquiera pone su nombre en `<img src=x onerror="...">`.
2. La liga abre `/admin/liga` y carga el roster — la lista muestra **todas** las cuentas de equipo existentes (`GET /api/liga/roster` devuelve `allTeams`, no solo las del roster propio), así que no hace falta ni que ese equipo pertenezca a esa liga.
3. El script corre en el origen del propio backend, donde `/admin/liga` guarda el token de sesión de la liga en `localStorage` bajo la clave `liga_auth` (`league.pb.js:208`). El atacante roba el token y actúa como la liga (roster, etapas, agendar y aceptar partidos).

Es una vulnerabilidad **cross-user**, no self-XSS: quien inyecta y quien la ejecuta son cuentas distintas.

**Agravante de contexto:** el mismo origen sirve el panel `/_/` de PocketBase y las otras 4 páginas de administración, todas guardando tokens en `localStorage`.

**Corrección:** el resto del archivo ya usa el patrón correcto — hay **18 usos de `textContent`** contra estos 2 de `innerHTML`. La corrección es construir el `<input>` y el nodo de texto por separado:

```js
const input = document.createElement("input");
input.type = "checkbox";
input.value = t.id;
input.checked = myTeamIds.has(t.id);
row.appendChild(input);
row.appendChild(document.createTextNode(" " + (t.name || t.username || t.id)));
```

---

## 4. Hallazgos nuevos — Medios

### 4.1 [MEDIO] La corrección de *lost update* de `ladders.pb.js` no se replicó en el arbitraje de partidos

**Archivos:** `backend/pb_hooks/match_arbitration.pb.js:110` vs. `backend/pb_hooks/ladders.pb.js:74-94`

La auditoría anterior (hallazgo 4.4) señaló que `ladder_matches.confirmations` sufría *lost update* al escribirse como blob JSON completo desde el cliente. **Se corrigió bien**: hoy `ladders.pb.js:74-94` hace un merge en el servidor contra `match.original()`, aplicando solo las claves que realmente cambiaron.

El sistema de arbitraje, escrito después, reintroduce exactamente el patrón corregido:

```js
// match_arbitration.pb.js
report.set("events", events);   // sobrescribe el array completo, sin merge
```

Y el propio hook declara que la sesión es multiusuario por diseño:

> *"La sesión de arbitraje en sí (match_reports) es COMPARTIDA: cualquier cantidad de gente con el código puede agregar eventos a la misma, sin candado."*

**Escenario de falla concreto:** dos personas arbitran el mismo partido desde sus teléfonos. A registra un gol al minuto 30; B, cuyo cliente aún no sincronizó (el poll es cada 10 s — `LeagueMatchArbitratorScreen.tsx:240`), registra una tarjeta al 31 y hace push de *su* array completo. El gol de A desaparece del informe oficial. Nadie recibe un error.

El mitigante actual es el poll de 10 s, que reduce la ventana pero no la cierra; y el comentario del hook dice que "se asume que coordinan en la vida real", lo cual es una suposición razonable en cancha pero no una garantía técnica.

**Corrección sugerida:** mismo patrón que `ladders.pb.js` — en vez de aceptar el array completo, aceptar solo el/los eventos nuevos (o hacer un merge por `id` de evento contra el estado persistido dentro del hook). El array ya tiene validación estructural por evento (`isValidEvent`), así que la pieza que falta es únicamente el merge.

### 4.2 [MEDIO] N+1 sin límite en `GET /api/beaumarket/markets`

**Archivo:** `backend/pb_hooks/beaumarket.pb.js:50-155`

```js
const markets = $app.findRecordsByFilter("beaumarkets", filter, "-created", 100, 0, params);
const result = markets.map((m) => {
    const positions = $app.findRecordsByFilter("beaumarket_positions", "market = {:id} && user = {:u}", "", 0, 0, ...);
    const myTrades  = $app.findRecordsByFilter("beaumarket_trades",    "market = {:id} && user = {:u}", "", 0, 0, ...);
    ...
});
```

Dos consultas **sin límite** (`0, 0` = ilimitado en PocketBase) por cada uno de hasta **100 mercados**: hasta ~200 consultas por carga de la pantalla, por usuario. Es simultáneamente el anti-patrón N+1 y la falta de paginación que `PRINCIPLES.md §1` prohíbe explícitamente ("*Evita patrones N+1: una consulta bien filtrada, no un loop de N peticiones*", "*Paginación siempre*").

**Corrección:** dos consultas totales filtradas por el conjunto de ids de mercado (`market = "a" || market = "b" || ...` acotado a los 100 ids ya cargados) y agrupar en memoria — exactamente el patrón que ya se usó para resolver el caso de `PostDetailScreen` documentado en `PRINCIPLES.md`.

### 4.3 [MEDIO] Escaneo completo y monótonamente creciente del historial de partidos en cada agendamiento

**Archivos:** `backend/pb_hooks/league.pb.js:951-960`, `league.pb.js:1083-1092`, `team_schedule.pb.js:20-28`

```js
$app.findRecordsByFilter("horario_blocked_slots", "", "", 0, 0)
$app.findRecordsByFilter("horario_matches", "status = 'confirmed'", "", 0, 0)
$app.findRecordsByFilter("league_matches", "(status = 'confirmed' || status = 'played') && deleted = false", "", 0, 0)
```

Tres consultas sin límite, repetidas en tres lugares. El problema no es el tamaño de hoy sino la forma: **incluir `status = 'played'` significa que cada partido jugado se queda en el escaneo para siempre**. Cada propuesta y cada aceptación de partido recorre el historial completo de la liga, sin poda por fecha, solo para calcular qué bloques de la semana en curso están ocupados.

**Corrección:** filtrar por el rango de bloques de la ventana que realmente se está calculando (`windowBlockCodes()` ya define ese conjunto), o al menos por fecha, en vez de traer toda la tabla.

Nota: hay **24 consultas con límite `0, 0`** en total en los hooks. La mayoría están acotadas naturalmente por su filtro (etapas de una liga, posiciones de un usuario) y son aceptables; las de esta sección y las de 4.2 son las que crecen sin techo.

### 4.4 [MEDIO] El código de arbitraje no expira y las enmiendas no dejan rastro

**Archivo:** `backend/pb_hooks/match_arbitration.pb.js:74-118`

El código de 6 caracteres tiene buena entropía (`$security.randomStringWithAlphabet`, alfabeto de 32 sin caracteres ambiguos → 32⁶ ≈ 1.07 × 10⁹), y la decisión de que el código *sea* la autorización está documentada y es coherente con el uso real (se dicta en cancha a quien vaya a arbitrar). Dos consecuencias que no parecen deliberadas:

1. **El código nunca caduca.** Tras `submit`, el partido pasa a `played` y el resultado se hace oficial — pero la rama `isAmend` (línea 76) permite seguir reescribiendo eventos y **el marcador del partido** (`match.set("scoreA"...)`, línea 111) indefinidamente, saltándose el guard de "el arbitraje ya se envió". Cualquiera que haya tenido el código en algún momento puede alterar la tabla de posiciones de un partido cerrado semanas atrás.
2. **No hay registro de quién enmendó.** `report.set("referee", e.auth.id)` solo se ejecuta al crear el informe (línea 100), así que el campo guarda a quien hizo el primer push. Todas las modificaciones posteriores, de cualquier cuenta, son anónimas.

**Corrección sugerida:** invalidar o rotar el código al finalizar (dejando la enmienda a la cuenta de la liga, que ya tiene endpoints propios autorizados), y registrar `amendedBy`/`amendedAt` en cada enmienda.

### 4.5 [MEDIO] 5 páginas HTML de administración embebidas en hooks — 29% del código de backend

| Ruta | Archivo | Líneas de HTML |
|---|---|---|
| `/admin/liga` | `league.pb.js:11-572` | 562 |
| `/admin/generate-link` | `auth.pb.js:556-970` | 415 |
| `/admin/reviews-import` | `reviews_import.pb.js:8-412` | 405 |
| `/register-org` | `auth.pb.js:164-504` | 341 |
| `/admin/beaumarket` | `beaumarket.pb.js:359-692` | 334 |
| `/admin/horarios` | `team_schedule.pb.js:64-365` | 302 |
| **Total** | | **~2.360** |

Sobre 8.263 líneas de backend, esto es **el 29% del código de hooks**, en template strings sin resaltado de sintaxis, sin typecheck, sin lint y sin tests. Cada una trae su propia copia de la paleta CSS, y **5 de ellas incluyen su propio formulario de login** que llama a `auth-with-password` y guarda el token en `localStorage` (`liga_auth`, `pb_admin_token`, etc.).

Esto amplifica el hallazgo 4.3 de la auditoría anterior (que señalaba una sola de estas páginas): hoy hay cinco puntos de entrada de credenciales fuera del panel oficial, cinco copias de la misma lógica de sesión, y —como muestra 3.1— es justamente el código que no pasa por ninguna herramienta automática el que acumula el bug de seguridad.

**Corrección sugerida:** no reescribirlas todas de golpe, pero sí (a) extraer el CSS y el bloque de login a un fragmento compartido servido desde un solo lugar, y (b) para páginas nuevas, preferir una pantalla dentro del frontend Expo (que sí pasa por `tsc`, React y el ciclo de review) sobre una página HTML nueva dentro de un hook.

### 4.6 [MEDIO] Las vulnerabilidades altas de npm subieron de 4 a 10; el gate de CI no las detiene

```
18 vulnerabilities (8 moderate, 10 high)
```

La crítica desapareció (bien), pero las altas se multiplicaron: `image-size` (DoS por bucle infinito en parsers ICNS/JXL/HEIF), `postcss` (XSS y path traversal vía `sourceMappingURL`), `nanoid` (bucle infinito), toda la cadena de `metro`/`@expo/cli`.

Todo es **tooling de build**, no código embarcado, así que el riesgo en producción es bajo — pero afecta a quien compile el proyecto, incluido el runner de CI. `nanoid` se corrige con `npm audit fix` sin breaking changes; el resto requiere el upgrade Expo 54→57 ya planificado y comentado en el propio `ci.yml`.

El gate está en `--audit-level=critical`, lo que era correcto cuando se escribió (había 1 crítica y 4 altas) pero hoy significa que **CI pasa en verde con 10 altas**. Vale la pena al menos bajar `nanoid` ahora y dejar el umbral documentado con la fecha de revisión.

### 4.7 [MEDIO] Sin configuración de rate limiting versionada, con ~40 rutas custom

`__bootstrap.pb.js` configura SMTP, S3/R2 y `appURL` desde variables de entorno, pero **no toca `settings.rateLimits`**. Existen 40 rutas `routerAdd` propias, varias de ellas sensibles a fuerza bruta o a abuso:

- `POST /api/league-matches/join` — oráculo de códigos de arbitraje (respuesta distinta según acierto).
- Los 5 formularios de login de las páginas de administración.
- `POST /api/beaumarket/buy` / `sell` — mutaciones de saldo.
- `POST /api/beaudle/guess`.

Sea cual sea la configuración de límites en producción, hoy vive únicamente en el panel `/_/` (dentro de `pb_data/`, que está fuera de git). Es decir: **no es reproducible, no es revisable, y un `pb_data` nuevo arranca sin ella**. Dado que el resto de los settings sí se configuran declarativamente en `__bootstrap.pb.js`, este es el lugar natural para fijarla.

### 4.8 [MEDIO] Erosión de tipos: los `any` crecieron ~30% pese al CI

| | 2026-08-05 | 2026-08-19 |
|---|---|---|
| `: any` | 119 | **180** |
| `as any` | 66 | **77** |

`tsc --noEmit` pasa limpio y el CI lo garantiza — ese fue el arreglo correcto. Pero el typecheck verde se está sosteniendo en parte a base de `any`: en dos semanas se agregaron 61 anotaciones `any` nuevas, concentradas en el código de ligas (`setMatch((prev: any) => ...)` en `LeagueMatchArbitratorScreen.tsx:252` es representativo: los registros de PocketBase se manejan como `any` en vez de tiparse).

Ya existen tipos del dominio en `src/types/`; extenderlos a las colecciones nuevas (`league_matches`, `match_reports`, `team_players`) recuperaría la mayor parte.

---

## 5. Hallazgos nuevos — Bajos / Informativos

- **[BAJO] Guard de membresía duplicada muerto.** `auth.pb.js:122-135`: el `throw new ApiError(400, "El usuario ya participa en esta organización.")` está **dentro** del `try`, y el `catch` que sigue lo traga con el comentario `// Ignorar si no existe previa membresía`. El chequeo nunca dispara. El impacto real es acotado porque existe un índice único `idx_om_user_org` sobre `(user, organization)` (`1783399000_unify_organizations.js:89`) que sí bloquea el duplicado — pero el usuario recibe un error crudo de constraint SQL en vez del mensaje pensado. Los dos bloques `try/catch` inmediatamente anteriores en el mismo handler están escritos correctamente, así que es un desliz aislado.

- **[BAJO] `innerHTML` sin escapar en `/admin/beaumarket`.** `beaumarket.pb.js:632-638` inserta `m.title`, `m.description` y las etiquetas de `outcomes` crudas. A diferencia de 3.1, esos valores solo los crea el propio superusuario desde esa misma página, así que es self-XSS — riesgo bajo, pero conviene corregirlo junto con 3.1 ya que es el mismo patrón.

- **[BAJO] `blog_comments_backup.json` con PII sigue trackeado.** Pendiente de la auditoría anterior (4.8). Nombres de usuario reales y contenido de mensajes, alcanzable en el historial de git desde `309ddaf`.

- **[BAJO] 9 `catch` silenciosos** en `src/`: `ladderService.ts:164`, `activityService.ts:130,140`, `ProblemEditorScreen.tsx:54`, `TinderScreen.tsx:461`, `ProblemDetailScreen.tsx:42`, y 3 en `utils/storage.ts` (estos últimos justificados — `localStorage` puede lanzar en modo privado).

- **[BAJO] 6 pantallas siguen sobre 1000 líneas**: `ProblemDetailScreen` (1417), `TinderScreen` (1316), `HomeScreen` (1227), `LadderDetailScreen` (1161), `ProblemEditorScreen` (1049), `LeagueMatchArbitratorScreen` (1038). El precedente de `TinderScreen` (2448 → 1316 extrayendo a `screens/tinder/`) muestra que el camino ya está probado.

- **[BAJO] Capa de servicios inconsistente.** 27 de 48 pantallas llaman a `pb.collection`/`pb.send` directamente en vez de pasar por `src/services/`. El código de ligas y horarios —lo más nuevo— no tiene servicio propio: las 6 llamadas a `/api/liga/*` y `/api/team-schedule/*` están inline en las pantallas, mientras que features contemporáneos sí lo tienen (`teamPlayersService.ts`, `beaumarketService.ts`).

- **[BAJO] Polling.** Pendiente de la anterior (4.9), y ampliado: notificaciones cada 10 s globalmente (`App.tsx:193`) + 2 peticiones cada 10 s por cada pantalla de arbitraje abierta (`LeagueMatchArbitratorScreen.tsx:240`). PocketBase soporta *realtime subscriptions* nativas, que encajarían especialmente bien en el caso del arbitraje (donde además resolverían parcialmente 4.1).

- **[BAJO] Sin ESLint ni script de test en el frontend.** `frontend/package.json` no define `lint` ni `test`; el CI solo corre `tsc`. Las 45.784 líneas de frontend no tienen ninguna prueba (a diferencia del backend, que ahora sí).

- **[BAJO] Dos pares de migraciones con timestamp duplicado** (`1784000500`, `1784000600`). Pendiente de la anterior; inofensivo hoy porque el nombre completo ordena de forma determinista.

- **[BAJO] `match_reports` es legible por cualquier autenticado** (`listRule`/`viewRule`: `@request.auth.id != ''`), incluido el campo `notes` — el informe arbitral en texto libre, que es justamente donde se anotan incidentes con nombres de jugadores. El hook lo declara deliberado ("*Leer el estado en vivo SÍ es público*"), pero esa decisión se tomó pensando en marcador y eventos; conviene revisar si `notes` debía quedar incluido.

- **[INFO] Documentación desincronizada.** `auditoria.md` (5 ago) está materialmente obsoleta —afirma "Sin CI/CD" y "cero suite de pruebas automatizadas", ambas cosas ya falsas— y `PRINCIPLES.md` la enlaza como la auditoría vigente. `SECURITY_AND_MAINTENANCE.md` no se toca desde el 27 de julio, pese a que desde entonces se agregó toda la superficie de ligas, códigos de arbitraje, invitaciones a organizaciones y dos páginas de administración nuevas.

- **[INFO] Sin secretos filtrados.** Reverificado: `backend/.env`, `frontend/.env`, `pb_data/`, el binario `pocketbase` y `frontend/dist/` no están trackeados. `.gitignore` correcto.

---

## 6. Aspectos positivos observados

- **`pb_hooks/lib/` es el mejor cambio estructural del período.** Extraer la lógica pura (OpenSkill, karma, LMSR de Beaumarket, Beaudle, eventos de partido, algoritmo de horarios) a módulos sin dependencia de `$app` resolvió de una vez el hallazgo 5-bajo de la auditoría anterior ("*el cálculo de OpenSkill está reimplementado como una IIFE de 150 líneas dentro de `ladders.pb.js`... dificulta escribir un test unitario*") y habilitó los 154 tests. Es exactamente la corrección estructural correcta, no un parche.
- **El algoritmo de emparejamiento de horarios está genuinamente bien probado**: casos de simetría, infactibilidad, exclusión de pares ya enfrentados, y el caso adversarial de "equipo que marca todo igual no se beneficia frente a uno que sí diferencia".
- **Autorización consistente en las 12 rutas de liga**: todas verifican `type === "organization" && subtype === "league"` y, cuando operan sobre un recurso, que pertenezca a la liga autenticada (`stage.getString("league") !== e.auth.id`). El diseño de "la cuenta de usuario *es* la liga" elimina toda una clase de bugs de IDOR y está explicado en la cabecera del archivo.
- **Los hallazgos operativos de PocketBase se documentan en el código donde importan**, no en un wiki que nadie lee: la cabecera de `team_players.pb.js` describe un bug real del runtime Goja (llamar a una función compartida con `$app.*` y luego otro `$app.*` revienta con un 400 genérico), incluyendo qué combinaciones se probaron y por qué la duplicación resultante es deliberada. Lo mismo con `report.getString("events") + JSON.parse` en `match_arbitration.pb.js:200` y con el comportamiento de `<coleccion>_via_<campo>` en `PRINCIPLES.md`.
- **Uso correcto de transacciones donde el estado debe ser consistente**: `match_arbitration.pb.js:215` envuelve el cierre del partido y la aprobación del informe en `$app.runInTransaction`.
- **Las reglas de las colecciones nuevas siguen el patrón seguro**: `league_teams`, `league_matches` y `match_reports` tienen `createRule`/`updateRule`/`deleteRule` en `null`, forzando que toda escritura pase por un hook que valida — en vez de reglas declarativas complejas que ya causaron un incidente en el pasado.
- **El ciclo de invitación a organizaciones cierra bien la escalación**: `auth.pb.js:140` fuerza `status = "pending"` sin importar qué mande el cliente, y `auth.pb.js:155` impide que *nadie* (ni la propia organización) mueva a `active` por la API normal; la única vía es `/api/org-invites/respond`, que usa `$app.save` para evitar deliberadamente su propio hook. La lógica y el porqué están comentados en ambos extremos.
- **Soft-delete uniforme** (`deleted`) en todas las colecciones nuevas, con las reglas de update que impiden resucitar filas borradas por la API.
- **Migraciones tratadas como inmutables**: las 52 migraciones desde el 6 de agosto tienen exactamente un commit cada una. La recomendación #8 no solo se aplicó, se sostuvo.

---

## 7. Recomendaciones priorizadas

**Ahora (minutos, alto impacto):**

1. **Corregir la XSS de `/admin/liga`** (`league.pb.js:254,393`) usando `createElement` + `createTextNode`, como ya se hace en las otras 18 inserciones del mismo archivo. De paso, escapar las 3 inserciones de `/admin/beaumarket` (`beaumarket.pb.js:632-638`).
2. **Sacar el `throw` del `try`** en `auth.pb.js:122-135` para que el mensaje de "el usuario ya participa" reemplace al error crudo de constraint.
3. **`npm audit fix`** para bajar `nanoid` (no-breaking), y anotar en `ci.yml` la fecha de revisión del umbral `critical`.
4. **Purgar `blog_comments_backup.json`** — pendiente desde la auditoría anterior.

**Esta iteración:**

5. **Merge de eventos en el arbitraje** (`match_arbitration.pb.js`), replicando el patrón ya validado en `ladders.pb.js:74-94`. Es el hallazgo con mayor probabilidad de causar una pérdida de datos visible para un usuario.
6. **Acotar las consultas de horarios por ventana temporal** (`league.pb.js:951,1083`, `team_schedule.pb.js:20`) — hoy cada agendamiento escanea todos los partidos jugados de la historia.
7. **Colapsar el N+1 de `/api/beaumarket/markets`** en dos consultas filtradas por el conjunto de ids.
8. **Fijar `settings.rateLimits` en `__bootstrap.pb.js`**, con foco en `/api/league-matches/join` y los formularios de login de las páginas de administración.

**Próxima fase:**

9. **Caducar el código de arbitraje al finalizar el partido** y registrar autor/fecha de cada enmienda.
10. **Extraer un `leagueService`/`scheduleService`** y tipar las colecciones nuevas en `src/types/`, para frenar el crecimiento de `any`.
11. **Upgrade de Expo 54→57** en un branch dedicado, que resuelve las 10 altas de npm de un golpe; subir el gate de CI a `high` al terminar.
12. **No agregar más páginas HTML dentro de hooks.** Para las existentes, extraer al menos el CSS y el bloque de login compartido; el 29% del backend que no pasa por ninguna herramienta automática es donde apareció el único hallazgo alto de esta auditoría.
13. **Actualizar la documentación**: apuntar `PRINCIPLES.md` a esta auditoría, y revisar `SECURITY_AND_MAINTENANCE.md` (sin cambios desde el 27 de julio) para incorporar el modelo de autorización por código de arbitraje y las páginas de administración.

---

## 8. Métricas del estado actual

| Métrica | 2026-08-05 | 2026-08-19 |
|---|---|---|
| Hooks de backend (líneas) | 2.693 | 8.263 |
| — de las cuales, HTML embebido | ~750 | ~2.360 (29%) |
| Lógica pura extraída a `lib/` | 0 | 8 módulos |
| Tests automatizados | 0 | **154, todos pasan** |
| Migraciones | 73 | 125 |
| Errores de `tsc --noEmit` | 4 | **0** |
| `: any` / `as any` | 119 / 66 | 180 / 77 |
| Vulnerabilidades npm | 1 crítica, 4 altas, 12 mod. | 0 críticas, **10 altas**, 8 mod. |
| `console.log` en hooks / frontend | decenas / 3 | 8 / **0** |
| Pantallas frontend | ~30 | 48 |
| Pantallas >1000 líneas | 5 | 6 |
| CI | ninguno | typecheck + audit + tests |

---

## 9. Estado de implementación

**Fecha de aplicación:** 2026-08-19, mismo día de la auditoría.
**Verificación:** los 175 tests de `npm run test:backend` pasan (eran 154 — se agregaron 21), `npx tsc --noEmit` compila limpio, y todo el comportamiento de backend se probó contra una instancia real de PocketBase levantada sobre una copia aislada de `pb_data`.

### 9.1 Recomendaciones aplicadas

| # | Recomendación | Estado | Qué se hizo |
|---|---|---|---|
| 1 | Corregir la XSS de `/admin/liga` | ✅ | `league.pb.js`: helper `teamCheckboxRow()` que arma la fila con `createElement` + `createTextNode`. Cubre los dos puntos de inyección (roster y selector de etapa). También se escapó `/admin/beaumarket` (§5.2) con `esc()`, ahora compartido desde `lib/adminUi.js` |
| 2 | Sacar el `throw` del `try` en `auth.pb.js` | ✅ | El `try` envuelve solo la consulta; el `throw` quedó fuera. El usuario ve «El usuario ya participa en esta organización» en vez del error crudo del índice único |
| 3 | `npm audit fix` + fecha de revisión en `ci.yml` | ✅ | `nanoid` corregido sin breaking changes (18 → 17 vulns, 10 → 9 altas). El comentario del gate ahora lleva fecha de revisión y la condición explícita para subirlo a `high` |
| 4 | Purgar `blog_comments_backup.json` | ✅ parcial | Sacado del árbol y del índice de git; `.gitignore` cubre `blog_comments_backup.json` y `*_backup.json`. **Sigue alcanzable en commits anteriores** — ver 9.3 |
| 5 | Merge de eventos en el arbitraje | ✅ | `mergeEvents()` en `lib/matchEvents.js`: fusión de tres vías (`stored` × `incoming` × `baseKeys`) con identidad por evento (`eventKey()`), orden cronológico por `at` y compatibilidad con los eventos legados sin `id`. El cliente genera `id` por evento y manda `baseKeys`. 12 tests nuevos |
| 6 | Acotar las consultas de horarios por ventana | ✅ | `windowBlockRange()` aprovecha que `blockCode` es `YYYY-MM-DD-HH` (orden lexicográfico = cronológico) para filtrar con `blockCode >= {:from} && blockCode <= {:to}`, con límite explícito igual al tamaño de la ventana. Aplicado en los 3 sitios. 3 tests nuevos |
| 7 | Colapsar el N+1 de `/api/beaumarket/markets` | ✅ | De ~200 consultas a 2, con filtro parametrizado `{:m0} \|\| {:m1} \|\| …` y paginación real (`findAllPaged`). También se corrigió `/api/admin/beaumarket/list`, que cargaba todas las filas de trades solo para contarlas: ahora es un `GROUP BY` |
| 8 | Fijar `settings.rateLimits` en el bootstrap | ✅ | 9 reglas versionadas en `__bootstrap.pb.js`, de la más específica a la más general. Verificado en vivo: el intento 11 sobre `/api/league-matches/join` devuelve 429 |
| 9 | Caducar el código de arbitraje + rastro de enmiendas | ✅ | `matchWriteDecision()` centraliza la regla: con el partido `played` el código ya no autoriza, solo la liga dueña. Campos `amendedBy`/`amendedAt` (migración `1787360000`). 6 tests nuevos |
| 10 | `leagueService` + tipar las colecciones nuevas | ✅ | `services/leagueService.ts` y `types/league.ts` (`LeagueMatch`, `MatchReport`, `LeagueStage`, `LeagueTeam`, `HorarioAvailability`, …). La pantalla de arbitraje ya no usa `any` para los registros |
| 11 | Upgrade de Expo 54→57 | ⏸️ | **Deliberadamente fuera de alcance** — ver 9.3 |
| 12 | Dejar de duplicar las páginas de administración | ✅ parcial | `lib/adminUi.js` con la paleta compartida (`PALETTE_CSS`, era byte a byte idéntica en las 6 páginas) y el escapado (`escapeHtml`/`clientEscapeHtmlFn`). Las 6 páginas verificadas renderizando. El bloque de login **no** se unificó — ver 9.3 |
| 13 | Actualizar la documentación | ✅ | `SECURITY_AND_MAINTENANCE.md` +4 secciones nuevas (páginas de administración/XSS, autorización del arbitraje, rate limits, aislamiento de VMs de Goja). `PRINCIPLES.md` y `README.md` apuntan acá. `auditoria.md` marcada como superada, con la lista de sus afirmaciones que hoy son falsas |

También se aplicaron dos hallazgos bajos: los **6 `catch` silenciosos** de §5.3 ahora registran el error (los 3 restantes, en `utils/storage.ts`, son deliberados y quedaron documentados como tales), y el `finalizeMatch` de la pantalla de arbitraje ganó una guarda contra enviar el código en `null` — un bug latente que destapó el tipado nuevo.

### 9.2 Hallazgos de la propia implementación

Tres cosas que solo aparecieron al verificar contra PocketBase real, y que quedaron documentadas en `SECURITY_AND_MAINTENANCE.md` §7 y §8 para no volver a pagarlas:

- **Los valores válidos de `audience` en las reglas de rate limit son `""`, `"@guest"` y `"@auth"` — con arroba.** El `types.d.ts` que trae PocketBase los documenta sin arroba. Con los valores del `.d.ts` el guardado falla entero y **el servidor arranca sin ningún límite aplicado**, dejando solo una línea en el log de arranque.
- **PocketBase ejecuta cada `routerAdd` en una VM de Goja aislada.** Una función declarada en el scope del módulo `.pb.js` no existe dentro de los handlers: el endpoint responde `X is not defined` en tiempo de ejecución, no al cargar el hook. Por eso la regla de autorización terminó en `lib/matchEvents.js` como función pura importada con `require()` dentro de cada handler.
- **`record.isNew` es un método, no una propiedad.** `if (!report.isNew)` siempre es falso, lo que habría anulado la fusión de eventos en silencio.

Y un cuarto, propio del formato: el HTML de las páginas de administración vive en un template literal, así que **un backtick suelto en un comentario rompe el hook entero** con un `SyntaxError` al cargar.

### 9.3 Lo que quedó fuera, y por qué

- **Upgrade de Expo 54→57 (rec. 11).** Es un cambio mayor con breaking changes en toda la cadena de Expo/Metro/React Native, y no es verificable sin correr la app completa en web y en nativo. La propia auditoría lo plantea como fase aparte en un branch dedicado. Las 9 vulns altas restantes son **todas de tooling de build** — ninguna viaja en el bundle que reciben los usuarios —, así que el riesgo de dejarlo pendiente es bajo y acotado a quien compila.
- **Purga del historial de git (rec. 4).** Sacar `blog_comments_backup.json` de los commits anteriores requiere reescribir la historia (`git filter-repo`), lo que invalida todos los clones y obliga a un force-push. Es una decisión del dueño del repo, no algo que corresponda hacer sin pedirlo.
- **Unificar el formulario de login de las páginas de administración (rec. 12).** Los cinco difieren en la colección contra la que autentican (`users` vs `_superusers`), la clave de `localStorage` y la validación posterior al login. Se unificó lo que era idéntico (paleta y escapado); parametrizar el resto es un refactor de más superficie que la que justifica el riesgo en código sin tests.
- **Dividir las 6 pantallas de más de 1000 líneas (§5.3).** Es un refactor grande sobre código de UI sin ninguna prueba automática, con riesgo de regresión alto y beneficio puramente estructural. Conviene hacerlo pantalla por pantalla, como ya se hizo con `TinderScreen`.
- **Privacidad de `match_reports.notes` (§5.3).** Se implementó una redacción y **se revirtió**: rompía el arbitraje compartido, que es una propiedad de diseño explícita — un segundo árbitro legítimo, con el código, habría visto el informe vacío. Es una decisión de producto (privacidad del borrador vs. sesión compartida), no un defecto, y queda para que la resuelva quien define el producto.
- **ESLint y pruebas de frontend (§5.3).** Añadir ESLint implica elegir configuración y arrastrar dependencias nuevas; no estaba entre las 13 recomendaciones priorizadas y conviene decidirlo aparte.

### 9.4 Métricas después de la implementación

| Métrica | Al auditar (19 ago) | Tras implementar |
|---|---|---|
| Tests automatizados | 154 | **175** |
| Errores de `tsc --noEmit` | 0 | 0 |
| Vulnerabilidades npm | 0 crít · 10 altas · 8 mod | 0 crít · **9 altas** · 8 mod |
| Hallazgos altos abiertos | 1 | **0** |
| Hallazgos medios abiertos | 8 | **0** |
| `catch` silenciosos | 9 | **3** (deliberados y documentados) |
| Consultas sin límite que crecen sin techo | 5 | **0** |
| Líneas de lógica pura testeada (`lib/`) | 1.404 | **1.580** |
