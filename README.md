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

La consola de administración local estará disponible en: [http://127.0.0.1:8090/_/](http://127.0.0.1:8090/_/)

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

## Documentación

| Documento | Contenido |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | **Empieza por acá.** Orientación completa del proyecto: arquitectura, dónde está cada cosa, y las trampas que cuestan horas (VMs de Goja, variables de compilación, reinicios automáticos) |
| [`SETUP.md`](./SETUP.md) | Guía de setup detallada (local y producción), variables de entorno |
| [`PRINCIPLES.md`](./PRINCIPLES.md) | Principios de ingeniería: por qué el código es como es (recursos, R2, datos sensibles, PWA) |
| [`DESIGN.md`](./DESIGN.md) | Guía de diseño visual y UX |
| [`SECURITY_AND_MAINTENANCE.md`](./SECURITY_AND_MAINTENANCE.md) | Reglas de seguridad, caveats técnicos, incidentes pasados |
| [`DEPLOY.md`](./DEPLOY.md) | Cómo desplegar a producción — manual y para agentes de IA |
| [`.agents/AGENTS.md`](./.agents/AGENTS.md) | Reglas operativas para agentes de IA trabajando en este repo |
| [`auditoria-2026-08-19.md`](./auditoria-2026-08-19.md) | Auditoría técnica vigente: estado del proyecto, hallazgos y su resolución |
