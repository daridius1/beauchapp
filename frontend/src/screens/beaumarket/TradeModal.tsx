import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../theme/theme';

interface TradeModalProps {
  visible: boolean;
  outcomeLabel: string | null;
  outcomeIndex: number | null;
  balance: number;
  submitting: boolean;
  error: string | null;
  onBet: (amount: number) => void;
  onClose: () => void;
}

// Apostar es la única operación posible — las apuestas son definitivas, no hay forma de
// retirarlas (ver comentario de cabecera en beaumarket.pb.js). El modal solo muestra lo
// que se va a apostar (el monto que se escribe) y lo que hay disponible para apostar (el
// saldo) — nada de previsualizaciones de pozo ni de cuánto se ganaría: eso depende de lo
// que apueste todavía el resto antes de que cierre el mercado, así que no es un número
// que se pueda prometer de buena fe hasta resolver (ver "tus apuestas" en OddsChart, que
// sí muestra esa proyección — pero solo ahí, nunca acá).
export const TradeModal: React.FC<TradeModalProps> = ({
  visible,
  outcomeLabel,
  outcomeIndex,
  balance,
  submitting,
  error,
  onBet,
  onClose,
}) => {
  const [amount, setAmount] = useState('');

  // Se queda con el último label real: al cerrar, el padre manda outcomeIndex=null de
  // inmediato pero el Modal (animationType="fade") tarda un instante en desaparecer de la
  // vista — sin esto, se alcanzaba a ver el título en blanco durante ese instante de la
  // animación de salida.
  const [displayLabel, setDisplayLabel] = useState<string | null>(outcomeLabel);

  useEffect(() => {
    if (outcomeIndex !== null) setDisplayLabel(outcomeLabel);
  }, [outcomeLabel, outcomeIndex]);

  // Limpia el monto cada vez que se abre para un resultado nuevo.
  useEffect(() => {
    if (visible) setAmount('');
  }, [visible]);

  // Limpia el monto después de una operación exitosa (submitting pasó de true a false
  // sin error) — el modal se queda abierto, listo para la próxima.
  const wasSubmitting = useRef(false);
  useEffect(() => {
    if (wasSubmitting.current && !submitting && !error) setAmount('');
    wasSubmitting.current = submitting;
  }, [submitting, error]);

  const parsedAmount = parseInt(amount, 10);
  const isValid = Number.isInteger(parsedAmount) && parsedAmount > 0 && parsedAmount <= balance;

  const handleConfirm = () => {
    if (!isValid) return;
    onBet(parsedAmount);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          <View style={styles.iconContainer}>
            <Feather name="trending-up" size={22} color="#ffffff" />
          </View>

          <Text style={styles.title}>"{displayLabel}"</Text>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TextInput
            style={styles.input}
            placeholder="Monto a apostar"
            placeholderTextColor={theme.colors.textMuted}
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            autoFocus
          />

          <Text style={styles.hint}>Tienes {balance} ℬ disponibles.</Text>

          <TouchableOpacity
            style={[styles.actionBtn, (!isValid || submitting) && styles.actionBtnDisabled]}
            activeOpacity={0.7}
            onPress={handleConfirm}
            disabled={!isValid || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <Text style={styles.actionBtnText}>Apostar</Text>
            )}
          </TouchableOpacity>

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
    maxWidth: 360,
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
  input: {
    width: '100%',
    height: 44,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: theme.colors.text,
    fontSize: 15,
    marginBottom: theme.spacing.sm,
  },
  hint: {
    width: '100%',
    color: theme.colors.textMuted,
    fontSize: 12,
    marginBottom: theme.spacing.xs,
  },
  error: {
    color: theme.colors.error,
    fontSize: 13,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  actionBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.xs,
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  actionBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
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
    marginTop: theme.spacing.md,
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
