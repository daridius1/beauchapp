import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { BeaudleGuessFeedback } from '../../services/beaudleService';
import { BEAUDLE_PLACES } from './places';

const CORRECT_COLOR = '#16a34a';
const PARTIAL_COLOR = '#ca8a04';
const WRONG_COLOR = '#dc2626';

type TileState = 'correct' | 'partial' | 'wrong';

const TILE_COLOR: Record<TileState, string> = {
  correct: CORRECT_COLOR,
  partial: PARTIAL_COLOR,
  wrong: WRONG_COLOR,
};

// Estilo inspirado en LoLdle: cada celda muestra el valor adivinado (no una flecha),
// coloreada en verde si coincide exactamente con el secreto, amarillo si comparte al
// menos un valor con el secreto sin ser igual (edificio/piso/tipo pueden tener más de un
// valor a la vez), y rojo si no comparten nada.
function Tile({ value, state }: { value: string; state: TileState }) {
  return (
    <View style={[styles.tile, { backgroundColor: TILE_COLOR[state] }]}>
      <Text style={styles.tileValue} numberOfLines={3}>{value}</Text>
    </View>
  );
}

export function GuessRowHeader() {
  return (
    <View style={styles.headerRow}>
      <Text style={styles.headerLabel}>Ubicación</Text>
      <Text style={styles.headerLabel}>Edificio</Text>
      <Text style={styles.headerLabel}>Piso</Text>
      <Text style={styles.headerLabel}>Tipo</Text>
    </View>
  );
}

export function GuessRow({ guess }: { guess: BeaudleGuessFeedback }) {
  const place = BEAUDLE_PLACES.find((p) => p.code === guess.code);
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Tile value={place?.ubicacion ?? '?'} state={guess.ubicacion === 'correct' ? 'correct' : 'wrong'} />
        <Tile value={place ? place.edificio.join(', ') : '?'} state={guess.edificio} />
        <Tile value={place ? place.piso.join(', ') : '?'} state={guess.piso} />
        <Tile value={place ? place.tipo.join(', ') : '?'} state={guess.tipo} />
      </View>
      <Text style={styles.name} numberOfLines={2}>{place?.name ?? guess.code}</Text>
      {guess.tie && !guess.solved && (
        <View style={styles.tieBanner}>
          <Feather name="alert-triangle" size={13} color="#facc15" style={{ marginRight: 6 }} />
          <Text style={styles.tieText}>
            Coincide en todo, pero hay más de un lugar así — prueba con el otro.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'stretch',
  },
  name: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },
  tile: {
    flex: 1,
    minHeight: 52,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  tileValue: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 10,
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: theme.spacing.xs,
  },
  headerLabel: {
    flex: 1,
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tieBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    padding: 8,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(250, 204, 21, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.3)',
  },
  tieText: {
    flex: 1,
    color: '#facc15',
    fontSize: 12,
  },
});
