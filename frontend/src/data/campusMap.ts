// Datos esquemáticos del campus para el mapa 3D (CampusMapScreen). La mayoría de los
// edificios son una huella rectangular simple; los que tienen una forma más distintiva
// en el plano (brazos, patios) usan `footprint` con un polígono aproximado — no es un
// trazado exacto, pero conserva las separaciones y la forma general en vez de aplanar
// todo a un rectángulo.
// Unidades arbitrarias (no metros reales). Origen (0,0) aprox. en la esquina de
// Torre Norte. En la orientación mostrada, el norte
// queda hacia -x y el este hacia -z; las coordenadas no representan metros reales.
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
  // Desplazamiento vertical excepcional. La cafetería cruza la cota de calle: no es un
  // subterráneo completo aunque su volumen quede parcialmente bajo tierra.
  verticalOffset?: number;
  // Algunos volúmenes son losas o pabellones y no representan la altura estándar de un
  // piso completo. Cuando está definido, la altura reemplaza FLOOR_HEIGHT en ese nivel.
  floorHeight?: number;
  // Cero cuando dos edificios comparten una pared y deben verse unidos, no separados por
  // el pasillo visual que se aplica al resto de la maqueta.
  footprintInset?: number;
  floors: number[];
}

export const CAMPUS_BUILDINGS: CampusBuilding[] = [
  { id: 'geologia', name: 'Geología', color: '#a8632f', x: [4, 20], z: [2, 14], floors: [1, 2, 3] },
  // Forma de arco: dos "patas" bajando desde el cuerpo principal, como en el plano.
  // Nace pegado a Geología y queda por delante (al sur) del brazo de IDIEM, no al lado.
  {
    id: 'quimica_biotecnologia', name: 'Centro de Energía', color: '#f0821e',
    x: [20, 27], z: [2, 9],
    footprint: [[20, 2], [27, 2], [27, 9], [20, 9]],
    floors: [1, 2],
  },
  // Cuerpo principal al este + brazo que se extiende al oeste (ahí está Laboratorio de
  // Sólidos), pasando por detrás/debajo del Centro de Energía hacia Geología, sin
  // tocar ninguna de las dos.
  {
    id: 'idiem', name: 'IDIEM', color: '#c2185b',
    x: [20, 46.4], z: [2, 14],
    footprint: [[33, 2], [46.4, 2], [46.4, 14], [20, 14], [20, 9], [24, 9], [24, 10], [33, 10]],
    floors: [1, 2, 3],
  },
  // Simple cubo — los detalles finos de su silueta real (Laboratorio de Fluidos como
  // brazo propio) se ignoran a propósito.
  { id: 'civil_geofisica', name: 'Ingeniería Civil / Geofísica', color: '#00695c', x: [7, 19], z: [17, 27], floors: [-1, 1, 2] },
  // Cuerpo principal + brazo hacia arriba en la mitad este (Laboratorio de Mecatrónica y
  // Robótica), como en el plano.
  {
    id: 'electrica', name: 'Ingeniería Eléctrica', color: '#8e99c7',
    x: [28, 41], z: [17, 27],
    footprint: [[32, 17], [41, 17], [41, 27], [28, 27], [28, 19], [32, 19]],
    floors: [-1, 1, 2],
  },
  // La zona de 850 se abre un poco respecto del esquema anterior: los edificios ocupan
  // más terreno y se leen mejor las circulaciones entre Torre Central, la cancha y los
  // pabellones del acceso sur.
  { id: 'torre_central', name: 'Torre Central', color: '#4b5fc0', x: [18, 26], z: [28, 35], floors: [1, 2, 3, 4, 5, 6, 7] },
  // Ebria forma el remate de Torre Central. Se ensancha en el eje este-oeste (z), no
  // hacia norte-sur (x), y conserva un vacío peatonal antes de la cancha.
  { id: 'ebria', name: 'Ebria', color: '#9b7a56', x: [18, 26], z: [35, 40], floors: [1] },
  { id: 'fisica', name: 'Física', color: '#c3d21e', x: [4, 15], z: [33, 45], floors: [-1, 1, 2] },
  { id: 'mineria', name: 'Ingeniería de Minas', color: '#2e9e4f', x: [30, 43], z: [33, 45], floors: [-1, 1, 2] },
  // Al otro lado de Blanco Encalada (la calle está en x:[-6.5,-1]), no del mismo lado
  // que el resto del campus. Se conserva un margen caminable antes del Casino; el
  // Gimnasio queda detrás de él (más lejos de la calle) y es un poco más grande.
  // Casino y Gimnasio comparten la esquina de Almirante Latorre, retirados de la vereda.
  { id: 'casino', name: 'Casino', color: '#9fc3cc', x: [-14, -10], z: [50, 64], floors: [1, 2, 3] },
  { id: 'gimnasio_domeyko', name: 'Gimnasio Domeyko', color: '#7fb0bb', x: [-22, -14.5], z: [48, 64], floors: [1] },
  // Cafetería, Biblioteca, Escuela y Hall Sur comparten muros, como el bloque continuo
  // de 850. Sobria es una losa delgada que ocupa la cubierta de la cafetería.
  { id: 'cafeteria', name: 'Cafetería', color: '#f2a08f', x: [20.5, 27.5], z: [51, 54], verticalOffset: -1.5, footprintInset: 0, floors: [1] },
  { id: 'sobria', name: 'Sobria', color: '#c9b09e', x: [20.5, 27.5], z: [51, 54], verticalOffset: -1.35, floorHeight: 0.7, footprintInset: 0, floors: [2] },
  // El bloque se retira de Beauchef para dejar una explanada antes de la vereda.
  { id: 'biblioteca', name: 'Biblioteca', color: '#f28066', x: [4, 16.5], z: [54, 62], footprintInset: 0, floors: [-1, 1, 2, 3] },
  { id: 'edificio_escuela', name: 'Edificio Escuela', color: '#e5342b', x: [16.5, 31.5], z: [54, 62], footprintInset: 0, floors: [-1, 1, 2, 3] },
  { id: 'hall_sur', name: 'Hall Sur', color: '#f28066', x: [31.5, 43], z: [54, 62], footprintInset: 0, floors: [-1, 1, 2, 3] },
  // Bajo las tres torres de 851 hay un edificio único desde -1 hasta -6: ninguno de
  // esos niveles deja vacío el rectángulo interior entre las torres.
  { id: 'subterraneos_851', name: 'Subterráneos Beauchef 851', color: '#597044', x: [1.6, 41.6], z: [74.6, 107.4], verticalOffset: -0.4, floors: [-6, -5, -4, -3, -2, -1] },
  // Las tres torres de 851 usan el mismo grosor de 7,4 unidades y mantienen el borde
  // que toca su vereda respectiva; el espacio interior liberado pasa al patio.
  { id: 'dim_dcc', name: 'Torre Norte', color: '#7cb342', x: [1.6, 9], z: [74.6, 107.4], floors: [1, 2, 3, 4, 5, 6, 7] },
  { id: 'industrial', name: 'Torre Oriente', color: '#8bc34a', x: [9, 33.6], z: [74.6, 82], floors: [1, 2, 3, 4, 5, 6, 7] },
  // Suspendido a la altura del segundo piso, desplazado hacia el poniente y un poco
  // hacia el sur dentro del patio central de 851.
  { id: 'auditorio_detigny', name: "Auditorio d'Etigny", color: '#aed581', x: [32.8, 43.2], z: [86.1, 94.5], floors: [2] },
  // Torre Poniente conserva el frente en la vereda de Club Hípico, pero se
  // adelgaza hacia el patio para abrir más superficie peatonal en 851.
  { id: 'mecanica_quimica', name: 'Torre Poniente', color: '#8bc34a', x: [9, 46.4], z: [100, 107.4], footprintInset: 0, floors: [1, 2, 3, 4, 5, 6, 7] },
  { id: 'negocios', name: 'Negocios', color: '#6b7f9d', x: [33.6, 46.4], z: [74.6, 82], footprintInset: 0, floors: [1] },
  // Casa CEI (Tupper 2140), al otro lado de Tupper respecto del Auditorio d'Etigny.
  { id: 'casa_cei', name: 'Casa CEI', color: '#a75d47', x: [59, 66], z: [83, 91], floors: [1, 2] },
];

