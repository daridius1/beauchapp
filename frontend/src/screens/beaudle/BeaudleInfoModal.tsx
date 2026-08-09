import React from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../theme/theme';

interface BeaudleInfoModalProps {
  visible: boolean;
  onClose: () => void;
}

interface Section {
  title: string;
  body: string;
}

const SECTIONS: Section[] = [
  {
    title: '¿Qué es Beaudle?',
    body: 'Un Wordle diario de Beauchef: cada día hay un lugar secreto (una sala, departamento, cancha, patio, etc.) y tienes 6 intentos para adivinarlo. El lugar es el mismo para todos y cambia todos los días.',
  },
  {
    title: '¿Qué comparas en cada intento?',
    body: 'Cuatro cosas del lugar que elegiste contra el secreto: su ubicación (851, 850, Casa CEI o Domeyko), el o los edificios/torres donde está, el o los pisos, y el o los tipos de lugar que es (ej. Deportivo, Oficina, Centro).',
  },
  {
    title: 'Los colores',
    body: 'Verde: coincide exacto con el secreto. Rojo: no tiene nada en común. Amarillo (solo en edificio, piso y tipo, porque esos pueden tener más de un valor a la vez): comparte al menos un valor con el secreto, pero no son exactamente los mismos — por ejemplo, si adivinas un lugar en "Torre Norte, Torre Poniente" y el secreto está solo en "Torre Norte", esa celda sale amarilla.',
  },
  {
    title: '¿Y si coincide todo pero no es el lugar?',
    body: 'Puede pasar que dos lugares distintos compartan exactamente las 4 pistas (misma ubicación, edificio, piso y tipo) — en ese caso el juego te avisa "hay más de un lugar así" para que pruebes con el otro, en vez de dejarte sin pistas para distinguirlos.',
  },
  {
    title: 'Recompensa',
    body: 'Al terminar el Beaudle del día —lo adivines o se te acaben los intentos— recibes 10 ℬ BeauTokens, una sola vez por día.',
  },
];

export const BeaudleInfoModal: React.FC<BeaudleInfoModalProps> = ({ visible, onClose }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          <View style={styles.iconContainer}>
            <Feather name="info" size={22} color="#ffffff" />
          </View>

          <Text style={styles.title}>Cómo funciona Beaudle</Text>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {SECTIONS.map((s, i) => (
              <View key={s.title} style={[styles.section, i !== SECTIONS.length - 1 && styles.sectionDivider]}>
                <Text style={styles.sectionTitle}>{s.title}</Text>
                <Text style={styles.sectionBody}>{s.body}</Text>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.closeBtn} activeOpacity={0.7} onPress={onClose}>
            <Text style={styles.closeBtnText}>Cerrar</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  card: {
    backgroundColor: '#0c0c0c',
    borderRadius: 14,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  scroll: {
    width: '100%',
    marginBottom: theme.spacing.md,
  },
  section: {
    paddingBottom: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  sectionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  sectionBody: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  closeBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#161616',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
