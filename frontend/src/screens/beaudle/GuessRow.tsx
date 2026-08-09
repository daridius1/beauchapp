import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { BeaudleGuessFeedback } from '../../services/beaudleService';
import { BEAUDLE_COURSES } from './courses';

const CORRECT_COLOR = '#22c55e';
const WRONG_COLOR = '#ef4444';

// Estilo inspirado en LoLdle: cada celda muestra el valor adivinado (no una flecha),
// coloreada en verde si coincide con el secreto y en rojo si no — sin indicar dirección.
function Tile({ value, correct }: { value: string | number; correct: boolean }) {
  return (
    <View style={[styles.tile, correct ? styles.tileCorrect : styles.tileWrong]}>
      <Text style={styles.tileValue}>{value}</Text>
    </View>
  );
}

export function GuessRowHeader() {
  return (
    <View style={styles.headerRow}>
      <View style={styles.headerSpacer} />
      <Text style={styles.headerLabel}>Depto</Text>
      <Text style={styles.headerLabel}>Semestre</Text>
      <Text style={styles.headerLabel}>Créditos</Text>
    </View>
  );
}

export function GuessRow({ guess }: { guess: BeaudleGuessFeedback }) {
  const course = BEAUDLE_COURSES.find((c) => c.code === guess.code);
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.codeCell}>
          <Text style={styles.code}>{guess.code}</Text>
          {!!course && (
            <Text style={styles.name} numberOfLines={2}>{course.name}</Text>
          )}
        </View>
        <Tile value={course?.department ?? '?'} correct={guess.department === 'correct'} />
        <Tile value={course?.semester ?? '?'} correct={guess.semester === 'correct'} />
        <Tile value={course?.credits ?? '?'} correct={guess.credits === 'correct'} />
      </View>
      {guess.tie && !guess.solved && (
        <View style={styles.tieBanner}>
          <Feather name="alert-triangle" size={13} color="#facc15" style={{ marginRight: 6 }} />
          <Text style={styles.tieText}>
            Coincide en todo, pero hay más de un ramo así — prueba con el otro.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'stretch',
  },
  codeCell: {
    flex: 1.6,
    justifyContent: 'center',
    paddingRight: 4,
  },
  code: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 13,
  },
  name: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  tile: {
    flex: 1,
    minHeight: 52,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileCorrect: {
    backgroundColor: CORRECT_COLOR,
  },
  tileWrong: {
    backgroundColor: WRONG_COLOR,
  },
  tileValue: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: theme.spacing.xs,
  },
  headerSpacer: {
    flex: 1.6,
  },
  headerLabel: {
    flex: 1,
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: 10,
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
