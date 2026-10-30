import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { creatorCodeError, normalizeCreatorCode } from '../../lib/creatorCodes';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './creatorProgram.ts': () => import('../../convex/creatorProgram'),
    './creators.ts': () => import('../../convex/creators'),
    './affiliates.ts': () => import('../../convex/affiliates'),
    './attribution.ts': () => import('../../convex/attribution'),
    './ownerApp.ts': () => import('../../convex/ownerApp'),
    './fieldAgentOnboarding.ts': () => import('../../convex/fieldAgentOnboarding'),
    './referrals.ts': () => import('../../convex/referrals'),
};
const NOW = Date.UTC(2026, 10, 2, 4);
const OLD = 'AFFMIKA8N3X';
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => vi.useRealTimers());

async function setup() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
        const mika = await ctx.db.insert('creators', { clerkId: 'mika', email: 'mika@example.test', firstName: 'Mika', role: 'affiliate', status: 'active',
            affiliateHandle: 'mika', referralCode: OLD, affiliatePrice: 1999, balance: 750, totalEarnings: 1250, totalWithdrawn: 500 });
        const toni = await ctx.db.insert('creators', { clerkId: 'toni', email: 'toni@example.test', role: 'affiliate', status: 'active', affiliateHandle: 'toni', referralCode: 'TONI30' });
        const agent = await ctx.db.insert('creators', { clerkId: 'agent', email: 'agent@example.test', role: 'creator', status: 'active', referralCode: 'JOYD4K2', workCity: 'Marikina' });
        await ctx.db.insert('creators', { clerkId: 'admin', email: 'admin@example.test', role: 'admin', status: 'active' });
        const owner = await ctx.db.insert('businessOwners', { clerkId: 'owner', email: 'owner@example.test', name: 'Shop owner', createdAt: NOW });
        const draft = await ctx.db.insert('submissions', { creatorId: agent, businessName: 'New owner shop', businessType: 'Other', ownerName: 'Owner', ownerPhone: '09171111111',
            ownerEmail: 'owner@example.test', address: 'Main St', city: 'Marikina', contentSource: 'owner_app', status: 'draft', amount: 4999, creatorPayout: 0 });
        await ctx.db.insert('websiteOwnerships', { businessOwnerId: owner, submissionId: draft, role: 'owner', claimedAt: NOW });
        const historical = await ctx.db.insert('submissions', { creatorId: mika, businessName: 'Existing paid quote', businessType: 'Other', ownerName: 'Existing owner', ownerPhone: '09172222222',
            address: 'Market St', city: 'Marikina', status: 'completed', affiliateHandle: 'mika', amount: 2499, creatorPayout: 1250, websiteListPrice: 4999, paidInFullAt: NOW - 1000 });
        await ctx.db.insert('earnings', { creatorId: mika, submissionId: historical, type: 'submission_approved', status: 'available', amount: 1250, createdAt: NOW - 1000 });
        await ctx.db.insert('paymentTokens', { submissionId: historical, token: 'old-quote-token', referenceCode: 'OLDQUOTE', amount: 2499, status: 'paid', createdAt: NOW - 2000, expiresAt: NOW + 1000 });
        await ctx.db.insert('withdrawals', { creatorId: mika, amount: 500, payoutMethod: 'wise_email', accountDetails: 'private', status: 'completed', createdAt: NOW - 500 });
        return { mika, toni, agent, owner, draft, historical };
    });
    return { t, ids, mika: t.withIdentity({ subject: 'mika', email: 'mika@example.test' }), toni: t.withIdentity({ subject: 'toni' }),
        agent: t.withIdentity({ subject: 'agent' }), owner: t.withIdentity({ subject: 'owner', email: 'owner@example.test' }) };
}

