import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import { captureEmailError, normalizeCaptureEmail } from '../../lib/captureEmail';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './submissions.ts': () => import('../../convex/submissions'),
};
const capture = {
    businessName: 'Corner Shop', businessType: 'Shop', ownerName: 'Sam', ownerPhone: '09171234567',
    address: 'Main Street', city: 'Marikina', photos: ['shop.jpg', 'owner.jpg', 'craft.jpg'],
};
const missingMessage = 'Enter the owner’s email address.';
const invalidMessage = 'Enter a valid email address for the owner.';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function setup() {
    const t = convexTest(schema, modules);
    const creatorId = await t.run(async (ctx) => {
        const id = await ctx.db.insert('creators', {
            clerkId: 'agent', email: 'agent@example.test', role: 'creator', status: 'active', submissionCount: 0,
        });
        await ctx.db.insert('creators', { clerkId: 'admin', email: 'admin@example.test', role: 'admin', status: 'active' });
        await ctx.db.insert('creators', { clerkId: 'other', email: 'other@example.test', role: 'creator', status: 'active' });
        return id;
    });
    const agent = t.withIdentity({ subject: 'agent' });
    const admin = t.withIdentity({ subject: 'admin' });
    const draft = (overrides: Partial<Doc<'submissions'>> = {}) => t.run((ctx) => ctx.db.insert('submissions', {
        ...capture, creatorId, status: 'draft', ...overrides,
    }));
    const row = (id: Id<'submissions'>) => t.run((ctx) => ctx.db.get(id));
    const effects = () => t.run(async (ctx) => ({
        leads: await ctx.db.query('leads').collect(),
        scheduled: await ctx.db.system.query('_scheduled_functions').collect(),
    }));
    return { t, creatorId, agent, admin, draft, row, effects };
}

