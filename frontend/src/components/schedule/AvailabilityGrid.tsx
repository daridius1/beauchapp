import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../theme/theme';

export const START_HOUR = 9;
export const END_HOUR = 19;
const WEEKS_WINDOW = 3;

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTH_LABELS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Nivel 1 (peor) a 4 (mejor) — no existe un valor especial de "no disponible", una
// disponibilidad muy mala es simplemente el extremo inferior de esta misma escala.
export const LEVEL_LABELS: Record<number, string> = { 1: 'Mala', 2: 'Regular', 3: 'Buena', 4: 'Excelente' };
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 4;

// Gradiente rojo -> ámbar -> lima -> verde, más explicativo que la opacidad monocroma
// anterior: el color solo comunica qué tan buena es la disponibilidad de un vistazo.
const LEVEL_COLORS: Record<number, string> = {
  1: '#ef4444',
  2: '#f59e0b',
  3: '#a3e635',
  4: '#22c55e',
};
const LEVEL_TEXT_COLORS: Record<number, string> = {
  1: '#ffffff',
  2: '#000000',
  3: '#000000',
  4: '#000000',
};

const BLOCKED_BG = '#26262a';
const BLOCKED_LABEL = 'Bloqueado por el admin';
const OCCUPIED_BG = '#1e3a5f';
const OCCUPIED_LABEL = 'Ocupado por un partido';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDateStr(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// Lunes de la semana que contiene `date` — misma regla que backend/pb_hooks/lib/teamSchedule.js
// (duplicada a propósito: son runtimes distintos, igual que el resto de helpers de
// fecha/bloque que ya se duplican entre el panel admin y el hook del servidor).
function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay(); // 0 (dom) .. 6 (sáb)
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

export function blockCode(dateStr: string, hour: number): string {
  return `${dateStr}-${pad2(hour)}`;
}

export function hourLabel(hour: number): string {
  return `${pad2(hour)}:00`;
}

interface WeekDay {
  dateStr: string;
  dayOfMonth: number;
  dayLabel: string;
}

interface WeekInfo {
  label: string;
  days: WeekDay[];
}

// Ventana móvil de `weeks` semanas (la que contiene `referenceDate` + las siguientes),
// siempre empezando un lunes — es lo único que reemplaza al concepto de "ronda": no
// hay nada que un admin tenga que abrir antes, la ventana marcable es siempre relativa
// a hoy.
export function getScheduleWindow(referenceDate: Date = new Date(), weeks: number = WEEKS_WINDOW): WeekInfo[] {
  const start = startOfWeek(referenceDate);
  const result: WeekInfo[] = [];
  for (let w = 0; w < weeks; w++) {
    const days: WeekDay[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(day.getDate() + w * 7 + d);
      days.push({ dateStr: formatDateStr(day), dayOfMonth: day.getDate(), dayLabel: DAY_LABELS[d] });
    }
    result.push({ label: weekRangeLabel(days), days });
  }
  return result;
}

function weekRangeLabel(days: WeekDay[]): string {
  const first = days[0];
  const last = days[6];
  const firstMonthIdx = Number(first.dateStr.split('-')[1]) - 1;
  const lastMonthIdx = Number(last.dateStr.split('-')[1]) - 1;
  if (firstMonthIdx === lastMonthIdx) {
    return `${first.dayOfMonth} al ${last.dayOfMonth} de ${MONTH_LABELS[firstMonthIdx]}`;
  }
  return `${first.dayOfMonth} ${MONTH_LABELS[firstMonthIdx]} al ${last.dayOfMonth} ${MONTH_LABELS[lastMonthIdx]}`;
}

// Todos los block codes válidos para la ventana actual — usado para saber qué claves
// debe tener `happiness` al guardar.
export function scheduleWindowBlockCodes(referenceDate: Date = new Date(), weeks: number = WEEKS_WINDOW): string[] {
  const codes: string[] = [];
  getScheduleWindow(referenceDate, weeks).forEach((week) => {
    week.days.forEach((day) => {
      for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
        codes.push(blockCode(day.dateStr, hour));
      }
    });
  });
  return codes;
}

