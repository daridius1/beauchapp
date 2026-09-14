import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, Platform, DeviceEventEmitter } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WebView } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
// Import puntual en vez del barrel de drei: el barrel arrastra useGLTF/three-mesh-bvh,
// que usan import.meta en sus workers y Metro no los transforma (rompe el bundle web).
// Por lo mismo se evita drei/core/Text (troika-three-text también usa workers): los
// nombres no flotan en la escena 3D.
import { OrbitControls } from '@react-three/drei/core/OrbitControls';
import { RootStackParamList } from '../types/navigation';
import { theme } from '../theme/theme';
import {
  CAMPUS_BUILDINGS, CAMPUS_GROUND_FEATURES, CAMPUS_PATIO_ZONES, CAMPUS_ROOMS,
  CAMPUS_SIDEWALK_INTERSECTION_ZONES, CAMPUS_SIDEWALK_ZONES, CAMPUS_STREETS,
  CAMPUS_STREET_INTERSECTION_ZONES, CAMPUS_STREET_ZONES, CANCHA, CampusRoom, floorY,
} from '../data/campusMap';
import { SURROUNDINGS_MAP_PATH } from '../data/surroundingsMapHtml';
import { POCKETBASE_URL } from '../services/pocketbase';
import { PostLocation } from '../types/postLocation';

type Props = NativeStackScreenProps<RootStackParamList, 'CampusMap'>;

// Margen visual entre huellas (incluso entre edificios que están pegados en el plano
// real): un pasillo delgado que separa los volúmenes sin dejar de leerse como contiguos.
const FOOTPRINT_INSET = 0.55;
// Espacio entre pisos apilados, para que se distingan como bloques separados.
const FLOOR_GAP = 0.15;
// Capas separadas y polygon offset evitan el z-fighting: las superficies horizontales
// ya no compiten por el mismo píxel aunque la cámara se incline casi a ras de suelo.
const SURFACE_Y = {
  patioBackground: 0.02,
  patio: 0.04,
  plaza: 0.07,
  sidewalk: 0.1,
  sidewalkIntersection: 0.13,
  street: 0.16,
  streetIntersection: 0.19,
  cancha: 0.22,
};
const FLAT_SURFACE_OFFSET = { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 };

// Las salas y la leyenda se conservan listas para reactivarlas cuando el mapa tenga más
// contenido; por ahora distraen de la exploración directa de la maqueta.
const SHOW_ROOM_SEARCH = false;
const SHOW_MAP_LEGEND = false;

const DIACRITICS_RE = /[\u0300-\u036f]/g;
function normalize(s: string) {
  return s.normalize('NFD').replace(DIACRITICS_RE, '').toLowerCase();
}

type Highlight = { buildingId: string; floor: number };
type MapSelection = { id: string; name: string; category: string };

const CAMPUS_SELECTABLE_AREAS = [
  ...CAMPUS_GROUND_FEATURES, ...CAMPUS_PATIO_ZONES, ...CAMPUS_SIDEWALK_INTERSECTION_ZONES,
  ...CAMPUS_SIDEWALK_ZONES, ...CAMPUS_STREET_INTERSECTION_ZONES, ...CAMPUS_STREET_ZONES,
];

function campusCoordinatesFor(selectionId: string): { x: number; z: number } | null {
  const building = CAMPUS_BUILDINGS.find((item) => selectionId.startsWith(`${item.id}_floor_`));
  if (building) {
    return { x: (building.x[0] + building.x[1]) / 2, z: (building.z[0] + building.z[1]) / 2 };
  }
  if (selectionId === 'cancha_850') {
    return { x: (CANCHA.x[0] + CANCHA.x[1]) / 2, z: (CANCHA.z[0] + CANCHA.z[1]) / 2 };
  }
  const area = CAMPUS_SELECTABLE_AREAS.find((item) => item.id === selectionId);
  return area ? { x: (area.x[0] + area.x[1]) / 2, z: (area.z[0] + area.z[1]) / 2 } : null;
}

function campusMarkerHeight(selectionId: string): number {
  const building = CAMPUS_BUILDINGS.find((item) => selectionId.startsWith(`${item.id}_floor_`));
  if (!building) return 4;
  return Math.max(...building.floors.map((floor) => {
    const [baseY0, baseY1] = floorY(floor);
    const y0 = baseY0 + (building.verticalOffset || 0);
    return building.floorHeight ? y0 + building.floorHeight : baseY1 + (building.verticalOffset || 0);
  })) + 5;
}

