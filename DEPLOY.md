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

## Deploy manual (paso a paso)

```bash
# Desde la raíz del repo, en tu máquina local
export DEPLOY_SERVER=usuario@tu-servidor        # obligatorio
export DEPLOY_REMOTE_DIR=red-social             # opcional, default "red-social"

./deploy.sh
```

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

1. **Nunca ejecutes `./deploy.sh` sin que el usuario lo haya pedido explícitamente *en ese momento* de la conversación.** Una autorización pasada ("dale, puedes desplegar cuando quieras") no cuenta como confirmación para una ejecución futura no relacionada — vuelve a confirmar cada vez, salvo que el usuario haya sido explícito en que no hace falta.
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

En resumen: el checklist y `deploy.sh` existen para que el despliegue sea aburrido y predecible. Si en algún punto la situación no encaja con lo que este documento describe, es una señal para parar y preguntar, no para improvisar.
