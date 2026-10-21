import { ConvexError, v } from 'convex/values';
import { mutation } from './_generated/server';
import { normalizePhone } from './lib/phone';

/**
 * "Hire an agent" requests from the public v2 landing page (/v2, Paths section).
 *
 * A shop owner leaves three things: the shop's name, the area and a mobile
 * number. That becomes a customer lead (source "website", status "new") so it
 * shows up in the admin Leads list next to the other website leads; the shop
 * name doubles as the lead's name and the area fills businessCity, which the
 * list already shows as the lead's city.
 *
 * Public and unauthenticated, so it is throttled without a new table:
 *   - the same mobile number within REPEAT_WINDOW_MS is treated as the same
 *     request (no second row, the caller still gets "sent");
 *   - at most GLOBAL_LIMIT landing requests are accepted per GLOBAL_WINDOW_MS
 *     across everyone, after which callers are asked to try again later.
 * Both checks walk the newest leads only (the table is read newest-first and
 * the walk stops at the window edge), so the cost stays flat as leads grow.
 */

export const LANDING_SOURCE = 'website';
export const LANDING_MESSAGE = 'Asked for a field agent visit from the website.';

const REPEAT_WINDOW_MS = 24 * 60 * 60 * 1000;
const GLOBAL_WINDOW_MS = 10 * 60 * 1000;
const GLOBAL_LIMIT = 20;
/** Upper bound on rows read per request, whatever the windows say. */
const SCAN_CAP = 400;

const clean = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max);

export const requestVisit = mutation({
    args: {
        shopName: v.string(),
        area: v.string(),
        mobile: v.string(),
    },
    handler: async (ctx, args) => {
        const shopName = clean(args.shopName, 120);
        const area = clean(args.area, 120);
        const mobile = clean(args.mobile, 40);
        const digits = normalizePhone(mobile);

        if (shopName.length < 2) throw new ConvexError({ field: 'shopName', message: 'Add your business name.' });
        if (area.length < 2) throw new ConvexError({ field: 'area', message: 'Add your city or area.' });
        if (!digits || digits.length < 10 || digits.length > 15) {
            throw new ConvexError({ field: 'mobile', message: 'Add a number we can message, like 0917 123 4567.' });
        }

        const now = Date.now();
        let recentLanding = 0;
        let scanned = 0;
        for await (const lead of ctx.db.query('leads').order('desc')) {
            if (++scanned > SCAN_CAP) break;
            const age = now - lead.createdAt;
            if (age > REPEAT_WINDOW_MS) break;
            if (lead.source !== LANDING_SOURCE || lead.message !== LANDING_MESSAGE) continue;
            if (normalizePhone(lead.phone) === digits) return { ok: true as const, duplicate: true };
            if (age <= GLOBAL_WINDOW_MS) recentLanding += 1;
        }
        if (recentLanding >= GLOBAL_LIMIT) {
            throw new ConvexError({ field: null, message: 'We are getting a lot of requests. Please try again in a few minutes.' });
        }

        await ctx.db.insert('leads', {
            source: LANDING_SOURCE,
            name: shopName,
            phone: mobile,
            message: LANDING_MESSAGE,
            businessName: shopName,
            businessCity: area,
            status: 'new',
            createdAt: now,
        });
        return { ok: true as const, duplicate: false };
    },
});
