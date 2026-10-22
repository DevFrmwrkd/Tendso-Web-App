import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import {
    CREATOR_CODE_DEFAULT_PRICE, CREATOR_OVERRIDE_CUTOVER, CREATOR_OVERRIDE_MONTHS, CREATOR_OVERRIDE_RATE,
    REFERRAL_BONUS, creatorOverrideEndsAt, earnsCreatorOverride, overrideFor,
} from '../../lib/pricing';
import { clientIpFromHeaders, hashIp } from '../../convex/lib/attribution';
import { manilaMonth } from '../../convex/creatorPortal';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './affiliates.ts': () => import('../../convex/affiliates'),
    './attribution.ts': () => import('../../convex/attribution'),
    './creatorOverrides.ts': () => import('../../convex/creatorOverrides'),
    './creatorPortal.ts': () => import('../../convex/creatorPortal'),
    './creatorProgram.ts': () => import('../../convex/creatorProgram'),
    './creators.ts': () => import('../../convex/creators'),
    './earnings.ts': () => import('../../convex/earnings'),
    './payments.ts': () => import('../../convex/payments'),
    './referrals.ts': () => import('../../convex/referrals'),
    './submissions.ts': () => import('../../convex/submissions'),
};

/** 2026-11-15 12:00 Asia/Manila: after the cut-over. */
const NOW = Date.UTC(2026, 10, 15, 4);
const DAY = 24 * 60 * 60 * 1000;
type T = ReturnType<typeof convexTest>;

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
});

async function setup() {
    const t = convexTest(schema, modules);
    const creatorId = await t.run((ctx) => ctx.db.insert('creators', {
        clerkId: 'mika', email: 'mika@example.com', phone: '09170000001', firstName: 'Mika', lastName: 'Reyes',
        role: 'affiliate', status: 'active', affiliateHandle: 'mika', referralCode: 'MIKA30',
        affiliatePrice: CREATOR_CODE_DEFAULT_PRICE, affiliatePhoto: 'https://example.com/mika.jpg',
        balance: 0, totalEarnings: 0, totalWithdrawn: 0,
    }));
    return { t, creatorId, mika: t.withIdentity({ subject: 'mika', email: 'mika@example.com' }) };
}

async function addAgent(t: T, clerkId: string, fields: Partial<Doc<'creators'>> = {}) {
    return t.run((ctx) => ctx.db.insert('creators', {
        clerkId, email: `${clerkId}@example.com`, firstName: clerkId, role: 'creator', status: 'active',
        referralCode: clerkId.toUpperCase(), balance: 0, totalEarnings: 0, ...fields,
    }));
}

async function addSale(t: T, creatorId: Id<'creators'>, fields: Partial<Doc<'submissions'>> = {}) {
    return t.run((ctx) => ctx.db.insert('submissions', {
        creatorId, businessName: 'Kanto Barbers', businessType: 'barber', ownerName: 'Jun', ownerPhone: '09179999999',
        ownerEmail: 'jun@example.com', address: '1 Rizal St', city: 'Marikina', status: 'pending_payment',
        amount: 2999, creatorPayout: 1500, ...fields,
    }));
}

const overrides = (t: T) => t.run(async (ctx) => (await ctx.db.query('earnings').collect()).filter((row) => row.type === 'creator_override'));
const credit = (t: T, submissionId: Id<'submissions'>) => t.mutation(internal.creatorOverrides.creditForSubmission, { submissionId });

/** Sign up a field agent with the creator's code, then run the scheduled referral step. */
async function recruitByCode(t: T, clerkId: string, code = 'MIKA30') {
    const agent = t.withIdentity({ subject: clerkId, email: `${clerkId}@example.com` });
    const id = await agent.mutation(api.creators.create, { clerkId, email: `${clerkId}@example.com`, firstName: clerkId, referralCode: clerkId.toUpperCase(), referredByCode: code });
    const jobs = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect());
    const job = jobs.find((row) => row.name === 'referrals:createFromSignup' && (row.args[0] as { referredId: string }).referredId === id);
    await t.mutation(internal.referrals.createFromSignup, job!.args[0] as never);
    return id;
}

