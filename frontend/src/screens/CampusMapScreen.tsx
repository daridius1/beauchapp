import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WebView } from 'react-native-webview';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
// Import puntual en vez del barrel de drei: el barrel arrastra useGLTF/three-mesh-bvh,
// que usan import.meta en sus workers y Metro no los transforma (rompe el bundle web).
// Por lo mismo se evita drei/core/Text (troika-three-text también usa workers): los
// nombres de edificio se muestran en la leyenda 2D, no flotando en la escena 3D.
import { OrbitControls } from '@react-three/drei/core/OrbitControls';
import { RootStackParamList } from '../types/navigation';
import { theme } from '../theme/theme';
import { CAMPUS_BUILDINGS, CAMPUS_ROOMS, CAMPUS_STREETS, CANCHA, CampusRoom, floorY } from '../data/campusMap';
import { SURROUNDINGS_MAP_PATH } from '../data/surroundingsMapHtml';
import { POCKETBASE_URL } from '../services/pocketbase';

type Props = NativeStackScreenProps<RootStackParamList, 'CampusMap'>;

// Margen visual entre huellas (incluso entre edificios que están pegados en el plano
// real): un pasillo delgado que separa los volúmenes sin dejar de leerse como contiguos.
const FOOTPRINT_INSET = 0.4;
// Espacio entre pisos apilados, para que se distingan como bloques separados.
const FLOOR_GAP = 0.15;

const DIACRITICS_RE = /[\u0300-\u036f]/g;
function normalize(s: string) {
  return s.normalize('NFD').replace(DIACRITICS_RE, '').toLowerCase();
}

type Highlight = { buildingId: string; floor: number };

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

