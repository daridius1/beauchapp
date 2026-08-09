import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { SelectorModal } from '../../components/SelectorModal';
import { BEAUDLE_COURSES, BeaudleCourse } from './courses';

// Mismo patrón que los filtros de ProblemsListScreen: un "selector" (TextInput no
// editable dentro de un TouchableOpacity) que abre un SelectorModal y se queda mostrando
// el valor elegido, en vez de un buscador libre que se vacía al seleccionar. El envío es
// un paso aparte, con el cuadrado de confirmar a la derecha.

function labelFor(course: BeaudleCourse) {
  return `${course.code} — ${course.name}`;
}

interface CourseSelectorProps {
  disabledCodes: string[];
  disabled?: boolean;
  onConfirm: (course: BeaudleCourse) => void;
}

export const CourseSelector: React.FC<CourseSelectorProps> = ({ disabledCodes, disabled, onConfirm }) => {
  const [selected, setSelected] = useState<BeaudleCourse | null>(null);
  const [showModal, setShowModal] = useState(false);

  const available = BEAUDLE_COURSES.filter((c) => !disabledCodes.includes(c.code));
  const suggestions = available.map(labelFor);

  const handleSelect = (val: string) => {
    setSelected(available.find((c) => labelFor(c) === val) || null);
  };

  const handleConfirm = () => {
    if (!selected || disabled) return;
    onConfirm(selected);
    setSelected(null);
  };

  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.selector} onPress={() => setShowModal(true)} disabled={disabled} activeOpacity={0.7}>
        <View pointerEvents="none">
          <TextInput
            style={styles.selectorInput}
            placeholder="Elige un ramo..."
            placeholderTextColor={theme.colors.textMuted}
            value={selected ? labelFor(selected) : ''}
            editable={false}
          />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.confirmButton, (!selected || disabled) && styles.confirmButtonDisabled]}
        onPress={handleConfirm}
        disabled={!selected || disabled}
      >
        <Feather name="check" size={20} color="#000000" />
      </TouchableOpacity>

      <SelectorModal
        visible={showModal}
        title="Elegir ramo"
        placeholder="Buscar ramo (ej. MA1001)..."
        suggestions={suggestions}
        allowCustom={false}
        onSelect={(val) => handleSelect(val)}
        onClose={() => setShowModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selector: {
    flex: 1,
  },
  selectorInput: {
    width: '100%',
    height: 44,
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  confirmButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.4,
  },
});