// Queda a un costado de Tupper, fuera de los volúmenes del campus, para que no tape la
// lectura de la maqueta. En el plano de referencia el norte apunta hacia el poniente.
const COMPASS_POSITION: [number, number, number] = [62, 0.06, 8];

const CAMPUS_BOUNDS = CAMPUS_BUILDINGS.reduce(
  (acc, b) => ({
    minX: Math.min(acc.minX, b.x[0]),
    maxX: Math.max(acc.maxX, b.x[1]),
    minZ: Math.min(acc.minZ, b.z[0]),
    maxZ: Math.max(acc.maxZ, b.z[1]),
  }),
  { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
);
const CENTER_X = (CAMPUS_BOUNDS.minX + CAMPUS_BOUNDS.maxX) / 2;
const CENTER_Z = (CAMPUS_BOUNDS.minZ + CAMPUS_BOUNDS.maxZ) / 2;

const GROUND_BOUNDS = [
  ...CAMPUS_BUILDINGS, ...CAMPUS_STREETS, ...CAMPUS_GROUND_FEATURES,
  ...CAMPUS_PATIO_ZONES, ...CAMPUS_SIDEWALK_INTERSECTION_ZONES, ...CAMPUS_SIDEWALK_ZONES,
  ...CAMPUS_STREET_INTERSECTION_ZONES,
].reduce(
  (acc, item) => ({
    minX: Math.min(acc.minX, item.x[0]),
    maxX: Math.max(acc.maxX, item.x[1]),
    minZ: Math.min(acc.minZ, item.z[0]),
    maxZ: Math.max(acc.maxZ, item.z[1]),
  }),
  {
    minX: COMPASS_POSITION[0] - 4,
    maxX: COMPASS_POSITION[0] + 4,
    minZ: COMPASS_POSITION[2] - 4,
    maxZ: COMPASS_POSITION[2] + 4,
  }
);
const GROUND_CENTER_X = (GROUND_BOUNDS.minX + GROUND_BOUNDS.maxX) / 2;
const GROUND_CENTER_Z = (GROUND_BOUNDS.minZ + GROUND_BOUNDS.maxZ) / 2;
// Vista inicial desde el sudeste, exactamente al límite de alejamiento definido en
// OrbitControls. Los controles conservan los mismos topes durante la navegación.
const INITIAL_CAMERA_POSITION: [number, number, number] = [CENTER_X + 120, 142, CENTER_Z - 120];

// El Shape vive en el plano XY local; se extruye a lo largo de Z y el mesh se rota
// -90° en X para pararlo (como el terreno/calles/cancha). Esa rotación manda la Y del
// shape a -Z del mundo, así que se le pasa -z para que el mundo quede con el z real.
function buildFootprintShape(points: [number, number][], holes: [number, number][][] = []): THREE.Shape {
  const shape = new THREE.Shape();
  points.forEach(([x, z], i) => {
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  holes.forEach((pointsOfHole) => {
    const hole = new THREE.Path();
    pointsOfHole.forEach(([x, z], i) => {
      if (i === 0) hole.moveTo(x, -z);
      else hole.lineTo(x, -z);
    });
    hole.closePath();
    shape.holes.push(hole);
  });
  return shape;
}

const BUILDING_SHAPES = new Map<string, THREE.Shape>();
CAMPUS_BUILDINGS.forEach((b) => {
  if (b.footprint) BUILDING_SHAPES.set(b.id, buildFootprintShape(b.footprint));
});
const PATIO_SHAPES = new Map<string, THREE.Shape>();
CAMPUS_PATIO_ZONES.forEach((zone) => {
  if (zone.footprint) PATIO_SHAPES.set(zone.id, buildFootprintShape(zone.footprint, zone.holes));
});

type CompassPoint = [number, number];
const COMPASS_NORTH: CompassPoint = [-1, 0];

function compassPointer(direction: CompassPoint, tipDistance: number, baseDistance: number, halfWidth: number) {
  const [directionX, directionZ] = direction;
  const tangent: CompassPoint = [-directionZ, directionX];
  const tip: CompassPoint = [directionX * tipDistance, directionZ * tipDistance];
  const left: CompassPoint = [directionX * baseDistance + tangent[0] * halfWidth, directionZ * baseDistance + tangent[1] * halfWidth];
  const right: CompassPoint = [directionX * baseDistance - tangent[0] * halfWidth, directionZ * baseDistance - tangent[1] * halfWidth];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    tip[0], 0, tip[1], left[0], 0, left[1], right[0], 0, right[1],
  ], 3));
  return geometry;
}