// La cancha se dibuja como una losa plana sin volumen (sin pisos), solo de referencia
// visual. Va al sur de Torre Central, separada de ella por el Pabellón de la Cancha y
// con espacio libre a ambos lados respecto de Física y Minas.
export const CANCHA = { x: [18.5, 26.5] as [number, number], z: [41.5, 47.5] as [number, number], color: '#6b6b6b' };

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
// del de abajo (Torres Oriente, Norte y Poniente) — ahí están los accesos
// "Beauchef 850/851" del plano. Como la cancha, son losas planas sin volumen.
//
// Se ensancharon las tres calzadas y se dejó una franja caminable antes de los edificios;
// así las vías no se confunden con sus fachadas al inclinar el modelo.
export const CAMPUS_STREETS: CampusStreet[] = [
  // Blanco sigue tras los cruces de Beauchef y Club Hípico, como referencia del borde
  // poniente de 851.
  { id: 'blanco_encalada', name: 'Blanco Encalada', color: '#2b2b2b', x: [-6.5, -1], z: [0, 123] },
  // Termina justo al salir del cruce con Club Hípico; no aparece una continuación al sur.
  { id: 'tupper', name: 'Tupper', color: '#2b2b2b', x: [49, 54.5], z: [0, 115] },
  // Beauchef continúa un tramo al otro lado de Tupper; al cruzar Blanco toma el nombre
  // Almirante Latorre. La pequeña superposición con Blanco es el cuerpo propio del
  // cruce, no un tramo duplicado de cualquiera de las dos calles.
  { id: 'beauchef', name: 'Beauchef', color: '#2b2b2b', x: [-6.5, 62], z: [67, 72] },
  { id: 'almirante_latorre', name: 'Almirante Latorre', color: '#2b2b2b', x: [-22, -6.5], z: [67, 72] },
  // Club Hípico cierra 851 por el lado de Mecánica y se ve más allá de Blanco y Tupper.
  { id: 'club_hipico', name: 'Club Hípico', color: '#2b2b2b', x: [-16, 62], z: [110, 115] },
];

