import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import { ALL_TEMPLATES } from '../../components/editor/templateCatalog';
import { captureDesignByCode, validCaptureDesignCode } from '../../lib/captureDesign';
import { buildPipelineInput } from '../../lib/aiPipeline/input';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './submissions.ts': () => import('../../convex/submissions'),
    './hyperagent.ts': () => import('../../convex/hyperagent'),
};
const NOW = Date.UTC(2026, 9, 28, 5);
const capture = {
    businessName: 'Corner Shop', businessType: 'Barber/Salon', ownerName: 'Sam', ownerPhone: '09171234567',
    ownerEmail: 'sam@example.test', address: 'Main Street', city: 'Marikina',
    photos: ['https://uploads.example.test/owner.jpg', 'https://uploads.example.test/shop.jpg', 'https://uploads.example.test/craft.jpg'],
    amount: 2999, creatorPayout: 1499.5, platformFee: 1499.5,
};

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function setup(actor: Partial<Doc<'creators'>> = {}) {
    const t = convexTest(schema, modules);
    const creatorId = await t.run((ctx) => ctx.db.insert('creators', {
        clerkId: 'agent', email: 'agent@example.test', role: 'creator', status: 'active', certifiedAt: NOW - 1000,
        ...actor,
    }));
    const agent = t.withIdentity({ subject: 'agent' });
    const draft = (overrides: Partial<Doc<'submissions'>> = {}) => t.run((ctx) => ctx.db.insert('submissions', {
        ...capture, creatorId, status: 'draft', ...overrides,
    }));
    const row = (id: Id<'submissions'>) => t.run((ctx) => ctx.db.get(id));
    const effects = () => t.run(async (ctx) => ({
        accounts: await ctx.db.query('creators').collect(),
        leads: await ctx.db.query('leads').collect(),
        websites: await ctx.db.query('generatedWebsites').collect(),
        pipelines: await ctx.db.query('aiPipelineRuns').collect(),
        scheduled: await ctx.db.system.query('_scheduled_functions').collect(),
    }));
    return { t, creatorId, agent, draft, row, effects };
}

describe('canonical capture design metadata', () => {
    it('resolves the complete catalog rather than only the mobile shortlist', () => {
        for (const template of ALL_TEMPLATES) {
            expect(captureDesignByCode(` ${template.code} `)).toEqual(template);
            expect(validCaptureDesignCode(template.code)).toBe(template.code);
        }
        expect(captureDesignByCode('florist:BR')).toMatchObject({ label: 'Bloom', preview: '/template-previews/br.html' });
    });

    it.each([undefined, null, 42, {}, '', ' ', 'BP', 'A', 'BARBERSHOP:BP', 'barbershop:BQ', 'generic:BP'])
    ('does not infer a canonical design from %j', (value) => {
        expect(captureDesignByCode(value)).toBeUndefined();
        expect(validCaptureDesignCode(value)).toBeNull();
    });
});

