import { useEffect, useRef, useState } from 'react';
import { Accelerometer } from 'expo-sensors';
import { isLevel, pitchDegrees, rollDegrees, shakiness, SHAKE_LIMIT_G, type Accel } from './level';

export interface LevelReading {
  /** False until the first sample, and on devices without an accelerometer. */
  hasSensor: boolean;
  /** The latest sample (null without a sensor). */
  accel: Accel | null;
  roll: number;
  pitch: number;
  shake: number;
  level: boolean;
  /** ms the phone has been level and still, continuously. */
  steadyMs: number;
  /** ms since the previous reading (for the framing step). */
  dtMs: number;
}

const INTERVAL_MS = 100;

const EMPTY: LevelReading = { hasSensor: false, accel: null, roll: 0, pitch: 0, shake: 0, level: false, steadyMs: 0, dtMs: INTERVAL_MS };

/**
 * The phone's tilt and steadiness from the accelerometer (expo-sensors), ten
 * times a second. `active=false` stops listening (e.g. while paused).
 * Without a sensor it still ticks, with hasSensor=false, so screens never wait forever.
 */
export function useLevel(active = true): LevelReading {
  const [reading, setReading] = useState<LevelReading>(EMPTY);
  const samples = useRef<Accel[]>([]);
  const last = useRef<LevelReading>(EMPTY);
  const lastAt = useRef<number>(Date.now());

  useEffect(() => {
    if (!active) return;
    let sub: { remove: () => void } | null = null;
    let fallback: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const onSample = (a: Accel | null) => {
      const t = Date.now();
      const dtMs = Math.min(500, Math.max(16, t - lastAt.current));
      lastAt.current = t;
      if (!a) {
        const next = { ...EMPTY, steadyMs: last.current.steadyMs + dtMs, dtMs };
        last.current = next;
        setReading(next);
        return;
      }
      samples.current = [...samples.current.slice(-4), a];
      const roll = rollDegrees(a);
      const pitch = pitchDegrees(a);
      const shake = shakiness(samples.current);
      const level = isLevel(roll, last.current.level);
      const steadyMs = level && shake <= SHAKE_LIMIT_G ? last.current.steadyMs + dtMs : 0;
      const next: LevelReading = { hasSensor: true, accel: a, roll, pitch, shake, level, steadyMs, dtMs };
      last.current = next;
      setReading(next);
    };

    Accelerometer.isAvailableAsync()
      .then((ok) => {
        if (cancelled) return;
        if (!ok) {
          fallback = setInterval(() => onSample(null), INTERVAL_MS);
          return;
        }
        Accelerometer.setUpdateInterval(INTERVAL_MS);
        sub = Accelerometer.addListener((m) => onSample({ x: m.x, y: m.y, z: m.z }));
      })
      .catch(() => {
        if (!cancelled) fallback = setInterval(() => onSample(null), INTERVAL_MS);
      });

    return () => {
      cancelled = true;
      sub?.remove();
      if (fallback) clearInterval(fallback);
    };
  }, [active]);

  return reading;
}
