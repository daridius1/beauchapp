export const formatMatchDate = (dateStr: string | undefined): string => {
  if (!dateStr) return 'Sin Fecha';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Sin Fecha';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} ${hh}:${min}`;
};