describe('override math', () => {
    it('is 5% of the website price for 12 months, from the cut-over', () => {
        expect(CREATOR_OVERRIDE_RATE).toBe(0.05);
        expect(CREATOR_OVERRIDE_MONTHS).toBe(12);
        expect([999, 2999, 3499, 4999].map(overrideFor)).toEqual([50, 150, 175, 250]);
        expect(overrideFor(0)).toBe(0);
        expect(overrideFor(Number.NaN)).toBe(0);
        expect(CREATOR_CODE_DEFAULT_PRICE).toBe(3499);
        expect(earnsCreatorOverride(CREATOR_OVERRIDE_CUTOVER)).toBe(true);
        expect(earnsCreatorOverride(CREATOR_OVERRIDE_CUTOVER - 1)).toBe(false);
        expect(new Date(creatorOverrideEndsAt(Date.UTC(2026, 10, 15))).toISOString()).toBe('2027-11-15T00:00:00.000Z');
        expect(REFERRAL_BONUS).toBe(1000);
    });
});

describe('recruit link', () => {
    it('stores the creator and join date on a field agent who signs up with the code, with no ₱1,000 referral', async () => {
        const { t, creatorId } = await setup();
        const agentId = await recruitByCode(t, 'ana');
        expect(await t.run((ctx) => ctx.db.get(agentId))).toMatchObject({
            recruitedByCreatorId: creatorId, recruitedAt: NOW, recruitedVia: 'code', referredBy: creatorId, referredByCode: 'MIKA30',
        });
        expect(await t.run((ctx) => ctx.db.query('referrals').collect())).toEqual([]);
    });

    it('keeps the legacy ₱1,000 referral for a creator recruit from before the cut-over, and pays no override on it', async () => {
        const { t, creatorId } = await setup();
        vi.setSystemTime(CREATOR_OVERRIDE_CUTOVER - DAY);
        const agentId = await recruitByCode(t, 'old');
        vi.setSystemTime(NOW);
        expect((await t.run((ctx) => ctx.db.get(agentId)))?.recruitedByCreatorId).toBeUndefined();
        expect(await t.run((ctx) => ctx.db.query('referrals').collect())).toEqual([expect.objectContaining({ referrerId: creatorId, referredId: agentId, status: 'pending' })]);

        const saleId = await addSale(t, agentId, { status: 'completed' });
        expect(await credit(t, saleId)).toMatchObject({ credited: false, reason: 'not_recruited' });
        await t.mutation(internal.referrals.qualifyByCreator, { referredId: agentId, bonusAmount: REFERRAL_BONUS });
        expect(await t.run((ctx) => ctx.db.get(creatorId))).toMatchObject({ balance: 1000, totalEarnings: 1000 });
        expect(await overrides(t)).toEqual([]);

        // Even a recruitedAt stamped before the cut-over stays on the bonus track.
        await t.run((ctx) => ctx.db.patch(agentId, { recruitedByCreatorId: creatorId, recruitedAt: CREATOR_OVERRIDE_CUTOVER - DAY }));
        expect(await credit(t, saleId)).toMatchObject({ credited: false, reason: 'legacy_referral' });
    });

    it('refuses self-referral, a second creator, and an agent who has already sold', async () => {
        const { t, creatorId, mika } = await setup();
        await expect(mika.mutation(api.attribution.claimAttribution, { handle: 'MIKA30', source: 'code' })).rejects.toThrow('your own');
        const sameEmail = t.withIdentity({ subject: 'twin', email: 'MIKA@example.com' });
        await expect(sameEmail.mutation(api.attribution.claimAttribution, { handle: 'MIKA30', source: 'code' })).rejects.toThrow('your own');

        const otherCreator = await t.run((ctx) => ctx.db.insert('creators', {
            clerkId: 'leo', email: 'leo@example.com', role: 'affiliate', status: 'active', affiliateHandle: 'leo', referralCode: 'LEO30', balance: 0,
        }));
        const agentId = await recruitByCode(t, 'ana');
        const ana = t.withIdentity({ subject: 'ana', email: 'ana@example.com' });
        expect(await ana.mutation(api.attribution.claimAttribution, { handle: 'leo', source: 'confirmed' })).toMatchObject({ linked: false, reason: 'already_recruited' });
        expect((await t.run((ctx) => ctx.db.get(agentId)))?.recruitedByCreatorId).toBe(creatorId);
        expect((await t.run((ctx) => ctx.db.get(otherCreator)))?.balance).toBe(0);

        const sellerId = await addAgent(t, 'seller');
        await addSale(t, sellerId, { status: 'completed' });
        const seller = t.withIdentity({ subject: 'seller', email: 'seller@example.com' });
        expect(await seller.mutation(api.attribution.claimAttribution, { handle: 'MIKA30', source: 'code' })).toMatchObject({ linked: false, reason: 'already_selling' });
        expect((await t.run((ctx) => ctx.db.get(sellerId)))?.recruitedByCreatorId).toBeUndefined();
    });
});

