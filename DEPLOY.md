# Guía de Despliegue — Beauchapp

Este documento cubre cómo desplegar Beauchapp a producción, tanto para una persona haciéndolo manualmente como — sección aparte, léela igual — para un agente de IA que lo haga en tu nombre.

Para la arquitectura completa de producción y el setup inicial del servidor (primera vez, sin nada instalado) usa [`SETUP.md`](./SETUP.md). Este documento asume que el servidor **ya existe y ya fue desplegado al menos una vez**; es la guía del día a día.

---

## Arquitectura resumida

```
[Usuarios] → [Cloudflare Tunnel / Caddy] → [PocketBase :8090]
                                                ├── API REST
                                                ├── Frontend estático (pb_public/)
                                                └── SQLite (pb_data/)
```

- PocketBase sirve la API **y** el frontend compilado desde el mismo proceso — no hay servidor de frontend separado.
- Los archivos (imágenes) NO se guardan en el servidor — van a Cloudflare R2 (ver [`PRINCIPLES.md`](./PRINCIPLES.md#2-los-archivos-imágenes-fotos-se-sirven-directo-desde-r2-no-proxeados-por-el-servidor)). Si `R2_ENDPOINT` no está configurado en el `.env` del servidor, las subidas de archivos se rechazan explícitamente (`storage_guard.pb.js`) — el deploy no falla, pero esa funcionalidad sí.
- El `.env` de producción (con `RESEND_API_KEY`, credenciales de R2, `APP_URL`) vive **solo en el servidor** y nunca se sube desde el repo — `deploy.sh` solo sube `.env.example` como referencia. Si es la primera vez, hay que crearlo a mano en el servidor (`cp .env.example .env && nano .env`) antes de levantar el servicio.

---

## Checklist antes de cualquier deploy

No saltarse ninguno de estos pasos, en este orden:

1. **`git status` limpio** — todo lo que se va a desplegar debe estar commiteado. Nunca desplegar cambios sin commitear (si el deploy falla a mitad de camino, no hay forma de reproducir exactamente qué se subió).
2. **Frontend:**
   ```bash
   cd frontend && npx tsc --noEmit
   ```
   Debe salir limpio. Un error de tipos no bloquea el build de Expo necesariamente, pero es señal de que algo no está probado.
3. **Backend:**
   ```bash
   npm run test:backend
   ```
   Los tests de lógica pura (`backend/pb_hooks/lib/__tests__`) deben pasar.
4. **Revisar que `backend/start.sh` no tenga `--dev`** — si en algún momento se agregó para debug local, sacarlo antes de desplegar (ver [`SECURITY_AND_MAINTENANCE.md`](./SECURITY_AND_MAINTENANCE.md)).
5. **Migraciones nuevas, si las hay** — revisar que cada migración nueva en `backend/pb_migrations/` tenga su función `down` y que no sea una edición de una migración ya aplicada en producción (ver `auditoria.md`, hallazgo sobre migraciones inmutables). Las migraciones se aplican automáticamente al arrancar PocketBase.
6. **Ninguna migración ni cambio debe tocar la configuración de auth de la colección `users`** (su `secret`/`tokenKey`, duración de tokens, config de OAuth2) — eso invalida de golpe la sesión de **todos** los usuarios logueados a la vez, no solo la de uno. Ver la sección de abajo sobre el deslogueo masivo.

## Deploy manual (paso a paso)

```bash
# Desde la raíz del repo, en tu máquina local
export DEPLOY_SERVER=salas@homeserver           # obligatorio — ver nota abajo
export DEPLOY_REMOTE_DIR=red-social             # opcional, default "red-social"

./deploy.sh
```

**`DEPLOY_SERVER` tiene que ser `usuario@host`, nunca un alias de SSH a secas.**
`deploy.sh` deriva `REMOTE_USER` cortando todo lo que sigue a la `@`
(`REMOTE_USER="${SERVER%@*}"`) para armar el `User=` del servicio systemd. Si
`DEPLOY_SERVER` no tiene ninguna `@` — por ejemplo, usar directamente el alias
`homeserver` de `~/.ssh/config` (ver `CLAUDE.md` §6) — no hay nada que cortar y
`REMOTE_USER` queda igual al alias completo, así que el servicio se crea con un
usuario (`homeserver`) que no existe en el servidor, y `pocketbase.service`
nunca arranca. La forma correcta de aprovechar ese alias es anteponerle el
usuario explícito: `salas@homeserver` — ssh sigue resolviendo `homeserver` a
través del alias (IP, puerto, clave), pero el script ya tiene la `@` que
necesita para extraer `REMOTE_USER` bien. `salas@192.168.0.6` (la IP directa)
funciona igual de bien si el alias no está configurado en la máquina desde la
que se despliega.

Qué hace `deploy.sh`, en orden:
1. Compila el frontend (`npx expo export -p web`) si `frontend/dist/` no existe ya.
2. Prepara el servidor (dependencias del sistema, descarga el binario de PocketBase si falta).
3. **Respalda `pb_data/` y `pb_public/` actuales del servidor** en `~/<REMOTE_DIR>/backups/` (comprimidos, con timestamp, conservando los últimos 10) — *antes* de sobrescribir nada.
4. Sube `pb_migrations/`, `pb_hooks/`, `seed.js`, `start.sh`, `.env.example` (no `.env` real).
5. Sube el frontend compilado a `pb_public/`.
6. Configura/reinicia el servicio systemd (`pocketbase.service`), que corre `start.sh` — el mismo script que aplica las variables de entorno del `.env` real que ya vive en el servidor.
7. Al final, ofrece configurar un túnel de Cloudflare si es la primera vez exponiendo el dominio.

Después del deploy, verificar a mano:
```bash
curl -s https://tu-dominio.com/api/health
```

## Ojo: las `EXPO_PUBLIC_*` se incrustan al compilar

El `.env` de producción vive en el servidor, pero **el frontend se compila en tu máquina**,
así que ese `.env` no participa del build. Las variables `EXPO_PUBLIC_*` tienen que estar
en el entorno local al momento de compilar; si falta alguna, queda incrustado el valor por
defecto (o ninguno) y el sitio sale a producción así, sin ningún error visible.

La que más duele es `EXPO_PUBLIC_R2_URL`: sin ella, **cada imagen a tamaño completo se
sirve a través de PocketBase** en vez de directo desde R2, en contra de
[`PRINCIPLES.md`](./PRINCIPLES.md) §2. Y no se nota mirando la página, porque las
miniaturas pasan por el servidor de todas formas (PocketBase las genera al vuelo): el feed
y los avatares se ven perfectos aunque la ruta directa esté rota. Para comprobarlo hay que
mirar el bundle:

```bash
grep -c "images.tu-dominio.com" frontend/dist/_expo/static/js/web/index-*.js   # debe dar 1
```

`deploy.sh` carga `frontend/.env` y avisa si la variable falta.

**Cuidado con `EXPO_PUBLIC_API_URL`**: el valor de `.env.example` es `http://127.0.0.1:8090`.
Si se copia tal cual a `frontend/.env`, queda incrustado en el bundle y **rompe producción**.
Déjala sin definir: la web usa `window.location.origin`, que es lo correcto servida por
PocketBase detrás de Cloudflare.

Y compila siempre con `--clear`: sin eso Metro reutiliza el bundle cacheado y un cambio en
las `EXPO_PUBLIC_*` no se refleja — sale con el mismo hash que antes y parece que no pasó
nada, porque efectivamente no pasó.

## Ojo: un deploy no debería desloguear a nadie

El usuario reportó que, después de un deploy anterior, **todos los usuarios quedaron
deslogueados de golpe**. No es un comportamiento normal ni esperado de `deploy.sh` — un
reinicio de PocketBase (§ siguiente) o un frontend nuevo no invalidan por sí solos las
sesiones existentes, así que si vuelve a pasar hay una causa puntual que rastrear, no algo
a asumir como "normal de desplegar". Candidatos conocidos, de más a menos probable:

- **Una migración tocó la config de auth de `users`** (regenerar `secret`/`tokenKey`, cambiar
  duración de tokens, tocar OAuth2) — invalida todos los JWT existentes en un solo golpe.
  Es el único mecanismo del lado del servidor que puede deslogar a *todo el mundo* a la vez
  (deslogar a un usuario puntual sí es normal: pasa al cambiar su contraseña). **Revisar esto
  explícitamente antes de cada deploy con migraciones nuevas** (punto 6 del checklist).
- **El frontend cambió `frontend/src/services/pocketbase.ts`** (la clave de `AsyncAuthStore`,
  el nombre bajo el que se guarda el token) — un cambio ahí hace que el bundle nuevo busque
  la sesión en otro lado y no la encuentre, aunque el token viejo siga siendo válido.
- **El dominio o origen cambió** (nuevo túnel de Cloudflare, redirect a otro host) — el
  `localStorage` del navegador es por origen, así que un cambio de dominio pierde la sesión
  web sin que sea culpa del backend.

Antes de desplegar algo que toque cualquiera de esos tres puntos, decirlo explícitamente al
usuario y pedir confirmación aparte, incluso si ya confirmó el deploy en general. Después de
cualquier deploy, como parte de la verificación normal (no opcional): confirmar con el
usuario que su propia sesión sigue activa sin tener que volver a loguearse.

## Ojo: subir `pb_hooks/` reinicia PocketBase solo

PocketBase corre con `--hooksWatch` (por defecto **true**), así que **cualquier escritura
dentro de `pb_hooks/` reinicia el proceso**, sin pasar por `systemctl` y sin pedir la
clave de sudo. Dos consecuencias que hay que tener presentes:

- **Las migraciones nuevas se aplican en ese reinicio**, no cuando uno hace el
  `systemctl restart` del final. Si alguna migración toca datos (una limpieza, un
  backfill), corre en ese momento — asegúrate de tener el respaldo hecho *antes* de
  subir los hooks, no después.
- **Un `scp` archivo por archivo puede reiniciar a mitad de la copia**, con el árbol de
  hooks incompleto. Conviene subir a un directorio de paso y recién ahí copiar todo de
  una:

  ```bash
  scp -r ./backend/pb_hooks/. $SERVER:~/red-social/.stage-hooks/
  ssh $SERVER 'cd ~/red-social && cp -a .stage-hooks/. pb_hooks/ && rm -rf .stage-hooks'
  ```

  El `cp -a` es local y toma milisegundos, así que el vigilante ve un solo cambio y
  reinicia una vez con todos los archivos ya en su lugar. Copiar (y no mover el
  directorio) también preserva lo que exista solo en el servidor.

  **Si un agente de IA está haciendo el deploy, este `ssh ... cp -a ... && rm -rf ...`
  final lo bloquea el clasificador de permisos de Claude Code** — cualquier comando ssh
  que sobrescriba o borre archivos ya existentes en el servidor de producción, sin
  importar el verbo (probado con `cp -a` solo, sin el `rm -rf`, y bloqueó igual) ni si el
  usuario ya lo autorizó explícitamente en el chat. Confirmado dos veces (2026-08-27 y
  2026-08-28). **La respuesta correcta es no pelear con eso**: no reintentar con otro
  quoting, no envolverlo en un script para esconder el verbo, no armar una automatización
  nueva (cron, systemd) para que el propio servidor lo haga solo — eso decidió
  explícitamente el usuario que no quería (2026-08-28). El agente deja los archivos listos
  en `.stage-hooks/` (eso sí lo permite el clasificador, es un directorio nuevo) y le pasa
  al usuario el comando exacto de arriba en un bloque `bash` para que lo corra él. Después
  el agente sigue solo con la verificación (health check, logs, confirmar que la migración
  se aplicó).

## Respaldo consistente de la base

El `tar` del paso 3 copia `data.db` mientras PocketBase la está usando, así que puede
quedar en un estado intermedio. Antes de cualquier deploy que borre o reescriba datos,
saca además un respaldo consistente con la API de backup de SQLite, que sí es segura en
caliente:

```bash
ssh $SERVER 'python3 -c "
import sqlite3, time
ts = time.strftime(\"%Y%m%d-%H%M%S\")
src = sqlite3.connect(\"file:/home/salas/red-social/pb_data/data.db?mode=ro\", uri=True)
dst = sqlite3.connect(f\"/home/salas/red-social/backups/data-consistente-{ts}.db\")
with dst: src.backup(dst)
"'
```

## Si algo sale mal (rollback)

El backup se genera automáticamente en cada deploy (paso 3 de arriba), en el servidor:
```bash
ssh usuario@tu-servidor
cd ~/red-social/backups
ls -lt                                  # ver el más reciente
sudo systemctl stop pocketbase
tar -xzf pb_data-<timestamp>.tar.gz -C ..   # restaura pb_data/
tar -xzf pb_public-<timestamp>.tar.gz -C .. # restaura pb_public/
sudo systemctl start pocketbase
```

---

## Instrucciones para un agente de IA que despliegue

Si eres un agente de IA (Claude Code u otro) y te piden desplegar Beauchapp, o consideras que un cambio amerita un deploy: **desplegar a producción es una acción de alto impacto, parcialmente irreversible, y con efecto visible para usuarios reales.** No es equivalente a correr tests o hacer un commit local.

1. **Nunca ejecutes `./deploy.sh` sin que el usuario lo haya pedido explícitamente *en ese momento* de la conversación.** Una autorización pasada ("dale, puedes desplegar cuando quieras") no cuenta como confirmación para una ejecución futura no relacionada — vuelve a confirmar cada vez, salvo que el usuario haya sido explícito en que no hace falta. Antes de esa confirmación, muéstrale el resultado del checklist (tsc, tests, `git status`, si hay migraciones y qué tocan) para que la autorización sea informada, no un "dale nomás" a ciegas.
2. **Corre el checklist completo de la sección de arriba antes de proponer el deploy.** Si algo falla (tsc, tests, `--dev` presente, `git status` sucio), repórtalo y detente — no despliegues igual "para ver si funciona".
3. **Nunca hardcodees ni adivines `DEPLOY_SERVER`.** Debe venir de una variable de entorno que el usuario ya tiene configurada o te pasa explícitamente en el momento. Si no está seteada, `deploy.sh` falla solo con un mensaje claro — no lo reemplaces por un valor que "parece correcto" de otro archivo.
4. **Nunca uses `--force`, saltes el paso de backup, ni edites `deploy.sh` para quitar la confirmación de Cloudflare Tunnel** sin que el usuario lo pida explícitamente.
5. **Después del deploy, reporta transparentemente al usuario, siempre:**
   - Dominio/URL activa (`APP_URL` configurado).
   - Estado del almacenamiento de archivos: ¿R2 está configurado y activo, o las subidas van a fallar?
   - Estado de las integraciones por variable de entorno (`RESEND_API_KEY` para correos, credenciales de R2).
   - Si hubo algo inesperado (una migración nueva que se aplicó, un warning en el arranque, etc.).

   Esta transparencia no es opcional — un deploy "silencioso" que omite el estado real de la infraestructura es peor que no reportar nada, porque da falsa confianza.
6. **Si el deploy falla a mitad de camino:** no reintentes automáticamente en un loop, no uses `git reset --hard` ni ninguna operación destructiva para "empezar de nuevo". Muestra el error real al usuario y espera indicación. El backup del paso 3 existe exactamente para este escenario — úsalo solo si el usuario confirma que quiere hacer rollback.
7. **No inventes pasos nuevos de infraestructura** (crear un túnel de Cloudflare, cambiar DNS, modificar el servicio systemd a mano) sin que el usuario lo pida — `deploy.sh` ya cubre el camino estándar.
8. **Cuando el paso final de subir `pb_hooks/` (`cp -a ... && rm -rf ...` por ssh, ver arriba) lo bloquee el clasificador de permisos**, no lo tomes como una falla a resolver por tu cuenta: no reintentes con otro quoting, no lo envuelvas en un script para esconder el verbo, no propongas dejar un cron/systemd corriendo solo para evitarlo — el usuario ya decidió explícitamente que no quiere esa clase de automatización nueva (2026-08-28). Deja los archivos en `.stage-hooks/`, verifica los checksums contra lo local, y pásale al usuario el comando exacto en un bloque `bash` para que lo corra él. Después seguís vos con la verificación.

En resumen: el checklist y `deploy.sh` existen para que el despliegue sea aburrido y predecible, y la verificación de cada paso (checksums, health check, logs, estado de la infraestructura) no es opcional ni algo para apurar — es lo que hace que "confía en el agente para desplegar" siga siendo razonable. Si en algún punto la situación no encaja con lo que este documento describe, es una señal para parar y preguntar, no para improvisar.
