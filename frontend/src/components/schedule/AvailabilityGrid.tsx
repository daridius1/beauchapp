import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../theme/theme';

export const START_HOUR = 8;
export const END_HOUR = 20;
const WEEKS_WINDOW = 3;

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']; // sin sábado ni domingo
const MONTH_LABELS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Nivel 1 (peor) a 5 (mejor) — no existe un valor especial de "no disponible", una
// disponibilidad muy mala es simplemente el extremo inferior de esta misma escala.
export const LEVEL_LABELS: Record<number, string> = {
  1: 'Muy mala',
  2: 'Mala',
  3: 'Regular',
  4: 'Buena',
  5: 'Excelente',
};
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 5;

// Gradiente rojo -> naranjo -> ámbar -> lima -> verde, más explicativo que la opacidad
// monocroma anterior: el color solo comunica qué tan buena es la disponibilidad de un
// vistazo. Exportados porque el modal de equipo (TeamScheduleScreen) los reusa para que
// cada opción de nota se vea con su color real, no solo un genérico "seleccionado".
export const LEVEL_COLORS: Record<number, string> = {
  1: '#ef4444',
  2: '#f97316',
  3: '#f59e0b',
  4: '#a3e635',
  5: '#22c55e',
};
export const LEVEL_TEXT_COLORS: Record<number, string> = {
  1: '#ffffff',
  2: '#000000',
  3: '#000000',
  4: '#000000',
  5: '#000000',
};

const BLOCKED_BG = '#26262a';
const BLOCKED_LABEL = 'Bloqueado por el admin';
const OCCUPIED_BG = '#1e3a5f';
const OCCUPIED_LABEL = 'Ocupado por un partido';
const PAST_BG = '#000000';
const PAST_LABEL = 'Ya pasó';

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

// Un bloque queda "pasado" apenas arranca su hora, no cuando termina — no tiene
// sentido dejar marcar disponibilidad para una hora que ya está corriendo.
function isBlockPast(dateStr: string, hour: number, now: Date = new Date()): boolean {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, hour) < now;
}

// Una semana está totalmente vencida cuando incluso su último bloque (el viernes a
// END_HOUR) ya pasó — nos ahorra recorrer los 55 bloques para saber si a esta semana
// le queda algo marcable.
function weekIsFullyPast(week: WeekInfo, now: Date = new Date()): boolean {
  const lastDay = week.days[week.days.length - 1];
  return isBlockPast(lastDay.dateStr, END_HOUR, now);
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
    for (let d = 0; d < DAY_LABELS.length; d++) {
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
  const last = days[days.length - 1];
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

// Los códigos de bloque de UNA semana, en orden día (lun-vie) x hora. Dos semanas
// cualesquiera devuelven listas paralelas, y eso es lo que permite copiar una sobre otra
// apareando por índice — sin aritmética de fechas, que es donde se cuelan los bugs de
// cambio de mes y de horario de verano.
export function weekBlockCodes(week: WeekInfo): string[] {
  const codes: string[] = [];
  week.days.forEach((day) => {
    for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
      codes.push(blockCode(day.dateStr, hour));
    }
  });
  return codes;
}

// La semana anterior a la ventana: la única que queda fuera y que igual hace falta, como
// fuente para "repetir la semana anterior" sobre la primera semana visible. Espejo de
// previousWeekBlockCodes() en backend/pb_hooks/lib/teamSchedule.js — duplicada a
// propósito, igual que el resto de helpers de fecha (son runtimes distintos). Ojo que
// pasa por startOfWeek: restarle 7 días a "hoy" a secas se equivoca de semana cuando hoy
// es sábado o domingo.
export function previousScheduleWeek(referenceDate: Date = new Date()): WeekInfo {
  const previousMonday = startOfWeek(referenceDate);
  previousMonday.setDate(previousMonday.getDate() - 7);
  return getScheduleWindow(previousMonday, 1)[0];
}

// "Puede" (level >= punto medio) vs "No puede" — usado para el modo binario de
// jugadores individuales, donde no tiene sentido la escala fina de 4 niveles que sí
// usan los equipos (esa alimenta el algoritmo de emparejamiento, esto no).
const MID_LEVEL = (MIN_LEVEL + MAX_LEVEL) / 2;
export function canPlay(level: number): boolean {
  return level > MID_LEVEL;
}

// Explicación de qué significa cada color — pensado para mostrarse ANTES de la
// grilla, no como referencia al final. En modo binario solo hay Puede/No puede (sin
// la escala fina de 5 niveles, que no aplica a disponibilidad individual).
export const ScheduleLegend: React.FC<{ binary?: boolean }> = ({ binary }) => (
  <View style={styles.legend}>
    {binary ? (
      <>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: LEVEL_COLORS[MAX_LEVEL] }]} />
          <Text style={styles.legendText}>Puede</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: LEVEL_COLORS[MIN_LEVEL] }]} />
          <Text style={styles.legendText}>No puede</Text>
        </View>
      </>
    ) : (
      ([1, 2, 3, 4, 5] as const).map((level) => (
        <View key={level} style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: LEVEL_COLORS[level] }]} />
          <Text style={styles.legendText}>{LEVEL_LABELS[level]}</Text>
        </View>
      ))
    )}
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
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, styles.legendSwatchPast]} />
      <Text style={styles.legendText}>{PAST_LABEL}</Text>
    </View>
  </View>
);

