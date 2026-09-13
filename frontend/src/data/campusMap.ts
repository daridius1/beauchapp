// Datos esquemáticos del campus para el mapa 3D (CampusMapScreen). La mayoría de los
// edificios son una huella rectangular simple; los que tienen una forma más distintiva
// en el plano (brazos, patios) usan `footprint` con un polígono aproximado — no es un
// trazado exacto, pero conserva las separaciones y la forma general en vez de aplanar
// todo a un rectángulo.
// Unidades arbitrarias (no metros reales). Origen (0,0) aprox. en la esquina de
// Ingeniería Matemática/Cs. de la Computación; +x hacia Tupper (este), +z hacia
// Beauchef/el acceso principal (sur).
//
// No existe piso 0: los positivos son sobre el nivel de calle, los negativos son
// subterráneos. floorY() traduce un número de piso a su rango vertical.

export const FLOOR_HEIGHT = 3;

export interface CampusBuilding {
  id: string;
  name: string;
  color: string;
  // Huella rectangular: [xMin, xMax], [zMin, zMax]. Para edificios con forma irregular
  // (ver `footprint`) esto queda como el bounding box — sigue sirviendo para calcular el
  // centro (legend, cámara) aunque el mesh real se dibuje con el polígono.
  x: [number, number];
  z: [number, number];
  // Huella real cuando el edificio no es un rectángulo simple: lista de puntos [x, z]
  // que forman el contorno (en el mismo sistema de unidades que x/z). Aproximación
  // poligonal del plano de la facultad — no es un trazado exacto, pero conserva los
  // "brazos"/patios que sí tiene el edificio real en vez de aplanarlo a un rectángulo.
  footprint?: [number, number][];
  floors: number[];
}

export const CAMPUS_BUILDINGS: CampusBuilding[] = [
  { id: 'geologia', name: 'Geología', color: '#a8632f', x: [4, 20], z: [2, 14], floors: [1, 2, 3] },
  // Forma de arco: dos "patas" bajando desde el cuerpo principal, como en el plano.
  // Nace pegado a Geología y queda por delante (al sur) del brazo de IDIEM, no al lado.
  {
    id: 'quimica_biotecnologia', name: 'Química y Biotecnología', color: '#f0821e',
    x: [20, 27], z: [2, 9],
    footprint: [[20, 2], [27, 2], [27, 9], [25, 9], [25, 6.5], [22, 6.5], [22, 9], [20, 9]],
    floors: [1, 2],
  },
  // Cuerpo principal al este + brazo que se extiende al oeste (ahí está Laboratorio de
  // Sólidos), pasando por detrás/debajo de Química y Biotecnología hacia Geología, sin
  // tocar ninguna de las dos.
  {
    id: 'idiem', name: 'IDIEM', color: '#c2185b',
    x: [24, 46], z: [2, 14],
    footprint: [[33, 2], [46, 2], [46, 14], [24, 14], [24, 10], [33, 10]],
    floors: [1, 2, 3],
  },
  // Simple cubo — los detalles finos de su silueta real (Laboratorio de Fluidos como
  // brazo propio) se ignoran a propósito.
  { id: 'civil_geofisica', name: 'Ingeniería Civil / Geofísica', color: '#00695c', x: [9, 21], z: [17, 27], floors: [-1, 1, 2] },
  // Cuerpo principal + brazo hacia arriba en la mitad este (Laboratorio de Mecatrónica y
  // Robótica), como en el plano.
  {
    id: 'electrica', name: 'Ingeniería Eléctrica', color: '#8e99c7',
    x: [26, 39], z: [15, 27],
    footprint: [[30, 15], [39, 15], [39, 27], [26, 27], [26, 19], [30, 19]],
    floors: [-1, 1, 2],
  },
  { id: 'torre_central', name: 'Torre Central', color: '#0d1b42', x: [19, 26], z: [28, 35], floors: [1, 2, 3, 4, 5, 6, 7] },
  { id: 'fisica', name: 'Física', color: '#c3d21e', x: [6, 18], z: [33, 44], floors: [-1, 1, 2] },
  { id: 'mineria', name: 'Ingeniería de Minas', color: '#2e9e4f', x: [27, 39], z: [33, 44], floors: [1, 2] },
  // Al otro lado de Blanco Encalada (la calle está en x:[-4.5,-0.5]), no del mismo lado
  // que el resto del campus. El Casino queda pegado a la calle; el Gimnasio está detrás
  // de él (más lejos de la calle) y es un poco más grande que el Casino.
  { id: 'casino', name: 'Casino', color: '#9fc3cc', x: [-9, -5], z: [38, 52], floors: [1, 2, 3] },
  { id: 'gimnasio_domeyko', name: 'Gimnasio Domeyko', color: '#7fb0bb', x: [-16, -9], z: [36, 53], floors: [1] },
  { id: 'cafeteria', name: 'Cafetería', color: '#f2a08f', x: [17, 24], z: [45, 48], floors: [-1] },
  { id: 'biblioteca', name: 'Biblioteca', color: '#f28066', x: [6, 15], z: [48, 58], floors: [1, 2, 3] },
  { id: 'edificio_escuela', name: 'Edificio Escuela', color: '#e5342b', x: [15, 29], z: [48, 58], floors: [1, 2, 3] },
  { id: 'hall_sur', name: 'Hall Sur', color: '#f28066', x: [29, 38], z: [48, 58], floors: [1, 2, 3] },
  { id: 'dim_dcc', name: 'Ingeniería Matemática y Cs. de la Computación (DIM/DCC)', color: '#7cb342', x: [0, 7], z: [62, 90], floors: [-3, -2, -1, 1, 2, 3, 4, 5, 6, 7] },
  { id: 'industrial', name: 'Ingeniería Industrial', color: '#8bc34a', x: [8, 30], z: [62, 70], floors: [-3, -2, -1, 1, 2, 3, 4, 5, 6, 7] },
  { id: 'auditorio_detigny', name: "Auditorio d'Etigny", color: '#aed581', x: [30, 38], z: [70, 76], floors: [1] },
  // Mismo largo (norte-sur) que Ingeniería Industrial (8 unidades) — antes era casi el
  // doble de grueso; se achicó manteniendo fijo el borde sur (90), lo que agranda el
  // patio interior entre este edificio e Industrial (antes 6 unidades de patio, ahora 12).
  { id: 'mecanica_quimica', name: 'Ingeniería Mecánica / Ingeniería Química, Biotecnología y Materiales', color: '#8bc34a', x: [8, 38], z: [82, 90], floors: [-3, -2, -1, 1, 2, 3, 4, 5, 6, 7] },
];