// Explicación de qué significa cada color — pensado para mostrarse ANTES de la
// grilla, no como referencia al final.
export const ScheduleLegend: React.FC = () => (
  <View style={styles.legend}>
    {([1, 2, 3, 4] as const).map((level) => (
      <View key={level} style={styles.legendItem}>
        <View style={[styles.legendSwatch, { backgroundColor: LEVEL_COLORS[level] }]} />
        <Text style={styles.legendText}>{LEVEL_LABELS[level]}</Text>
      </View>
    ))}
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, styles.legendSwatchBlocked]}>
        <Feather name="slash" size={8} color={theme.colors.textMuted} />
      </View>
      <Text style={styles.legendText}>{BLOCKED_LABEL}</Text>
    </View>
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, styles.legendSwatchOccupied]}>
        <Feather name="lock" size={8} color={theme.colors.textMuted} />
      </View>
      <Text style={styles.legendText}>{OCCUPIED_LABEL}</Text>
    </View>
  </View>
);

interface AvailabilityGridProps {
  values: Record<string, number>;
  onChange: (block: string, value: number) => void;
  blockedBlocks?: Set<string>;
  occupiedBlocks?: Set<string>;
  disabled?: boolean;
}

// Calendario de 3 semanas (la actual + 2), cada una como una tabla de 7 días x 11
// horas (9 a 19). Tocar una celda avanza al siguiente nivel (1..4, cíclico); los
// bloques que el admin cerró (blockedBlocks) o que ya tienen un partido asignado
// (occupiedBlocks) se muestran aparte y no son tocables.
export const AvailabilityGrid: React.FC<AvailabilityGridProps> = ({ values, onChange, blockedBlocks, occupiedBlocks, disabled }) => {
  const weeks = getScheduleWindow();

  return (
    <View>
      {weeks.map((week) => (
        <View key={week.label} style={styles.weekBlock}>
          <Text style={styles.weekLabel}>Semana del {week.label}</Text>
          <View style={styles.row}>
            <View style={styles.hourLabelCell} />
            {week.days.map((day) => (
              <View key={day.dateStr} style={styles.dayHeaderCell}>
                <Text style={styles.dayHeaderText}>{day.dayLabel}</Text>
                <Text style={styles.dayHeaderDate}>{day.dayOfMonth}</Text>
              </View>
            ))}
          </View>

          {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i).map((hour) => (
            <View key={hour} style={styles.row}>
              <View style={styles.hourLabelCell}>
                <Text style={styles.hourLabelText}>{hourLabel(hour)}</Text>
              </View>
              {week.days.map((day) => {
                const block = blockCode(day.dateStr, hour);
                if (blockedBlocks?.has(block)) {
                  return (
                    <View key={block} style={[styles.cell, { backgroundColor: BLOCKED_BG }]}>
                      <Feather name="slash" size={10} color={theme.colors.textMuted} />
                    </View>
                  );
                }
                if (occupiedBlocks?.has(block)) {
                  return (
                    <View key={block} style={[styles.cell, { backgroundColor: OCCUPIED_BG }]}>
                      <Feather name="lock" size={10} color={theme.colors.textMuted} />
                    </View>
                  );
                }
                const level = values[block] ?? MIN_LEVEL;
                return (
                  <TouchableOpacity
                    key={block}
                    style={[styles.cell, { backgroundColor: LEVEL_COLORS[level] }]}
                    activeOpacity={0.7}
                    disabled={disabled}
                    onPress={() => onChange(block, level >= MAX_LEVEL ? MIN_LEVEL : level + 1)}
                  >
                    <Text style={[styles.cellText, { color: LEVEL_TEXT_COLORS[level] }]}>{level}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  weekBlock: {
    marginBottom: 18,
  },
  weekLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
  },
  hourLabelCell: {
    width: 44,
    height: 26,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  hourLabelText: {
    color: theme.colors.textMuted,
    fontSize: 9,
  },
  dayHeaderCell: {
    flex: 1,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayHeaderText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  dayHeaderDate: {
    color: theme.colors.textMuted,
    fontSize: 9,
  },
  cell: {
    flex: 1,
    height: 26,
    borderWidth: 0.5,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellText: {
    fontSize: 10,
    fontWeight: '700',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: theme.colors.border,
  },
  legendSwatchBlocked: {
    backgroundColor: BLOCKED_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendSwatchOccupied: {
    backgroundColor: OCCUPIED_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendText: {
    color: theme.colors.textMuted,
    fontSize: 10,
  },
});
