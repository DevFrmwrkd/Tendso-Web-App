import { ConvexError, v } from 'convex/values';
import { action, internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { normalizePhone } from './lib/phone';

// Public submissions go through the Next.js route: it supplies a trusted,
// hashed caller IP and a server secret. Turnstile is verified before any writes.
export const LANDING_SOURCE = 'website';
export const LANDING_MESSAGE = 'Asked for a field agent visit from the website.';

const REPEAT_WINDOW_MS = 24 * 60 * 60 * 1000;
const GLOBAL_WINDOW_MS = 10 * 60 * 1000;
const GLOBAL_LIMIT = 20;
const CALLER_LIMIT = 3;

const clean = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max);

const visitArgs = { shopName: v.string(), area: v.string(), mobile: v.string() };

export const requestVisit = action({
    args: { ...visitArgs, caller: v.string(), secret: v.string(), token: v.string() },
    handler: async (ctx, args): Promise<{ ok: true; duplicate: boolean }> => {
        if (!process.env.LANDING_LEADS_SECRET || args.secret !== process.env.LANDING_LEADS_SECRET) {
            throw new ConvexError('Unauthorized');
        }
        const key = process.env.TURNSTILE_SECRET_KEY;
        const hostname = process.env.TURNSTILE_HOSTNAME;
        if (!key || !hostname || !args.token || args.token.length > 2048) {
            throw new ConvexError('Visit requests are temporarily unavailable.');
        }
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: new URLSearchParams({ secret: key, response: args.token }),
        });
        const result = await response.json();
        if (!response.ok || result.success !== true || result.hostname !== hostname || result.action !== 'landing-visit') {
            throw new ConvexError('Please complete the bot check and try again.');
        }
        return await ctx.runMutation(internal.landingLeads.saveVisit, {
            shopName: args.shopName, area: args.area, mobile: args.mobile, caller: args.caller,
        });
    },
});

export const saveVisit = internalMutation({
    args: {
        ...visitArgs,
        caller: v.string(),
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
        // Append-only receipts are independent of editable/deletable admin leads.
        const callerRequests = await ctx.db.query('landingVisitRequests')
            .withIndex('by_caller_time', (q) => q.eq('caller', args.caller).gte('createdAt', now - GLOBAL_WINDOW_MS))
            .take(CALLER_LIMIT);
        if (callerRequests.length >= CALLER_LIMIT) {
            throw new ConvexError({ field: null, message: 'Please wait a few minutes before requesting another visit.' });
        }
        const duplicate = await ctx.db.query('landingVisitRequests')
            .withIndex('by_phone_time', (q) => q.eq('phone', digits).gte('createdAt', now - REPEAT_WINDOW_MS))
            .first();
        if (duplicate) return { ok: true as const, duplicate: true };
        const recentLanding = await ctx.db.query('landingVisitRequests')
            .withIndex('by_time', (q) => q.gte('createdAt', now - GLOBAL_WINDOW_MS))
            .take(GLOBAL_LIMIT);
        if (recentLanding.length >= GLOBAL_LIMIT) {
            throw new ConvexError({ field: null, message: 'We are getting a lot of requests. Please try again in a few minutes.' });
        }
        await ctx.db.insert('landingVisitRequests', { phone: digits, caller: args.caller, createdAt: now });

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
