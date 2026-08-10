import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, DeviceEventEmitter } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { ActivityRecord, activityService } from '../services/activityService';
import { ActivityCard } from '../components/ActivityCard';
import { ActivityOverlapGrid } from '../components/ActivityOverlapGrid';
import { withMinimumDelay } from '../utils/refresh';
import { toLocalDateStr } from '../utils/date';

export const ActivitiesScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'following' | 'all'>('following');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);

  // Fecha seleccionada en el calendario (Formato YYYY-MM-DD)
  const todayStr = toLocalDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Offset de semanas (0 = semana actual que inicia HOY, 1 = semana siguiente, -1 = semana anterior)
  const [weekOffset, setWeekOffset] = useState<number>(0);

  // Generar bloque semanal de 7 días iniciando desde (Hoy + weekOffset * 7)
  const visibleDays = React.useMemo(() => {
    const list = [];
    const base = new Date();
    const startDate = new Date(base);
    startDate.setDate(base.getDate() + weekOffset * 7);

    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const iso = toLocalDateStr(d);
      const dayName = d.toLocaleDateString('es-CL', { weekday: 'short' });
      const dayNum = d.getDate();
      const monthName = d.toLocaleDateString('es-CL', { month: 'long' });
      const shortMonthName = d.toLocaleDateString('es-CL', { month: 'short' });
      list.push({ iso, dayName, dayNum, monthName, shortMonthName });
    }
    return list;
  }, [weekOffset]);

  // Etiqueta del mes o meses que componen la semana visible (ej: "Julio / Agosto" o "Agosto")
  const currentWeekMonthLabel = React.useMemo(() => {
    if (visibleDays.length === 0) return '';
    const firstMonth = visibleDays[0].monthName;
    const lastMonth = visibleDays[visibleDays.length - 1].monthName;

    const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

    if (firstMonth.toLowerCase() === lastMonth.toLowerCase()) {
      return capitalize(firstMonth);
    }
    return `${capitalize(firstMonth)} / ${capitalize(lastMonth)}`;
  }, [visibleDays]);

  const handlePrevWeek = () => {
    const newOffset = weekOffset - 1;
    setWeekOffset(newOffset);
    const base = new Date();
    const startDate = new Date(base);
    startDate.setDate(base.getDate() + newOffset * 7);
    setSelectedDate(toLocalDateStr(startDate));
  };

  const handleNextWeek = () => {
    const newOffset = weekOffset + 1;
    setWeekOffset(newOffset);
    const base = new Date();
    const startDate = new Date(base);
    startDate.setDate(base.getDate() + newOffset * 7);
    setSelectedDate(toLocalDateStr(startDate));
  };

  const fetchActivities = async (hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);
      const data = await activityService.getActivities(activeTab, user?.id);
      setActivities(data);
    } catch (err) {
      console.error('Error al cargar actividades:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [activeTab, user?.id]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await withMinimumDelay(() => fetchActivities(true));
      setLoading(false);
    });
    return () => sub.remove();
  }, [activeTab, user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await withMinimumDelay(() => fetchActivities(true));
    setRefreshing(false);
  }, [activeTab, user?.id]);

  // Filtrar actividades por el día seleccionado para la vista de Calendario
  const dayActivities = React.useMemo(() => {
    return activities.filter(act => act.date === selectedDate);
  }, [activities, selectedDate]);

  // Set de fechas con al menos 1 actividad para pintar el punto indicador
  const datesWithEvents = React.useMemo(() => {
    const set = new Set<string>();
    activities.forEach(act => {
      if (act.date) set.add(act.date);
    });
    return set;
  }, [activities]);

  const isOrganization = user?.type === 'organization';

  return (
    <View style={styles.container}>
      {/* Cabecera Superior con Pestañas Siguiendo / Todas */}
      <View style={styles.tabHeaderContainer}>
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'following' && styles.tabButtonActive]}
            onPress={() => setActiveTab('following')}
          >
            <Feather
              name="users"
              size={14}
              color={activeTab === 'following' ? theme.colors.primary : theme.colors.textMuted}
            />
            <Text style={[styles.tabText, activeTab === 'following' && styles.tabTextActive]}>
              Siguiendo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'all' && styles.tabButtonActive]}
            onPress={() => setActiveTab('all')}
          >
            <Feather
              name="globe"
              size={14}
              color={activeTab === 'all' ? theme.colors.primary : theme.colors.textMuted}
            />
            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
              Todas
            </Text>
          </TouchableOpacity>
        </View>

        {/* Switcher de Vistas: Calendario / Lista */}
        <View style={styles.viewModeRow}>
          <TouchableOpacity
            style={[styles.viewModeBtn, viewMode === 'calendar' && styles.viewModeBtnActive]}
            onPress={() => setViewMode('calendar')}
          >
            <Feather
              name="calendar"
              size={14}
              color={viewMode === 'calendar' ? '#000000' : theme.colors.textMuted}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.viewModeBtn, viewMode === 'list' && styles.viewModeBtnActive]}
            onPress={() => setViewMode('list')}
          >
            <Feather
              name="list"
              size={14}
              color={viewMode === 'list' ? '#000000' : theme.colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Selector Semanal de Días (para vista Calendario con mes arriba y cartas auto-ajustadas) */}
      {viewMode === 'calendar' && (
        <View style={styles.dateSelectorWrapper}>
          {/* Cabecera centrada con el Nombre del Mes/Meses y enlace "Ir a hoy" */}
          <View style={styles.monthHeaderRow}>
            <View style={styles.monthHeaderSide} />

            <Text style={styles.monthLabelText}>{currentWeekMonthLabel}</Text>

            <View style={styles.monthHeaderSide}>
              {weekOffset !== 0 && (
                <TouchableOpacity
                  style={styles.todayResetTextBtn}
                  onPress={() => {
                    setWeekOffset(0);
                    setSelectedDate(todayStr);
                  }}
                  activeOpacity={0.7}
                >
                  <Feather name="rotate-ccw" size={11} color={theme.colors.primary} />
                  <Text style={styles.todayResetText}>Hoy</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Fila del selector con 7 cartas expandidas + botones de navegación ◀️ / ▶️ */}
          <View style={styles.weekSelectorBar}>
            <TouchableOpacity
              style={styles.weekNavBtn}
              onPress={handlePrevWeek}
              activeOpacity={0.7}
            >
              <Feather name="chevron-left" size={18} color={theme.colors.text} />
            </TouchableOpacity>

            <View style={styles.daysRowContainer}>
              {visibleDays.map(item => {
                const isSelected = item.iso === selectedDate;
                const hasEvents = datesWithEvents.has(item.iso);

                return (
                  <TouchableOpacity
                    key={item.iso}
                    style={[styles.dateChip, isSelected && styles.dateChipSelected]}
                    onPress={() => setSelectedDate(item.iso)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dayNameText, isSelected && styles.dayNameSelected]}>
                      {item.dayName.toUpperCase().replace('.', '')}
                    </Text>
                    <Text style={[styles.dayNumText, isSelected && styles.dayNumSelected]}>
                      {item.dayNum}
                    </Text>
                    {hasEvents && (
                      <View style={[styles.eventDot, isSelected && styles.eventDotSelected]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.weekNavBtn}
              onPress={handleNextWeek}
              activeOpacity={0.7}
            >
              <Feather name="chevron-right" size={18} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Cuerpo Principal */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : viewMode === 'calendar' ? (
        <ActivityOverlapGrid
          activities={dayActivities}
          onActivityPress={(act) => navigation.navigate('ActivityDetail', { activityId: act.id })}
          selectedDateText={
            (() => {
              const found = visibleDays.find(d => d.iso === selectedDate);
              if (found) {
                return `${found.dayName}, ${found.dayNum} de ${found.monthName}`;
              }
              const d = new Date(selectedDate + 'T00:00:00');
              const dayName = d.toLocaleDateString('es-CL', { weekday: 'short' });
              const dayNum = d.getDate();
              const monthName = d.toLocaleDateString('es-CL', { month: 'long' });
              return `${dayName}, ${dayNum} de ${monthName}`;
            })()
          }
        />
      ) : (
        <FlatList
          data={activities}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
          }
          renderItem={({ item }) => (
            <ActivityCard
              activity={item}
              onPress={() => navigation.navigate('ActivityDetail', { activityId: item.id })}
              onOrgPress={(orgId) => navigation.navigate('UserProfile', { userId: orgId })}
              onPressAttendees={() => navigation.navigate('FollowList', { userId: item.id, type: 'attendees', title: 'Asistentes a la actividad' })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="calendar" size={40} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>No hay actividades disponibles</Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'following'
                  ? 'Sigue a más organizaciones para ver sus eventos aquí'
                  : 'Las organizaciones publicarán sus eventos próximamente'}
              </Text>
            </View>
          }
        />
      )}

      {/* Botón Flotante para Crear Actividad (Solo Organizaciones) */}
      {isOrganization && (
        <TouchableOpacity
          style={styles.fabButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('ActivityEditor')}
        >
          <Feather name="plus" size={24} color="#000000" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  tabHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0c0c0c',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#262626',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  viewModeRow: {
    flexDirection: 'row',
    backgroundColor: '#171717',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#262626',
  },
  viewModeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  viewModeBtnActive: {
    backgroundColor: theme.colors.primary,
  },
  dateSelectorWrapper: {
    backgroundColor: '#0c0c0c',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  monthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  monthHeaderSide: {
    minWidth: 50,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  monthLabelText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    flex: 1,
  },
  todayResetTextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  todayResetText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  weekSelectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  weekNavBtn: {
    width: 32,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysRowContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateChip: {
    flex: 1,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  dateChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  dayNameText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#888888',
    marginBottom: 2,
  },
  dayNameSelected: {
    color: '#000000',
  },
  dayNumText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  dayNumSelected: {
    color: '#000000',
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#38bdf8',
    marginTop: 3,
  },
  eventDotSelected: {
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
    maxWidth: 260,
  },
  fabButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