export interface CampusGroundFeature {
  id: string;
  name: string;
  color: string;
  x: [number, number];
  z: [number, number];
}

// En la orientación real de esta maqueta, el oriente queda arriba de 850 (no a la
// derecha): Plaza Ercilla continúa el espacio abierto junto a Geología e IDIEM.
export const CAMPUS_GROUND_FEATURES: CampusGroundFeature[] = [
  { id: 'plaza_ercilla', name: 'Plaza Ercilla', color: '#31543b', x: [2, 46], z: [-18, -2] },
];

// Las superficies abiertas se mantienen como cuerpos separados para que el mapa pueda
// distinguir qué zona se tocó, aunque visualmente formen parte del mismo patio o calle.
export interface CampusInteractiveArea {
  id: string;
  name: string;
  color: string;
  x: [number, number];
  z: [number, number];
  // Un área puede ser un polígono con recortes. Se usa para las circulaciones que
  // completan un patio sin pasar por debajo de las huellas de los edificios.
  footprint?: [number, number][];
  holes?: [number, number][][];
  // Código breve visible en el mapa para referirse a un parcial sin escribir su
  // descripción completa.
  shortId?: string;
  // Una zona fusionada puede conservar varios rectángulos físicos, pero se comporta
  // como un único cuerpo al dibujarla y seleccionarla.
  parts?: { x: [number, number]; z: [number, number] }[];
}

function rectangleFootprint(x: [number, number], z: [number, number]): [number, number][] {
  return [[x[0], z[0]], [x[1], z[0]], [x[1], z[1]], [x[0], z[1]]];
}

const CAMPUS_850_BUILDING_IDS = new Set([
  'geologia', 'quimica_biotecnologia', 'idiem', 'civil_geofisica', 'electrica',
  'torre_central', 'ebria', 'fisica', 'mineria', 'cafeteria', 'biblioteca',
  'edificio_escuela', 'hall_sur',
]);
function subtractRectangle(
  area: Pick<CampusInteractiveArea, 'x' | 'z'>, obstacle: Pick<CampusInteractiveArea, 'x' | 'z'>
): Pick<CampusInteractiveArea, 'x' | 'z'>[] {
  const x0 = Math.max(area.x[0], obstacle.x[0]);
  const x1 = Math.min(area.x[1], obstacle.x[1]);
  const z0 = Math.max(area.z[0], obstacle.z[0]);
  const z1 = Math.min(area.z[1], obstacle.z[1]);
  if (x0 >= x1 || z0 >= z1) return [area];

  const pieces: Pick<CampusInteractiveArea, 'x' | 'z'>[] = [];
  if (area.z[0] < z0) pieces.push({ x: area.x, z: [area.z[0], z0] });
  if (z1 < area.z[1]) pieces.push({ x: area.x, z: [z1, area.z[1]] });
  if (area.x[0] < x0) pieces.push({ x: [area.x[0], x0], z: [z0, z1] });
  if (x1 < area.x[1]) pieces.push({ x: [x1, area.x[1]], z: [z0, z1] });
  return pieces;
}