interface AvailabilityGridProps {
  values: Record<string, number>;
  onChange: (block: string, value: number) => void;
  blockedBlocks?: Set<string>;
  occupiedBlocks?: Set<string>;
  disabled?: boolean;
  // Jugadores individuales: la celda solo alterna Puede/No puede en vez de ciclar por
  // los 4 niveles de "qué tan feliz estaría" — esa escala fina es para el emparejamiento
  // entre equipos, no tiene sentido para "puedo o no puedo jugar a esa hora".
  binary?: boolean;
  // "Repetir la semana anterior". El botón se dibuja acá, y no en la pantalla, porque
  // qué semana está seleccionada es estado de este componente (los tabs viven acá): la
  // pantalla no tiene cómo saber sobre cuál se estaría copiando. Recibe el índice y
  // resuelve de dónde sale la fuente.
  canCopyPreviousWeek?: (weekIndex: number) => boolean;
  onCopyPreviousWeek?: (weekIndex: number) => void;
}

// Calendario de N semanas, pero mostradas de a una: primero se elige la semana (tabs
// arriba) y recién ahí se ve/edita su tabla de 5 días (lun-vie) x 11 horas (9 a 19).
// Mostrarlas todas apiladas a la vez (como era antes) hacía la pantalla larguísima y
// mezclaba semanas que en la práctica se llenan una por una. Tocar una celda avanza al
// siguiente nivel (1..4, cíclico, o Puede/No puede si `binary`); los bloques que el
// admin cerró (blockedBlocks) o que ya tienen un partido asignado (occupiedBlocks) se
// muestran aparte y no son tocables.
export const AvailabilityGrid: React.FC<AvailabilityGridProps> = ({ values, onChange, blockedBlocks, occupiedBlocks, disabled, binary, canCopyPreviousWeek, onCopyPreviousWeek }) => {
  const weeks = getScheduleWindow();
  // Por defecto se abre en la primera semana que todavía tenga algo marcable, no
  // siempre en la semana 0: si hoy es sábado o domingo, la semana actual (lun-vie) ya
  // quedó entera en el pasado y no tiene sentido aterrizar ahí. Solo se calcula una vez
  // al montar, igual que el resto de la ventana — no se re-evalúa mientras la pantalla
  // sigue abierta.
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const idx = weeks.findIndex((w) => !weekIsFullyPast(w));
    return idx === -1 ? weeks.length - 1 : idx;
  });
  const week = weeks[Math.min(selectedWeek, weeks.length - 1)];
  const todayStr = formatDateStr(new Date());

  return (
    <View>
      <View style={styles.weekTabs}>
        {weeks.map((w, i) => (
          <TouchableOpacity
            key={w.label}
            style={[styles.weekTab, i === selectedWeek && styles.weekTabActive]}
            activeOpacity={0.7}
            onPress={() => setSelectedWeek(i)}
          >
            <Text style={[styles.weekTabText, i === selectedWeek && styles.weekTabTextActive]}>{w.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!disabled && onCopyPreviousWeek && canCopyPreviousWeek?.(selectedWeek) ? (
        <TouchableOpacity
          style={styles.copyWeekBtn}
          activeOpacity={0.7}
          onPress={() => onCopyPreviousWeek(selectedWeek)}
        >
          <Feather name="copy" size={12} color={theme.colors.primary} />
          <Text style={styles.copyWeekBtnText}>Repetir la semana anterior</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.row}>
        <View style={styles.hourLabelCell} />
        {week.days.map((day) => {
          const isToday = day.dateStr === todayStr;
          return (
            <View key={day.dateStr} style={[styles.dayHeaderCell, isToday && styles.dayHeaderCellToday]}>
              <Text style={[styles.dayHeaderText, isToday && styles.dayHeaderTextToday]}>{day.dayLabel}</Text>
              <Text style={[styles.dayHeaderDate, isToday && styles.dayHeaderTextToday]}>{day.dayOfMonth}</Text>
            </View>
          );
        })}
      </View>

      {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i).map((hour) => (
        <View key={hour} style={styles.row}>
          <View style={styles.hourLabelCell}>
            <Text style={styles.hourLabelText}>{hourLabel(hour)}</Text>
          </View>
          {week.days.map((day) => {
            const block = blockCode(day.dateStr, hour);
            // El pasado se revisa primero y gana contra cualquier otro estado: un
            // bloque bloqueado u ocupado que además ya pasó no tiene ninguna acción
            // pendiente asociada (no se puede "desocupar" ni "desbloquear" el ayer), así
            // que mostrar el candado o la barra ahí sería sugerir una acción que no existe.
            if (isBlockPast(day.dateStr, hour)) {
              return <View key={block} style={[styles.cell, styles.cellPast]} />;
            }
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
            if (binary) {
              const available = canPlay(level);
              const color = available ? LEVEL_COLORS[MAX_LEVEL] : LEVEL_COLORS[MIN_LEVEL];
              const textColor = available ? LEVEL_TEXT_COLORS[MAX_LEVEL] : LEVEL_TEXT_COLORS[MIN_LEVEL];
              return (
                <TouchableOpacity
                  key={block}
                  style={[styles.cell, { backgroundColor: color }]}
                  activeOpacity={0.7}
                  disabled={disabled}
                  onPress={() => onChange(block, available ? MIN_LEVEL : MAX_LEVEL)}
                >
                  <Feather name={available ? 'check' : 'x'} size={11} color={textColor} />
                </TouchableOpacity>
              );
            }
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
  );
};

const styles = StyleSheet.create({
  copyWeekBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 14,
  },
  copyWeekBtnText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  weekTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  weekTab: {
    flexGrow: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  weekTabActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  weekTabText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  weekTabTextActive: {
    color: '#000000',
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
  // El fondo de la app ya es negro puro (theme.colors.background), así que "hoy" no se
  // puede marcar con relleno oscuro — se marca con el borde y el color del texto.
  dayHeaderCellToday: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  dayHeaderTextToday: {
    color: theme.colors.primary,
  },
  cell: {
    flex: 1,
    height: 26,
    borderWidth: 0.5,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Mismo negro que el fondo de la app (a propósito: "pasado" debe leerse como un
  // vacío, no como un color más de la escala) — el borde más claro que el de una celda
  // normal es lo único que evita que la celda desaparezca contra ese fondo.
  cellPast: {
    backgroundColor: PAST_BG,
    borderColor: '#3f3f46',
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
  legendSwatchPast: {
    backgroundColor: PAST_BG,
    borderColor: '#3f3f46',
  },
  legendText: {
    color: theme.colors.textMuted,
    fontSize: 10,
  },
});
