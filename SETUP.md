# Beauchapp — Guía de Setup

## Requisitos Previos

| Herramienta | Versión mínima | Verificar con |
|---|---|---|
| Node.js | 18+ | `node -v` |
| npm | 9+ | `npm -v` |
| Git | cualquiera | `git --version` |

## Credenciales Necesarias

La plataforma solo requiere **una credencial externa**:

| Credencial | Para qué se usa | Dónde obtenerla |
|---|---|---|
| `RESEND_API_KEY` | Envío de correos (verificación, recuperación de contraseña) | [resend.com/api-keys](https://resend.com/api-keys) |

> [!NOTE]
> La app funciona sin esta key, pero los correos de verificación y recuperación de contraseña no se enviarán.

---

## Setup Local (Desarrollo)

### 1. Clonar el repositorio

```bash
git clone <url-del-repo> beauchapp
cd beauchapp
```

### 2. Backend (PocketBase)

```bash
cd backend
```

**a) Descargar PocketBase**

Descargar el binario correspondiente a tu sistema desde [pocketbase.io/docs](https://pocketbase.io/docs/) y dejarlo en la carpeta `backend/`.

```bash
# Linux (ejemplo)
wget https://github.com/pocketbase/pocketbase/releases/download/v0.25.9/pocketbase_0.25.9_linux_amd64.zip
unzip pocketbase_0.25.9_linux_amd64.zip
rm pocketbase_0.25.9_linux_amd64.zip
```

**b) Configurar credenciales**

```bash
cp .env.example .env
```

Edita `.env` y pega tu token de Resend:

```
RESEND_API_KEY=re_tuTokenAqui
```

**c) Levantar el servidor**

```bash
./start.sh
```

> [!IMPORTANT]
> Usa `./start.sh` en vez de `./pocketbase serve`. El script carga las variables de entorno del `.env` y PocketBase las usa para configurar SMTP automáticamente al arrancar.

> [!WARNING]
> Si en el futuro configuras el SMTP de Resend de forma manual desde el Panel de Administración o mediante la API REST, asegúrate de **habilitar explícitamente el uso de TLS** (`tls: true` o marcando la casilla correspondiente) al usar el puerto `465`. Si se omite este paso, los correos no se enviarán y no habrá reportes de error visibles en Resend.

**d) Crear cuenta de administrador**

Abre `http://127.0.0.1:8090/_/` en tu navegador y crea tu cuenta de administrador (correo + contraseña). Esta cuenta es solo para gestionar la base de datos, no es un usuario de la app.

> [!TIP]
> Las migraciones de la base de datos (`pb_migrations/`) se aplican automáticamente al primer arranque. No necesitas crear tablas manualmente.

### 3. Frontend (Expo / React Native)

En otra terminal:

```bash
cd frontend
npm install
```

**a) (Opcional) Configurar URL del backend**

Si necesitas apuntar a una IP específica (ej. para probar desde el celular), crea un `.env`:

```bash
cp .env.example .env
# Edita y pon tu IP local, ej:
# EXPO_PUBLIC_API_URL=http://192.168.0.100:8090
```

> [!NOTE]
> Si no creas el `.env`, el frontend detecta automáticamente la IP del backend en desarrollo. Solo es necesario si la detección automática no funciona.

**b) Levantar la app**

```bash
# Web
npm run web

# Celular (con Expo Go instalado)
npm start
```

La app estará en `http://localhost:8081` (web) o escanea el QR con Expo Go (celular).

### 4. Verificar que todo funciona

1. Abre `http://localhost:8081`
2. Regístrate con un correo `@ing.uchile.cl`
3. Si configuraste Resend, revisa tu correo para el link de verificación
4. Publica un post y comprueba que aparece en el feed

---

## Setup en Servidor (Producción)

### Arquitectura

```
[Usuarios] → [Tu Dominio] → [PocketBase]
                                ├── API REST (:8090)
                                ├── Frontend (archivos estáticos)
                                └── Base de datos (SQLite)
```