// Los parciales ya tienen IDs y fusiones definidos por la maqueta. Al mover un borde
// de edificio se conserva este recorte de referencia para no reindexar el resto.
const STABLE_850_SEGMENT_OBSTACLES: Record<string, Pick<CampusInteractiveArea, 'x' | 'z'>> = {
  idiem: { x: [24, 46], z: [2, 14] },
  electrica: { x: [28, 41], z: [15, 27] },
};

const CAMPUS_850_OBSTACLES = [
  ...CAMPUS_BUILDINGS
    .filter((building) => CAMPUS_850_BUILDING_IDS.has(building.id))
    .map((building) => STABLE_850_SEGMENT_OBSTACLES[building.id] || { x: building.x, z: building.z }),
  { x: CANCHA.x, z: CANCHA.z },
  // Estos patios se dibujan sobre la circulación general. Se restan desde el origen
  // para que ningún tramo de fondo aparezca en dos lados de un patio específico.
  { x: [7, 19] as [number, number], z: [14, 17] as [number, number] },
  { x: [19, 28] as [number, number], z: [17, 27] as [number, number] },
  { x: [32, 41] as [number, number], z: [14, 15] as [number, number] },
  { x: [30, 41] as [number, number], z: [27, 33] as [number, number] },
  { x: [15, 18] as [number, number], z: [33, 35] as [number, number] },
  { x: [26, 30] as [number, number], z: [33, 35] as [number, number] },
  { x: [18.5, 26] as [number, number], z: [40, 41.5] as [number, number] },
  { x: [15, 18.5] as [number, number], z: [41.5, 45] as [number, number] },
  { x: [26.5, 30] as [number, number], z: [41.5, 45] as [number, number] },
  { x: [4, 15] as [number, number], z: [45, 54] as [number, number] },
  { x: [18.5, 26.5] as [number, number], z: [47.5, 51] as [number, number] },
  { x: [31.5, 43] as [number, number], z: [45, 54] as [number, number] },
  { x: [4, 16.5] as [number, number], z: [62, 64.4] as [number, number] },
  { x: [16.5, 31.5] as [number, number], z: [62, 64.4] as [number, number] },
  { x: [31.5, 43] as [number, number], z: [62, 64.4] as [number, number] },
];

function circulationSegments(
  id: string, x: [number, number], z: [number, number]
): CampusInteractiveArea[] {
  const emptyPieces = CAMPUS_850_OBSTACLES.reduce(
    (pieces, obstacle) => pieces.flatMap((piece) => subtractRectangle(piece, obstacle)),
    [{ x, z }] as Pick<CampusInteractiveArea, 'x' | 'z'>[]
  );
  return emptyPieces.map((piece, index) => {
    return {
      id: `${id}_tramo_${index + 1}`,
      name: 'Zona exterior',
      color: '#162129',
      x: piece.x,
      z: piece.z,
    };
  });
}

function assignPatioIds(zones: CampusInteractiveArea[]): CampusInteractiveArea[] {
  let partialNumber = 0;
  let patioNumber = 0;
  return zones.map((zone) => {
    if (zone.id.startsWith('patio_850_circulacion_')) {
      const shortId = String(++partialNumber);
      return { ...zone, shortId };
    }
    if (zone.id.startsWith('patio_850_')) {
      return { ...zone, shortId: `P${++patioNumber}` };
    }
    return zone;
  });
}

function splitPartialAlongLongestSide(zones: CampusInteractiveArea[], shortId: string): CampusInteractiveArea[] {
  return zones.flatMap((zone) => {
    if (zone.shortId !== shortId || zone.parts || zone.footprint) return [zone];
    const width = zone.x[1] - zone.x[0];
    const depth = zone.z[1] - zone.z[0];
    const splitX = width >= depth;
    const midpoint = splitX ? (zone.x[0] + zone.x[1]) / 2 : (zone.z[0] + zone.z[1]) / 2;
    return splitX
      ? [
        { ...zone, id: `${zone.id}_1`, shortId: `${shortId}.1`, x: [zone.x[0], midpoint] as [number, number] },
        { ...zone, id: `${zone.id}_2`, shortId: `${shortId}.2`, x: [midpoint, zone.x[1]] as [number, number] },
      ]
      : [
        { ...zone, id: `${zone.id}_1`, shortId: `${shortId}.1`, z: [zone.z[0], midpoint] as [number, number] },
        { ...zone, id: `${zone.id}_2`, shortId: `${shortId}.2`, z: [midpoint, zone.z[1]] as [number, number] },
      ];
  });
}

