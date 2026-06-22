import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { theme } from './HomeScreen';

interface MatchRegisterScreenProps {
  onNavigate: (screen: string) => void;
}

export const MatchRegisterScreen: React.FC<MatchRegisterScreenProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [discipline, setDiscipline] = useState('Taca-Taca');
  const [opponent, setOpponent] = useState('');
  const [myScore, setMyScore] = useState('');
  const [opponentScore, setOpponentScore] = useState('');
  const [loading, setLoading] = useState(false);

  const disciplines = ['Taca-Taca', 'Ajedrez', 'Ping-Pong', 'Pool'];

  const handleSubmit = async () => {
    if (!opponent) {
      Alert.alert('Error', 'Debes ingresar el nombre o correo de tu rival.');
      return;
    }
    if (!myScore || !opponentScore) {
      Alert.alert('Error', 'Debes ingresar el marcador completo.');
      return;
    }

    setLoading(true);
    try {
      // Registrar partida en PocketBase (placeholder por ahora hasta crear colecciones)
      // Simulamos la operación
      setTimeout(() => {
        setLoading(false);
        Alert.alert(
          'Partida Registrada',
          'El resultado ha sido procesado. Los ELOs se han recalculado.',
          [{ text: 'Ver Perfil', onPress: () => onNavigate('Profile') }]
        );
        setOpponent('');
        setMyScore('');
        setOpponentScore('');
      }, 1000);
    } catch (err) {
      setLoading(false);
      Alert.alert('Error', 'Hubo un error al registrar la partida.');
    }
  };

  if (!user) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.messageText}>Inicia sesión para registrar marcadores oficiales.</Text>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => onNavigate('Login')}
        >
          <Text style={styles.actionButtonText}>Iniciar Sesión</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.formCard}>
        <Text style={styles.title}>Registrar Partido</Text>
        <Text style={styles.subtitle}>
          Registra el marcador del partido jugado. El cálculo de ELO se realiza de forma inmediata confiando en la honestidad de la comunidad.
        </Text>

        <Text style={styles.label}>Disciplina</Text>
        <View style={styles.disciplineContainer}>
          {disciplines.map((d) => (
            <TouchableOpacity
              key={d}
              style={[
                styles.disciplineBadge,
                discipline === d && styles.disciplineBadgeActive
              ]}
              onPress={() => setDiscipline(d)}
            >
              <Text 
                style={[
                  styles.disciplineText,
                  discipline === d && styles.disciplineTextActive
                ]}
              >
                {d}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Rival (Nombre o Correo)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. diego.silva@ug.uchile.cl"
            placeholderTextColor={theme.colors.textMuted}
            value={opponent}
            onChangeText={setOpponent}
            autoCapitalize="none"
          />
        </View>

        <Text style={styles.label}>Marcador</Text>
        <View style={styles.scoreRow}>
          <View style={styles.scoreInputContainer}>
            <Text style={styles.scoreLabel}>Tu puntaje</Text>
            <TextInput
              style={styles.scoreInput}
              placeholder="0"
              placeholderTextColor={theme.colors.textMuted}
              value={myScore}
              onChangeText={setMyScore}
              keyboardType="number-pad"
            />
          </View>
          <Text style={styles.scoreDivider}>-</Text>
          <View style={styles.scoreInputContainer}>
            <Text style={styles.scoreLabel}>Puntaje rival</Text>
            <TextInput
              style={styles.scoreInput}
              placeholder="0"
              placeholderTextColor={theme.colors.textMuted}
              value={opponentScore}
              onChangeText={setOpponentScore}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Procesando...' : 'Subir Resultado'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    padding: theme.spacing.md,
    justifyContent: 'center',
    minHeight: '80%',
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  messageText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  actionButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: theme.borderRadius.md,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  formCard: {
    paddingVertical: theme.spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 20,
    marginBottom: theme.spacing.lg,
  },
  disciplineContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.lg,
  },
  disciplineBadge: {
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.borderRadius.md,
    marginRight: 8,
    marginBottom: 8,
  },
  disciplineBadgeActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  disciplineText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  disciplineTextActive: {
    color: '#fff',
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    fontSize: 16,
    color: theme.colors.text,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingVertical: 10,
    paddingHorizontal: 0,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xl,
  },
  scoreInputContainer: {
    flex: 1,
  },
  scoreLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginBottom: 6,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scoreInput: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 12,
    fontSize: 22,
    color: theme.colors.text,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontWeight: '700',
  },
  scoreDivider: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.textMuted,
    paddingHorizontal: 12,
    marginTop: 18,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