describe('override payout', () => {
    it('credits 5% of the website price (domain excluded) when the shop pays in full, once', async () => {
        const { t, creatorId } = await setup();
        const agentId = await recruitByCode(t, 'ana');
        const saleId = await addSale(t, agentId, {
            amount: 2999 + 500, submissionType: 'with_custom_domain', domainChargedPHP: 500, requestedDomain: 'kanto.ph',
        });
        await t.mutation(internal.payments.creditCreatorForPayment, { submissionId: saleId, triggeredBy: 'system:auto-payment' });
        const jobs = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect());
        expect(jobs.filter((job) => job.name === 'creatorOverrides:creditForSubmission').map((job) => job.args[0])).toEqual([{ submissionId: saleId }]);

        expect(await credit(t, saleId)).toEqual({ credited: true, amount: 150 });
        expect(await credit(t, saleId)).toMatchObject({ credited: false, reason: 'already_credited' });
        expect(await t.run((ctx) => ctx.db.get(creatorId))).toMatchObject({ balance: 150, totalEarnings: 150 });
        expect(await overrides(t)).toEqual([expect.objectContaining({ creatorId, submissionId: saleId, amount: 150, status: 'available' })]);
        // The agent's own 50% is untouched by the override.
        expect((await t.run((ctx) => ctx.db.get(agentId)))?.balance).toBe(1500);
    });

    it('fires from the paid-in-full hook: a down payment pays no override, the balance pays it once', async () => {
        const { t, creatorId } = await setup();
        const agentId = await recruitByCode(t, 'ana');
        const saleId = await addSale(t, agentId);
        const overrideJobs = async () => (await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect()))
            .filter((job) => job.name === 'creatorOverrides:creditForSubmission');

        // Down payment: the agent gets their whole cut now, the creator nothing yet.
        await t.mutation(internal.payments.creditCreatorForPayment, { submissionId: saleId, triggeredBy: 'system:xendit', stage: 'deposit', depositAmount: 500 });
        expect(await t.run((ctx) => ctx.db.get(saleId))).toMatchObject({ status: 'deposit_paid', depositPaidAt: NOW, balanceDue: 2499 });
        expect(await overrideJobs()).toEqual([]);
        expect(await credit(t, saleId)).toMatchObject({ credited: false, reason: 'not_paid_in_full' });
        expect((await t.run((ctx) => ctx.db.get(agentId)))?.balance).toBe(1500);

        // Balance: paid in full, the override is scheduled exactly once.
        await t.mutation(internal.payments.creditCreatorForPayment, { submissionId: saleId, triggeredBy: 'system:xendit' });
        expect(await t.run((ctx) => ctx.db.get(saleId))).toMatchObject({ status: 'completed', paidInFullAt: NOW, balanceDue: 0 });
        expect(await overrideJobs()).toHaveLength(1);
        // A repeated webhook is a no-op.
        await t.mutation(internal.payments.creditCreatorForPayment, { submissionId: saleId, triggeredBy: 'system:xendit' });
        expect(await overrideJobs()).toHaveLength(1);

        expect(await credit(t, saleId)).toEqual({ credited: true, amount: 150 });
        expect(await credit(t, saleId)).toMatchObject({ credited: false, reason: 'already_credited' });
        expect(await overrides(t)).toEqual([expect.objectContaining({ creatorId, submissionId: saleId, amount: 150 })]);
        expect((await t.run((ctx) => ctx.db.get(agentId)))?.balance).toBe(1500);
    });

    it('never credits on a down payment (deposit_paid), only once paid in full', async () => {
        const { t, creatorId } = await setup();
        const agentId = await recruitByCode(t, 'ana');
        const saleId = await addSale(t, agentId, { status: 'deposit_paid', amount: 4999, creatorPayout: 2500 });
        expect(await credit(t, saleId)).toMatchObject({ credited: false, reason: 'not_paid_in_full' });
        expect(await overrides(t)).toEqual([]);
        await t.run((ctx) => ctx.db.patch(saleId, { status: 'paid', paidAt: NOW }));
        expect(await credit(t, saleId)).toEqual({ credited: true, amount: 250 });
        expect((await t.run((ctx) => ctx.db.get(creatorId)))?.balance).toBe(250);
    });

    it('schedules the override from submissions.markPaid too', async () => {
        const { t } = await setup();
        await t.run((ctx) => ctx.db.insert('creators', { clerkId: 'admin', email: 'admin@example.com', role: 'admin', status: 'active' }));
        const agentId = await recruitByCode(t, 'ana');
        const saleId = await addSale(t, agentId);
        await t.withIdentity({ subject: 'admin' }).mutation(api.submissions.markPaid, { id: saleId });
        const jobs = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect());
        expect(jobs.some((job) => job.name === 'creatorOverrides:creditForSubmission')).toBe(true);
        expect(await credit(t, saleId)).toEqual({ credited: true, amount: 150 });
    });

    it('pays only within 12 months of the join date', async () => {
        const { t, creatorId } = await setup();
        const joinedAt = Date.UTC(2026, 10, 1);
        const agentId = await addAgent(t, 'ana', { recruitedByCreatorId: creatorId, recruitedAt: joinedAt, recruitedVia: 'code' });
        const inside = await addSale(t, agentId, { status: 'paid', paidAt: creatorOverrideEndsAt(joinedAt) - 1 });
        const atEnd = await addSale(t, agentId, { status: 'paid', paidAt: creatorOverrideEndsAt(joinedAt) });
        const beforeJoin = await addSale(t, agentId, { status: 'paid', paidAt: joinedAt - 1 });
        expect(await credit(t, inside)).toEqual({ credited: true, amount: 150 });
        expect(await credit(t, atEnd)).toMatchObject({ credited: false, reason: 'outside_window' });
        expect(await credit(t, beforeJoin)).toMatchObject({ credited: false, reason: 'outside_window' });
    });

    it('is one level only: nothing on a recruit’s recruits', async () => {
        const { t, creatorId } = await setup();
        const anaId = await recruitByCode(t, 'ana');
        // Ana (a field agent) invites Ben with her own code: the legacy field-agent referral.
        const benId = await recruitByCode(t, 'ben', 'ANA');
        expect((await t.run((ctx) => ctx.db.get(benId)))?.recruitedByCreatorId).toBeUndefined();
        expect(await t.run((ctx) => ctx.db.query('referrals').collect())).toEqual([expect.objectContaining({ referrerId: anaId, referredId: benId })]);
        const benSale = await addSale(t, benId, { status: 'completed' });
        expect(await credit(t, benSale)).toMatchObject({ credited: false, reason: 'not_recruited' });

        // A creator's own sales, and an affiliate account as "recruit", never pay an override.
        const ownSale = await addSale(t, creatorId, { status: 'completed' });
        expect(await credit(t, ownSale)).toMatchObject({ credited: false, reason: 'not_field_agent' });
        expect((await t.run((ctx) => ctx.db.get(creatorId)))?.balance).toBe(0);
    });

    it('pays nothing on the creator’s own shop, a comped site or a giveaway', async () => {
        const { t } = await setup();
        const agentId = await recruitByCode(t, 'ana');
        const ownShop = await addSale(t, agentId, { status: 'completed', ownerEmail: 'Mika@Example.com' });
        const ownPhone = await addSale(t, agentId, { status: 'completed', ownerEmail: undefined, ownerPhone: '+63 917 000 0001' });
        const comped = await addSale(t, agentId, { status: 'completed', pricingMode: 'comped' });
        const giveaway = await addSale(t, agentId, { status: 'completed', giveawayApplication: true, amount: 0, creatorPayout: 0 });
        expect(await credit(t, ownShop)).toMatchObject({ reason: 'own_site' });
        expect(await credit(t, ownPhone)).toMatchObject({ reason: 'own_site' });
        expect(await credit(t, comped)).toMatchObject({ reason: 'not_a_sale' });
        expect(await credit(t, giveaway)).toMatchObject({ reason: 'not_a_sale' });
        expect(await overrides(t)).toEqual([]);
    });
});