// El plano usa norte hacia -x y oriente hacia -z. La punta larga se construye desde
// esa referencia, sin aplicar una rotación posterior que pueda invertirla.
const COMPASS_NORTH_POINTER = compassPointer(COMPASS_NORTH, 2.65, 0.08, 0.48);
const COMPASS_SOUTH_POINTER = compassPointer([1, 0], 1.72, 0.08, 0.36);
const COMPASS_EAST_POINTER = compassPointer([0, -1], 1.52, 0.08, 0.28);
const COMPASS_WEST_POINTER = compassPointer([0, 1], 1.52, 0.08, 0.28);

// Trazo de tiza en el patio entre la cancha y la cafetería. Los puntos siguen la
// postura de la referencia: cabeza, un brazo extendido y las dos piernas. Se modela
// como un tubo muy bajo para que conserve grosor desde cualquier ángulo.
function crimeSceneOutlinePoint(sourceX: number, sourceY: number) {
  return new THREE.Vector3((sourceY - 150) * 0.014, 0, (sourceX - 180) * 0.006);
}

const BODY_OUTLINE_POINTS = [
  [154, 20], [176, 19], [189, 29], [192, 42], [187, 54],
  [204, 62], [244, 75], [302, 81], [337, 84], [344, 96],
  [328, 105], [282, 102], [239, 98], [208, 95], [193, 106],
  [189, 122], [204, 135], [227, 144], [238, 158], [243, 181],
  [248, 210], [260, 230], [285, 239], [300, 251], [296, 264],
  [280, 272], [252, 270], [223, 261], [204, 248], [194, 220],
  [186, 191], [172, 171], [151, 161], [132, 159], [117, 173],
  [107, 196], [94, 220], [78, 249], [60, 276], [39, 284],
  [22, 278], [18, 262], [26, 241], [44, 211], [61, 182],
  [78, 155], [94, 128], [103, 105], [99, 89], [79, 76],
  [58, 62], [64, 50], [83, 55], [104, 66], [126, 76],
  [139, 61], [143, 45], [142, 30],
].map(([x, y]) => crimeSceneOutlinePoint(x, y));
const BODY_OUTLINE_GEOMETRY = new THREE.TubeGeometry(
  new THREE.CatmullRomCurve3(BODY_OUTLINE_POINTS, true, 'catmullrom', 0.12), 160, 0.05, 6, true
);
const BODY_OUTLINE_POSITION: [number, number, number] = [22.5, SURFACE_Y.patio + 0.09, 49.25];
const CAMERA_TARGET: [number, number, number] = [BODY_OUTLINE_POSITION[0], 2, BODY_OUTLINE_POSITION[2]];

const GroundCompass: React.FC = () => (
  <group position={COMPASS_POSITION}>
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.88, 2, 40]} />
      <meshBasicMaterial color="#bac4ca" />
    </mesh>
    <mesh geometry={COMPASS_NORTH_POINTER}>
      <meshBasicMaterial color="#f2f5f7" side={THREE.DoubleSide} />
    </mesh>
    <mesh geometry={COMPASS_SOUTH_POINTER}>
      <meshBasicMaterial color="#68737d" side={THREE.DoubleSide} />
    </mesh>
    <mesh geometry={COMPASS_EAST_POINTER}>
      <meshBasicMaterial color="#909aa2" side={THREE.DoubleSide} />
    </mesh>
    <mesh geometry={COMPASS_WEST_POINTER}>
      <meshBasicMaterial color="#909aa2" side={THREE.DoubleSide} />
    </mesh>
  </group>
);

