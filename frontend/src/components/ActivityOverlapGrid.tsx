import React, { useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { ActivityRecord } from '../services/activityService';

interface ActivityOverlapGridProps {
  activities: ActivityRecord[];
  onActivityPress: (activity: ActivityRecord) => void;
  selectedDateText?: string;
}

// Convertir hora "HH:mm" a minutos transcurridos desde las 08:00 AM
const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10) || 0;
  const mins = parseInt(parts[1], 10) || 0;

  // Tratar 00:00 como 24:00
  const normalizedHours = hours === 0 ? 24 : hours;
  const minutesFrom8AM = (normalizedHours - 8) * 60 + mins;
  return Math.max(0, Math.min(16 * 60, minutesFrom8AM)); // Clampeado entre 8am (0) y 24am (960 min)
};

interface PositionedActivity {
  activity: ActivityRecord;
  top: number;
  height: number;
  colIndex: number;
  totalCols: number;
}

export const ActivityOverlapGrid: React.FC<ActivityOverlapGridProps> = ({
  activities,
  onActivityPress,
  selectedDateText,
}) => {
  const { width } = useWindowDimensions();
  const HOUR_HEIGHT = 60; // 60px por hora
  const TOTAL_HOURS = 16; // 8:00 AM a 24:00 (16 horas)
  const CANVAS_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT; // 960px

  const hoursList = useMemo(() => {
    const list = [];
    for (let h = 8; h <= 24; h++) {
      const displayHour = h === 24 ? '00:00' : `${h < 10 ? '0' : ''}${h}:00`;
      list.push(displayHour);
    }
    return list;
  }, []);

  // Algoritmo de resolución de solapamiento de actividades
  const positionedActivities = useMemo(() => {
    if (!activities || activities.length === 0) return [];

    // 1. Convertir a minutos e intervalo [startMin, endMin]
    const items = activities.map(act => {
      const startMin = timeToMinutes(act.start_time);
      let endMin = timeToMinutes(act.end_time);
      if (endMin <= startMin) endMin = startMin + 60; // Mínimo 1 hora de duración si es inválido
      const durationMin = endMin - startMin;

      const top = (startMin / 60) * HOUR_HEIGHT;
      const height = Math.max(36, (durationMin / 60) * HOUR_HEIGHT);

      return {
        activity: act,
        startMin,
        endMin,
        top,
        height,
      };
    });

    // Ordenar por hora de inicio
    items.sort((a, b) => a.startMin - b.startMin || (b.endMin - b.startMin) - (a.endMin - a.startMin));

    // 2. Agrupar eventos que se solapan horizontalmente
    const groups: (typeof items)[] = [];
    let currentGroup: typeof items = [];
    let maxEnd = -1;

    for (const item of items) {
      if (currentGroup.length === 0) {
        currentGroup.push(item);
        maxEnd = item.endMin;
      } else if (item.startMin < maxEnd) {
        currentGroup.push(item);
        if (item.endMin > maxEnd) maxEnd = item.endMin;
      } else {
        groups.push(currentGroup);
        currentGroup = [item];
        maxEnd = item.endMin;
      }
    }
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    // 3. Asignar columnas dentro de cada grupo solapado
    const result: PositionedActivity[] = [];

    for (const group of groups) {
      const columns: (typeof items)[] = [];

      for (const item of group) {
        let placed = false;
        for (let colIdx = 0; colIdx < columns.length; colIdx++) {
          const lastInCol = columns[colIdx][columns[colIdx].length - 1];
          if (lastInCol.endMin <= item.startMin) {
            columns[colIdx].push(item);
            (item as any).colIndex = colIdx;
            placed = true;
            break;
          }
        }
        if (!placed) {
          (item as any).colIndex = columns.length;
          columns.push([item]);
        }
      }

      const totalCols = columns.length;
      for (const item of group) {
        result.push({
          activity: item.activity,
          top: item.top,
          height: item.height,
          colIndex: (item as any).colIndex || 0,
          totalCols,
        });
      }
    }

    return result;
  }, [activities, HOUR_HEIGHT]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {!!selectedDateText && (
        <View style={styles.dateHeader}>
          <Feather name="calendar" size={14} color={theme.colors.accent} />
          <Text style={styles.dateHeaderText}>{selectedDateText}</Text>
        </View>
      )}

      <View style={styles.gridCanvasContainer}>
        {/* Columna Izquierda: Horas (08:00 - 00:00) */}
        <View style={styles.hoursColumn}>
          {hoursList.map((hour, idx) => (
            <View key={hour + idx} style={[styles.hourLabelBox, { height: HOUR_HEIGHT }]}>
              <Text style={styles.hourLabelText}>{hour}</Text>
            </View>
          ))}
        </View>

        {/* Lienzo Principal de Horarios */}
        <View style={[styles.eventsCanvas, { height: CANVAS_HEIGHT }]}>
          {/* Líneas horizontales de fondo cada hora */}
          {hoursList.slice(0, -1).map((hour, idx) => (
            <View
              key={'line-' + hour}
              style={[
                styles.gridLine,
                { top: idx * HOUR_HEIGHT }
              ]}
            />
          ))}

          {/* Si no hay actividades para este día */}
          {activities.length === 0 && (
            <View style={styles.emptyStateOverlay}>
              <Feather name="calendar" size={32} color="#333333" />
              <Text style={styles.emptyStateText}>Sin actividades programadas para este día</Text>
            </View>
          )}

          {/* Tarjetas Posicionadas con Resolución de Solapamientos */}
          {positionedActivities.map(({ activity, top, height, colIndex, totalCols }) => {
            const widthPct = 100 / totalCols;
            const leftPct = colIndex * widthPct;
            const org = activity.expand?.organization;
            const chipColor = org?.chip_color || '#38bdf8';

            return (
              <TouchableOpacity
                key={activity.id}
                activeOpacity={0.85}
                onPress={() => onActivityPress(activity)}
                style={[
                  styles.eventCard,
                  {
                    top,
                    height: height - 2, // Margen vertical de 2px
                    left: `${leftPct}%`,
                    width: `${widthPct - 1}%`, // Margen horizontal de 1%
                    borderLeftColor: chipColor,
                  }
                ]}
              >
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTimeText} numberOfLines={1}>
                    {activity.start_time} - {activity.end_time}
                  </Text>
                  {!!activity.category && (
                    <Text style={styles.cardCategoryTag} numberOfLines={1}>
                      {activity.category}
                    </Text>
                  )}
                </View>

                <Text style={styles.cardTitle} numberOfLines={height < 50 ? 1 : 2}>
                  {activity.title}
                </Text>

                {height >= 55 && (
                  <View style={styles.cardFooterRow}>
                    <Text style={styles.cardLocationText} numberOfLines={1}>
                      📍 {activity.location}
                    </Text>
                    {!!org && (
                      <Text style={styles.cardOrgText} numberOfLines={1}>
                        @{org.username || org.name}
                      </Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0c0c0c',
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  dateHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'capitalize',
  },
  gridCanvasContainer: {
    flexDirection: 'row',
    marginTop: 8,
    paddingRight: 10,
  },
  hoursColumn: {
    width: 52,
    alignItems: 'center',
  },
  hourLabelBox: {
    justifyContent: 'flex-start',
    paddingTop: 0,
  },
  hourLabelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666666',
    fontFamily: 'monospace',
  },
  eventsCanvas: {
    flex: 1,
    position: 'relative',
    borderLeftWidth: 1,
    borderLeftColor: '#1f1f1f',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#171717',
  },
  emptyStateOverlay: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyStateText: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '500',
  },
  eventCard: {
    position: 'absolute',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#262626',
    borderLeftWidth: 4,
    borderRadius: 6,
    padding: 6,
    overflow: 'hidden',
    zIndex: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
    gap: 4,
  },
  cardTimeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.accent,
  },
  cardCategoryTag: {
    fontSize: 9,
    fontWeight: '700',
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 15,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: 2,
    gap: 4,
  },
  cardLocationText: {
    fontSize: 10,
    color: '#a3a3a3',
    flex: 1,
  },
  cardOrgText: {
    fontSize: 10,
    color: '#888888',
    fontWeight: '600',
  },
});