describe('attribution', () => {
    it('keeps a colliding handle and code separate for clicks, owner claims and recruits', async () => {
        const { t, creatorId } = await setup();
        const codeOwnerId = await t.run((ctx) => ctx.db.insert('creators', {
            clerkId: 'leo', email: 'leo@example.com', role: 'affiliate', status: 'active',
            affiliateHandle: 'leo', referralCode: 'MIKA', balance: 0,
        }));
        for (const code of ['MIKA', 'mika', ' MiKa ']) {
            expect(await t.query(api.creatorProgram.getCreatorByCode, { code })).toMatchObject({ handle: 'leo', code: 'MIKA' });
        }
        expect(await t.mutation(api.attribution.recordClick, { handle: 'mika', kind: 'earn', cookieId: 'collision' }))
            .toMatchObject({ creator: { handle: 'mika', code: 'MIKA30' } });
        const linkedId = await addAgent(t, 'linked');
        await t.withIdentity({ subject: 'linked' }).mutation(api.attribution.claimAttribution, { handle: 'mika', source: 'confirmed' });
        expect(await t.run((ctx) => ctx.db.get(linkedId))).toMatchObject({ recruitedByCreatorId: creatorId });
        expect(await t.withIdentity({ subject: 'linked' }).query(api.attribution.myAttribution, {}))
            .toMatchObject({ creator: { handle: 'mika' } });

        const agentId = await addAgent(t, 'typed');
        await t.withIdentity({ subject: 'typed' }).mutation(api.attribution.claimAttribution, { handle: 'mika', source: 'code' });
        expect(await t.run((ctx) => ctx.db.get(agentId))).toMatchObject({ recruitedByCreatorId: codeOwnerId });
        await t.withIdentity({ subject: 'owner' }).mutation(api.attribution.claimAttribution, { handle: 'MIKA', source: 'code', as: 'owner' });
        expect(await t.run((ctx) => ctx.db.query('creatorAttributions').withIndex('by_clerk_id', (q) => q.eq('clerkId', 'owner')).first()))
            .toMatchObject({ creatorId: codeOwnerId, kind: 'owner' });

        // An inactive code must never fall back to another creator's active handle.
        await t.run((ctx) => ctx.db.patch(codeOwnerId, { status: 'suspended' }));
        expect(await t.query(api.creatorProgram.getCreatorByCode, { code: 'MIKA' })).toBeNull();
        await expect(t.withIdentity({ subject: 'late' }).mutation(api.attribution.claimAttribution, { handle: 'MIKA', source: 'code' }))
            .rejects.toThrow('could not find');
    });

    it('suggests the creator behind a recent click but never attributes on its own', async () => {
        const { t, creatorId } = await setup();
        expect(await t.mutation(api.attribution.recordClick, { handle: 'mika', kind: 'earn', cookieId: 'cookie-1', userAgent: 'Mozilla/5.0' }))
            .toMatchObject({ recorded: true, creator: { handle: 'mika', name: 'Mika Reyes', saving: 1500 } });
        // The same browser re-opening the link is one click.
        expect(await t.mutation(api.attribution.recordClick, { handle: 'mika', kind: 'earn', cookieId: 'cookie-1' })).toMatchObject({ recorded: false });
        await t.mutation(internal.attribution.recordClickInternal, { handle: 'mika', kind: 'shop', ipHash: 'hash-a', userAgent: 'iPhone' });
        expect(await t.mutation(api.attribution.recordClick, { handle: 'nobody', kind: 'shop', cookieId: 'cookie-1' })).toEqual({ recorded: false, creator: null });
        const clicks = await t.run((ctx) => ctx.db.query('attributionClicks').collect());
        expect(clicks).toHaveLength(2);
        expect(JSON.stringify(clicks)).not.toMatch(/\d+\.\d+\.\d+\.\d+/);

        const agentId = await addAgent(t, 'ana');
        const ana = t.withIdentity({ subject: 'ana', email: 'ana@example.com' });
        expect(await ana.query(api.attribution.suggestAttribution, { cookieId: 'cookie-1' })).toMatchObject({ creator: { handle: 'mika' }, kind: 'earn', matchedBy: 'cookie' });
        expect(await t.query(internal.attribution.suggestInternal, { ipHash: 'hash-a' })).toMatchObject({ creator: { handle: 'mika' }, kind: 'shop', matchedBy: 'network' });
        expect(await t.query(internal.attribution.suggestInternal, { ipHash: 'hash-b' })).toBeNull();
        // Asking changed nothing.
        expect((await t.run((ctx) => ctx.db.get(agentId)))?.recruitedByCreatorId).toBeUndefined();
        expect(await t.run((ctx) => ctx.db.query('creatorAttributions').collect())).toEqual([]);
        // The creator is never suggested to themselves.
        expect(await t.withIdentity({ subject: 'mika' }).query(api.attribution.suggestAttribution, { cookieId: 'cookie-1' })).toBeNull();

        vi.setSystemTime(NOW + DAY + 1);
        expect(await ana.query(api.attribution.suggestAttribution, { cookieId: 'cookie-1' })).toBeNull();
        vi.setSystemTime(NOW);

        expect(await ana.mutation(api.attribution.claimAttribution, { handle: 'mika', source: 'confirmed' })).toMatchObject({ status: 'claimed', kind: 'agent', linked: true });
        expect(await t.run((ctx) => ctx.db.get(agentId))).toMatchObject({ recruitedByCreatorId: creatorId, recruitedVia: 'confirmed' });
        expect(await ana.query(api.attribution.suggestAttribution, { cookieId: 'cookie-1' })).toBeNull();
        expect(await ana.query(api.attribution.myAttribution, {})).toMatchObject({ kind: 'agent', status: 'applied', creator: { handle: 'mika' } });
    });

    it('applies an agent claim made before the account existed, and stores an owner claim for checkout', async () => {
        const { t, creatorId } = await setup();
        const early = t.withIdentity({ subject: 'early', email: 'early@example.com' });
        expect(await early.mutation(api.attribution.claimAttribution, { handle: 'mika', source: 'install_referrer' })).toMatchObject({ kind: 'agent', linked: false });
        const id = await early.mutation(api.creators.create, { clerkId: 'early', email: 'early@example.com', referralCode: 'EARLY' });
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ recruitedByCreatorId: creatorId, recruitedVia: 'install_referrer' });
        expect(await early.query(api.attribution.myAttribution, {})).toMatchObject({ status: 'applied' });

        await t.run((ctx) => ctx.db.insert('businessOwners', { clerkId: 'owner', email: 'owner@example.com', createdAt: NOW }));
        const owner = t.withIdentity({ subject: 'owner', email: 'owner@example.com' });
        expect(await owner.mutation(api.attribution.claimAttribution, { handle: 'MIKA30', source: 'code' })).toMatchObject({ kind: 'owner', linked: true, creator: { code: 'MIKA30', price: 3499 } });
        expect(await owner.mutation(api.attribution.claimAttribution, { handle: 'MIKA30', source: 'code' })).toMatchObject({ status: 'unchanged' });
    });

    it('hashes the caller IP with a salt and never returns the raw IP', async () => {
        const headers = (entries: Record<string, string>) => new Headers(entries);
        expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7');
        expect(clientIpFromHeaders(headers({ 'cf-connecting-ip': '2001:DB8::1', 'x-forwarded-for': '203.0.113.7' }))).toBe('2001:db8::1');
        expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '<script>' }))).toBeNull();
        expect(await hashIp('203.0.113.7', undefined)).toBeNull();
        const a = await hashIp('203.0.113.7', 'salt-1');
        expect(a).toMatch(/^[0-9a-f]{64}$/);
        expect(a).not.toContain('203');
        expect(await hashIp('203.0.113.7', 'salt-2')).not.toBe(a);
        expect(await hashIp('203.0.113.7', 'salt-1')).toBe(a);
    });
});