// La cancha se dibuja como una losa plana sin volumen (sin pisos), solo de referencia
// visual. Va en la misma columna que Torre Central (justo al sur), con espacio libre a
// ambos lados respecto de Física y Minas — antes se solapaba con Física.
export const CANCHA = { x: [19, 26] as [number, number], z: [36, 42] as [number, number], color: '#6b6b6b' };

export interface CampusStreet {
  id: string;
  name: string;
  color: string;
  x: [number, number];
  z: [number, number];
}

// Calles reales que bordean el campus (del plano de la facultad): Blanco Encalada al
// oeste y Tupper al este corren de norte a sur en todo el largo del campus; Beauchef
// corre de este a oeste en la franja que separa el bloque de arriba (Edificio Escuela)
// del de abajo (Industrial/DIM-DCC/Mecánica-Química) — ahí están los accesos
// "Beauchef 850/851" del plano. Como la cancha, son losas planas sin volumen.
//
// Blanco Encalada va pegada a Ingeniería Matemática/DCC (x:[0,7], el borde oeste real
// del campus en el bloque de abajo) — en la vida real casi no hay espacio entre ambos.
export const CAMPUS_STREETS: CampusStreet[] = [
  { id: 'blanco_encalada', name: 'Blanco Encalada', color: '#2b2b2b', x: [-4.5, -0.5], z: [0, 92] },
  { id: 'tupper', name: 'Tupper', color: '#2b2b2b', x: [48.5, 52.5], z: [0, 92] },
  { id: 'beauchef', name: 'Beauchef', color: '#2b2b2b', x: [-5, 49], z: [58.5, 61.5] },
];

export interface CampusRoom {
  id: string;
  name: string;
  buildingId: string;
  floor: number;
}

// Datos de ejemplo para probar la búsqueda — no son un catálogo real de salas todavía.
// Cuando exista una fuente real (backend o planilla), esto se reemplaza sin tocar la
// pantalla: CampusMapScreen solo consume CampusRoom[].
export const CAMPUS_ROOMS: CampusRoom[] = [
  { id: 'lab_solidos', name: 'Laboratorio de Sólidos', buildingId: 'idiem', floor: 1 },
  { id: 'lab_fluidos', name: 'Laboratorio de Fluidos', buildingId: 'civil_geofisica', floor: -1 },
  { id: 'lab_mecatronica', name: 'Laboratorio de Mecatrónica y Robótica', buildingId: 'electrica', floor: -1 },
  { id: 'decanato', name: 'Decanato', buildingId: 'torre_central', floor: 7 },
  { id: 'sec_ing_mecanica', name: 'Ingeniería Mecánica (Secretaría)', buildingId: 'torre_central', floor: 3 },
  { id: 'sala_galileo', name: 'Sala Galileo', buildingId: 'fisica', floor: 1 },
  { id: 'lab_intro_ingenieria', name: 'Laboratorio de Introducción a la Ingeniería', buildingId: 'fisica', floor: -1 },
  { id: 'lab_metodos_exp', name: 'Laboratorio de Métodos Experimentales', buildingId: 'fisica', floor: -1 },
  { id: 'ciencia_materiales', name: 'Ciencia de los Materiales', buildingId: 'mineria', floor: 2 },
  { id: 'gimnasio_pesas', name: 'Gimnasio de Pesas', buildingId: 'gimnasio_domeyko', floor: 1 },
  { id: 'sala_estudio_biblioteca', name: 'Sala de Estudio Biblioteca', buildingId: 'biblioteca', floor: 2 },
  { id: 'auditorio_gorbea', name: 'Auditorio Gorbea', buildingId: 'edificio_escuela', floor: 1 },
  { id: 'hall_sur_control', name: 'Control de Acceso Hall Sur', buildingId: 'hall_sur', floor: 1 },
  { id: 'auditorio_detigny_sala', name: "Auditorio d'Etigny", buildingId: 'auditorio_detigny', floor: 1 },
  { id: 'sala_dcc', name: 'Sala de Computación DCC', buildingId: 'dim_dcc', floor: 3 },
];

export function floorY(floor: number): [number, number] {
  if (floor > 0) return [(floor - 1) * FLOOR_HEIGHT, floor * FLOOR_HEIGHT];
  return [floor * FLOOR_HEIGHT, (floor + 1) * FLOOR_HEIGHT];
}
