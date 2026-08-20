import { hourLabel } from '../components/schedule/AvailabilityGrid';

// Formateo del `blockCode` de un partido ("YYYY-MM-DD-HH") a algo legible.
//
// Vivía dentro de LeagueMatchRow, pero la Beaupolla necesita exactamente lo mismo en
// sus tarjetas y una tercera copia era la forma segura de que los tres formatos
// terminaran divergiendo.

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTH_LABELS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "Jue 20 ago · 15:00" */
export function formatBlockCode(code: string): string {
  if (!code || code.length < 13) return code || 'Por definir';
  const hour = Number(code.slice(-2));
  const [y, m, d] = code.slice(0, -3).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayLabel = DAY_LABELS[(date.getDay() + 6) % 7];
  return `${dayLabel} ${d} ${MONTH_LABELS[m - 1]} · ${hourLabel(hour)}`;
}

/** "Jue 20 ago" — sin la hora, para donde el horario exacto no aporta. */
export function formatBlockDate(code: string): string {
  if (!code || code.length < 13) return code || 'Por definir';
  const [y, m, d] = code.slice(0, -3).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayLabel = DAY_LABELS[(date.getDay() + 6) % 7];
  return `${dayLabel} ${d} ${MONTH_LABELS[m - 1]}`;
}