const FUSED_850_ZONE_GROUPS = [
  ['43', '41'],
  ['37', '33', '16', 'P10', '38', '34', '17'],
  ['44', '42'],
  ['39', '35', '18', 'P12', '19', '36', '40'],
  ['25', 'P5', '21', 'P8'],
  ['P9', '22', '26', 'P6'],
  ['29', '24', '20'],
  ['23', '27', '32'],
  ['30', 'P4', '31'],
  ['15', '13', '11', '8'],
  ['P2', 'P18', '10'],
  ['9', '6', '12'],
  ['28', '14.1'],
  ['F11', '7', '14.2'],
  ['4', '5'],
];

function fuse850Zones(zones: CampusInteractiveArea[]): CampusInteractiveArea[] {
  let available = [...zones];
  FUSED_850_ZONE_GROUPS.forEach((group, groupIndex) => {
    const members = group
      .map((shortId) => available.find((zone) => zone.shortId === shortId))
      .filter((zone): zone is CampusInteractiveArea => !!zone);
    if (members.length !== group.length) return;

    const parts = members.flatMap((zone) => zone.parts || [{ x: zone.x, z: zone.z }]);
    const shortId = `F${groupIndex + 1}`;
    const fusedZone: CampusInteractiveArea = {
      id: `patio_850_fusion_${groupIndex + 1}`,
      name: 'Zona de patio',
      shortId,
      color: members[0].color,
      x: [Math.min(...parts.map((part) => part.x[0])), Math.max(...parts.map((part) => part.x[1]))] as [number, number],
      z: [Math.min(...parts.map((part) => part.z[0])), Math.max(...parts.map((part) => part.z[1]))] as [number, number],
      parts,
    };
    available = [...available.filter((zone) => !members.includes(zone)), fusedZone];
  });
  return available;
}

const CONSUMED_850_ZONE_IDS = new Set(['3', 'F15', 'P16']);

function removeConsumed850Zones(zones: CampusInteractiveArea[]): CampusInteractiveArea[] {
  return zones.filter((zone) => !zone.shortId || !CONSUMED_850_ZONE_IDS.has(zone.shortId));
}

// Los códigos numéricos sirvieron para acordar las fusiones, pero no son una forma útil
// de orientarse en la maqueta. Una vez cerradas esas fusiones, cada superficie recibe un
// nombre espacial estable; los códigos ya no salen ni al seleccionar ni como rótulo.
const CAMPUS_850_ZONE_NAMES: Record<string, string> = {
  patio_850_circulacion_plaza_tramo_1: 'Borde de Plaza Ercilla',
  patio_850_circulacion_plaza_tramo_2: 'Acceso a Geología',
  patio_850_fusion_1: 'Corredor Beauchef poniente',
  patio_850_fusion_2: 'Explanada de Física',
  patio_850_fusion_3: 'Corredor Beauchef oriente',
  patio_850_fusion_4: 'Explanada de Minas',
  patio_850_fusion_5: 'Patio de Física',
  patio_850_fusion_6: 'Patio de Minas',
  patio_850_fusion_7: 'Circulación poniente de Física',
  patio_850_fusion_8: 'Circulación oriente de Minas',
  patio_850_fusion_9: 'Patio entre Eléctrica y Minas',
  patio_850_fusion_10: 'Corredor oriente de Civil',
  patio_850_fusion_11: 'Patio entre Civil y Eléctrica',
  patio_850_fusion_12: 'Corredor poniente de Civil',
  patio_850_fusion_13: 'Explanada norte de Física',
  patio_850_fusion_14: 'Circulación central de 850',
  patio_850_geologia_civil: 'Patio entre Geología y Civil',
  patio_850_idiem_electrica: 'Patio entre IDIEM y Eléctrica',
  patio_850_ebria_cancha: 'Patio entre Ebria y Cancha',
  patio_850_cancha_cafeteria: 'Patio entre Cancha y Cafetería',
  patio_850_biblioteca_beauchef: 'Explanada de Biblioteca',
  patio_850_escuela_beauchef: 'Explanada de Edificio Escuela',
  patio_850_hall_beauchef: 'Explanada de Hall Sur',
  patio_850_idiem_interior: 'Patio interior de IDIEM',
};

function name850Zones(zones: CampusInteractiveArea[]): CampusInteractiveArea[] {
  return zones.map((zone) => ({
    ...zone,
    name: CAMPUS_850_ZONE_NAMES[zone.id] || zone.name,
    shortId: undefined,
  }));
}

