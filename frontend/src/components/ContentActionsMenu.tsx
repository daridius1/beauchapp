import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';

export interface ContentAction {
  key: string;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

interface Props {
  actions: ContentAction[];
  iconName?: keyof typeof Feather.glyphMap;
  iconSize?: number;
}

// Menú "⋮" estándar para acciones sobre contenido de otras personas (o propio): reportar,
// eliminar, bloquear, etc. Reemplaza los dropdowns que antes se copiaban a mano en cada
// pantalla (PostCard, ProfileScreen) con los mismos estilos duplicados.
export const ContentActionsMenu: React.FC<Props> = ({ actions, iconName = 'more-horizontal', iconSize = 20 }) => {
  const [open, setOpen] = useState(false);

  if (actions.length === 0) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen((prev) => !prev)}>
        <Feather name={iconName} size={iconSize} color={theme.colors.textMuted} />
      </TouchableOpacity>

      {open && (
        <View style={styles.dropdownMenu}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.key}
              style={styles.dropdownItem}
              onPress={() => {
                setOpen(false);
                action.onPress();
              }}
            >
              <Feather
                name={action.icon}
                size={16}
                color={action.destructive ? theme.colors.error : theme.colors.text}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.dropdownItemText, action.destructive && { color: theme.colors.error }]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  trigger: {
    padding: 8,
  },
  dropdownMenu: {
    position: 'absolute',
    right: 0,
    top: 36,
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    zIndex: 1000,
    minWidth: 140,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dropdownItemText: {
    color: theme.colors.text,
    fontSize: 14,
  },
});
