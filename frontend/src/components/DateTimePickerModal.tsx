import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';

interface DateTimePickerModalProps {
  visible: boolean;
  mode: 'date' | 'time';
  title?: string;
  value: string; // YYYY-MM-DD for date, HH:mm for time
  onConfirm: (selectedVal: string) => void;
  onClose: () => void;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAY_NAMES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

// Horas desde las 08:00 AM hasta las 23:00 PM
const HOURS = Array.from({ length: 16 }, (_, i) => String(i + 8).padStart(2, '0'));
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

export const DateTimePickerModal: React.FC<DateTimePickerModalProps> = ({
  visible,
  mode,
  title,
  value,
  onConfirm,
  onClose,
}) => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  // Estado para Fecha (Año, Mes, Día)
  const now = new Date();
  const [currentYear, setCurrentYear] = useState<number>(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(now.getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(value || now.toISOString().split('T')[0]);

  // Estado para Hora (HH, mm)
  const initialTimeParts = (value && value.includes(':')) ? value.split(':') : ['14', '00'];
  const rawH = parseInt(initialTimeParts[0] || '14', 10);
  const safeH = isNaN(rawH) || rawH < 8 ? '08' : String(Math.min(23, rawH)).padStart(2, '0');
  const [selectedHour, setSelectedHour] = useState<string>(safeH);
  const [selectedMinute, setSelectedMinute] = useState<string>(initialTimeParts[1] || '00');

  useEffect(() => {
    if (visible) {
      if (mode === 'date' && value && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [y, m, d] = value.split('-').map(Number);
        setCurrentYear(y);
        setCurrentMonth(m - 1);
        setSelectedDateStr(value);
      } else if (mode === 'time' && value && value.includes(':')) {
        const [h, min] = value.split(':');
        setSelectedHour(h.padStart(2, '0'));
        setSelectedMinute(min.padStart(2, '0'));
      }
    }
  }, [visible, mode, value]);

  // Manejo de cambio de mes en el calendario
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  // Generar días del mes para el calendario
  const getDaysInMonth = (year: number, month: number) => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDayIndex, daysInMonth };
  };

  const handleConfirmDate = () => {
    onConfirm(selectedDateStr);
    onClose();
  };

  const handleConfirmTime = () => {
    onConfirm(`${selectedHour}:${selectedMinute}`);
    onClose();
  };