export const CAMPUS_PATIO_ZONES: CampusInteractiveArea[] = name850Zones(removeConsumed850Zones(fuse850Zones(splitPartialAlongLongestSide(assignPatioIds([
  // Las circulaciones exteriores cubren los vacíos de 850 por sectores que siguen los
  // edificios del plano, sin volver a convertir el patio en una única losa genérica.
  ...circulationSegments('patio_850_circulacion_plaza', [1.6, 46.4], [-2, 14]),
  ...circulationSegments('patio_850_circulacion_civil', [1.6, 46.4], [14, 27]),
  ...circulationSegments('patio_850_circulacion_torre', [1.6, 46.4], [27, 47.5]),
  ...circulationSegments('patio_850_circulacion_cafeteria', [1.6, 46.4], [47.5, 54]),
  ...circulationSegments('patio_850_circulacion_escuela', [1.6, 46.4], [54, 62]),
  ...circulationSegments('patio_850_circulacion_beauchef', [1.6, 46.4], [62, 64.4]),
  // Son vacíos reales entre dos volúmenes o entre un volumen y el borde de circulación;
  // no se dibuja una losa debajo de los edificios ni entre cuerpos que comparten muro.
  { id: 'patio_850_geologia_civil', name: 'Patio 850 · entre Geología y Civil', color: '#1b2730', x: [7, 19], z: [14, 17] },
  { id: 'patio_850_civil_electrica', name: 'Patio 850 · entre Civil y Eléctrica', color: '#202d36', x: [19, 28], z: [17, 27] },
  { id: 'patio_850_idiem_electrica', name: 'Patio 850 · entre IDIEM y Eléctrica', color: '#1b2730', x: [32, 41], z: [14, 17] },
  { id: 'patio_850_electrica_minas', name: 'Patio 850 · entre Eléctrica y Minas', color: '#202d36', x: [30, 41], z: [27, 33] },
  { id: 'patio_850_fisica_torre', name: 'Patio 850 · entre Física y Torre Central', color: '#1b2730', x: [15, 18], z: [33, 35] },
  { id: 'patio_850_torre_minas', name: 'Patio 850 · entre Torre Central y Minas', color: '#202d36', x: [26, 30], z: [33, 35] },
  { id: 'patio_850_ebria_cancha', name: 'Patio 850 · entre Ebria y Cancha', color: '#1b2730', x: [18.5, 26], z: [40, 41.5] },
  { id: 'patio_850_fisica_cancha', name: 'Patio 850 · entre Física y Cancha', color: '#202d36', x: [15, 18.5], z: [41.5, 45] },
  { id: 'patio_850_cancha_minas', name: 'Patio 850 · entre Cancha y Minas', color: '#1b2730', x: [26.5, 30], z: [41.5, 45] },
  { id: 'patio_850_fisica_biblioteca', name: 'Patio 850 · entre Física y Biblioteca', color: '#202d36', x: [4, 15], z: [45, 54] },
  { id: 'patio_850_cancha_cafeteria', name: 'Patio 850 · entre Cancha y Cafetería', color: '#1b2730', x: [18.5, 26.5], z: [47.5, 51] },
  { id: 'patio_850_minas_hall', name: 'Patio 850 · entre Minas y Hall Sur', color: '#202d36', x: [31.5, 43], z: [45, 54] },
  { id: 'patio_850_biblioteca_beauchef', name: 'Patio 850 · entre Biblioteca y Beauchef', color: '#1b2730', x: [4, 16.5], z: [62, 64.4] },
  { id: 'patio_850_escuela_beauchef', name: 'Patio 850 · entre Escuela y Beauchef', color: '#202d36', x: [16.5, 31.5], z: [62, 64.4] },
  { id: 'patio_850_hall_beauchef', name: 'Patio 850 · entre Hall Sur y Beauchef', color: '#1b2730', x: [31.5, 43], z: [62, 64.4] },
  // Vacíos internos de las huellas poligonales: son patios reales, no parte de un
  // edificio, y completan toda la superficie seleccionable de 850.
  { id: 'patio_850_quimica_interior', name: 'Patio 850 · interior de Química', color: '#202d36', x: [22, 25], z: [6.5, 9] },
  { id: 'patio_850_idiem_interior', name: 'Patio 850 · interior de IDIEM', color: '#1b2730', x: [24, 33], z: [2, 10] },
  { id: 'patio_850_electrica_interior', name: 'Patio 850 · interior de Eléctrica', color: '#202d36', x: [28, 32], z: [15, 19] },
  // El patio interior de 851 se reduce a dos sectores: el vacío general y la zona que
  // queda bajo el auditorio suspendido, conocida como la Araña.
  {
    id: 'patio_851', name: 'Patio 851', color: '#1b2730', x: [9, 34], z: [74.6, 107.4],
    // Industrial y Mecánica llegan hasta DIM; el patio conserva solo el vacío central
    // y las franjas que no están cubiertas por una torre.
    footprint: rectangleFootprint([9, 34], [74.6, 100]),
    holes: [
      rectangleFootprint([9, 34], [74.6, 82]),
    ],
  },
  // Además de la proyección del auditorio, toma la franja contigua hasta el borde del
  // patio: se lee como una sola área y no queda aislada dentro de Patio 851.
  { id: 'patio_851_debajo_arana', name: 'Debajo de la Araña', color: '#202d36', x: [34, 46.4], z: [82, 100] },
]), '14'))));