describe('creator sign-up and code', () => {
    it('lands a pending application on the existing admin list; the code works only after approval', async () => {
        const { t } = await setup();
        await t.run((ctx) => ctx.db.insert('creators', { clerkId: 'admin', email: 'admin@example.com', role: 'admin', status: 'active' }));
        const admin = t.withIdentity({ subject: 'admin' });
        const lia = t.withIdentity({ subject: 'lia', email: 'Lia@Example.com' });
        expect(await t.query(api.creatorProgram.checkAvailability, { handle: 'mika', code: 'mika30' })).toMatchObject({
            handle: { available: false }, code: { value: 'MIKA30', available: false },
        });
        expect(await t.query(api.creatorProgram.checkAvailability, { code: 'OTR30' })).toMatchObject({ code: { available: false, error: expect.stringContaining('reserved') } });
        expect(await t.query(api.creatorProgram.checkAvailability, { handle: 'Lia-Makes', code: 'lia25' })).toMatchObject({
            handle: { value: 'lia-makes', available: true }, code: { value: 'LIA25', available: true },
        });

        const args = { firstName: 'Lia', lastName: 'Cruz', handle: 'lia-makes', code: 'lia25', socials: [{ platform: 'tiktok' as const, handle: '@liamakes' }], audienceSize: 12000 };
        await expect(lia.mutation(api.creatorProgram.apply, { ...args, socials: [] })).rejects.toThrow('social');
        await expect(lia.mutation(api.creatorProgram.apply, { ...args, code: 'MIKA30' })).rejects.toThrow('taken');
        const id = await lia.mutation(api.creatorProgram.apply, args);
        expect(await lia.mutation(api.creatorProgram.apply, { ...args, firstName: 'Changed' })).toBe(id);
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
            role: 'affiliate', status: 'pending', email: 'lia@example.com', affiliateHandle: 'lia-makes', referralCode: 'LIA25',
            affiliatePrice: 3499, creatorSocials: [{ platform: 'tiktok', handle: '@liamakes' }], creatorAudienceSize: 12000, creatorAppliedAt: NOW, firstName: 'Lia',
        });
        expect(await lia.query(api.creatorProgram.myApplication, {})).toMatchObject({ status: 'pending', handle: 'lia-makes', code: 'LIA25' });
        expect((await admin.query(api.affiliates.list, {})).map((row) => row._id)).toContain(id);
        expect(await t.query(api.creatorProgram.getCreatorByCode, { code: 'LIA25' })).toBeNull();
        await expect(lia.query(api.creatorPortal.summary, {})).rejects.toThrow('admin approval');

        await admin.mutation(api.creators.updateStatus, { id, status: 'active' });
        expect(await t.query(api.creatorProgram.getCreatorByCode, { code: 'lia25' })).toEqual({
            handle: 'lia-makes', name: 'Lia Cruz', photo: null, code: 'LIA25', listPrice: 4999, price: 3499, saving: 1500, percentOff: 30,
        });
        expect(await t.query(api.creatorProgram.getCreatorByCode, { code: 'lia-makes' })).toBeNull();
        expect(await t.query(api.creatorProgram.myApplication, {})).toEqual({ status: 'signed_out' });
    });
});

