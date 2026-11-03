/** Development-only ledger. This module deliberately has no real payment actions. */
import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { OWNER_SAMPLE_DATA } from './ownerFlags';
import type { SubmissionId } from './ownerTypes';

/** Avoid calling a development-only function from production OTA bundles. */
export function isOwnerPaymentSimulatorBuild(): boolean {
  return !OWNER_SAMPLE_DATA && process.env.EXPO_PUBLIC_CONVEX_URL === 'https://diligent-ibex-454.convex.cloud';
}

export function useOwnerPaymentSimulation(submissionId: SubmissionId | null) {
  const { userId } = useAuth();
  const enabled = isOwnerPaymentSimulatorBuild() && !!userId && !!submissionId;
  const result = useQuery(api.paymentSimulator.get, enabled && submissionId ? { submissionId } : 'skip');
  return enabled ? result : null;
}

export function useRunOwnerPaymentSimulation() {
  return useMutation(api.paymentSimulator.run);
}

export type OwnerPaymentSimulation = NonNullable<ReturnType<typeof useOwnerPaymentSimulation>>;
export type OwnerPaymentSimulationAction = Parameters<ReturnType<typeof useRunOwnerPaymentSimulation>>[0]['action'];

/** The test ledger accepts whole PHP only; never round an entered transfer. */
export function simulationAmount(value: string): number | null {
  const text = value.trim();
  if (!/^\d+$/.test(text)) return null;
  const amount = Number(text);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function simulationPeso(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
}
