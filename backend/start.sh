#!/bin/bash
# Script de arranque de Beauchapp Backend
# Carga las credenciales desde .env y levanta PocketBase con SMTP configurado.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Cargar .env si existe
if [ -f "$SCRIPT_DIR/.env" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/.env" | grep -v '^\s*$' | xargs)
fi

# Verificar que existe la API key
if [ -z "$RESEND_API_KEY" ]; then
    echo "⚠️  RESEND_API_KEY no definida. Los correos no se enviarán."
    echo "   Copia .env.example a .env y llena tu token de Resend."
    echo ""
fi

# Arrancar PocketBase con las variables de SMTP inyectadas como env vars del proceso
exec "$SCRIPT_DIR/pocketbase" serve --dev \
    "$@"