describe('capture owner email', () => {
    it.each([
        ['missing', undefined, missingMessage],
        ['empty', '', missingMessage],
        ['whitespace', ' \t\n ', missingMessage],
        ['no domain', 'sam', invalidMessage],
        ['no local part', '@example.test', invalidMessage],
        ['no domain suffix', 'sam@example', invalidMessage],
        ['multiple at signs', 'sam@@example.test', invalidMessage],
        ['embedded whitespace', 'sam @example.test', invalidMessage],
        ['embedded newline', 'sam@exam\nple.test', invalidMessage],
        ['overlong', `${'a'.repeat(321)}@example.test`, invalidMessage],
    ])('rejects a %s email before final-submit side effects', async (_label, ownerEmail, message) => {
        const { agent, draft, row, effects } = await setup();
        const id = await draft({ ownerEmail });
        await expect(agent.mutation(api.submissions.submit, { id })).rejects.toThrow(message);
        const stored = await row(id);
        expect(stored?.status).toBe('draft');
        expect(stored?.ownerEmail).toBe(ownerEmail);
        expect(await effects()).toEqual({ leads: [], scheduled: [] });
    });

    it('accepts an email with a plus alias, trims it, and keeps its case through the lead and owner invite', async () => {
        const { agent, draft, row, effects } = await setup();
        const id = await draft({ ownerEmail: '  Sam.Shop+Website@Example.test \t' });
        await agent.mutation(api.submissions.submit, { id });
        expect(await row(id)).toMatchObject({ status: 'submitted', ownerEmail: 'Sam.Shop+Website@Example.test' });
        const first = await effects();
        expect(first.leads).toHaveLength(1);
        expect(first.leads[0]).toMatchObject({ submissionId: id, email: 'Sam.Shop+Website@Example.test' });
        expect(first.scheduled.some((job) => job.name === 'owners:inviteForSubmission')).toBe(true);
        await agent.mutation(api.submissions.submit, { id });
        expect(await effects()).toEqual(first);
    });

    it('still saves incomplete drafts and trims explicit email edits without rejecting partial typing', async () => {
        const { t, creatorId, agent, row } = await setup();
        const id = await agent.mutation(api.submissions.create, { ...capture, creatorId });
        expect(await row(id)).toMatchObject({ status: 'draft' });
        await agent.mutation(api.submissions.update, { id, ownerEmail: '  sam@  ' });
        expect(await row(id)).toMatchObject({ status: 'draft', ownerEmail: 'sam@' });
        await agent.mutation(api.submissions.update, { id, ownerEmail: '   ' });
        expect(await row(id)).toMatchObject({ status: 'draft', ownerEmail: '' });
        expect((await t.run((ctx) => ctx.db.get(creatorId)))?.submissionCount).toBe(1);
    });

    it('trims the email when saving a new draft', async () => {
        const { creatorId, agent, row } = await setup();
        const id = await agent.mutation(api.submissions.create, { ...capture, creatorId, ownerEmail: '  Sam@Example.test  ' });
        expect(await row(id)).toMatchObject({ status: 'draft', ownerEmail: 'Sam@Example.test' });
    });

    it.each([undefined, 'sam@', '  '])('rejects direct submitted-row creation with invalid email %j without inserting anything', async (ownerEmail) => {
        const { t, creatorId, agent, effects } = await setup();
        await expect(agent.mutation(api.submissions.create, { ...capture, creatorId, status: 'submitted', ownerEmail })).rejects.toThrow(/email address/);
        expect(await t.run((ctx) => ctx.db.query('submissions').collect())).toEqual([]);
        expect((await t.run((ctx) => ctx.db.get(creatorId)))?.submissionCount).toBe(0);
        expect(await effects()).toEqual({ leads: [], scheduled: [] });
    });

    it('accepts a normalized email in direct submitted-row creation', async () => {
        const { creatorId, agent, row } = await setup();
        const id = await agent.mutation(api.submissions.create, {
            ...capture, creatorId, status: 'submitted', ownerEmail: '  Sam@Example.test  ',
        });
        expect(await row(id)).toMatchObject({ status: 'submitted', ownerEmail: 'Sam@Example.test' });
    });

    it.each(['submitted', 'approved', 'completed'] as const)('requires an email for admin creation of a new %s capture', async (status) => {
        const { creatorId, admin, effects } = await setup();
        await expect(admin.mutation(api.submissions.create, { ...capture, creatorId, status })).rejects.toThrow(missingMessage);
        expect(await effects()).toEqual({ leads: [], scheduled: [] });
    });

    it('requires an email when an admin finalizes an existing draft', async () => {
        const { admin, draft, row, effects } = await setup();
        const id = await draft();
        await expect(admin.mutation(api.submissions.submit, { id })).rejects.toThrow(missingMessage);
        expect((await row(id))?.status).toBe('draft');
        expect(await effects()).toEqual({ leads: [], scheduled: [] });
    });

    it('keeps existing submitted captures without email readable, editable, and idempotent', async () => {
        const { creatorId, agent, admin, draft, row, effects } = await setup();
        const id = await draft({ status: 'submitted' });
        expect(await agent.query(api.submissions.getByCreatorId, { creatorId })).toHaveLength(1);
        await agent.mutation(api.submissions.update, { id, businessName: 'Renamed Shop' });
        await agent.mutation(api.submissions.submit, { id });
        await admin.mutation(api.submissions.updateStatus, { id, status: 'in_review' });
        expect(await row(id)).toMatchObject({ businessName: 'Renamed Shop', status: 'in_review' });
        expect(await effects()).toEqual({ leads: [], scheduled: [] });
    });

    it('preserves authorization before exposing capture validation errors', async () => {
        const { t, draft, row, effects } = await setup();
        const id = await draft();
        await expect(t.mutation(api.submissions.submit, { id })).rejects.toThrow('Not authenticated');
        await expect(t.withIdentity({ subject: 'other' }).mutation(api.submissions.submit, { id })).rejects.toThrow('own creator account');
        expect((await row(id))?.status).toBe('draft');
        expect(await effects()).toEqual({ leads: [], scheduled: [] });
    });

    it('preserves the photo requirement after the email is supplied', async () => {
        const { agent, draft, row, effects } = await setup();
        const id = await draft({ ownerEmail: 'sam@example.test', photos: ['one.jpg'] });
        await expect(agent.mutation(api.submissions.submit, { id })).rejects.toThrow('At least 3 photos');
        expect((await row(id))?.status).toBe('draft');
        expect(await effects()).toEqual({ leads: [], scheduled: [] });
    });

    it.each([null, undefined, 12, {}, []])('handles non-string shared validation input %j safely', (input) => {
        expect(normalizeCaptureEmail(input)).toBe('');
        expect(captureEmailError(input)).toBe(missingMessage);
    });
});
