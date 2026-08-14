import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';

const MAX_OPTIONS = 6;
const MIN_OPTIONS = 2;
const MAX_OPTION_LENGTH = 80;

export function isValidPoll(options: string[] | null | undefined): boolean {
  if (!options) return false;
  const nonEmpty = options.map((o) => o.trim()).filter(Boolean);
  return nonEmpty.length >= MIN_OPTIONS;
}

interface PollComposerProps {
  options: string[];
  onChange: (options: string[]) => void;
  onRemove: () => void;
}

// UI inline para armar una encuesta al componer un post/comentario/respuesta — sin
// botón de envío propio, se integra al botón de Publicar/Responder que ya existe en
// cada pantalla (el padre agrega pollOptions al postData/FormData recién al enviar).
export const PollComposer: React.FC<PollComposerProps> = ({ options, onChange, onRemove }) => {
  const updateOption = (index: number, value: string) => {
    const next = options.slice();
    next[index] = value;
    onChange(next);
  };

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    onChange([...options, '']);
  };

  const removeOption = (index: number) => {
    if (options.length <= MIN_OPTIONS) return;
    onChange(options.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Encuesta</Text>
        <TouchableOpacity onPress={onRemove} style={styles.removeAllBtn}>
          <Feather name="x" size={16} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      {options.map((opt, i) => (
        <View key={i} style={styles.optionRow}>
          <TextInput
            style={styles.optionInput}
            placeholder={`Opción ${i + 1}`}
            placeholderTextColor={theme.colors.textMuted}
            value={opt}
            onChangeText={(v) => updateOption(i, v)}
            maxLength={MAX_OPTION_LENGTH}
          />
          {options.length > MIN_OPTIONS && (
            <TouchableOpacity onPress={() => removeOption(i)} style={styles.removeOptionBtn}>
              <Feather name="x" size={14} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      ))}

      {options.length < MAX_OPTIONS && (
        <TouchableOpacity onPress={addOption} style={styles.addBtn} activeOpacity={0.7}>
          <Feather name="plus" size={14} color={theme.colors.primary} />
          <Text style={styles.addBtnText}>Agregar opción</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  removeAllBtn: {
    padding: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  optionInput: {
    flex: 1,
    height: 38,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    color: theme.colors.text,
    fontSize: 13,
  },
  removeOptionBtn: {
    padding: 6,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  addBtnText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
