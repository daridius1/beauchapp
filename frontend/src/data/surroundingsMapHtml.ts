// El mapa de alrededores es una página estática propia (MapLibre GL + un extracto PMTiles
// de solo el sector de Beauchef, generado offline con `pmtiles extract` — ver
// frontend/public/mapa-alrededores/). Se sirve como archivo real, no como HTML inyectado:
// se probó srcDoc/baseUrl:'about:blank' (como el resto de los WebView de la app) y el mapa
// nunca cargaba, sin error — MapLibre carga su script desde un CDN y parsea tiles en Web
// Workers, y eso no arranca dentro de HTML inline sin importar el sandbox del iframe/WebView.
// Con `src`/`source.uri` apuntando al archivo real, carga sin problema.
export const FCFM_CENTER: [number, number] = [-33.4577, -70.6623];
export const SURROUNDINGS_RADIUS_M = 1500;

// Ruta relativa a la raíz servida por PocketBase/Metro (frontend/public/ se copia tal cual
// a pb_public/ en cada deploy — ver DEPLOY.md). En web resuelve contra el origen actual de
// la página (sirve tanto en `expo start --web` como en producción); en nativo hace falta un
// origen absoluto, ver `mapUrlForPlatform` en CampusMapScreen.tsx.
export const SURROUNDINGS_MAP_PATH = '/mapa-alrededores/index.html';