describe('creator portal', () => {
    it.each(['deposit_paid', 'pending_payment', 'deployed'])('excludes own-shop email and phone matches from pending team earnings (%s)', async (status) => {
        const { t, mika } = await setup();
        const agentId = await recruitByCode(t, 'ana');
        const ownEmail = await addSale(t, agentId, { status, amount: 4999, ownerEmail: '  MIKA@Example.com  ' });
        const ownPhone = await addSale(t, agentId, { status, amount: 4999, ownerEmail: undefined, ownerPhone: '+63 917 000 0001' });
        await addSale(t, agentId, { status, amount: 4999 });
        expect((await mika.query(api.creatorPortal.summary, {})).payouts)
            .toMatchObject({ waitingFromTeam: 250, waitingForShops: 250 });
        for (const submissionId of [ownEmail, ownPhone]) {
            await t.run((ctx) => ctx.db.patch(submissionId, { status: 'paid', paidAt: NOW }));
            expect(await credit(t, submissionId)).toMatchObject({ credited: false, reason: 'own_site' });
        }
        expect(await overrides(t)).toEqual([]);
    });

    it('summarises now money, monthly money, funnel, recruits, shops and payouts in ₱', async () => {
        const { t, creatorId, mika } = await setup();
        const month = manilaMonth(NOW);
        expect(month.label).toBe('2026-11');
        // Shops that used Mika's code: one paid this month, one still paying, one paid last month.
        await addSale(t, creatorId, { status: 'completed', amount: 3499, creatorPayout: 1750, creatorPaidAt: NOW - DAY, websiteListPrice: 4999 });
        await addSale(t, creatorId, { status: 'deposit_paid', amount: 3499, creatorPayout: 1750, businessName: 'Tahi Tailors' });
        await addSale(t, creatorId, { status: 'completed', amount: 3499, creatorPayout: 1750, creatorPaidAt: month.start - DAY });
        await t.run((ctx) => ctx.db.patch(creatorId, { balance: 3650 }));

        const anaId = await recruitByCode(t, 'ana');
        const benId = await recruitByCode(t, 'ben');
        const anaSale = await addSale(t, anaId, { status: 'paid', paidAt: NOW, city: 'Pasig' });
        await credit(t, anaSale);
        await addSale(t, benId, { status: 'pending_payment', amount: 4999, creatorPayout: 2500 });
        await t.mutation(api.attribution.recordClick, { handle: 'mika', kind: 'earn', cookieId: 'c1' });
        await t.mutation(api.attribution.recordClick, { handle: 'mika', kind: 'shop', cookieId: 'c2' });
        await t.run((ctx) => ctx.db.insert('withdrawals', { creatorId, amount: 1000, payoutMethod: 'wise_email', accountDetails: 'x', status: 'completed', createdAt: NOW - 2 * DAY, processedAt: NOW - DAY }));

        const summary = await mika.query(api.creatorPortal.summary, {});
        expect(summary.creator).toMatchObject({ handle: 'mika', code: 'MIKA30', price: 3499, saving: 1500, shopLink: '/v2/a/mika', earnLink: '/v2/a/mika/earn' });
        expect(summary.now).toMatchObject({ thisMonth: 1750, shopsThisMonth: 1 });
        expect(summary.monthly).toEqual({ thisMonth: 150, activeAgents: 1, agentsInWindow: 2, nextEndDate: creatorOverrideEndsAt(NOW) });
        expect(summary.funnel).toEqual({ shop: { clicks: 1, signUps: 0, sales: 2 }, earn: { clicks: 1, signUps: 2, sales: 1 } });
        expect(summary.recruits.find((row) => row.creatorId === anaId)).toMatchObject({
            name: 'ana', area: 'Pasig', joinedAt: NOW, salesThisMonth: 1, overrideThisMonth: 150, monthsLeft: 12, earning: true,
        });
        expect(summary.shops.map((shop) => shop.status)).toEqual(expect.arrayContaining(['paid', 'paying', 'paid']));
        expect(summary.shops.find((shop) => shop.businessName === 'Tahi Tailors')).toMatchObject({ listPrice: 4999, paid: 3499, kept: 1750, status: 'paying' });
        expect(summary.payouts).toMatchObject({
            readyToSend: 3800, waitingFromShops: 1750, waitingFromTeam: 250, waitingForShops: 2000, inFlight: 0,
            history: [{ amount: 1000, status: 'completed', requestedAt: NOW - 2 * DAY, sentAt: NOW - DAY }],
        });
        await expect(t.withIdentity({ subject: 'ana' }).query(api.creatorPortal.summary, {})).rejects.toThrow('creator account');
    });
});
