import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, useWindowDimensions } from 'react-native';
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
//
// Se renderiza en un Modal (no como un View absoluto anidado adentro de la tarjeta) a
// propósito: cuando la tarjeta completa es a su vez un TouchableOpacity (ej. el feed de
// posts, que navega al detalle al tocar la tarjeta), un dropdown anidado con position:
// 'absolute' queda atrapado en el mismo árbol táctil/stacking context que esa tarjeta y de
// otras tarjetas del feed — en la práctica, los clics en el dropdown se vuelven poco
// confiables o directamente no llegan (reportado: "el botón de reportar es casi imposible
// de clickear en el feed"). Un Modal se monta en la raíz, fuera de ese árbol, así que no
// compite por el touch con nada de la lista.
export const ContentActionsMenu: React.FC<Props> = ({ actions, iconName = 'more-horizontal', iconSize = 20 }) => {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<any>(null);
  const { width: windowWidth } = useWindowDimensions();

  if (actions.length === 0) return null;

  const handleOpen = () => {
    if (!triggerRef.current) return;
    triggerRef.current.measure((_x: number, _y: number, width: number, height: number, pageX: number, pageY: number) => {
      setAnchor({ top: pageY + height + 4, right: Math.max(8, windowWidth - (pageX + width)) });
      setOpen(true);
    });
  };

  return (
    <>
      <TouchableOpacity ref={triggerRef} style={styles.trigger} onPress={handleOpen}>
        <Feather name={iconName} size={iconSize} color={theme.colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setOpen(false)} />
          {anchor && (
            <View style={[styles.dropdownMenu, { top: anchor.top, right: anchor.right }]}>
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
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  trigger: {
    padding: 8,
  },
  modalRoot: {
    flex: 1,
  },
  dropdownMenu: {
    position: 'absolute',
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
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
