import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';

// Paginación incremental en el cliente para listas que ya están cargadas en memoria
// pero son demasiado largas para pintarlas de una: una liga acumula todos sus partidos
// para siempre, así que la vista arrancaba montando cientos de filas de golpe.
//
// No pagina la CONSULTA (los datos ya vinieron, y se necesitan completos para la tabla
// de posiciones y la de goleadores): lo que acota es cuánto se renderiza. Cada "cargar
// más" suma otra tanda sin volver a pedir nada al servidor.
export function usePagedList<T>(items: T[], pageSize = 12) {
  const [visibleCount, setVisibleCount] = useState(pageSize);

  // Se vuelve a la primera tanda cuando cambia la CANTIDAD de elementos (un refresh
  // trajo partidos nuevos, se cambió de filtro), no cuando cambia la referencia del
  // arreglo: la vista de liga reordena la lista cada 20 s para refrescar el minuto de
  // los partidos en vivo, y con `items` como dependencia eso colapsaba solo lo que la
  // persona acababa de expandir.
  useEffect(() => {
    setVisibleCount(pageSize);
  }, [items.length, pageSize]);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => prev + pageSize);
  }, [pageSize]);

  const visible = items.slice(0, visibleCount);
  const remaining = Math.max(0, items.length - visible.length);

  return { visible, remaining, hasMore: remaining > 0, loadMore };
}

interface LoadMoreButtonProps {
  /** Cuántos elementos quedan por mostrar. Si es 0, no se renderiza nada. */
  remaining: number;
  onPress: () => void;
  /** Sustantivo en plural para el contador, ej. "partidos". */
  label?: string;
}

// Discreto a propósito: sin fondo ni borde, alineado al centro y en color apagado —
// es un control de "hay más abajo", no una acción principal que compita con las filas.
export const LoadMoreButton: React.FC<LoadMoreButtonProps> = ({ remaining, onPress, label }) => {
  if (remaining <= 0) return null;

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.6}>
        <Text style={styles.text}>
          Cargar más{label ? ` ${label}` : ''} ({remaining})
        </Text>
        <Feather name="chevron-down" size={14} color={theme.colors.textMuted} style={{ marginLeft: 4 }} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  text: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