describe('field-agent draft design choices', () => {
    it('saves only the canonical choice and style timestamp without submitting, repricing, or scheduling a build', async () => {
        const { agent, draft, row, effects } = await setup();
        const id = await draft({ templateId: 'generic:A', templateIds: ['generic:A', 'generic:B'], styleUpdatedAt: NOW - 500 });
        const before = await row(id);
        const beforeEffects = await effects();
        expect(await agent.mutation(api.submissions.chooseDesign, { id, templateId: ' \tbarbershop:BP\n ' })).toEqual({ ok: true });
        expect(await row(id)).toEqual({ ...before, templateId: 'barbershop:BP', templateIds: ['barbershop:BP'], styleUpdatedAt: NOW });
        expect(await effects()).toEqual(beforeEffects);

        // Changing the selection replaces it; the API never leaves stale multiple picks.
        vi.setSystemTime(NOW + 100);
        await agent.mutation(api.submissions.chooseDesign, { id, templateId: 'florist:BR' });
        const saved = await row(id);
        expect(saved).toEqual({ ...before, templateId: 'florist:BR', templateIds: ['florist:BR'], styleUpdatedAt: NOW + 100 });
        expect(await effects()).toEqual(beforeEffects);
        // The existing AI handoff must use this pick before an older generated-site choice.
        expect(buildPipelineInput(saved!, { customizations: { heroStyle: 'generic:A' } }, (url) => url).chosenTemplate).toBe('florist:BR');
    });

    it('preserves the legacy certified creator account contract', async () => {
        const { agent, draft, row } = await setup({ role: undefined });
        const id = await draft();
        await agent.mutation(api.submissions.chooseDesign, { id, templateId: 'generic:A' });
        expect((await row(id))?.templateId).toBe('generic:A');
    });

    it('rejects an unauthenticated caller without changing the draft or scheduling work', async () => {
        const { t, draft, row, effects } = await setup();
        const id = await draft();
        const before = await row(id);
        const beforeEffects = await effects();
        await expect(t.mutation(api.submissions.chooseDesign, { id, templateId: 'generic:A' })).rejects.toThrow('Not authenticated');
        expect(await row(id)).toEqual(before);
        expect(await effects()).toEqual(beforeEffects);
    });

    it.each([
        ['uncertified', { certifiedAt: undefined }],
        ['rejected', { rejectedAt: NOW - 500 }],
        ['suspended', { status: 'suspended' }],
        ['deleted', { status: 'deleted' }],
        ['soft deleted', { isDeleted: true }],
        ['affiliate', { role: 'affiliate' }],
        ['owner', { role: 'owner' }],
        ['admin', { role: 'admin' }],
    ] satisfies [string, Partial<Doc<'creators'>>][])('rejects a %s actor even for its own draft', async (_label, actor) => {
        const { agent, draft, row, effects } = await setup(actor);
        const id = await draft();
        const before = await row(id);
        const beforeEffects = await effects();
        await expect(agent.mutation(api.submissions.chooseDesign, { id, templateId: 'generic:A' })).rejects.toThrow();
        expect(await row(id)).toEqual(before);
        expect(await effects()).toEqual(beforeEffects);
    });

    it('rejects another certified agent instead of treating certification as ownership', async () => {
        const { t, draft, row, effects } = await setup();
        await t.run((ctx) => ctx.db.insert('creators', {
            clerkId: 'other', email: 'other@example.test', role: 'creator', status: 'active', certifiedAt: NOW - 1000,
        }));
        const id = await draft();
        const before = await row(id);
        const beforeEffects = await effects();
        await expect(t.withIdentity({ subject: 'other' }).mutation(api.submissions.chooseDesign, { id, templateId: 'generic:A' }))
            .rejects.toThrow('your own draft');
        expect(await row(id)).toEqual(before);
        expect(await effects()).toEqual(beforeEffects);
    });

    it.each(['submitted', 'in_review', 'approved', 'rejected', 'deployed', 'pending_payment', 'paid', 'completed', 'website_generated'])
    ('rejects a %s capture without changing an existing choice', async (status) => {
        const { agent, draft, row, effects } = await setup();
        const id = await draft({ status, templateId: 'generic:B' });
        const before = await row(id);
        const beforeEffects = await effects();
        await expect(agent.mutation(api.submissions.chooseDesign, { id, templateId: 'generic:A' })).rejects.toThrow('only be changed on a draft');
        expect(await row(id)).toEqual(before);
        expect(await effects()).toEqual(beforeEffects);
    });

    it.each(['owner_app', 'owner_intake'])('rejects a draft from %s even when attributed to the agent', async (contentSource) => {
        const { agent, draft, row, effects } = await setup();
        const id = await draft({ contentSource, templateId: 'generic:B' });
        const before = await row(id);
        const beforeEffects = await effects();
        await expect(agent.mutation(api.submissions.chooseDesign, { id, templateId: 'generic:A' })).rejects.toThrow('owner submission flow');
        expect(await row(id)).toEqual(before);
        expect(await effects()).toEqual(beforeEffects);
    });

    it.each(['', ' \t\n ', 'A', 'BP', 'barbershop:BQ', 'BARBERSHOP:BP', 'unknown:A', 'https://example.test/design', '<script>', 'a'.repeat(1000)])
    ('rejects invalid template %j without overwriting the saved design', async (templateId) => {
        const { agent, draft, row, effects } = await setup();
        const id = await draft({ templateId: 'generic:B', templateIds: ['generic:B'], styleUpdatedAt: NOW - 500 });
        const before = await row(id);
        const beforeEffects = await effects();
        await expect(agent.mutation(api.submissions.chooseDesign, { id, templateId })).rejects.toThrow('valid website design');
        expect(await row(id)).toEqual(before);
        expect(await effects()).toEqual(beforeEffects);
    });
});

describe('legacy Studio design handoff', () => {
    it.each(['barbershop:BP', ' florist:BR '])('forwards canonical selected design %s on an existing render request', async (templateId) => {
        const { t, draft } = await setup();
        const id = await draft({ status: 'submitted', templateId });
        vi.stubEnv('HYPERAGENT_WEBHOOK_URL', 'https://studio.example.test/hook');
        vi.stubEnv('HYPERAGENT_WEBHOOK_TOKEN', 'fixture-token');
        const network = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
        vi.stubGlobal('fetch', network);
        await t.action(internal.hyperagent.triggerStudioRender, { submissionId: id, viaStudio: true });
        expect(network).toHaveBeenCalledTimes(1);
        expect(network.mock.calls[0][0]).toBe('https://studio.example.test/hook');
        const payload = JSON.parse(network.mock.calls[0][1].body);
        expect(payload).toEqual({
            submissionId: id, templateId: templateId.trim(),
            business: {
                name: capture.businessName, type: capture.businessType, owner: capture.ownerName,
                city: capture.city, address: capture.address, phone: capture.ownerPhone, email: capture.ownerEmail, hasProducts: false,
            },
            photos: capture.photos.map((url, index) => ({ role: ['headshot', 'interior_1', 'interior_2'][index], url })),
            transcript: '', qa: [],
        });
    });

    it.each([undefined, 'A', 'barbershop:BQ'])('keeps the legacy payload unchanged for absent or invalid design %j', async (templateId) => {
        const { t, draft } = await setup();
        const id = await draft({ status: 'submitted', templateId });
        vi.stubEnv('HYPERAGENT_WEBHOOK_URL', 'https://studio.example.test/hook');
        vi.stubEnv('HYPERAGENT_WEBHOOK_TOKEN', 'fixture-token');
        const network = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
        vi.stubGlobal('fetch', network);
        await t.action(internal.hyperagent.triggerStudioRender, { submissionId: id, viaStudio: true });
        const payload = JSON.parse(network.mock.calls[0][1].body);
        expect(payload).not.toHaveProperty('templateId');
        expect(payload.submissionId).toBe(id);
        expect(payload.photos).toHaveLength(3);
    });
});
