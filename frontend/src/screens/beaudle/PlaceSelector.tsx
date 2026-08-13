import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { SelectorModal } from '../../components/SelectorModal';
import { BEAUDLE_PLACES, BeaudlePlace } from './places';

// Mismo patrón que los filtros de ProblemsListScreen: un "selector" (TextInput no
// editable dentro de un TouchableOpacity) que abre un SelectorModal y se queda mostrando
// el valor elegido, en vez de un buscador libre que se vacía al seleccionar. El envío es
// un paso aparte, con el cuadrado de confirmar a la derecha.

function labelFor(place: BeaudlePlace) {
  return place.shortName === place.name ? place.name : `${place.shortName} — ${place.name}`;
}

// BEAUDLE_PLACES está agrupado por edificio (ver places.ts) — mostrarlo tal cual en la
// lista de alternativas se sentía como un catálogo ordenado en vez de una lista de
// candidatos. Se baraja una vez por montaje (no en cada render, para que la lista no
// salte de orden mientras el usuario va descartando opciones jugadas).
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface PlaceSelectorProps {
  disabledCodes: string[];
  disabled?: boolean;
  onConfirm: (place: BeaudlePlace) => void;
}

export const PlaceSelector: React.FC<PlaceSelectorProps> = ({ disabledCodes, disabled, onConfirm }) => {
  const [selected, setSelected] = useState<BeaudlePlace | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [shuffledPlaces] = useState(() => shuffle(BEAUDLE_PLACES));

  const available = shuffledPlaces.filter((p) => !disabledCodes.includes(p.code));
  const suggestions = available.map(labelFor);

  const handleSelect = (val: string) => {
    setSelected(available.find((p) => labelFor(p) === val) || null);
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
            placeholder="Elige un lugar..."
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
        title="Elegir lugar"
        placeholder="Buscar lugar (ej. DCC)..."
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
