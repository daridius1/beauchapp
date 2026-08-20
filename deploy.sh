#!/bin/bash
set -e

# Configurable vía variables de entorno (o un deploy.env local, no versionado, con `source deploy.env`).
# Ejemplo: DEPLOY_SERVER=usuario@host DEPLOY_REMOTE_DIR=red-social ./deploy.sh
SERVER="${DEPLOY_SERVER:?Debes definir DEPLOY_SERVER, ej: usuario@host. Ver README/SETUP.md.}"
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-red-social}"
REMOTE_USER="${SERVER%@*}"
LOCAL_BUILD_DIR="./frontend/dist"

echo "========================================="
echo "🚀 Iniciando Despliegue en Homeserver"
echo "========================================="

# Las EXPO_PUBLIC_* se incrustan en el bundle EN EL MOMENTO DE COMPILAR, así que tienen
# que estar en el entorno de esta máquina — el .env del servidor no participa del build.
# Si falta EXPO_PUBLIC_R2_URL el sitio igual funciona, pero cada imagen a tamaño completo
# pasa a servirse a través de PocketBase en vez de directo desde R2 (ver PRINCIPLES.md §2),
# y eso es invisible mirando la página: las miniaturas van por el servidor de todas formas.
if [ -f ./frontend/.env ]; then
  set -a; . ./frontend/.env; set +a
fi

if [ -z "${EXPO_PUBLIC_R2_URL:-}" ]; then
  echo "⚠️  EXPO_PUBLIC_R2_URL no está definida: las imágenes se servirán por el proxy de"
  echo "   PocketBase, no directo desde R2. Defínela en frontend/.env (ver .env.example)"
  echo "   o exportala antes de correr este script."
  read -p "   ¿Compilar igual? [s/N] " -n 1 -r; echo
  [[ $REPLY =~ ^[SsYy]$ ]] || exit 1
fi

# 1. Verificar si el frontend ya está compilado
if [ ! -d "$LOCAL_BUILD_DIR" ]; then
  echo "Compilando frontend..."
  cd frontend
  # --clear es necesario: sin él Metro reutiliza el bundle cacheado y un cambio en las
  # EXPO_PUBLIC_* no se refleja (el bundle sale con el MISMO hash que antes).
  npx expo export -p web --clear
  cd ..
fi

echo "1. Creando estructura en el servidor y descargando PocketBase..."
ssh -t $SERVER "sudo apt update && sudo apt install wget unzip git tmux mc curl -y && mkdir -p ~/$REMOTE_DIR/pb_public && cd ~/$REMOTE_DIR && if [ ! -f pocketbase ]; then echo 'Obteniendo última versión de PocketBase...' && VERSION=\$(curl -s https://api.github.com/repos/pocketbase/pocketbase/releases/latest | grep '\"tag_name\":' | sed -E 's/.*\"v([^\"]+)\".*/\1/') && echo \"Descargando versión \$VERSION...\" && wget \"https://github.com/pocketbase/pocketbase/releases/latest/download/pocketbase_\${VERSION}_linux_amd64.zip\" -O pb.zip && unzip -o pb.zip && chmod +x pocketbase && rm pb.zip; fi"

echo "2. Respaldando pb_data y pb_public actuales en el servidor (si existen)..."
ssh -t $SERVER "cd ~/$REMOTE_DIR && TS=\$(date +%Y%m%d-%H%M%S) && mkdir -p backups && [ -d pb_data ] && tar -czf \"backups/pb_data-\$TS.tar.gz\" pb_data || echo 'pb_data no existe aún, se omite backup.' && [ -d pb_public ] && tar -czf \"backups/pb_public-\$TS.tar.gz\" pb_public || echo 'pb_public no existe aún, se omite backup.' && ls -1t backups | tail -n +11 | xargs -r -I{} rm -f \"backups/{}\""

echo "3. Subiendo backend y base de datos inicial..."
scp -r ./backend/pb_migrations ./backend/pb_hooks ./backend/seed.js ./backend/start.sh ./backend/.env.example $SERVER:~/$REMOTE_DIR/

echo "4. Subiendo el frontend estático..."
scp -r $LOCAL_BUILD_DIR/* $SERVER:~/$REMOTE_DIR/pb_public/

echo "5. Configurando persistencia con Systemd..."
ssh -t $SERVER "echo '[Unit]
Description=PocketBase Red Social
After=network.target

[Service]
Type=simple
User=$REMOTE_USER
WorkingDirectory=/home/$REMOTE_USER/$REMOTE_DIR
ExecStart=/bin/bash /home/$REMOTE_USER/$REMOTE_DIR/start.sh --http=\"127.0.0.1:8090\"
Restart=on-failure

[Install]
WantedBy=multi-user.target' | sudo tee /etc/systemd/system/pocketbase.service > /dev/null && sudo systemctl daemon-reload && sudo systemctl enable pocketbase && sudo systemctl restart pocketbase"

echo "========================================="
echo "✅ Despliegue interno completado."
echo "La app está corriendo en el servidor local en: http://${SERVER#*@}:8090"
echo "========================================="
echo ""
echo "☁️  Fase Cloudflare Zero Trust (Túnel):"
echo "Para exponer tu app al mundo sin abrir puertos:"
echo "1. Entra a tu dashboard de Cloudflare -> Zero Trust -> Networks -> Tunnels."
echo "2. Crea un túnel."
echo "3. Copia el comando de instalación para Debian (suele empezar con 'sudo cloudflared...')."
echo ""
read -p "¿Tienes el comando de instalación de cloudflared a mano y deseas ejecutarlo ahora en el servidor? (s/n): " instalar_cf
if [ "$instalar_cf" = "s" ]; then
  read -p "Pega el comando completo proporcionado por Cloudflare: " cf_cmd
  ssh -t $SERVER "$cf_cmd"
  echo "¡Cloudflared instalado!"
fi

echo ""
echo "4. En Cloudflare, configura la ruta (ej: polla.tudominio.com) apuntando al servicio 'http://127.0.0.1:8090'."
echo "¡Todo listo para jugar! 🏆"