const MAX_SEGMENT_LENGTH = 12;

function segmentArea(area: CampusInteractiveArea): CampusInteractiveArea[] {
  const horizontal = area.x[1] - area.x[0] >= area.z[1] - area.z[0];
  const length = horizontal ? area.x[1] - area.x[0] : area.z[1] - area.z[0];
  const count = Math.max(1, Math.ceil(length / MAX_SEGMENT_LENGTH));
  return Array.from({ length: count }, (_, index) => {
    const start = index / count;
    const end = (index + 1) / count;
    return horizontal
      ? { ...area, x: [area.x[0] + length * start, area.x[0] + length * end] as [number, number] }
      : { ...area, z: [area.z[0] + length * start, area.z[0] + length * end] as [number, number] };
  });
}

function streetArea(street: CampusStreet): CampusInteractiveArea {
  return { id: street.id, name: street.name, color: street.color, x: street.x, z: street.z };
}

const SIDEWALK_WIDTH = 2.6;

function sidewalksFor(street: CampusStreet): CampusInteractiveArea[] {
  const horizontal = street.x[1] - street.x[0] >= street.z[1] - street.z[0];
  if (horizontal) {
    return [
      { id: `${street.id}_vereda_1`, name: `Vereda de ${street.name} · lado 1`, color: '#73777c', x: street.x, z: [street.z[0] - SIDEWALK_WIDTH, street.z[0]] },
      { id: `${street.id}_vereda_2`, name: `Vereda de ${street.name} · lado 2`, color: '#73777c', x: street.x, z: [street.z[1], street.z[1] + SIDEWALK_WIDTH] },
    ];
  }
  return [
    { id: `${street.id}_vereda_1`, name: `Vereda de ${street.name} · lado 1`, color: '#73777c', x: [street.x[0] - SIDEWALK_WIDTH, street.x[0]], z: street.z },
    { id: `${street.id}_vereda_2`, name: `Vereda de ${street.name} · lado 2`, color: '#73777c', x: [street.x[1], street.x[1] + SIDEWALK_WIDTH], z: street.z },
  ];
}

function intersectionCorners(first: CampusStreet, second: CampusStreet): CampusInteractiveArea[] {
  const firstHorizontal = first.x[1] - first.x[0] >= first.z[1] - first.z[0];
  const horizontal = firstHorizontal ? first : second;
  const vertical = firstHorizontal ? second : first;
  const intersects = horizontal.x[0] <= vertical.x[1] && horizontal.x[1] >= vertical.x[0]
    && vertical.z[0] <= horizontal.z[1] && vertical.z[1] >= horizontal.z[0];
  if (firstHorizontal === (second.x[1] - second.x[0] >= second.z[1] - second.z[0]) || !intersects) return [];

  const xRanges: [number, number][] = [
    [vertical.x[0] - SIDEWALK_WIDTH, vertical.x[0]],
    [vertical.x[1], vertical.x[1] + SIDEWALK_WIDTH],
  ];
  const zRanges: [number, number][] = [
    [horizontal.z[0] - SIDEWALK_WIDTH, horizontal.z[0]],
    [horizontal.z[1], horizontal.z[1] + SIDEWALK_WIDTH],
  ];
  return xRanges.flatMap((x, xIndex) => zRanges.map((z, zIndex) => ({
    id: `cruce_${first.id}_${second.id}_${xIndex}_${zIndex}`,
    name: `Intersección de veredas · ${first.name} y ${second.name}`,
    color: '#878b90',
    x,
    z,
  })));
}

