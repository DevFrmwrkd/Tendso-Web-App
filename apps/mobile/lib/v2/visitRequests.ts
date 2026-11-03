import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavigationContext } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import { api, type Id } from '@tendso/convex-client';
import { useNetwork } from '../../providers/NetworkProvider';
import { OWNER_SAMPLE_DATA } from './ownerFlags';

export type VisitId = Id<'ownerVisitRequests'>;
export type VisitRequest = NonNullable<FunctionReturnType<typeof api.visitRequests.getMine>>;
export type CreateVisitArgs = Omit<FunctionArgs<typeof api.visitRequests.create>, 'clerkId'>;

export function useOwnerVisitRequests(): VisitRequest[] | undefined {
  const { userId } = useAuth();
  const value = useQuery(api.visitRequests.listMine, userId && !OWNER_SAMPLE_DATA ? { clerkId: userId } : 'skip');
  if (!userId || OWNER_SAMPLE_DATA) return [];
  return value === undefined ? undefined : value?.actorClerkId === userId
    ? value.requests.filter(row => row.actorClerkId === userId && row.ownerId === value.ownerId) : [];
}
export function useOwnerVisit(id: VisitId | null) {
  const { userId } = useAuth();
  const value = useQuery(api.visitRequests.getMine, id && userId && !OWNER_SAMPLE_DATA ? { id, clerkId: userId } : 'skip');
  return !id || !userId || OWNER_SAMPLE_DATA ? null : value === undefined ? undefined : value?.actorClerkId === userId && value._id === id ? value : null;
}
export function useCreateVisitRequest() {
  const mutation = useMutation(api.visitRequests.create);
  const { userId } = useAuth();
  return useCallback(async (args: CreateVisitArgs) => {
    if (!userId || OWNER_SAMPLE_DATA) return Promise.reject(new Error('Sign in to request a real shop visit.'));
    const result = await mutation({ ...args, clerkId: userId });
    if (result.actorClerkId !== userId) throw new Error('Your account changed. Open your visit requests again.');
    return result;
  }, [mutation, userId]);
}
export function useAssignedVisits(enabled = true) {
  const { userId } = useAuth();
  const value = useQuery(api.visitRequests.listAssigned, enabled && userId ? { clerkId: userId } : 'skip');
  return !enabled || !userId ? null : value === undefined ? undefined : value?.actorClerkId === userId ? value : null;
}
export function useAssignedVisit(id: VisitId | null, enabled = true) {
  const { userId } = useAuth();
  const value = useQuery(api.visitRequests.getAssigned, enabled && id && userId ? { id, clerkId: userId } : 'skip');
  return !enabled || !id || !userId ? null : value === undefined ? undefined : value?.actorClerkId === userId && value._id === id ? value : null;
}
export function useVisitActions() {
  return { accept: useMutation(api.visitRequests.accept), decline: useMutation(api.visitRequests.decline),
    complete: useMutation(api.visitRequests.complete), cancel: useMutation(api.visitRequests.cancel) };
}

/** Late work never changes another account, route or navigation visit. */
export function useVisitOperation(target: string) {
  const { userId, sessionId } = useAuth();
  const { isConnected } = useNetwork();
  const navigation = useContext(NavigationContext);
  const identity = `${userId ?? ''}:${sessionId ?? ''}:${target}`;
  const latest = useRef({ identity, offline: isConnected === false });
  useLayoutEffect(() => { latest.current = { identity, offline: isConnected === false }; }, [identity,isConnected]);
  const mounted = useRef(true), focused = useRef(navigation?.isFocused() ?? true), visit = useRef(0), sequence = useRef(0);
  const active = useRef<number | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; active.current = null; }; }, []);
  useEffect(() => {
    if (!navigation) return;
    focused.current = navigation.isFocused();
    const blur = navigation.addListener('blur', () => { focused.current = false; visit.current++; active.current = null; });
    const focus = navigation.addListener('focus', () => { focused.current = true; visit.current++; active.current = null; setBusy(false); });
    return () => { blur(); focus(); };
  }, [navigation]);
  const isCurrent = () => mounted.current && focused.current && latest.current.identity === identity;
  const run = async <T,>(action: () => Promise<T>, success?: (result: T) => void) => {
    if (!userId || !isCurrent() || latest.current.offline || active.current !== null) return;
    const operation = ++sequence.current, opened = visit.current;
    active.current = operation; setBusy(true); setError(null);
    const current = () => isCurrent() && visit.current === opened && active.current === operation;
    try { const result = await action(); if (current() && !latest.current.offline) success?.(result); }
    catch (cause) {
      if (current()) {
        const data = cause && typeof cause === 'object' && 'data' in cause ? cause.data : null;
        setError(typeof data === 'string' ? data : cause instanceof Error ? cause.message : 'Please try again.');
      }
    } finally { if (current()) { active.current = null; setBusy(false); } }
  };
  return { busy, error, offline: isConnected === false, isCurrent, run };
}

export const visitStatusLabel = (status: VisitRequest['status']) => ({ requested: 'Request received', assigned: 'Awaiting acceptance',
  confirmed: 'Visit confirmed', completed: 'Visit completed', cancelled: 'Cancelled' })[status];
export function visitSchedule(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? `${new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })} · Philippine time`
    : 'Time not set yet';
}
export function validVisitPin(value: { lat: number; lng: number } | undefined | null): value is { lat: number; lng: number } {
  return !!value && Number.isFinite(value.lat) && Number.isFinite(value.lng) && value.lat >= 4 && value.lat <= 22 && value.lng >= 116 && value.lng <= 127;
}
export function validVisitPhone(value: string): boolean { return /^(?:09\d{9}|9\d{9}|639\d{9})$/.test(value.replace(/\D/g, '')); }
export function visitPhoneLink(value: string | null | undefined): string | null {
  const digits = value?.replace(/\D/g, '') ?? '';
  const number = /^09\d{9}$/.test(digits) ? `63${digits.slice(1)}` : /^9\d{9}$/.test(digits) ? `63${digits}` : digits;
  return /^\d{7,15}$/.test(number) ? `tel:+${number}` : null;
}