const Buildings: React.FC<{
  highlight: Highlight | null;
  selectedId: string | null;
  readOnly: boolean;
  onSelect: (selection: MapSelection) => void;
}> = ({ highlight, selectedId, readOnly, onSelect }) => {
  const choose = (selection: MapSelection) => {
    if (!readOnly) onSelect(selection);
  };

  return (
    <>
    {CAMPUS_BUILDINGS.map((b) => {
      const shape = BUILDING_SHAPES.get(b.id);
      const footprintInset = b.footprintInset ?? FOOTPRINT_INSET;
      const width = b.x[1] - b.x[0] - footprintInset;
      const depth = b.z[1] - b.z[0] - footprintInset;
      const cx = (b.x[0] + b.x[1]) / 2;
      const cz = (b.z[0] + b.z[1]) / 2;

      return (
        <group key={b.id}>
          {b.floors.map((f) => {
            const [baseY0, baseY1] = floorY(f);
            const y0 = baseY0 + (b.verticalOffset || 0);
            const y1 = b.floorHeight ? y0 + b.floorHeight : baseY1 + (b.verticalOffset || 0);
            const isHighlighted = highlight?.buildingId === b.id && highlight.floor === f;
            const floorId = `${b.id}_floor_${f}`;
            const isSelected = selectedId === floorId;
            const dimmed = !!highlight && !isHighlighted;
            // El piso resaltado ignora el depth-test y se dibuja al final (renderOrder
            // alto): así se ve "a rayos X" a través de cualquier edificio que quede
            // delante, en vez de perderse detrás de la cámara actual.
            const material = (
              <meshStandardMaterial
                color={isHighlighted ? '#ffe14d' : isSelected ? '#75c9f5' : b.color}
                emissive={isHighlighted ? '#ffb300' : isSelected ? '#164e63' : '#000000'}
                emissiveIntensity={isHighlighted ? 0.7 : isSelected ? 0.35 : 0}
                transparent={dimmed || isHighlighted}
                opacity={dimmed ? 0.12 : isHighlighted ? 0.85 : 1}
                depthWrite={!dimmed && !isHighlighted}
                depthTest={!isHighlighted}
              />
            );
            const renderOrder = isHighlighted ? 999 : 0;
            // Huella real (polígono, con brazos/patios): se extruye el Shape en vez de
            // usar una caja. Huella rectangular simple: boxGeometry, como antes.
            if (shape) {
              return (
                <mesh
                  key={f}
                  position={[0, y0 + FLOOR_GAP / 2, 0]}
                  rotation={[-Math.PI / 2, 0, 0]}
                  renderOrder={renderOrder}
                  onClick={(event) => { event.stopPropagation(); choose({ id: floorId, name: `${b.name} · piso ${f}`, category: 'Piso' }); }}
                >
                  <extrudeGeometry args={[shape, { depth: y1 - y0 - FLOOR_GAP, bevelEnabled: false }]} />
                  {material}
                </mesh>
              );
            }
            return (
              <mesh
                key={f}
                position={[cx, (y0 + y1) / 2, cz]}
                renderOrder={renderOrder}
                onClick={(event) => { event.stopPropagation(); choose({ id: floorId, name: `${b.name} · piso ${f}`, category: 'Piso' }); }}
              >
                <boxGeometry args={[width, y1 - y0 - FLOOR_GAP, depth]} />
                {material}
              </mesh>
            );
          })}
        </group>
      );
    })}

    {/* Cancha: losa plana sin volumen, solo referencia visual. */}
    <mesh
      position={[(CANCHA.x[0] + CANCHA.x[1]) / 2, SURFACE_Y.cancha, (CANCHA.z[0] + CANCHA.z[1]) / 2]}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={(event) => { event.stopPropagation(); choose({ id: 'cancha_850', name: 'Cancha 850', category: 'Cancha' }); }}
    >
      <planeGeometry args={[CANCHA.x[1] - CANCHA.x[0], CANCHA.z[1] - CANCHA.z[0]]} />
      <meshStandardMaterial color={selectedId === 'cancha_850' ? '#75c9f5' : CANCHA.color} {...FLAT_SURFACE_OFFSET} />
    </mesh>

    {/* Los patios se dividen en sectores para que el toque identifique un área concreta. */}
    {CAMPUS_PATIO_ZONES.map((zone) => {
      const shape = PATIO_SHAPES.get(zone.id);
      const isPartial = zone.id.startsWith('patio_850_circulacion_');
      const isFused = !!zone.parts;
      const y = isPartial && !isFused ? SURFACE_Y.patioBackground : SURFACE_Y.patio;
      const material = <meshStandardMaterial color={selectedId === zone.id ? '#75c9f5' : zone.color} {...FLAT_SURFACE_OFFSET} />;
      const select = (event: { stopPropagation: () => void }) => {
        event.stopPropagation();
        choose({ id: zone.id, name: zone.name, category: isFused ? 'Zona de patio' : isPartial ? 'Zona exterior' : 'Patio' });
      };
      if (zone.parts) {
        return (
          <group key={zone.id}>
            {zone.parts.map((part, index) => (
              <mesh
                key={index}
                position={[(part.x[0] + part.x[1]) / 2, y, (part.z[0] + part.z[1]) / 2]}
                rotation={[-Math.PI / 2, 0, 0]}
                onClick={select}
              >
                <planeGeometry args={[part.x[1] - part.x[0], part.z[1] - part.z[0]]} />
                <meshStandardMaterial color={selectedId === zone.id ? '#75c9f5' : zone.color} {...FLAT_SURFACE_OFFSET} />
              </mesh>
            ))}
          </group>
        );
      }
      return shape ? (
        <mesh key={zone.id} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} onClick={select}>
          <shapeGeometry args={[shape]} />
          {material}
        </mesh>
      ) : (
        <mesh
          key={zone.id}
          position={[(zone.x[0] + zone.x[1]) / 2, y, (zone.z[0] + zone.z[1]) / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={select}
        >
          <planeGeometry args={[zone.x[1] - zone.x[0], zone.z[1] - zone.z[0]]} />
          {material}
        </mesh>
      );
    })}

    <mesh
      geometry={BODY_OUTLINE_GEOMETRY}
      position={BODY_OUTLINE_POSITION}
      onClick={(event) => {
        event.stopPropagation();
        choose({ id: 'patio_850_cancha_cafeteria', name: 'Patio entre Cancha y Cafetería', category: 'Patio' });
      }}
    >
      <meshStandardMaterial color="#f2f2e8" emissive="#b8b8a8" emissiveIntensity={0.35} roughness={1} />
    </mesh>

    {/* Plaza Ercilla: área exterior verde, sin volumen de edificio. */}
    {CAMPUS_GROUND_FEATURES.map((feature) => (
      <mesh
        key={feature.id}
        position={[(feature.x[0] + feature.x[1]) / 2, SURFACE_Y.plaza, (feature.z[0] + feature.z[1]) / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(event) => { event.stopPropagation(); choose({ id: feature.id, name: feature.name, category: 'Plaza' }); }}
      >
        <planeGeometry args={[feature.x[1] - feature.x[0], feature.z[1] - feature.z[0]]} />
        <meshStandardMaterial color={selectedId === feature.id ? '#75c9f5' : feature.color} {...FLAT_SURFACE_OFFSET} />
      </mesh>
    ))}

    {/* Veredas anchas a ambos lados y tramos de calle clickeables por separado. */}
    {CAMPUS_SIDEWALK_ZONES.map((zone) => (
      <mesh
        key={zone.id}
        position={[(zone.x[0] + zone.x[1]) / 2, SURFACE_Y.sidewalk, (zone.z[0] + zone.z[1]) / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(event) => { event.stopPropagation(); choose({ id: zone.id, name: zone.name, category: 'Vereda' }); }}
      >
        <planeGeometry args={[zone.x[1] - zone.x[0], zone.z[1] - zone.z[0]]} />
        <meshStandardMaterial color={selectedId === zone.id ? '#75c9f5' : zone.color} {...FLAT_SURFACE_OFFSET} />
      </mesh>
    ))}

    {CAMPUS_SIDEWALK_INTERSECTION_ZONES.map((zone) => (
      <mesh
        key={zone.id}
        position={[(zone.x[0] + zone.x[1]) / 2, SURFACE_Y.sidewalkIntersection, (zone.z[0] + zone.z[1]) / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(event) => { event.stopPropagation(); choose({ id: zone.id, name: zone.name, category: 'Cruce de veredas' }); }}
      >
        <planeGeometry args={[zone.x[1] - zone.x[0], zone.z[1] - zone.z[0]]} />
        <meshStandardMaterial color={selectedId === zone.id ? '#75c9f5' : zone.color} {...FLAT_SURFACE_OFFSET} />
      </mesh>
    ))}

    {/* Cada cruce de calzadas reemplaza los tramos que lo rodean: queda como un lugar
        propio, al igual que las cuatro esquinas de sus veredas. */}
    {CAMPUS_STREET_INTERSECTION_ZONES.map((zone) => (
      <mesh
        key={zone.id}
        position={[(zone.x[0] + zone.x[1]) / 2, SURFACE_Y.streetIntersection, (zone.z[0] + zone.z[1]) / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(event) => { event.stopPropagation(); choose({ id: zone.id, name: zone.name, category: 'Cruce de calles' }); }}
      >
        <planeGeometry args={[zone.x[1] - zone.x[0], zone.z[1] - zone.z[0]]} />
        <meshStandardMaterial color={selectedId === zone.id ? '#75c9f5' : zone.color} {...FLAT_SURFACE_OFFSET} />
      </mesh>
    ))}

    {CAMPUS_STREET_ZONES.map((zone) => (
      <mesh
        key={zone.id}
        position={[(zone.x[0] + zone.x[1]) / 2, SURFACE_Y.street, (zone.z[0] + zone.z[1]) / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(event) => { event.stopPropagation(); choose({ id: zone.id, name: zone.name, category: 'Calle' }); }}
      >
        <planeGeometry args={[zone.x[1] - zone.x[0], zone.z[1] - zone.z[0]]} />
        <meshStandardMaterial color={selectedId === zone.id ? '#75c9f5' : zone.color} {...FLAT_SURFACE_OFFSET} />
      </mesh>
    ))}

    <GroundCompass />

    {/* Terreno base */}
    <mesh position={[GROUND_CENTER_X, -0.1, GROUND_CENTER_Z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[GROUND_BOUNDS.maxX - GROUND_BOUNDS.minX + 16, GROUND_BOUNDS.maxZ - GROUND_BOUNDS.minZ + 16]} />
      <meshStandardMaterial color="#151515" />
    </mesh>
    </>
  );
};

// La marca se dibuja por encima de la maqueta, incluso cuando el lugar queda dentro de
// un edificio: el color del piso entrega contexto y este hito deja inequívoco qué lugar
// está señalando la publicación desde cualquier ángulo de cámara.
const LocationMarker: React.FC<{ x: number; z: number; height: number }> = ({ x, z, height }) => (
  <group position={[x, 0, z]}>
    <mesh position={[0, 0.45, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1000}>
      <ringGeometry args={[2.4, 3.3, 40]} />
      <meshBasicMaterial color="#ff4d67" transparent opacity={0.95} depthTest={false} />
    </mesh>
    <mesh position={[0, height, 0]} renderOrder={1001}>
      <sphereGeometry args={[1.35, 24, 16]} />
      <meshBasicMaterial color="#ff4d67" depthTest={false} />
    </mesh>
    <mesh position={[0, height + 2.4, 0]} renderOrder={1001}>
      <coneGeometry args={[2.25, 4.8, 4]} />
      <meshBasicMaterial color="#ff4d67" transparent opacity={0.82} depthTest={false} />
    </mesh>
  </group>
);

// Página estática servida como archivo real (ver surroundingsMapHtml.ts) — no como
// srcDoc/html inline: MapLibre carga su script desde un CDN y parsea tiles en Web Workers,
// y eso no arranca dentro de HTML inyectado inline sin importar el sandbox del iframe/WebView
// (probado). En web una ruta relativa alcanza (resuelve contra el origen actual); en nativo
// hace falta un origen absoluto, y el backend es el único servidor que la tiene siempre.
const SURROUNDINGS_MAP_URL =
  Platform.OS === 'web' ? SURROUNDINGS_MAP_PATH : `${POCKETBASE_URL}${SURROUNDINGS_MAP_PATH}`;

function parseSurroundingsLocation(data: unknown): PostLocation | null {
  try {
    const message = typeof data === 'string' ? JSON.parse(data) : data;
    if (!message || typeof message !== 'object' || (message as { type?: string }).type !== 'beauchapp-location') return null;
    const location = (message as { location?: PostLocation }).location;
    if (!location || location.source !== 'surroundings' || !location.name || !location.category) return null;
    return location;
  } catch (_) {
    return null;
  }
}

const SurroundingsMap: React.FC<{
  pickerMode: boolean;
  initialLocation?: PostLocation;
  onLocationSelected: (location: PostLocation) => void;
}> = ({ pickerMode, initialLocation, onLocationSelected }) => {
  const mapParams = new URLSearchParams();
  if (pickerMode) mapParams.set('picker', '1');
  if (initialLocation?.source === 'surroundings' && initialLocation.latitude !== undefined && initialLocation.longitude !== undefined) {
    mapParams.set('lat', String(initialLocation.latitude));
    mapParams.set('lng', String(initialLocation.longitude));
  }
  const mapUrl = mapParams.size ? `${SURROUNDINGS_MAP_URL}?${mapParams.toString()}` : SURROUNDINGS_MAP_URL;

  useEffect(() => {
    if (Platform.OS !== 'web' || !pickerMode || typeof window === 'undefined') return;
    const handleMessage = (event: any) => {
      const location = parseSurroundingsLocation(event.data);
      if (location) onLocationSelected(location);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [pickerMode, onLocationSelected]);

  if (Platform.OS === 'web') {
    return (
      <iframe
        src={mapUrl}
        style={{ border: 'none', width: '100%', height: '100%', backgroundColor: theme.colors.background }}
      />
    );
  }
  return (
    <WebView
      originWhitelist={['*']}
      source={{ uri: mapUrl }}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      javaScriptEnabled
      domStorageEnabled
      onMessage={(event) => {
        const location = parseSurroundingsLocation(event.nativeEvent.data);
        if (location) onLocationSelected(location);
      }}
    />
  );
};

export const CampusMapScreen: React.FC<Props> = ({ navigation, route }) => {
  const pickerMode = route.params?.picker === true;
  const postLocation = route.params?.location;
  const locationViewMode = !!postLocation;
  const [tab, setTab] = useState<'3d' | 'alrededores'>(postLocation?.source === 'surroundings' ? 'alrededores' : '3d');
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [mapSelection, setMapSelection] = useState<MapSelection | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<PostLocation | null>(null);

  useEffect(() => {
    if (!postLocation) return;
    setTab(postLocation.source === 'surroundings' ? 'alrededores' : '3d');
    if (postLocation.source === 'campus' && postLocation.campusElementId) {
      setMapSelection({ id: postLocation.campusElementId, name: postLocation.name, category: postLocation.category });
    }
  }, [postLocation]);

  const matches = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    return CAMPUS_ROOMS.filter((r) => normalize(r.name).includes(q)).slice(0, 8);
  }, [query]);

  const selectRoom = (room: CampusRoom) => {
    setHighlight({ buildingId: room.buildingId, floor: room.floor });
    setQuery(room.name);
  };

  const selectMapElement = (selection: MapSelection) => {
    setMapSelection(selection);
    if (pickerMode) {
      const coordinates = campusCoordinatesFor(selection.id);
      setSelectedLocation({
        source: 'campus',
        name: selection.name,
        category: selection.category,
        campusElementId: selection.id,
        campusX: coordinates?.x,
        campusZ: coordinates?.z,
      });
    }
  };

  const selectSurroundingsLocation = (location: PostLocation) => {
    if (!pickerMode) return;
    setSelectedLocation(location);
    setMapSelection({ id: 'surroundings_location', name: location.name, category: location.category });
  };

  const confirmLocation = () => {
    if (!selectedLocation) return;
    DeviceEventEmitter.emit('postLocationSelected', selectedLocation);
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home');
  };

  const building = highlight ? CAMPUS_BUILDINGS.find((b) => b.id === highlight.buildingId) : undefined;
  const storedCampusCoordinates = postLocation?.source === 'campus'
    ? postLocation.campusX !== undefined && postLocation.campusZ !== undefined
      ? { x: postLocation.campusX, z: postLocation.campusZ }
      : postLocation.campusElementId ? campusCoordinatesFor(postLocation.campusElementId) : null
    : null;
  const orbitTarget: [number, number, number] = storedCampusCoordinates
    ? [storedCampusCoordinates.x, 2, storedCampusCoordinates.z]
    : CAMERA_TARGET;

  return (
    <View style={styles.container}>
      {!locationViewMode && <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === '3d' && styles.tabBtnActive]}
          onPress={() => {
            setTab('3d');
            setMapSelection(null);
            setSelectedLocation(null);
          }}
        >
          <Text style={[styles.tabText, tab === '3d' && styles.tabTextActive]}>Beauchef</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'alrededores' && styles.tabBtnActive]}
          onPress={() => {
            setTab('alrededores');
            setMapSelection(null);
            setSelectedLocation(null);
          }}
        >
          <Text style={[styles.tabText, tab === 'alrededores' && styles.tabTextActive]}>Alrededores</Text>
        </TouchableOpacity>
      </View>}

      {tab === 'alrededores' ? (
        <View style={styles.canvasWrapper}>
          <SurroundingsMap
            pickerMode={pickerMode}
            initialLocation={postLocation}
            onLocationSelected={selectSurroundingsLocation}
          />
          {pickerMode && selectedLocation && (
            <TouchableOpacity style={styles.locationConfirmButton} onPress={confirmLocation}>
              <Feather name="map-pin" size={16} color="#000000" />
              <Text style={styles.locationConfirmText}>Usar esta ubicación</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          {SHOW_ROOM_SEARCH && <View style={styles.searchWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Buscar una sala..."
              placeholderTextColor={theme.colors.textMuted}
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                if (highlight) setHighlight(null);
              }}
            />
            {matches.length > 0 && (
              <FlatList
                style={styles.suggestions}
                data={matches}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const b = CAMPUS_BUILDINGS.find((bb) => bb.id === item.buildingId);
                  return (
                    <TouchableOpacity style={styles.suggestionRow} onPress={() => selectRoom(item)}>
                      <Text style={styles.suggestionName}>{item.name}</Text>
                      <Text style={styles.suggestionSub}>
                        {b?.name} · piso {item.floor}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            {highlight && building && (
              <View style={styles.highlightBanner}>
                <Text style={styles.highlightText}>
                  {building.name} · piso {highlight.floor}
                </Text>
                <TouchableOpacity onPress={() => { setHighlight(null); setQuery(''); }}>
                  <Text style={styles.clearText}>Limpiar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>}

          <View style={styles.canvasWrapper}>
            <Canvas
              camera={{ position: INITIAL_CAMERA_POSITION, fov: 45 }}
              onPointerMissed={locationViewMode ? undefined : () => setMapSelection(null)}
            >
              <ambientLight intensity={0.7} />
              <directionalLight position={[40, 60, 20]} intensity={1} />
              <Buildings
                highlight={highlight}
                selectedId={mapSelection?.id || null}
                readOnly={locationViewMode}
                onSelect={selectMapElement}
              />
              {locationViewMode && postLocation?.source === 'campus' && storedCampusCoordinates && (
                <LocationMarker
                  x={storedCampusCoordinates.x}
                  z={storedCampusCoordinates.z}
                  height={campusMarkerHeight(postLocation.campusElementId || '')}
                />
              )}
              <OrbitControls
                target={orbitTarget}
                maxPolarAngle={Math.PI / 1.7}
                minDistance={15}
                maxDistance={220}
              />
            </Canvas>

            {mapSelection && (
              <View pointerEvents="none" style={styles.mapSelection}>
                <Text style={styles.mapSelectionCategory}>{mapSelection.category}</Text>
                <Text style={styles.mapSelectionName}>{mapSelection.name}</Text>
              </View>
            )}

            {pickerMode && selectedLocation && (
              <TouchableOpacity style={styles.locationConfirmButton} onPress={confirmLocation}>
                <Feather name="map-pin" size={16} color="#000000" />
                <Text style={styles.locationConfirmText}>Usar esta ubicación</Text>
              </TouchableOpacity>
            )}

            {SHOW_MAP_LEGEND && <ScrollView style={styles.legend} contentContainerStyle={styles.legendContent}>
              {CAMPUS_BUILDINGS.map((b) => (
                <View key={b.id} style={styles.legendRow}>
                  <View style={[styles.legendSwatch, { backgroundColor: b.color }]} />
                  <Text style={styles.legendText} numberOfLines={1}>{b.name}</Text>
                </View>
              ))}
              <View style={styles.legendDivider} />
              {CAMPUS_GROUND_FEATURES.map((feature) => (
                <View key={feature.id} style={styles.legendRow}>
                  <View style={[styles.legendSwatch, { backgroundColor: feature.color }]} />
                  <Text style={styles.legendText} numberOfLines={1}>{feature.name}</Text>
                </View>
              ))}
              <View style={styles.legendRow}>
                <View style={[styles.legendSwatch, { backgroundColor: '#1b2730' }]} />
                <Text style={styles.legendText}>Patios por zonas</Text>
              </View>
              <View style={styles.legendRow}>
                <View style={[styles.legendSwatch, { backgroundColor: '#73777c' }]} />
                <Text style={styles.legendText}>Veredas</Text>
              </View>
              <View style={styles.legendDivider} />
              {CAMPUS_STREETS.map((s) => (
                <View key={s.id} style={styles.legendRow}>
                  <View style={[styles.legendSwatch, { backgroundColor: s.color }]} />
                  <Text style={styles.legendText} numberOfLines={1}>{s.name}</Text>
                </View>
              ))}
            </ScrollView>}
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  tabBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tabText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#000000',
  },
  searchWrapper: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    zIndex: 10,
  },
  input: {
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    color: theme.colors.text,
    fontSize: 14,
  },
  suggestions: {
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderTopWidth: 0,
    borderRadius: theme.borderRadius.md,
    maxHeight: 240,
  },
  suggestionRow: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  suggestionName: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  suggestionSub: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  highlightBanner: {
    marginTop: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  highlightText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  clearText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  canvasWrapper: {
    flex: 1,
  },
  mapSelection: {
    position: 'absolute',
    left: theme.spacing.sm,
    bottom: theme.spacing.sm,
    maxWidth: 260,
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  mapSelectionCategory: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  mapSelectionName: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  locationConfirmButton: {
    position: 'absolute',
    right: theme.spacing.sm,
    bottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  locationConfirmText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },
  legend: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    maxHeight: 260,
    width: 200,
    backgroundColor: 'rgba(10,10,10,0.85)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
  },
  legendContent: {
    padding: theme.spacing.sm,
  },
  legendDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    gap: 8,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    color: theme.colors.text,
    fontSize: 11,
    flexShrink: 1,
  },
});
