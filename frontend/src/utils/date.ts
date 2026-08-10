// Fecha local en formato YYYY-MM-DD, a partir de los componentes locales de un Date
// (año/mes/día) — a propósito NO usa toISOString(), que primero convierte el instante a
// UTC: cerca de medianoche, en un huso horario detrás de UTC (ej. Chile, UTC-3/-4), ese
// paso adelanta la fecha resultante en un día respecto al día calendario local real.
export const toLocalDateStr = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const formatMatchDate = (dateStr: string | undefined): string => {
  if (!dateStr) return 'Sin Fecha';
  const normalizedStr = dateStr.replace(' ', 'T');
  const d = new Date(normalizedStr);
  if (isNaN(d.getTime())) return 'Sin Fecha';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} ${hh}:${min}`;
};
