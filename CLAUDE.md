# Beauchapp — contexto para una sesión nueva

Red social y plataforma comunitaria de la Facultad de Ciencias Físicas y Matemáticas de la
Universidad de Chile (Beauchef). Está **en producción con usuarios reales** (447 cuentas a
2026-08-20), así que cada cambio en `master` puede terminar frente a gente de verdad.

Lee esto entero antes de tocar nada. Está ordenado de lo que más se necesita a lo que menos.

---

## 1. Qué es, en una pantalla

Un monorepo con dos mitades:

- **`backend/`** — PocketBase 0.39 (Go + SQLite) con **hooks en JavaScript**. Toda la lógica
  de negocio vive ahí. No hay un servidor Node aparte.
- **`frontend/`** — Expo 54 / React Native 0.81 / React 19, TypeScript en modo estricto.
  Compila a web y se sirve como estático **desde el mismo PocketBase**.

Las funcionalidades ("beauchapps") son: foro, Pautas (enunciados y soluciones), Ladders
(ELO con OpenSkill), Reseñas de cursos y profesores, Beaudle (juego diario), Beaumarket
(mercado de predicciones), Marketplace, Tinder Beauchef, Actividades, Ligas de fútbol con
arbitraje en vivo, Beaupolla (apuestas sin dinero sobre esas ligas) y Horarios.

```
[Usuarios] → [Cloudflare Tunnel] → [PocketBase 127.0.0.1:8090]
                                        ├── API REST + hooks JS
                                        ├── frontend compilado (pb_public/)
                                        └── SQLite (pb_data/)
   [Imágenes] → Cloudflare R2 (bucket beauchapp) → images.daridius.cl
```

---

## 2. Las trampas que cuestan horas

Esto es lo que no se deduce leyendo el código, y cada punto costó un bug real.

### 2.1 Cada `routerAdd` corre en su propia VM (Goja)

Una función declarada en el scope del módulo **no existe** dentro del handler. Lo único que
cruza es `require()` **hecho adentro del handler**:

```js
routerAdd("POST", "/api/loquesea", (e) => {
    const { algo } = require(`${__hooks}/lib/algo.js`);   // adentro, siempre
});
```

Por eso la lógica pura vive en `pb_hooks/lib/*.js` (sin `$app`) y se testea con `node --test`.
Los `$app.*` van dentro del handler. Síntoma típico: `X is not defined` en runtime, con el
código perfectamente visible tres líneas más arriba.

### 2.2 `record.isNew` es un **método**, no una propiedad

`if (!record.isNew)` es siempre falso — una función siempre es truthy. Va `record.isNew()`.

### 2.3 Un backtick dentro de un comentario rompe la página entera

Las páginas de administración son plantillas de string gigantes dentro de los `.pb.js`. Un
`` `así` `` en un comentario **dentro** de la plantilla la corta por la mitad. Pasó tres veces.
Antes de dar por buena una página, verifica:

```bash
node --check backend/pb_hooks/tuarchivo.pb.js
```

Y lo mismo con `\n` dentro de esas plantillas: hay que escribirlo `\\n`, o el JS de afuera
mete un salto de línea real en el HTML servido y rompe el string en el navegador.

### 2.4 `audience` de los rate limits no es lo que dice `types.d.ts`

Los valores válidos son `""`, `"@guest"`, `"@auth"` — **con arroba**. Con el valor incorrecto
PocketBase arranca **sin ningún rate limit**, y solo deja una línea en el log.

### 2.5 Las `EXPO_PUBLIC_*` se incrustan **al compilar**

El `.env` de producción vive en el servidor, pero el frontend se compila en tu máquina: ese
`.env` no participa del build. Si falta una variable, el sitio sale a producción degradado sin
ningún error visible. Y hay que compilar con `--clear`, porque si no Metro reutiliza el bundle
cacheado y el cambio de variable no se refleja (sale con el mismo hash). Detalles en `DEPLOY.md`.

### 2.6 Subir `pb_hooks/` reinicia PocketBase solo

Corre con `--hooksWatch` (por defecto activo). Cualquier escritura en `pb_hooks/` reinicia el
proceso sin pasar por systemd — y **ahí se aplican las migraciones**, no en el restart manual
del final. Ver `DEPLOY.md`.

### 2.7 Las migraciones no pueden `require()` los hooks

En el contexto de migraciones no existe `__hooks` (`ReferenceError`). Si una migración necesita
lógica de un `lib/`, se copia adentro — y además así queda congelada, que es lo correcto: una
migración es una foto de un momento y no debe cambiar porque alguien edite esa función después.

---

## 3. Cómo se trabaja acá

```bash
# Backend (aplica migraciones al arrancar, recarga hooks al vuelo)
cd backend && ./pocketbase serve

# Frontend
cd frontend && npm run web

# Antes de cualquier commit que toque el backend
npm run test:backend        # node --test sobre pb_hooks/lib/__tests__ (223 tests)

# Antes de cualquier commit que toque el frontend
cd frontend && npx tsc --noEmit
```

**Verificar en el navegador sin credenciales.** Las páginas de administración
(`/admin/liga`, `/admin/horarios`, `/admin/beaumarket`, `/admin/reviews-import`,
`/admin/generate-link`) piden sesión, pero se pueden probar enteras interceptando `fetch`:
se descarga el HTML, se le inyecta un `<script>` con `localStorage` y un `window.fetch` falso,
y se escribe con `document.write` sobre una página **del mismo origen pero sin scripts**
(por ejemplo `/api/health`; si se hace sobre la propia página, sus `const` globales chocan y
tira `X has already been declared`).

