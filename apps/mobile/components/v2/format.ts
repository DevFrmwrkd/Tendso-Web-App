/** "₱4,999". Rounds to whole pesos; never shows centavos. */
export function formatPeso(amount: number | null | undefined): string {
  const n = Math.round(Number.isFinite(amount as number) ? (amount as number) : 0);
  const sign = n < 0 ? '-' : '';
  return `${sign}₱${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/** "Oct 18" in English, no year. */
export function shortDate(value: number | string | Date | null | undefined): string {
  if (value === null || value === undefined) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