describe('readable creator codes and permanent aliases', () => {
    it('checks normalized availability and saves only the code, preserving all existing prices, balances, referrals and payout records', async () => {
        const { t, ids, mika } = await setup();
        const financialSnapshot = () => t.run(async ctx => ({
            submissions: await ctx.db.query('submissions').collect(), earnings: await ctx.db.query('earnings').collect(),
            tokens: await ctx.db.query('paymentTokens').collect(), withdrawals: await ctx.db.query('withdrawals').collect(),
            referrals: await ctx.db.query('referrals').collect(), attributions: await ctx.db.query('creatorAttributions').collect(),
        }));
        const before = await financialSnapshot();
        const account = await t.run(ctx => ctx.db.get(ids.mika));
        expect(await mika.query(api.creatorProgram.checkCodeAvailability, { code: '  mika30  ' })).toEqual({ value: 'MIKA30', available: true, error: null });
        expect(await mika.mutation(api.creatorProgram.updateCode, { code: '  mika30  ' })).toEqual({ code: 'MIKA30' });
        expect(await t.run(ctx => ctx.db.get(ids.mika))).toEqual({ ...account, referralCode: 'MIKA30' });
        expect(await financialSnapshot()).toEqual(before);
        expect((await t.run(ctx => ctx.db.query('creatorCodeAliases').collect())).map(row => ({ code: row.code, creatorId: row.creatorId }))).toEqual([
            { code: OLD, creatorId: ids.mika }, { code: 'MIKA30', creatorId: ids.mika },
        ]);
        for (const code of [OLD, 'MIKA30']) {
            expect(await mika.query(api.creatorProgram.checkCodeAvailability, { code })).toEqual({ value: code, available: true, error: null });
            expect(await t.query(api.creatorProgram.checkAvailability, { code })).toMatchObject({ code: { available: false } });
            expect(await t.query(api.creatorProgram.getCreatorByCode, { code: code.toLowerCase() })).toMatchObject({ handle: 'mika', code: 'MIKA30', price: 3499, percentOff: 30 });
            expect((await t.query(api.creators.getByReferralCode, { referralCode: ` ${code.toLowerCase()} ` }))?._id).toBe(ids.mika);
        }
        expect(await t.query(api.creatorProgram.getCreatorByHandle, { handle: 'mika' })).toMatchObject({ handle: 'mika', code: 'MIKA30' });
        expect(await t.run(ctx => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);
    });

    it('lets the same creator reuse an earlier code and makes repeated saves idempotent', async () => {
        const { t, mika } = await setup();
        await mika.mutation(api.creatorProgram.updateCode, { code: 'MIKA30' });
        await mika.mutation(api.creatorProgram.updateCode, { code: 'MIKAREYES' });
        await mika.mutation(api.creatorProgram.updateCode, { code: OLD });
        const aliases = await t.run(ctx => ctx.db.query('creatorCodeAliases').collect());
        vi.setSystemTime(NOW + 1000);
        expect(await mika.mutation(api.creatorProgram.updateCode, { code: OLD })).toEqual({ code: OLD });
        expect(await t.run(ctx => ctx.db.query('creatorCodeAliases').collect())).toEqual(aliases);
        expect(new Set(aliases.map(row => row.code))).toEqual(new Set([OLD, 'MIKA30', 'MIKAREYES']));
    });

    it.each(['TONI30', 'JOYD4K2', 'OTR30', 'bad-code', 'TINY'.slice(0, 3), 'X'.repeat(17)])('rejects taken, reserved or invalid %s atomically', async code => {
        const { t, ids, mika } = await setup();
        const before = await t.run(ctx => ctx.db.get(ids.mika));
        expect(await mika.query(api.creatorProgram.checkCodeAvailability, { code })).toMatchObject({ available: false, error: expect.any(String) });
        await expect(mika.mutation(api.creatorProgram.updateCode, { code })).rejects.toThrow();
        expect(await t.run(ctx => ctx.db.get(ids.mika))).toEqual(before);
        expect(await t.run(ctx => ctx.db.query('creatorCodeAliases').collect())).toEqual([]);
    });

    it('rechecks availability in the mutation after another account claims a previously available candidate', async () => {
        const { t, ids, mika, toni } = await setup();
        expect(await mika.query(api.creatorProgram.checkCodeAvailability, { code: 'SHARED30' })).toMatchObject({ available: true });
        expect(await toni.query(api.creatorProgram.checkCodeAvailability, { code: 'SHARED30' })).toMatchObject({ available: true });
        await toni.mutation(api.creatorProgram.updateCode, { code: 'SHARED30' });
        await expect(mika.mutation(api.creatorProgram.updateCode, { code: 'SHARED30' })).rejects.toThrow('taken');
        expect((await t.run(ctx => ctx.db.get(ids.mika)))?.referralCode).toBe(OLD);
    });

    it('allows exactly one competing code save after both accounts saw an available candidate', async () => {
        const { t, ids, mika, toni } = await setup();
        const before = await t.run(async ctx => [await ctx.db.get(ids.mika), await ctx.db.get(ids.toni)]);
        const checks = await Promise.all([mika, toni].map(caller => caller.query(api.creatorProgram.checkCodeAvailability, { code: 'RACING30' })));
        expect(checks.every(check => check.available)).toBe(true);
        const results = await Promise.allSettled([mika, toni].map(caller => caller.mutation(api.creatorProgram.updateCode, { code: 'RACING30' })));
        expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
        const winner = results.findIndex(result => result.status === 'fulfilled');
        const accounts = await t.run(async ctx => [await ctx.db.get(ids.mika), await ctx.db.get(ids.toni)]);
        expect(accounts[winner]?.referralCode).toBe('RACING30');
        expect(accounts[1 - winner]).toEqual(before[1 - winner]);
        expect(await t.run(ctx => ctx.db.query('creatorCodeAliases').withIndex('by_code', q => q.eq('code', 'RACING30')).collect()))
            .toEqual([expect.objectContaining({ creatorId: winner === 0 ? ids.mika : ids.toni })]);
    });

    it('keeps deleted account aliases reserved, including after the creator row is permanently removed', async () => {
        const { t, ids, mika, toni } = await setup();
        await mika.mutation(api.creatorProgram.updateCode, { code: 'MIKA30' });
        await t.run(ctx => ctx.db.delete(ids.mika));
        for (const code of [OLD, 'MIKA30']) {
            expect(await toni.query(api.creatorProgram.checkCodeAvailability, { code })).toMatchObject({ available: false });
            await expect(toni.mutation(api.creatorProgram.updateCode, { code })).rejects.toThrow('taken');
            expect(await t.query(api.creatorProgram.getCreatorByCode, { code })).toBeNull();
        }
    });

    it.each([null, 'agent', 'admin'])('rejects non-affiliate availability and code writes for %s', async subject => {
        const { t } = await setup();
        const caller = subject ? t.withIdentity({ subject }) : t;
        await expect(caller.query(api.creatorProgram.checkCodeAvailability, { code: 'NEWCODE30' })).rejects.toThrow();
        await expect(caller.mutation(api.creatorProgram.updateCode, { code: 'NEWCODE30' })).rejects.toThrow();
        expect(await t.run(ctx => ctx.db.query('creatorCodeAliases').collect())).toEqual([]);
    });

    it.each(['pending', 'deleted', 'suspended'])('blocks %s affiliate writes while a suspended account may check its own code', async status => {
        const { t, ids, mika } = await setup();
        await t.run(ctx => ctx.db.patch(ids.mika, { status }));
        if (status === 'suspended') expect(await mika.query(api.creatorProgram.checkCodeAvailability, { code: OLD })).toMatchObject({ available: true });
        else await expect(mika.query(api.creatorProgram.checkCodeAvailability, { code: OLD })).rejects.toThrow();
        const before = await t.run(ctx => ctx.db.get(ids.mika));
        await expect(mika.mutation(api.creatorProgram.updateCode, { code: 'MIKA30' })).rejects.toThrow();
        expect(await t.run(ctx => ctx.db.get(ids.mika))).toEqual(before);
        expect(await t.run(ctx => ctx.db.query('creatorCodeAliases').collect())).toEqual([]);
    });

    it('cannot be passed another account or an admin-preview bypass flag', async () => {
        const { mika, ids } = await setup();
        await expect(mika.mutation(api.creatorProgram.updateCode, { code: 'MIKA30', creatorId: ids.toni } as never)).rejects.toThrow();
        await expect(mika.mutation(api.creatorProgram.updateCode, { code: 'MIKA30', preview: true } as never)).rejects.toThrow();
    });
});

describe('alias attribution compatibility', () => {
    it('uses an old printed code for the owner discount and first attribution without changing historical orders', async () => {
        const { t, ids, mika, owner } = await setup();
        const historical = await t.run(ctx => ctx.db.get(ids.historical));
        await mika.mutation(api.creatorProgram.updateCode, { code: 'MIKA30' });
        expect(await owner.mutation(api.ownerApp.applyCreatorCode, { submissionId: ids.draft, code: OLD.toLowerCase() })).toMatchObject({ handle: 'mika', code: 'MIKA30', total: 3499, saving: 1500 });
        expect(await t.run(ctx => ctx.db.get(ids.draft))).toMatchObject({ creatorId: ids.mika, amount: 3499, creatorPayout: 1750 });
        expect(await owner.mutation(api.attribution.claimAttribution, { handle: OLD, source: 'code', as: 'owner' })).toMatchObject({ status: 'unchanged', linked: true, creator: { handle: 'mika' } });
        expect(await t.run(ctx => ctx.db.get(ids.historical))).toEqual(historical);
        expect(await t.query(api.creatorProgram.getCreatorByCode, { code: 'JOYD4K2' })).toBeNull();
        expect((await t.query(api.creators.getByReferralCode, { referralCode: 'JOYD4K2' }))?._id).toBe(ids.agent);
    });

    it('preserves a referral job queued before a rename and never moves or restarts the attached recruit', async () => {
        const { t, ids, mika } = await setup();
        const recruit = t.withIdentity({ subject: 'new-agent', email: 'new-agent@example.test' });
        const id = await recruit.mutation(api.creators.create, { clerkId: 'new-agent', email: 'new-agent@example.test', referralCode: 'AGENTNEW1', referredByCode: OLD });
        const jobs = await t.run(ctx => ctx.db.system.query('_scheduled_functions').collect());
        const job = jobs.find(row => row.name === 'referrals:createFromSignup')!;
        await mika.mutation(api.creatorProgram.updateCode, { code: 'MIKA30' });
        await t.mutation(internal.referrals.createFromSignup, job.args[0] as never);
        const attached = await t.run(ctx => ctx.db.get(id));
        expect(attached).toMatchObject({ referredBy: ids.mika, referredByCode: OLD, recruitedByCreatorId: ids.mika, recruitedAt: NOW });
        vi.setSystemTime(NOW + 5000);
        await t.mutation(internal.referrals.createFromSignup, job.args[0] as never);
        expect(await t.run(ctx => ctx.db.get(id))).toEqual(attached);
        expect(await t.run(ctx => ctx.db.query('referrals').collect())).toEqual([]);
        // Retrying signup ignores a newly taken requested own code, preserving the existing account.
        expect(await recruit.mutation(api.creators.create, { clerkId: 'new-agent', referralCode: 'MIKA30' })).toBe(id);
        expect(await t.run(ctx => ctx.db.get(id))).toEqual(attached);
    });

    it('accepts old/current onboarding retries by the same referrer identity without changing completed attribution', async () => {
        const { t, ids, mika, agent } = await setup();
        await mika.mutation(api.creatorProgram.updateCode, { code: 'MIKA30' });
        await agent.mutation(api.fieldAgentOnboarding.saveDiscovery, { discoverySource: 'friend', referredByCode: OLD });
        await t.run(ctx => ctx.db.patch(ids.agent, { fieldAgentOnboardingCompletedAt: NOW }));
        const attached = await t.run(ctx => ctx.db.get(ids.agent));
        expect(attached).toMatchObject({ recruitedByCreatorId: ids.mika, referredByCode: 'MIKA30', recruitedAt: NOW });
        vi.setSystemTime(NOW + 1000);
        for (const referredByCode of [OLD, 'mika30']) await agent.mutation(api.fieldAgentOnboarding.saveDiscovery, { discoverySource: 'facebook', referredByCode });
        expect(await t.run(ctx => ctx.db.get(ids.agent))).toEqual(attached);
        await expect(agent.mutation(api.fieldAgentOnboarding.saveDiscovery, { discoverySource: 'friend', referredByCode: 'TONI30' })).rejects.toThrow('already been recorded');
    });

    it('supports old aliases during post-signup referral application and reserves them against new agent or creator codes', async () => {
        const { t, ids, mika, agent } = await setup();
        await mika.mutation(api.creatorProgram.updateCode, { code: 'MIKA30' });
        await agent.mutation(api.creators.applyReferralCode, { id: ids.agent, referredByCode: ` ${OLD.toLowerCase()} ` });
        expect(await t.run(ctx => ctx.db.get(ids.agent))).toMatchObject({ referredBy: ids.mika, referredByCode: OLD });
        const newcomer = t.withIdentity({ subject: 'newcomer', email: 'newcomer@example.test' });
        for (const code of [OLD, 'MIKA30', 'JOYD4K2', 'OTR30']) {
            await expect(newcomer.mutation(api.creators.create, { clerkId: 'newcomer', referralCode: code })).rejects.toThrow('taken');
            await expect(newcomer.mutation(api.creatorProgram.apply, { firstName: 'New', handle: 'newcomer', code, socials: [{ platform: 'tiktok', handle: '@new' }] })).rejects.toThrow();
        }
        expect(await t.run(ctx => ctx.db.query('creators').withIndex('by_clerk_id', q => q.eq('clerkId', 'newcomer')).collect())).toEqual([]);
    });

    it.each(['pending', 'suspended', 'deleted'])('does not activate an old alias for a %s affiliate', async status => {
        const { t, ids, mika, toni, agent, owner } = await setup();
        await mika.mutation(api.creatorProgram.updateCode, { code: 'MIKA30' });
        await t.run(ctx => ctx.db.patch(ids.mika, { status }));
        expect(await t.query(api.creatorProgram.getCreatorByCode, { code: OLD })).toBeNull();
        expect(await t.query(api.creators.getByReferralCode, { referralCode: OLD })).toBeNull();
        for (const code of [OLD, 'MIKA30']) {
            expect(await toni.query(api.creatorProgram.checkCodeAvailability, { code })).toMatchObject({ available: false });
            await expect(toni.mutation(api.creatorProgram.updateCode, { code })).rejects.toThrow('taken');
        }
        await expect(owner.mutation(api.ownerApp.applyCreatorCode, { submissionId: ids.draft, code: OLD })).rejects.toThrow('active creator');
        await expect(agent.mutation(api.fieldAgentOnboarding.saveDiscovery, { discoverySource: 'friend', referredByCode: OLD })).rejects.toThrow('Invalid referral code');
        await expect(t.mutation(internal.referrals.createFromSignup, { referrerId: ids.mika, referredId: ids.agent, referralCode: OLD })).rejects.toThrow('Invalid referrer');
        expect((await t.run(ctx => ctx.db.get(ids.agent)))?.recruitedAt).toBeUndefined();
    });

    it('preserves the existing field-agent code format and allows multiple empty own codes', async () => {
        const { t } = await setup();
        const longCode = 'FIELD-AGENT-LEGACY-CODE-17';
        const caller = t.withIdentity({ subject: 'legacy-format' });
        const id = await caller.mutation(api.creators.create, { clerkId: 'legacy-format', referralCode: longCode });
        expect((await t.query(api.creators.getByReferralCode, { referralCode: longCode }))?._id).toBe(id);
        for (const subject of ['empty-code-1', 'empty-code-2']) {
            expect(await t.withIdentity({ subject }).mutation(api.creators.create, { clerkId: subject, referralCode: '' })).toBeTruthy();
        }
    });

    it('fails closed for an ambiguous legacy code rather than redirecting it to another account', async () => {
        const { t, mika } = await setup();
        await mika.mutation(api.creatorProgram.updateCode, { code: 'MIKA30' });
        // Simulate a collision written by an old deployment that had no namespace check.
        await t.run(ctx => ctx.db.insert('creators', { clerkId: 'legacy-collision', email: 'collision@example.test', role: 'creator', referralCode: OLD }));
        expect(await t.query(api.creators.getByReferralCode, { referralCode: OLD })).toBeNull();
        expect(await t.query(api.creatorProgram.getCreatorByCode, { code: OLD })).toBeNull();
        expect(await mika.query(api.creatorProgram.checkCodeAvailability, { code: OLD })).toMatchObject({ available: false });
        expect(await t.query(api.creatorProgram.getCreatorByCode, { code: 'MIKA30' })).toMatchObject({ handle: 'mika' });
    });

    it('reserves the chosen code at new signup and shares local format validation with clients', async () => {
        const { t } = await setup();
        const newcomer = t.withIdentity({ subject: 'newcomer', email: 'newcomer@example.test' });
        const id = await newcomer.mutation(api.creatorProgram.apply, { firstName: 'New', handle: 'newcomer', code: ' new30 ', socials: [{ platform: 'tiktok', handle: '@new' }] });
        expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ referralCode: 'NEW30', status: 'pending' });
        expect(await t.run(ctx => ctx.db.query('creatorCodeAliases').withIndex('by_code', q => q.eq('code', 'NEW30')).unique())).toMatchObject({ creatorId: id });
        expect(creatorCodeError(normalizeCreatorCode(' new30 '))).toBeNull();
        expect(creatorCodeError('OTR30')).toContain('reserved');
    });
});