  const renderCalendar = () => {
    const { firstDayIndex, daysInMonth } = getDaysInMonth(currentYear, currentMonth);
    const blanks = Array.from({ length: firstDayIndex }, (_, i) => i);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
      <View style={styles.calendarContainer}>
        {/* Encabezado del Mes y Año */}
        <View style={styles.monthHeader}>
          <TouchableOpacity style={styles.monthNavBtn} onPress={handlePrevMonth}>
            <Feather name="chevron-left" size={20} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.monthTitleText}>
            {MONTH_NAMES[currentMonth]} {currentYear}
          </Text>
          <TouchableOpacity style={styles.monthNavBtn} onPress={handleNextMonth}>
            <Feather name="chevron-right" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Nombres de los Días de la Semana */}
        <View style={styles.weekRow}>
          {DAY_NAMES.map((d, i) => (
            <Text key={i} style={styles.weekDayText}>{d}</Text>
          ))}
        </View>

        {/* Grilla de Días */}
        <View style={styles.daysGrid}>
          {blanks.map(b => (
            <View key={`b-${b}`} style={styles.dayCellEmpty} />
          ))}
          {days.map(day => {
            const mStr = String(currentMonth + 1).padStart(2, '0');
            const dStr = String(day).padStart(2, '0');
            const iso = `${currentYear}-${mStr}-${dStr}`;
            const isSelected = iso === selectedDateStr;

            return (
              <TouchableOpacity
                key={day}
                style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                onPress={() => setSelectedDateStr(iso)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayCellText, isSelected && styles.dayCellTextSelected]}>
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Botón de Confirmación de Fecha */}
        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmDate}>
          <Text style={styles.confirmBtnText}>Confirmar Fecha ({selectedDateStr})</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderTimePicker = () => {
    return (
      <View style={styles.timePickerContainer}>
        <Text style={styles.timePreviewText}>
          {selectedHour}:{selectedMinute} hrs
        </Text>

        <View style={styles.timeColumnsRow}>
          {/* Columna de Horas */}
          <View style={{ flex: 1 }}>
            <Text style={styles.timeColumnHeader}>Hora</Text>
            <ScrollView style={styles.timeScrollView} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {HOURS.map(h => {
                const isSelected = h === selectedHour;
                return (
                  <TouchableOpacity
                    key={h}
                    style={[styles.timeItem, isSelected && styles.timeItemSelected]}
                    onPress={() => setSelectedHour(h)}
                  >
                    <Text style={[styles.timeItemText, isSelected && styles.timeItemTextSelected]}>
                      {h} h
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Separador */}
          <View style={styles.timeColumnDivider} />

          {/* Columna de Minutos */}
          <View style={{ flex: 1 }}>
            <Text style={styles.timeColumnHeader}>Minuto</Text>
            <ScrollView style={styles.timeScrollView} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {MINUTES.map(m => {
                const isSelected = m === selectedMinute;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.timeItem, isSelected && styles.timeItemSelected]}
                    onPress={() => setSelectedMinute(m)}
                  >
                    <Text style={[styles.timeItemText, isSelected && styles.timeItemTextSelected]}>
                      {m} min
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* Botón de Confirmación de Hora */}
        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmTime}>
          <Text style={styles.confirmBtnText}>Confirmar Hora ({selectedHour}:{selectedMinute})</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, isDesktop && styles.overlayDesktop]}>
        <Pressable style={styles.dismissArea} onPress={onClose} />

        <View style={[styles.content, isDesktop && styles.contentDesktop]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name={mode === 'date' ? 'calendar' : 'clock'} size={18} color="#ffffff" />
              <Text style={styles.headerTitle}>
                {title || (mode === 'date' ? 'Seleccionar Fecha' : 'Seleccionar Hora')}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Cuerpo */}
          {mode === 'date' ? renderCalendar() : renderTimePicker()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  overlayDesktop: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dismissArea: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
  content: {
    backgroundColor: '#0c0c0c',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: '#262626',
    borderBottomWidth: 0,
    padding: 16,
  },
  contentDesktop: {
    width: 420,
    borderRadius: 16,
    borderBottomWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  // Estilos del Calendario
  calendarContainer: {
    paddingBottom: 8,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  monthNavBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#262626',
  },
  monthTitleText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  weekDayText: {
    width: 40,
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  dayCellEmpty: {
    width: '14.28%',
    height: 40,
  },
  dayCell: {
    width: '14.28%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  dayCellSelected: {
    backgroundColor: '#ffffff',
  },
  dayCellText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  dayCellTextSelected: {
    color: '#000000',
    fontWeight: '800',
  },
  // Estilos del Time Picker
  timePickerContainer: {
    paddingBottom: 8,
  },
  timePreviewText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  timeColumnsRow: {
    flexDirection: 'row',
    height: 200,
    marginBottom: 16,
    backgroundColor: '#121212',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#262626',
    padding: 8,
  },
  timeColumnHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  timeColumnDivider: {
    width: 1,
    backgroundColor: '#262626',
    marginHorizontal: 4,
  },
  timeScrollView: {
    flex: 1,
  },
  timeItem: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
    marginBottom: 4,
  },
  timeItemSelected: {
    backgroundColor: '#ffffff',
  },
  timeItemText: {
    color: '#888888',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  timeItemTextSelected: {
    color: '#000000',
    fontWeight: '800',
  },
  confirmBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  confirmBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
});
