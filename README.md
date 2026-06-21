# Beauchapp 🏆

Plataforma comunitaria universitaria para gestionar ránkings de ELO, ligas y registros de partidos para los juegos de los patios de la Universidad de Chile (taca-taca, ajedrez, etc.).

## Estructura del Proyecto

El proyecto está organizado en un monorepositorio con la siguiente estructura:

*   **`backend/`**: Servidor PocketBase escrito en Go + SQLite. Contiene las reglas del negocio y base de datos.
*   **`frontend/`**: Aplicación móvil/web desarrollada con Expo + React Native en TypeScript.

## Requisitos Previos

*   [Node.js](https://nodejs.org/) (v18 o superior recomendado)
*   [PocketBase](https://pocketbase.io/) (para el backend local)
*   [Git](https://git-scm.com/)

## Desarrollo Local

### 1. Servidor Backend (PocketBase)

Dirígete a la carpeta `backend/` y levanta el servidor PocketBase:

```bash
cd backend
./pocketbase serve
```

La consola de administración local estará disponible en: [http://127.0.5.1:8090/_/](http://127.0.5.1:8090/_/)

### 2. Cliente Frontend (Expo)

Dirígete a la carpeta `frontend/` e instala las dependencias:

```bash
cd frontend
npm install
```

Luego inicia el servidor de desarrollo para web/móvil:

```bash
npm run web
# o bien
npx expo start --web
```
