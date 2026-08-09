import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { previewBuy, previewSell } from './lmsrPreview';

type TradeMode = 'buy' | 'sell';

interface TradeModalProps {
  visible: boolean;
  outcomeLabel: string | null;
  outcomeIndex: number | null;
  // Estado LMSR vigente del mercado — solo para la previsualización en vivo mientras se
  // escribe el monto; el cálculo real y definitivo de cuántas acciones se compran/venden
  // y a qué costo siempre lo hace el backend dentro de la transacción.
  q: number[];
  b: number;
  balance: number;
  heldShares: number;
  submitting: boolean;
  error: string | null;
  onBuy: (budgetPoints: number) => void;
  onSell: (shares: number) => void;
  onClose: () => void;
}

// Comprar y vender del mismo resultado viven en un solo modal, con un switch arriba —
// las dos vistas son equivalentes (mismo input, mismo botón, mismo layout) y solo
// cambian de significado según el modo elegido. Nada de botones especiales por modo
// (ej. "vender todo"): si algo existe en un modo, existe en el otro.
export const TradeModal: React.FC<TradeModalProps> = ({
  visible,
  outcomeLabel,
  outcomeIndex,
  q,
  b,
  balance,
  heldShares,
  submitting,
  error,
  onBuy,
  onSell,
  onClose,
}) => {
  const [mode, setMode] = useState<TradeMode>('buy');
  const [amount, setAmount] = useState('');

  // Se queda con los últimos valores reales: al cerrar, el padre manda outcomeIndex=null
  // de inmediato pero el Modal (animationType="fade") tarda un instante en desaparecer
  // de la vista — sin esto, se alcanzaba a ver el título/las acciones en blanco durante
  // ese instante de la animación de salida.
  const [displayLabel, setDisplayLabel] = useState<string | null>(outcomeLabel);
  const [displayIndex, setDisplayIndex] = useState<number | null>(outcomeIndex);
  const [displayHeldShares, setDisplayHeldShares] = useState(heldShares);

  useEffect(() => {
    if (outcomeIndex !== null) {
      setDisplayLabel(outcomeLabel);
      setDisplayIndex(outcomeIndex);
      setDisplayHeldShares(heldShares);
    }
  }, [outcomeLabel, outcomeIndex, heldShares]);

  // Si te quedaste sin acciones (ej. las vendiste todas), no te deja seguir en modo
  // "Vender" — vuelve a "Comprar" en vez de dejar el switch en un estado sin sentido.
  useEffect(() => {
    if (displayHeldShares <= 0 && mode === 'sell') setMode('buy');
  }, [displayHeldShares, mode]);

  // Limpia el monto cada vez que se abre para un resultado nuevo o se cambia de modo.
  useEffect(() => {
    if (visible) setAmount('');
  }, [visible, mode]);

  // Limpia el monto después de una operación exitosa (submitting pasó de true a false
  // sin error) — el modal se queda abierto, listo para la próxima.
  const wasSubmitting = useRef(false);
  useEffect(() => {
    if (wasSubmitting.current && !submitting && !error) setAmount('');
    wasSubmitting.current = submitting;
  }, [submitting, error]);

  const parsedAmount = parseInt(amount, 10);
  const maxAmount = mode === 'buy' ? balance : displayHeldShares;
  const isValid = Number.isInteger(parsedAmount) && parsedAmount > 0 && parsedAmount <= maxAmount;

  const buyPreview = useMemo(() => {
    if (mode !== 'buy' || !isValid || displayIndex === null || !q || q.length === 0) return null;
    return previewBuy(q, b, displayIndex, parsedAmount);
  }, [mode, isValid, displayIndex, q, b, parsedAmount]);

  const sellPreview = useMemo(() => {
    if (mode !== 'sell' || !isValid || displayIndex === null || !q || q.length === 0) return null;
    return previewSell(q, b, displayIndex, parsedAmount);
  }, [mode, isValid, displayIndex, q, b, parsedAmount]);

  const handleConfirm = () => {
    if (!isValid) return;
    if (mode === 'buy') onBuy(parsedAmount);
    else onSell(parsedAmount);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          <View style={styles.iconContainer}>
            <Feather name="repeat" size={22} color="#ffffff" />
          </View>

          <Text style={styles.title}>"{displayLabel}"</Text>

          <View style={styles.switchRow}>
            <TouchableOpacity
              style={[styles.switchBtn, mode === 'buy' && styles.switchBtnActive]}
              activeOpacity={0.7}
              onPress={() => setMode('buy')}
            >
              <Text style={[styles.switchBtnText, mode === 'buy' && styles.switchBtnTextActive]}>Comprar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.switchBtn, mode === 'sell' && styles.switchBtnActive, displayHeldShares <= 0 && styles.switchBtnDisabled]}
              activeOpacity={0.7}
              onPress={() => displayHeldShares > 0 && setMode('sell')}
              disabled={displayHeldShares <= 0}
            >
              <Text style={[styles.switchBtnText, mode === 'sell' && styles.switchBtnTextActive]}>Vender</Text>
            </TouchableOpacity>
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TextInput
            style={styles.input}
            placeholder={mode === 'buy' ? 'Monto a gastar' : 'Cantidad de acciones'}
            placeholderTextColor={theme.colors.textMuted}
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            autoFocus
          />

          {mode === 'buy' && buyPreview && buyPreview.shares > 0 && (
            <Text style={styles.hint}>
              ≈ {buyPreview.shares} acciones · precio pasaría a {buyPreview.priceAfterPct.toFixed(1)}%
            </Text>
          )}
          {mode === 'sell' && sellPreview && (
            <Text style={styles.hint}>
              ≈ recibirías {sellPreview.proceeds} ℬ · precio pasaría a {sellPreview.priceAfterPct.toFixed(1)}%
            </Text>
          )}

          <Text style={styles.hint}>
            {mode === 'buy' ? `Tienes ${balance} ℬ disponibles.` : `Tienes ${displayHeldShares} acciones de este resultado.`}
          </Text>

          <TouchableOpacity
            style={[styles.actionBtn, (!isValid || submitting) && styles.actionBtnDisabled]}
            activeOpacity={0.7}
            onPress={handleConfirm}
            disabled={!isValid || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <Text style={styles.actionBtnText}>{mode === 'buy' ? 'Comprar' : 'Vender'}</Text>
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
  switchRow: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#161616',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#262626',
    padding: 3,
    marginBottom: theme.spacing.md,
  },
  switchBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchBtnActive: {
    backgroundColor: '#ffffff',
  },
  switchBtnDisabled: {
    opacity: 0.35,
  },
  switchBtnText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  switchBtnTextActive: {
    color: '#000000',
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
