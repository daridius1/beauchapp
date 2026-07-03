#!/bin/bash
set -e

SERVER="salas@192.168.0.26"
PROJECT_DIR="~/red-social"
LOCAL_BUILD_DIR="./frontend/dist"

echo "========================================="
echo "🚀 Iniciando Despliegue en Homeserver"
echo "========================================="

# 1. Verificar si el frontend ya está compilado
if [ ! -d "$LOCAL_BUILD_DIR" ]; then
  echo "Compilando frontend..."
  cd frontend
  npx expo export -p web
  cd ..
fi

echo "1. Creando estructura en el servidor y descargando PocketBase..."
ssh -t $SERVER "sudo apt update && sudo apt install wget unzip git tmux mc curl -y && mkdir -p ~/red-social/pb_public && cd ~/red-social && if [ ! -f pocketbase ]; then echo 'Obteniendo última versión de PocketBase...' && VERSION=\$(curl -s https://api.github.com/repos/pocketbase/pocketbase/releases/latest | grep '\"tag_name\":' | sed -E 's/.*\"v([^\"]+)\".*/\1/') && echo \"Descargando versión \$VERSION...\" && wget \"https://github.com/pocketbase/pocketbase/releases/latest/download/pocketbase_\${VERSION}_linux_amd64.zip\" -O pb.zip && unzip -o pb.zip && chmod +x pocketbase && rm pb.zip; fi"

echo "2. Subiendo backend y base de datos inicial..."
scp -r ./backend/pb_migrations ./backend/pb_hooks ./backend/seed.js ./backend/start.sh ./backend/.env.example $SERVER:~/red-social/

echo "3. Subiendo el frontend estático..."
scp -r $LOCAL_BUILD_DIR/* $SERVER:~/red-social/pb_public/

echo "4. Configurando persistencia con Systemd..."
ssh -t $SERVER "echo '[Unit]
Description=PocketBase Red Social
After=network.target

[Service]
Type=simple
User=salas
WorkingDirectory=/home/salas/red-social
ExecStart=/bin/bash /home/salas/red-social/start.sh --http=\"127.0.0.1:8090\"
Restart=on-failure

[Install]
WantedBy=multi-user.target' | sudo tee /etc/systemd/system/pocketbase.service > /dev/null && sudo systemctl daemon-reload && sudo systemctl enable pocketbase && sudo systemctl restart pocketbase"

echo "========================================="
echo "✅ Despliegue interno completado."
echo "La app está corriendo en el servidor local en: http://192.168.0.26:8090"
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
