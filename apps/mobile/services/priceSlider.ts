export function snapPrice(raw: number, floor: number, ceiling: number, step: number): number {
  const clamped = Math.max(floor, Math.min(ceiling, Number.isFinite(raw) ? raw : ceiling));
  if (clamped === floor || clamped === ceiling) return clamped;
  const increment = Number.isFinite(step) && step > 0 ? step : 1;
  return Math.max(floor, Math.min(ceiling, floor + Math.round((clamped - floor) / increment) * increment));
}
