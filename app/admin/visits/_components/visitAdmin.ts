import type { FunctionReturnType } from 'convex/server';
import type { api } from '@/convex/_generated/api';
import type { StatusWord } from '@/components/r1/statusWords';

export type AdminVisit = FunctionReturnType<typeof api.visitRequests.listAdmin>['requests'][number];
export type VisitAgent = FunctionReturnType<typeof api.visitRequests.listAssignableAgents>['agents'][number];
export type VisitStatus = AdminVisit['status'];
export type VisitFilter = VisitStatus | 'all';

export const VISIT_FILTERS: Array<{ value: VisitFilter; label: string }> = [
    { value: 'all', label: 'All requests' }, { value: 'requested', label: 'Needs assignment' },
    { value: 'assigned', label: 'Awaiting acceptance' }, { value: 'confirmed', label: 'Confirmed' },
    { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' },
];
export function visitStatus(visit: AdminVisit): StatusWord {
    switch (visit.status) {
        case 'requested': return { tone: 'attn', word: visit.declineReason ? 'Needs reassignment' : 'Needs assignment' };
        case 'assigned': return { tone: 'attn', word: 'Awaiting acceptance' };
        case 'confirmed': return { tone: 'progress', word: 'Confirmed' };
        case 'completed': return { tone: 'done', word: 'Completed' };
        case 'cancelled': return { tone: 'off', word: 'Cancelled' };
    }
}
export const canAssignVisit = (visit: AdminVisit) => visit.status === 'requested' || visit.status === 'assigned';
export const canCancelVisit = (visit: AdminVisit) => canAssignVisit(visit) || visit.status === 'confirmed';

const PH_OFFSET = 8 * 60 * 60 * 1000;
const dateFormat = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
export function formatVisitTime(timestamp: number | null | undefined): string {
    return typeof timestamp === 'number' && Number.isFinite(timestamp) && Number.isFinite(new Date(timestamp).getTime())
        ? dateFormat.format(timestamp) : 'Not proposed yet';
}
export function philippineInputValue(timestamp: number | undefined): string {
    if (timestamp === undefined || !Number.isFinite(timestamp)) return '';
    const date = new Date(timestamp + PH_OFFSET);
    return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 16) : '';
}
/** datetime-local has no timezone. Treat its wall time explicitly as UTC+8. */
export function parsePhilippineSchedule(value: string): number | null {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
    const timestamp = Date.parse(`${value}:00+08:00`);
    return Number.isFinite(timestamp) && philippineInputValue(timestamp) === value ? timestamp : null;
}
export function visitDirections(visit: Pick<AdminVisit, 'coordinates'>): string | null {
    const point = visit.coordinates;
    if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)
        || Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) return null;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${point.lat},${point.lng}`)}`;
}
export function contactPhone(phone: string): string | null {
    const digits = phone.replace(/[^\d+]/g, '');
    return /^\+?\d{7,15}$/.test(digits) ? `tel:${digits}` : null;
}
export function contactEmail(email: string | undefined): string | null {
    return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `mailto:${encodeURIComponent(email)}` : null;
}
