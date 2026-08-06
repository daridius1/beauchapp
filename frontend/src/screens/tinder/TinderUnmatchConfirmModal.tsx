import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { styles } from './TinderScreen.styles';

interface TinderUnmatchConfirmModalProps {
  selectedMatch: any;
  onCancel: () => void;
  onConfirm: () => void;
}

export const TinderUnmatchConfirmModal: React.FC<TinderUnmatchConfirmModalProps> = ({
  selectedMatch,
  onCancel,
  onConfirm,
}) => {
  return (
    <View style={styles.modalOverlay}>
      <View style={styles.confirmModalCard}>
        <View style={styles.confirmModalHeader}>
          <Feather name="alert-triangle" size={22} color={theme.colors.error} style={{ marginRight: 8 }} />
          <Text style={styles.confirmModalTitle}>Deshacer Match</Text>
        </View>

        <Text style={styles.confirmModalDesc}>
          ¿Estás seguro de que deseas deshacer tu match con <Text style={{ fontWeight: '700', color: theme.colors.text }}>{selectedMatch.user?.name}</Text>?
          {"\n\n"}
          Ambos dejarán de ver sus datos de contacto en redes sociales de inmediato.
        </Text>

        <View style={styles.confirmModalActions}>
          <TouchableOpacity
            style={[styles.confirmModalBtn, styles.confirmModalBtnCancel]}
            onPress={onCancel}
          >
            <Text style={styles.confirmModalBtnTextCancel}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.confirmModalBtn, styles.confirmModalBtnConfirm]}
            onPress={onConfirm}
          >
            <Text style={styles.confirmModalBtnTextConfirm}>Deshacer Match</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