function streetIntersectionArea(first: CampusStreet, second: CampusStreet): CampusInteractiveArea[] {
  const firstHorizontal = first.x[1] - first.x[0] >= first.z[1] - first.z[0];
  const secondHorizontal = second.x[1] - second.x[0] >= second.z[1] - second.z[0];
  if (firstHorizontal === secondHorizontal) return [];

  const x0 = Math.max(first.x[0], second.x[0]);
  const x1 = Math.min(first.x[1], second.x[1]);
  const z0 = Math.max(first.z[0], second.z[0]);
  const z1 = Math.min(first.z[1], second.z[1]);
  if (x0 >= x1 || z0 >= z1) return [];
  return [{
    id: `cruce_calle_${first.id}_${second.id}`,
    name: `Intersección · ${first.name} y ${second.name}`,
    color: '#3d3d3d',
    x: [x0, x1],
    z: [z0, z1],
  }];
}

function subtractArea(area: CampusInteractiveArea, cut: CampusInteractiveArea): CampusInteractiveArea[] {
  const x0 = Math.max(area.x[0], cut.x[0]);
  const x1 = Math.min(area.x[1], cut.x[1]);
  const z0 = Math.max(area.z[0], cut.z[0]);
  const z1 = Math.min(area.z[1], cut.z[1]);
  if (x0 >= x1 || z0 >= z1) return [area];

  const pieces: CampusInteractiveArea[] = [];
  if (area.z[0] < z0) pieces.push({ ...area, z: [area.z[0], z0] });
  if (z1 < area.z[1]) pieces.push({ ...area, z: [z1, area.z[1]] });
  if (area.x[0] < x0) pieces.push({ ...area, x: [area.x[0], x0], z: [z0, z1] });
  if (x1 < area.x[1]) pieces.push({ ...area, x: [x1, area.x[1]], z: [z0, z1] });
  return pieces;
}

// Almirante Latorre es la continuación nominal de Beauchef al otro lado de Blanco; se
// trata como una sola intersección para no duplicar las cuatro esquinas de esa vereda.
const STREETS_WITH_SIDEWALK_INTERSECTIONS = CAMPUS_STREETS.filter((street) => street.id !== 'almirante_latorre');

export const CAMPUS_SIDEWALK_INTERSECTION_ZONES = STREETS_WITH_SIDEWALK_INTERSECTIONS.flatMap((street, index) =>
  STREETS_WITH_SIDEWALK_INTERSECTIONS.slice(index + 1).flatMap((other) => intersectionCorners(street, other))
);

export const CAMPUS_STREET_INTERSECTION_ZONES = STREETS_WITH_SIDEWALK_INTERSECTIONS.flatMap((street, index) =>
  STREETS_WITH_SIDEWALK_INTERSECTIONS.slice(index + 1).flatMap((other) => streetIntersectionArea(street, other))
);

export const CAMPUS_STREET_ZONES = CAMPUS_STREETS
  .map(streetArea)
  .flatMap((area) => CAMPUS_STREET_INTERSECTION_ZONES.reduce((pieces, cut) => pieces.flatMap((piece) => subtractArea(piece, cut)), [area]))
  .flatMap(segmentArea)
  .map((segment, index) => ({ ...segment, id: `${segment.id}_tramo_${index + 1}`, name: `${segment.name} · tramo ${index + 1}` }));
export const CAMPUS_SIDEWALK_ZONES = CAMPUS_STREETS
  .flatMap(sidewalksFor)
  .flatMap((area) => CAMPUS_SIDEWALK_INTERSECTION_ZONES.reduce((pieces, cut) => pieces.flatMap((piece) => subtractArea(piece, cut)), [area]))
  .flatMap(segmentArea)
  .map((segment, index) => ({ ...segment, id: `${segment.id}_tramo_${index + 1}`, name: `${segment.name} · tramo ${index + 1}` }));

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
  { id: 'auditorio_detigny_sala', name: "Auditorio d'Etigny", buildingId: 'auditorio_detigny', floor: 2 },
  { id: 'sala_dcc', name: 'Sala de Computación DCC', buildingId: 'dim_dcc', floor: 3 },
];

export function floorY(floor: number): [number, number] {
  if (floor > 0) return [(floor - 1) * FLOOR_HEIGHT, floor * FLOOR_HEIGHT];
  return [floor * FLOOR_HEIGHT, (floor + 1) * FLOOR_HEIGHT];
}
