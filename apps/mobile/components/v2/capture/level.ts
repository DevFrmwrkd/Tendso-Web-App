/**
 * Phone-level heuristics for the camera screens. Pure functions, no ML.
 *
 * Input is the accelerometer in g (expo-sensors `Accelerometer`), device axes:
 * held upright in portrait, gravity is roughly (0, -1, 0). We only need:
 *   roll  — the in-plane tilt (the horizon line). 0 = straight.
 *   pitch — leaning the top of the phone towards / away from you. 0 = upright.
 *   shake — how much the reading moves between samples.
 */
import type { ShotKind } from '../../../lib/v2/captureContent';

export interface Accel {
  x: number;
  y: number;
  z: number;
}

const DEG = 180 / Math.PI;

/** In-plane tilt in degrees, −180..180. Positive = turned clockwise. */
export function rollDegrees(a: Accel): number {
  return Math.atan2(a.x, -a.y) * DEG;
}

/** Lean in degrees: 0 upright, 90 flat on its back (screen up), −90 face down. */
export function pitchDegrees(a: Accel): number {
  return Math.atan2(-a.z, Math.hypot(a.x, a.y)) * DEG;
}

/** Thresholds with hysteresis so the hint does not flicker at the edge. */
export const LEVEL_ENTER_DEG = 3;
export const LEVEL_EXIT_DEG = 6;
export const SHAKE_LIMIT_G = 0.06;
/** Upright enough for a shop front, a room or a sign. */
export const UPRIGHT_LIMIT_DEG = 30;

export function isLevel(rollDeg: number, wasLevel: boolean): boolean {
  const r = Math.abs(rollDeg);
  return wasLevel ? r <= LEVEL_EXIT_DEG : r <= LEVEL_ENTER_DEG;
}

/** Mean absolute change between consecutive samples, in g. */
export function shakiness(samples: readonly Accel[]): number {
  if (samples.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < samples.length; i++) {
    const p = samples[i - 1];
    const c = samples[i];
    sum += Math.abs(c.x - p.x) + Math.abs(c.y - p.y) + Math.abs(c.z - p.z);
  }
  return sum / (samples.length - 1);
}

/** The level line rotation to draw (clamped so it never spins). */
export function levelLineDegrees(rollDeg: number): number {
  return Math.max(-25, Math.min(25, -rollDeg));
}

// ------------------------------------------------------------------ interview framing

export interface FramingState {
  /** ms the phone has been level and still, continuously. */
  steadyMs: number;
  /** Framing passed (sticky: measured once). */
  good: boolean;
  /** Total ms spent checking. */
  elapsedMs: number;
  level: boolean;
}

export const FRAMING_STEADY_MS = 700;
/** Never hold the owner hostage: after this, carry on anyway. */
export const FRAMING_GIVE_UP_MS = 6000;

export const initialFraming: FramingState = { steadyMs: 0, good: false, elapsedMs: 0, level: false };

/**
 * One step of the "measured once" framing check. Feed it every sensor sample
 * (or null when the device has no accelerometer) with the ms since the last one.
 */
export function stepFraming(s: FramingState, a: Accel | null, dtMs: number, shake: number): FramingState {
  if (s.good) return s;
  const elapsedMs = s.elapsedMs + dtMs;
  if (!a) {
    // No sensor: give it a moment so the hint is readable, then go.
    return { ...s, elapsedMs, level: true, good: elapsedMs >= 1200 };
  }
  const level = isLevel(rollDegrees(a), s.level);
  const still = shake <= SHAKE_LIMIT_G;
  const steadyMs = level && still ? s.steadyMs + dtMs : 0;
  const good = steadyMs >= FRAMING_STEADY_MS || elapsedMs >= FRAMING_GIVE_UP_MS;
  return { steadyMs, good, elapsedMs, level };
}

/**
 * The same check from a running reading (useLevel keeps the steady time itself):
 * passed when level + still long enough, after a moment without a sensor, or on give-up.
 */
export function framingPassed(r: { hasSensor: boolean; steadyMs: number }, elapsedMs: number): boolean {
  if (elapsedMs >= FRAMING_GIVE_UP_MS) return true;
  if (!r.hasSensor) return elapsedMs >= 1200;
  return r.steadyMs >= FRAMING_STEADY_MS;
}

// ------------------------------------------------------------------ photo feedback

export type ShotFeedback =
  | { good: true; text: 'Perfect, hold still' }
  | { good: false; text: string };

/**
 * The feedback chip for a photo task. Simple, honest heuristics:
 *  1. shaking            → "Hold still"
 *  2. tilted sideways    → "Hold the phone straight"
 *  3. leaning (for fronts, rooms, signs, people) → "Hold the phone upright"
 *  4. not steady long enough yet → the task's own tip ("Step back a little")
 *  5. otherwise          → "Perfect, hold still"
 */
export function shotFeedback(opts: {
  kind: ShotKind;
  roll: number;
  pitch: number;
  shake: number;
  steadyMs: number;
  wasLevel: boolean;
  tip: string;
  hasSensor: boolean;
}): ShotFeedback {
  const { kind, roll, pitch, shake, steadyMs, wasLevel, tip, hasSensor } = opts;
  if (!hasSensor) return steadyMs >= 900 ? { good: true, text: 'Perfect, hold still' } : { good: false, text: tip };
  if (shake > SHAKE_LIMIT_G * 2) return { good: false, text: 'Hold still' };
  if (!isLevel(roll, wasLevel)) return { good: false, text: 'Hold the phone straight' };
  if (kind !== 'object' && Math.abs(pitch) > UPRIGHT_LIMIT_DEG) return { good: false, text: 'Hold the phone upright' };
  if (steadyMs < 500) return { good: false, text: tip };
  return { good: true, text: 'Perfect, hold still' };
}

// ------------------------------------------------------------------ mic meter

/** expo-av metering (dBFS, −160..0) → 0..1 for the five little bars. */
export function meterLevel(db: number | undefined | null): number {
  if (db === undefined || db === null || !Number.isFinite(db)) return 0;
  return Math.max(0, Math.min(1, (db + 55) / 50));
}

/** Five bar heights (0.2..1) from one level, louder in the middle like the mock. */
export function meterBars(level: number): number[] {
  const shape = [0.55, 0.8, 1, 0.8, 0.55];
  return shape.map((k) => Math.max(0.2, Math.min(1, 0.2 + level * k)));
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