PocketBase puede servir tanto la API como el frontend estático desde el mismo proceso.

### 1. Preparar el servidor

Necesitas un servidor Linux con acceso SSH (ej. VPS en DigitalOcean, Hetzner, AWS Lightsail, etc).

```bash
# Clonar el repo en el servidor
git clone <url-del-repo> beauchapp
cd beauchapp
```

### 2. Backend

```bash
cd backend

# Descargar PocketBase (Linux 64-bit)
wget https://github.com/pocketbase/pocketbase/releases/download/v0.25.9/pocketbase_0.25.9_linux_amd64.zip
unzip pocketbase_0.25.9_linux_amd64.zip
rm pocketbase_0.25.9_linux_amd64.zip

# Configurar credenciales
cp .env.example .env
nano .env  # Pegar RESEND_API_KEY
```

### 3. Compilar el frontend

```bash
cd ../frontend
npm install

# Definir la URL pública del backend
export EXPO_PUBLIC_API_URL=https://tu-dominio.com

# Compilar los archivos estáticos
npx expo export --platform web
```

Esto genera la carpeta `frontend/dist/` con los archivos estáticos.

### 4. Servir el frontend desde PocketBase

Copia los archivos compilados a la carpeta que PocketBase sirve automáticamente:

```bash
mkdir -p ../backend/pb_public
cp -r dist/* ../backend/pb_public/
```

> [!IMPORTANT]
> PocketBase sirve automáticamente todo lo que esté en `pb_public/` como archivos estáticos en la raíz del dominio.

### 5. Levantar PocketBase como servicio

Crea un servicio de systemd para que PocketBase arranque automáticamente:

```bash
sudo nano /etc/systemd/system/beauchapp.service
```

```ini
[Unit]
Description=Beauchapp (PocketBase)
After=network.target

[Service]
Type=simple
User=tu_usuario
WorkingDirectory=/ruta/a/beauchapp/backend
ExecStart=/ruta/a/beauchapp/backend/start.sh --http=0.0.0.0:8090
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable beauchapp
sudo systemctl start beauchapp
```

> [!WARNING]
> En producción, quita el flag `--dev` de `start.sh` para desactivar el modo desarrollo.

### 6. Configurar dominio y HTTPS

Usa **Caddy** como reverse proxy (configura HTTPS automáticamente):

```bash
sudo dnf install caddy  # o apt install caddy
sudo nano /etc/caddy/Caddyfile
```

```
tu-dominio.com {
    reverse_proxy localhost:8090
}
```

```bash
sudo systemctl enable caddy
sudo systemctl start caddy
```

Caddy obtiene y renueva el certificado SSL automáticamente.

### 7. Crear cuenta de administrador

Abre `https://tu-dominio.com/_/` y crea la cuenta de admin.

---

## Estructura de Archivos Relevantes

```
beauchapp/
├── backend/
│   ├── .env.example          # Template de credenciales
│   ├── .env                  # ← TU ARCHIVO (no se sube al repo)
│   ├── start.sh              # Script de arranque (carga .env)
│   ├── pocketbase            # Binario (no se sube al repo)
│   ├── pb_data/              # Base de datos (no se sube al repo)
│   ├── pb_hooks/
│   │   ├── __bootstrap.pb.js # Config SMTP automática desde env vars
│   │   └── main.pb.js        # Lógica de negocio
│   ├── pb_migrations/        # Estructura de tablas (sí se sube)
│   └── pb_public/            # Frontend compilado (solo en producción)
│
└── frontend/
    ├── .env.example           # Template de config
    ├── .env                   # ← TU ARCHIVO (no se sube al repo)
    ├── src/                   # Código fuente
    └── package.json
```

---

## Resumen Rápido

| Acción | Comando |
|---|---|
| Levantar backend (dev) | `cd backend && ./start.sh` |
| Levantar frontend (dev) | `cd frontend && npm run web` |
| Compilar frontend (prod) | `cd frontend && npx expo export --platform web` |
| Admin panel | `http://127.0.0.1:8090/_/` |
