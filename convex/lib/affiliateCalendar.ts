import { ConvexError } from 'convex/values';

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Half-open Manila calendar month. Shared by the web and mobile portals. */
export function manilaMonth(now: number) {
    const local = new Date(now + MANILA_OFFSET_MS);
    const year = local.getUTCFullYear();
    const month = local.getUTCMonth();
    return {
        start: Date.UTC(year, month, 1) - MANILA_OFFSET_MS,
        end: Date.UTC(year, month + 1, 1) - MANILA_OFFSET_MS,
        label: `${year}-${String(month + 1).padStart(2, '0')}`,
    };
}

/** Display selection never changes live balances or the commission period. */
export function selectedManilaMonth(value: string | undefined, now: number) {
    if (value === undefined) return manilaMonth(now);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || Number(value.slice(0, 4)) < 2000) {
        throw new ConvexError('Choose a valid calendar month.');
    }
    const month = manilaMonth(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, 1));
    if (month.start > manilaMonth(now).start) throw new ConvexError('Choose this month or an earlier month.');
    return month;
}