// El Shape vive en el plano XY local; se extruye a lo largo de Z y el mesh se rota
// -90° en X para pararlo (como el terreno/calles/cancha). Esa rotación manda la Y del
// shape a -Z del mundo, así que se le pasa -z para que el mundo quede con el z real.
function buildFootprintShape(points: [number, number][]): THREE.Shape {
  const shape = new THREE.Shape();
  points.forEach(([x, z], i) => {
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  return shape;
}

const BUILDING_SHAPES = new Map<string, THREE.Shape>();
CAMPUS_BUILDINGS.forEach((b) => {
  if (b.footprint) BUILDING_SHAPES.set(b.id, buildFootprintShape(b.footprint));
});

const Buildings: React.FC<{ highlight: Highlight | null }> = ({ highlight }) => (
  <>
    {CAMPUS_BUILDINGS.map((b) => {
      const shape = BUILDING_SHAPES.get(b.id);
      const width = b.x[1] - b.x[0] - FOOTPRINT_INSET;
      const depth = b.z[1] - b.z[0] - FOOTPRINT_INSET;
      const cx = (b.x[0] + b.x[1]) / 2;
      const cz = (b.z[0] + b.z[1]) / 2;

      return (
        <group key={b.id}>
          {b.floors.map((f) => {
            const [y0, y1] = floorY(f);
            const isHighlighted = highlight?.buildingId === b.id && highlight.floor === f;
            const dimmed = !!highlight && !isHighlighted;
            // El piso resaltado ignora el depth-test y se dibuja al final (renderOrder
            // alto): así se ve "a rayos X" a través de cualquier edificio que quede
            // delante, en vez de perderse detrás de la cámara actual.
            const material = (
              <meshStandardMaterial
                color={isHighlighted ? '#ffe14d' : b.color}
                emissive={isHighlighted ? '#ffb300' : '#000000'}
                emissiveIntensity={isHighlighted ? 0.7 : 0}
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
                <mesh key={f} position={[0, y0 + FLOOR_GAP / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={renderOrder}>
                  <extrudeGeometry args={[shape, { depth: y1 - y0 - FLOOR_GAP, bevelEnabled: false }]} />
                  {material}
                </mesh>
              );
            }
            return (
              <mesh key={f} position={[cx, (y0 + y1) / 2, cz]} renderOrder={renderOrder}>
                <boxGeometry args={[width, y1 - y0 - FLOOR_GAP, depth]} />
                {material}
              </mesh>
            );
          })}
        </group>
      );
    })}

    {/* Cancha: losa plana sin volumen, solo referencia visual. */}
    <mesh position={[(CANCHA.x[0] + CANCHA.x[1]) / 2, 0.02, (CANCHA.z[0] + CANCHA.z[1]) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[CANCHA.x[1] - CANCHA.x[0], CANCHA.z[1] - CANCHA.z[0]]} />
      <meshStandardMaterial color={CANCHA.color} />
    </mesh>

    {/* Calles: Blanco Encalada, Tupper y Beauchef, losas planas sin volumen. */}
    {CAMPUS_STREETS.map((s) => (
      <mesh key={s.id} position={[(s.x[0] + s.x[1]) / 2, 0.01, (s.z[0] + s.z[1]) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[s.x[1] - s.x[0], s.z[1] - s.z[0]]} />
        <meshStandardMaterial color={s.color} />
      </mesh>
    ))}

    {/* Terreno base */}
    <mesh position={[CENTER_X, -0.1, CENTER_Z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[CAMPUS_BOUNDS.maxX - CAMPUS_BOUNDS.minX + 20, CAMPUS_BOUNDS.maxZ - CAMPUS_BOUNDS.minZ + 20]} />
      <meshStandardMaterial color="#151515" />
    </mesh>
  </>
);

// Página estática servida como archivo real (ver surroundingsMapHtml.ts) — no como
// srcDoc/html inline: MapLibre carga su script desde un CDN y parsea tiles en Web Workers,
// y eso no arranca dentro de HTML inyectado inline sin importar el sandbox del iframe/WebView
// (probado). En web una ruta relativa alcanza (resuelve contra el origen actual); en nativo
// hace falta un origen absoluto, y el backend es el único servidor que la tiene siempre.
const SURROUNDINGS_MAP_URL =
  Platform.OS === 'web' ? SURROUNDINGS_MAP_PATH : `${POCKETBASE_URL}${SURROUNDINGS_MAP_PATH}`;

const SurroundingsMap: React.FC = () => {
  if (Platform.OS === 'web') {
    return (
      <iframe
        src={SURROUNDINGS_MAP_URL}
        style={{ border: 'none', width: '100%', height: '100%', backgroundColor: theme.colors.background }}
      />
    );
  }
  return (
    <WebView
      originWhitelist={['*']}
      source={{ uri: SURROUNDINGS_MAP_URL }}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      javaScriptEnabled
      domStorageEnabled
    />
  );
};

export const CampusMapScreen: React.FC<Props> = () => {
  const [tab, setTab] = useState<'3d' | 'alrededores'>('3d');
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState<Highlight | null>(null);

  const matches = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    return CAMPUS_ROOMS.filter((r) => normalize(r.name).includes(q)).slice(0, 8);
  }, [query]);

  const selectRoom = (room: CampusRoom) => {
    setHighlight({ buildingId: room.buildingId, floor: room.floor });
    setQuery(room.name);
  };

  const building = highlight ? CAMPUS_BUILDINGS.find((b) => b.id === highlight.buildingId) : undefined;

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === '3d' && styles.tabBtnActive]}
          onPress={() => setTab('3d')}
        >
          <Text style={[styles.tabText, tab === '3d' && styles.tabTextActive]}>Edificios 3D</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'alrededores' && styles.tabBtnActive]}
          onPress={() => setTab('alrededores')}
        >
          <Text style={[styles.tabText, tab === 'alrededores' && styles.tabTextActive]}>Alrededores</Text>
        </TouchableOpacity>
      </View>

      {tab === 'alrededores' ? (
        <View style={styles.canvasWrapper}>
          <SurroundingsMap />
        </View>
      ) : (
        <>
          <View style={styles.searchWrapper}>
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
          </View>

          <View style={styles.canvasWrapper}>
            <Canvas camera={{ position: [55, 55, 75], fov: 45 }}>
              <ambientLight intensity={0.7} />
              <directionalLight position={[40, 60, 20]} intensity={1} />
              <Buildings highlight={highlight} />
              <OrbitControls target={[CENTER_X, 5, CENTER_Z]} maxPolarAngle={Math.PI / 2.05} minDistance={15} maxDistance={220} />
            </Canvas>

            <ScrollView style={styles.legend} contentContainerStyle={styles.legendContent}>
              {CAMPUS_BUILDINGS.map((b) => (
                <View key={b.id} style={styles.legendRow}>
                  <View style={[styles.legendSwatch, { backgroundColor: b.color }]} />
                  <Text style={styles.legendText} numberOfLines={1}>{b.name}</Text>
                </View>
              ))}
              <View style={styles.legendDivider} />
              {CAMPUS_STREETS.map((s) => (
                <View key={s.id} style={styles.legendRow}>
                  <View style={[styles.legendSwatch, { backgroundColor: s.color }]} />
                  <Text style={styles.legendText} numberOfLines={1}>{s.name}</Text>
                </View>
              ))}
            </ScrollView>
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
