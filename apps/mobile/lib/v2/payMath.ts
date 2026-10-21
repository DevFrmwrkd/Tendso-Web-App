/**
 * Down payment arithmetic for the pay screen (the server re-checks everything:
 * ownerPayments.createPayToken). Minimum ₱500, whole pesos, less than the total;
 * paying everything is a full payment.
 */
import { DOWN_PAYMENT_STEP, MIN_DOWN_PAYMENT } from './ownerContent';

/** The largest down payment we offer: one step under the total. */
export function maxDownPayment(total: number, step = DOWN_PAYMENT_STEP): number {
  const top = Math.floor((total - 1) / step) * step;
  return Math.max(0, top);
}

export function canPayPart(total: number, min = MIN_DOWN_PAYMENT, step = DOWN_PAYMENT_STEP): boolean {
  return maxDownPayment(total, step) >= min;
}

export function clampDownPayment(amount: number, total: number, min = MIN_DOWN_PAYMENT, step = DOWN_PAYMENT_STEP): number {
  const max = maxDownPayment(total, step);
  if (max < min) return 0;
  const rounded = Math.round(amount / step) * step;
  return Math.min(max, Math.max(min, rounded));
}

export function stepDownPayment(amount: number, dir: 1 | -1, total: number, min = MIN_DOWN_PAYMENT, step = DOWN_PAYMENT_STEP): number {
  return clampDownPayment(amount + dir * step, total, min, step);
}

/** A friendly starting amount: about a fifth, at least the minimum. */
export function suggestedDownPayment(total: number, min = MIN_DOWN_PAYMENT, step = DOWN_PAYMENT_STEP): number {
  return clampDownPayment(Math.max(min, total / 5), total, min, step);
}

export type PayChoice = { kind: 'full' | 'balance'; amount: number } | { kind: 'deposit'; amount: number };

/** Parse the route params of the method screen safely. */
export function parsePayChoice(kind: unknown, amount: unknown, total: number, balance: number): PayChoice | null {
  const n = Number(amount);
  if (kind === 'full') return { kind: 'full', amount: total };
  if (kind === 'balance') return balance > 0 ? { kind: 'balance', amount: balance } : null;
  if (kind === 'deposit' && Number.isFinite(n)) {
    const a = clampDownPayment(n, total);
    return a > 0 ? { kind: 'deposit', amount: a } : null;
  }
  return null;
}