**Inspeccionar producción sin romper nada.** El servidor no tiene `node` ni `sqlite3`, pero sí
`python3` con el módulo `sqlite3`. Siempre en modo lectura:

```python
sqlite3.connect("file:/home/salas/red-social/pb_data/data.db?mode=ro", uri=True)
```

`pb_data/auxiliary.db` guarda el log de peticiones (`_logs`, con `data` en JSON): sirve para
medir tráfico real, contar 429, ver qué IP ve PocketBase, etc.

---

## 4. Dónde está cada cosa

### Backend (`backend/pb_hooks/`)

29 archivos `*.pb.js`, uno por dominio: `forum`, `problems`, `ladders`, `beaudle`,
`beaumarket`, `marketplace`, `tinder`, `activities`, `league`, `polla`, `match_arbitration`,
`team_schedule`, `notifications`, `auth`, `organizations`, `reports`, `blocking`…

Especiales:

| Archivo | Para qué |
|---|---|
| `__bootstrap.pb.js` | SMTP, R2, `appURL`, **rate limits** y **trustedProxy**. Todo lo que sería configuración manual del panel vive acá, versionado. |
| `storage_guard.pb.js` | Rechaza subidas si R2 no está activo. Nunca se guardan imágenes en el disco del servidor. |
| `target_meta.pb.js` / `enrich_targets.pb.js` | Los posts pueden apuntar a cualquier entidad (`targetType` + `targetId`) y guardan una copia de sus datos (`targetMeta`) para sobrevivir al borrado. |
| `public_league.pb.js` | Endpoints `/api/public/*`: dejan ver ligas sin sesión **sin abrir las reglas de las colecciones**. |

`pb_hooks/lib/*.js` es lógica pura sin `$app`, con tests: `matchEvents`, `polla`, `openskill`,
`karma`, `beaudle`, `beaumarket`, `beaurok`, `mentions`, `teamSchedule`, `adminUi`,
`publicLeague`, `chipFields`.

### Frontend (`frontend/src/`)

56 pantallas en `screens/`, 16 servicios en `services/` (toda llamada a la API pasa por un
servicio, no por `pb.collection` suelto en la pantalla), componentes compartidos en
`components/`, y `theme/theme.ts` con la paleta.

### Base de datos

45 colecciones. Las centrales: `users` (personas **y** organizaciones, distinguidas por
`type`/`subtype`), `posts` (foro, comentarios y citas en la misma tabla), `notifications`,
`organization_members`, y los grupos por feature (`league_*`, `ladder_*`, `tinder_*`,
`beaumarket*`, `beaudle_*`, `horario_*`, `marketplace_items`, `problems`, `courses`).

---

## 5. Cosas que ya se decidieron (no volver a discutirlas)

- **Borrado suave en todos lados.** Casi todo tiene `deleted`; borrar de verdad rompe hilos
  de conversación y referencias. Ver `PRINCIPLES.md`.
- **Imágenes desde R2, no proxeadas.** Solo las miniaturas `100x100` de avatares y escudos
  chicos pasan por PocketBase; todo lo demás va directo al CDN. Y nunca se pide miniatura de
  un `.webp`: PocketBase la re-codifica y sale **más pesada que el original** (medido: 6,8 KB
  → 103 KB). Detalle completo en `PRINCIPLES.md` §2.
- **Endpoints públicos dedicados** antes que abrir reglas de colección. Abrir `users` para
  mostrar el nombre de un equipo expondría las 447 cuentas.
- **El servidor es un Atom con 2 GB y 10 Mbps de subida.** Cualquier cosa que multiplique
  peticiones o bytes por usuario importa. Ver `PRINCIPLES.md` §1.
- **`withMinimumDelay(fn, 400)`** para que los spinners se vean, en vez de parpadear.

---

## 6. Producción

Homeserver del usuario, `ssh salas@192.168.0.6`, directorio `~/red-social`, servicio systemd
`pocketbase`, dominio <https://beauchapp.daridius.cl>.

**El `sudo` pide contraseña**, así que un agente no puede reiniciar el servicio: se hacen los
pasos sin sudo y el `sudo systemctl restart pocketbase` lo corre la persona. En la práctica
el reinicio suele ocurrir solo al subir los hooks (§2.6).

**No despliegues sin que te lo pidan explícitamente en ese momento.** El procedimiento
completo, el checklist y el rollback están en `DEPLOY.md`, que tiene una sección escrita
específicamente para agentes de IA.

---

## 7. Mapa de documentación

| Documento | Cuándo leerlo |
|---|---|
| [`PRINCIPLES.md`](./PRINCIPLES.md) | **Antes de cualquier tarea no trivial.** Por qué el código es como es. |
| [`.agents/AGENTS.md`](./.agents/AGENTS.md) | Reglas operativas: layout responsivo, deep links, scroll en PWA, tiempos de carga. |
| [`DEPLOY.md`](./DEPLOY.md) | Cualquier cosa que toque producción. |
| [`SECURITY_AND_MAINTENANCE.md`](./SECURITY_AND_MAINTENANCE.md) | Reglas de seguridad, caveats de PocketBase, incidentes pasados. |
| [`DESIGN.md`](./DESIGN.md) | Cualquier cambio visual. |
| [`SETUP.md`](./SETUP.md) | Levantar el proyecto de cero, variables de entorno. |
| [`auditoria-2026-08-19.md`](./auditoria-2026-08-19.md) | Estado técnico del proyecto y qué se resolvió de cada hallazgo. |

Y una regla del propio proyecto que conviene respetar: **el código y los comentarios están en
español**, y los comentarios explican *por qué*, no *qué*.
