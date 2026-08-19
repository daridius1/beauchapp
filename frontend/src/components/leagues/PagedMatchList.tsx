import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { theme } from '../../theme/theme';
import { LeagueMatchRow, LeagueMatchRowData, LiveMatchInfo } from './LeagueMatchRow';
import { LoadMoreButton, usePagedList } from '../LoadMoreButton';

interface PagedMatchListProps {
  matches: LeagueMatchRowData[];
  liveInfoByMatch?: Record<string, LiveMatchInfo>;
  onPressMatch: (matchId: string) => void;
  /** Texto cuando no hay ningún partido. */
  emptyText: string;
  /** Oculta el nombre de la etapa en cada fila (útil dentro de una etapa). */
  hideStage?: boolean;
  /** Cuántos partidos por tanda. */
  pageSize?: number;
}

// Listado de partidos con carga incremental. Se usa en cualquier vista donde la lista
// pueda crecer sin techo (una liga acumula todos sus partidos; un equipo, todos los que
// jugó), en vez de montar cientos de filas de una sola vez.
//
// Existe como componente y no como código suelto en cada pantalla porque la vista de
// etapas necesita una lista independiente POR etapa, y un hook no se puede llamar
// dentro de un .map().
export const PagedMatchList: React.FC<PagedMatchListProps> = ({
  matches,
  liveInfoByMatch,
  onPressMatch,
  emptyText,
  hideStage,
  pageSize = 12,
}) => {
  const { visible, remaining, loadMore } = usePagedList(matches, pageSize);

  if (matches.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <>
      {visible.map((m, idx) => (
        <LeagueMatchRow
          key={m.id}
          match={m}
          live={liveInfoByMatch?.[m.id]}
          // "Última" es la última VISIBLE: si todavía quedan por cargar, la fila de
          // abajo mantiene su separador para que no parezca el final de la lista.
          isLast={remaining === 0 && idx === visible.length - 1}
          hideStage={hideStage}
          onPress={() => onPressMatch(m.id)}
        />
      ))}
      <LoadMoreButton remaining={remaining} onPress={loadMore} label="partidos" />
    </>
  );
};

const styles = StyleSheet.create({
  emptyContainer: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
});
