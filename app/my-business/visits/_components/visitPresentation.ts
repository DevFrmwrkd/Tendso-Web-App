import type { FunctionReturnType } from 'convex/server';
import type { api } from '@/convex/_generated/api';
import type { OwnerSite } from '../../_components/ownerSite';

export type OwnerVisit = NonNullable<FunctionReturnType<typeof api.visitRequests.getMine>>;
export type VisitPoint = { lat: number; lng: number };
export const VISIT_PREFERENCES = ['Today', 'Tomorrow', 'This week'] as const;
export type VisitPreference = typeof VISIT_PREFERENCES[number];
export type VisitDraft = { shopName: string; address: string; city: string; phone: string; coordinates: VisitPoint | null; preferredWhen: VisitPreference };

export const visitIsOpen = (visit: Pick<OwnerVisit, 'status'>) => visit.status !== 'completed' && visit.status !== 'cancelled';
export const visitStatusLabel = (status: OwnerVisit['status']) => ({ requested: 'Request received', assigned: 'Awaiting acceptance', confirmed: 'Visit confirmed', completed: 'Visit completed', cancelled: 'Cancelled' })[status];
export const visitStatusDescription = (status: OwnerVisit['status']) => ({
    requested: 'The team is arranging a field agent and a proposed time for your shop.',
    assigned: 'A field agent is assigned. The proposed time is waiting for their acceptance; the visit is not confirmed yet.',
    confirmed: 'Your field agent accepted the visit. Check the confirmed time below.',
    completed: 'Your field agent marked this visit complete. This does not submit or publish a website.',
    cancelled: 'This visit is cancelled. No field agent should travel for this request.',
})[status];

export function visitSchedule(value: number | null | undefined): string {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 && Number.isFinite(new Date(value).getTime())
        ? `${new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })} · Philippine time`
        : 'Time not set yet';
}
export function validVisitPin(value: VisitPoint | null | undefined): value is VisitPoint {
    return !!value && Number.isFinite(value.lat) && Number.isFinite(value.lng) && value.lat >= 4 && value.lat <= 22 && value.lng >= 116 && value.lng <= 127;
}
export function validVisitPhone(value: string): boolean { return /^(?:09\d{9}|9\d{9}|639\d{9})$/.test(value.replace(/\D/g, '')); }
export function visitPhoneHref(value: string | null | undefined): string | null {
    const digits = value?.replace(/\D/g, '') ?? '';
    const normalized = /^09\d{9}$/.test(digits) ? `63${digits.slice(1)}` : /^9\d{9}$/.test(digits) ? `63${digits}` : digits;
    return /^\d{7,15}$/.test(normalized) ? `tel:+${normalized}` : null;
}
export const visitDirectionsHref = (coordinates: VisitPoint | null | undefined) => validVisitPin(coordinates)
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${coordinates.lat},${coordinates.lng}`)}` : null;
export function selectedVisitBusiness(sites: readonly OwnerSite[] | undefined, submissionId: string | null | undefined): OwnerSite | null {
    return submissionId ? sites?.find(site => site.submissionId === submissionId) ?? null : null;
}
export function visitDraftErrors(draft: VisitDraft): Partial<Record<keyof VisitDraft, string>> {
    const errors: Partial<Record<keyof VisitDraft, string>> = {};
    if (draft.shopName.trim().length < 2 || draft.shopName.trim().length > 120) errors.shopName = 'Use 2–120 characters for the shop name.';
    if (draft.address.trim().length < 3 || draft.address.trim().length > 300) errors.address = 'Add the street, building or landmark (3–300 characters).';
    if (draft.city.trim().length < 2 || draft.city.trim().length > 120) errors.city = 'Add the city or municipality (2–120 characters).';
    if (!validVisitPin(draft.coordinates)) errors.coordinates = 'Pin the shop’s exact location in the Philippines.';
    if (!validVisitPhone(draft.phone)) errors.phone = 'Add a valid Philippine mobile number.';
    if (!(VISIT_PREFERENCES as readonly string[]).includes(draft.preferredWhen)) errors.preferredWhen = 'Choose your preferred visit day.';
    return errors;
}
export function visitError(cause: unknown): string {
    const data = cause && typeof cause === 'object' && 'data' in cause ? cause.data : null;
    return typeof data === 'string' ? data : cause instanceof Error ? cause.message : 'Please try again.';
}
