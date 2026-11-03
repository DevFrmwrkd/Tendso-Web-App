import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import type { Id } from '../../convex/_generated/dataModel';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './visitRequests.ts': () => import('../../convex/visitRequests'),
};
const NOW = Date.UTC(2026, 10, 3, 18);
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

async function setup() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
        const admin = await ctx.db.insert('creators', { clerkId: 'admin', role: 'admin', status: 'active', email: 'admin@example.test' });
        const agent = await ctx.db.insert('creators', { clerkId: 'agent', role: 'creator', status: 'active', email: 'agent@example.test',
            firstName: 'Ana', lastName: 'Cruz', phone: '09171111111', certifiedAt: NOW - 1000, workCity: 'Marikina' });
        const secondAgent = await ctx.db.insert('creators', { clerkId: 'agent-2', role: 'creator', status: 'active', email: 'agent2@example.test',
            firstName: 'Ben', certifiedAt: NOW - 1000 });
        const uncertified = await ctx.db.insert('creators', { clerkId: 'uncertified', role: 'creator', status: 'active', email: 'new@example.test' });
        const affiliate = await ctx.db.insert('creators', { clerkId: 'affiliate', role: 'affiliate', status: 'active', email: 'affiliate@example.test', certifiedAt: NOW });
        const ownerId = await ctx.db.insert('businessOwners', { clerkId: 'owner', email: 'owner@example.test', createdAt: NOW });
        const otherOwnerId = await ctx.db.insert('businessOwners', { clerkId: 'other-owner', email: 'other@example.test', createdAt: NOW });
        const submissionId = await ctx.db.insert('submissions', { creatorId: agent, businessName: 'My Shop', businessType: 'Other',
            ownerName: 'Owner', ownerPhone: '09171234567', address: '1 Main St', city: 'Marikina', status: 'draft' });
        await ctx.db.insert('websiteOwnerships', { businessOwnerId: ownerId, submissionId, role: 'owner', claimedAt: NOW });
        return { admin, agent, secondAgent, uncertified, affiliate, ownerId, otherOwnerId, submissionId };
    });
    const owner = t.withIdentity({ subject: 'owner', email: 'owner@example.test', emailVerified: true });
    const otherOwner = t.withIdentity({ subject: 'other-owner', email: 'other@example.test', emailVerified: true });
    const admin = t.withIdentity({ subject: 'admin' });
    const agent = t.withIdentity({ subject: 'agent' });
    const secondAgent = t.withIdentity({ subject: 'agent-2' });
    let sequence = 0;
    const input = () => ({ requestKey: `visit-key-${++sequence}`, submissionId: ids.submissionId, shopName: 'My Shop', ownerName: 'Owner Name',
        phone: '0917 123 4567', email: 'owner@example.test', address: '1 Main Street', city: 'Marikina',
        coordinates: { lat: 14.65, lng: 121.1 }, preferredWhen: 'Saturday morning', clerkId: 'owner' });
    const create = (extra = {}) => owner.mutation(api.visitRequests.create, { ...input(), ...extra });
    const assign = async (id: Id<'ownerVisitRequests'>, expectedRevision = 0, extra = {}) => admin.mutation(api.visitRequests.assign, {
        id, expectedRevision, agentId: ids.agent, scheduledAt: NOW + 86400000, adminNote: 'Private operations note', clerkId: 'admin', ...extra,
    });
    const events = () => t.run(ctx => ctx.db.query('ownerVisitEvents').collect());
    const jobs = () => t.run(ctx => ctx.db.system.query('_scheduled_functions').collect());
    return { t, ids, owner, otherOwner, admin, agent, secondAgent, input, create, assign, events, jobs };
}

describe('private owner shop visit requests', () => {
    it('creates an idempotent mapped request, persistent owner event and admin notification without creating a community lead', async () => {
        const { t, owner, input, ids, events, jobs } = await setup();
        const args = input();
        const [first, second] = await Promise.all([owner.mutation(api.visitRequests.create, args), owner.mutation(api.visitRequests.create, args)]);
        expect(first._id).toBe(second._id);
        expect(first).toMatchObject({ ownerId: ids.ownerId, submissionId: ids.submissionId, phone: '+639171234567', status: 'requested',
            revision: 0, actorClerkId: 'owner', coordinates: args.coordinates, preferredWhen: 'Saturday morning', assignedAgent: null });
        expect(await events()).toHaveLength(1);
        const scheduled = await jobs();
        expect(scheduled.filter(job => job.name === 'notifications:createAndSend')).toEqual([expect.objectContaining({ args: [expect.objectContaining({
            creatorId: ids.admin, type: 'system', data: { visitRequestId: first._id, screen: 'visit' },
        })] })]);
        expect(scheduled.filter(job => job.name === 'ownerInbox:pushVisitEvent')).toHaveLength(1);
        expect(await t.run(ctx => ctx.db.query('leads').collect())).toEqual([]);
        expect(await t.run(ctx => ctx.db.query('submissions').collect())).toHaveLength(1);
        expect(await t.run(ctx => ctx.db.query('ownerVisitRequests').collect())).toHaveLength(1);
    });

    it.each(['anonymous', 'unverified', 'wrong-email', 'stale-clerk', 'foreign-business'])('rejects %s request creation', async scenario => {
        const { t, owner, otherOwner, input } = await setup();
        const args = input();
        const caller = scenario === 'anonymous' ? t : scenario === 'unverified'
            ? t.withIdentity({ subject: 'owner', email: 'owner@example.test', emailVerified: false })
            : scenario === 'wrong-email' ? t.withIdentity({ subject: 'owner', email: 'wrong@example.test', emailVerified: true })
                : scenario === 'foreign-business' ? otherOwner : owner;
        await expect(caller.mutation(api.visitRequests.create, { ...args,
            clerkId: scenario === 'stale-clerk' ? 'old-actor' : scenario === 'foreign-business' ? 'other-owner' : args.clerkId })).rejects.toThrow();
        expect(await t.run(ctx => ctx.db.query('ownerVisitRequests').collect())).toEqual([]);
    });

    it.each([{ lat: 0, lng: 0 }, { lat: 14.5, lng: 0 }, { lat: Number.NaN, lng: 121 }, { lat: 90, lng: 180 }])('requires a finite Philippine map pin %j', async coordinates => {
        const { create } = await setup();
        await expect(create({ coordinates })).rejects.toThrow('pin in the Philippines');
    });

    it.each([{ phone: '123' }, { address: '' }, { city: '' }, { shopName: '' }, { ownerName: '' },
        { preferredWhen: '' }, { email: 'invalid' }, { requestKey: 'short' }])('validates request contact/place fields %j', async fields => {
        const { create } = await setup();
        await expect(create(fields)).rejects.toThrow();
    });

    it('bounds open requests and allows exact-key retries even when the limit is reached', async () => {
        const { owner, create, input } = await setup();
        const args = input();
        const first = await owner.mutation(api.visitRequests.create, args);
        await create(); await create();
        await expect(create()).rejects.toThrow('three open');
        expect((await owner.mutation(api.visitRequests.create, args))._id).toBe(first._id);
    });

    it('limits cancelled-and-recreated requests per day while retaining idempotent retries', async () => {
        const { owner, create, input } = await setup();
        const firstArgs = input();
        const first = await owner.mutation(api.visitRequests.create, firstArgs);
        await owner.mutation(api.visitRequests.cancel, { id: first._id, expectedRevision: 0 });
        for (let i = 0; i < 4; i++) {
            const row = await create();
            await owner.mutation(api.visitRequests.cancel, { id: row._id, expectedRevision: 0 });
        }
        await expect(create()).rejects.toThrow('Please wait');
        expect((await owner.mutation(api.visitRequests.create, firstArgs))._id).toBe(first._id);
    });

    it('keeps contact details scoped to the requesting owner/admin/assigned agent', async () => {
        const { owner, otherOwner, admin, agent, secondAgent, create, assign, ids } = await setup();
        const row = await create();
        expect(await otherOwner.query(api.visitRequests.getMine, { id: row._id })).toBeNull();
        expect(await agent.query(api.visitRequests.getAssigned, { id: row._id })).toBeNull();
        expect((await agent.query(api.visitRequests.listAssigned, {}))?.requests).toEqual([]);
        await expect(owner.query(api.visitRequests.listAdmin, {})).rejects.toThrow('admin');
        const assigned = await assign(row._id);
        expect(assigned.adminNote).toBe('Private operations note');
        expect(await owner.query(api.visitRequests.getMine, { id: row._id })).toMatchObject({ assignedAgent: { id: ids.agent, name: 'Ana Cruz' } });
        expect(await owner.query(api.visitRequests.getMine, { id: row._id })).not.toHaveProperty('adminNote');
        expect(await agent.query(api.visitRequests.getAssigned, { id: row._id })).toMatchObject({ phone: '+639171234567', actorClerkId: 'agent' });
        expect(await agent.query(api.visitRequests.getAssigned, { id: row._id })).not.toHaveProperty('adminNote');
        expect(await secondAgent.query(api.visitRequests.getAssigned, { id: row._id })).toBeNull();
        expect((await admin.query(api.visitRequests.listAdmin, {})).requests[0].adminNote).toBe('Private operations note');
    });

    it('lists only certified active field agents and rejects invalid assignment targets', async () => {
        const { t, admin, create, assign, ids } = await setup();
        const list = await admin.query(api.visitRequests.listAssignableAgents, {});
        expect(list.actorClerkId).toBe('admin');
        expect(list.agents.map(row => row.id).sort()).toEqual([ids.agent, ids.secondAgent].sort());
        const request = await create();
        for (const agentId of [ids.admin, ids.uncertified, ids.affiliate]) await expect(assign(request._id, 0, { agentId })).rejects.toThrow('certified');
        await t.run(ctx => ctx.db.patch(ids.agent, { status: 'suspended' }));
        await expect(assign(request._id)).rejects.toThrow('certified');
    });

    it('does not repeat assignment events or notifications when an unchanged current assignment is saved again', async () => {
        const { create, assign, events, jobs } = await setup();
        const row = await create();
        const first = await assign(row._id);
        const before = await jobs();
        expect((await assign(row._id, 1)).revision).toBe(first.revision);
        expect(await events()).toHaveLength(2);
        expect(await jobs()).toEqual(before);
    });

    it.each([NOW, NOW - 1, NOW + 366 * 86400000, Number.NaN])('rejects an invalid proposed schedule %s', async scheduledAt => {
        const { create, assign } = await setup();
        const row = await create();
        await expect(assign(row._id, 0, { scheduledAt })).rejects.toThrow('future visit time');
    });

    it('atomically assigns, confirms and completes a visit with deduplicated owner events and no website/payment transition', async () => {
        const { t, ids, owner, agent, create, assign, events, jobs } = await setup();
        const before = await t.run(ctx => ctx.db.get(ids.submissionId));
        const row = await create();
        const assigned = await assign(row._id);
        expect(assigned).toMatchObject({ status: 'assigned', revision: 1, assignedAgentId: ids.agent, scheduledAt: NOW + 86400000 });
        const confirmed = await agent.mutation(api.visitRequests.accept, { id: row._id, expectedRevision: 1, agentNote: 'Private agent note', clerkId: 'agent' });
        expect(confirmed).toMatchObject({ status: 'confirmed', revision: 2, acceptedAt: NOW });
        expect(await owner.query(api.visitRequests.getMine, { id: row._id })).not.toHaveProperty('agentNote');
        vi.setSystemTime(assigned.scheduledAt!);
        const done = await agent.mutation(api.visitRequests.complete, { id: row._id, expectedRevision: 2, agentNote: 'Visited', clerkId: 'agent' });
        expect(done).toMatchObject({ status: 'completed', revision: 3, completedAt: assigned.scheduledAt });
        await expect(agent.mutation(api.visitRequests.complete, { id: row._id, expectedRevision: 2 })).rejects.toThrow('changed');
        expect((await events()).map(event => event.type)).toEqual(['visit_requested', 'visit_assigned', 'visit_confirmed', 'visit_completed']);
        expect(await t.run(ctx => ctx.db.get(ids.submissionId))).toEqual(before);
        expect(await t.run(ctx => ctx.db.query('leads').collect())).toEqual([]);
        expect(await t.run(ctx => ctx.db.query('earnings').collect())).toEqual([]);
        expect(await t.run(ctx => ctx.db.query('paymentTokens').collect())).toEqual([]);
        expect((await jobs()).every(job => ['ownerInbox:pushVisitEvent', 'notifications:createAndSend'].includes(job.name))).toBe(true);
    });

    it.each([0, 1])('requires the team to reschedule a proposal at or after its start time (offset %s)', async offset => {
        const { admin, agent, create, assign, events } = await setup();
        const row = await create();
        const assigned = await assign(row._id);
        vi.setSystemTime(assigned.scheduledAt! + offset);
        await expect(agent.mutation(api.visitRequests.accept, { id: row._id, expectedRevision: 1 })).rejects.toThrow('reschedule');
        expect((await events()).map(event => event.type)).toEqual(['visit_requested', 'visit_assigned']);
        expect((await admin.query(api.visitRequests.listAdmin, {})).requests[0]).toMatchObject({ status: 'assigned', revision: 1 });
        const rescheduled = await assign(row._id, 1, { scheduledAt: Date.now() + 3600000 });
        expect(await agent.mutation(api.visitRequests.accept, { id: row._id, expectedRevision: rescheduled.revision })).toMatchObject({ status: 'confirmed' });
    });

    it('keeps a future confirmed appointment open until its scheduled time and emits completion only then', async () => {
        const { agent, create, assign, events } = await setup();
        const row = await create();
        const assigned = await assign(row._id);
        await agent.mutation(api.visitRequests.accept, { id: row._id, expectedRevision: 1 });
        vi.setSystemTime(assigned.scheduledAt! - 1);
        await expect(agent.mutation(api.visitRequests.complete, { id: row._id, expectedRevision: 2 })).rejects.toThrow('scheduled time');
        expect(await agent.query(api.visitRequests.getAssigned, { id: row._id })).toMatchObject({ status: 'confirmed', revision: 2 });
        expect((await events()).filter(event => event.type === 'visit_completed')).toEqual([]);
        vi.setSystemTime(assigned.scheduledAt!);
        expect(await agent.mutation(api.visitRequests.complete, { id: row._id, expectedRevision: 2 })).toMatchObject({ status: 'completed', completedAt: assigned.scheduledAt });
        expect((await events()).filter(event => event.type === 'visit_completed')).toHaveLength(1);
    });

    it.each(['assigned', 'confirmed'] as const)('blocks overlapping %s visits for one agent on either side of the start time', async currentStatus => {
        const { agent, create, assign } = await setup();
        const first = await create(), second = await create();
        const assigned = await assign(first._id);
        if (currentStatus === 'confirmed') await agent.mutation(api.visitRequests.accept, { id: first._id, expectedRevision: 1 });
        for (const difference of [-30 * 60000 + 1, 0, 30 * 60000 - 1]) {
            await expect(assign(second._id, 0, { scheduledAt: assigned.scheduledAt! + difference })).rejects.toThrow('within 30 minutes');
        }
        expect(await assign(second._id, 0, { scheduledAt: assigned.scheduledAt! + 30 * 60000 })).toMatchObject({ status: 'assigned', revision: 1 });
    });

    it('allows rescheduling the same visit and booking a different agent at the same time', async () => {
        const { ids, create, assign } = await setup();
        const first = await create(), second = await create();
        const assigned = await assign(first._id);
        expect(await assign(first._id, 1, { scheduledAt: assigned.scheduledAt! + 1 })).toMatchObject({ revision: 2 });
        expect(await assign(second._id, 0, { agentId: ids.secondAgent, scheduledAt: assigned.scheduledAt! + 1 })).toMatchObject({ assignedAgentId: ids.secondAgent });
    });

    it('releases an agent’s time slot after the earlier visit is cancelled', async () => {
        const { owner, create, assign } = await setup();
        const first = await create(), second = await create();
        const assigned = await assign(first._id);
        await owner.mutation(api.visitRequests.cancel, { id: first._id, expectedRevision: 1 });
        expect(await assign(second._id, 0, { scheduledAt: assigned.scheduledAt! })).toMatchObject({ status: 'assigned' });
    });

    it('atomically gives only one of two overlapping requests the same agent’s time slot', async () => {
        const { admin, create, assign, events } = await setup();
        const first = await create(), second = await create();
        const results = await Promise.allSettled([assign(first._id), assign(second._id, 0, { scheduledAt: NOW + 86400000 + 60000 })]);
        expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        const failed = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
        expect(String(failed.reason)).toContain('within 30 minutes');
        const rows = (await admin.query(api.visitRequests.listAdmin, {})).requests;
        expect(rows.filter(row => row.status === 'assigned')).toHaveLength(1);
        expect(rows.filter(row => row.status === 'requested')).toHaveLength(1);
        expect((await events()).filter(event => event.type === 'visit_assigned')).toHaveLength(1);
    });

    it('decline restores the private request queue and revokes the previous agent’s read access', async () => {
        const { owner, agent, admin, create, assign, events } = await setup();
        const row = await create(); await assign(row._id);
        const declined = await agent.mutation(api.visitRequests.decline, { id: row._id, expectedRevision: 1, reason: 'Outside my route', clerkId: 'agent' });
        expect(declined).toMatchObject({ status: 'requested', revision: 2, declineReason: 'Outside my route', assignedAgent: null });
        expect(declined.assignedAgentId).toBeUndefined(); expect(declined.scheduledAt).toBeUndefined();
        expect(await agent.query(api.visitRequests.getAssigned, { id: row._id })).toBeNull();
        expect((await agent.query(api.visitRequests.listAssigned, {}))?.requests).toEqual([]);
        expect((await admin.query(api.visitRequests.listAdmin, { status: 'requested' })).requests).toHaveLength(1);
        expect((await owner.query(api.visitRequests.getMine, { id: row._id }))?.status).toBe('requested');
        expect((await events()).at(-1)?.type).toBe('visit_declined');
    });

    it('reassignment removes old-agent access and stale actions cannot overwrite the new assignment', async () => {
        const { ids, agent, secondAgent, create, assign, jobs } = await setup();
        const row = await create(); await assign(row._id);
        await assign(row._id, 1, { agentId: ids.secondAgent, scheduledAt: NOW + 2 * 86400000 });
        expect(await agent.query(api.visitRequests.getAssigned, { id: row._id })).toBeNull();
        await expect(agent.mutation(api.visitRequests.accept, { id: row._id, expectedRevision: 1 })).rejects.toThrow('not assigned');
        expect(await secondAgent.query(api.visitRequests.getAssigned, { id: row._id })).toMatchObject({ revision: 2, assignedAgentId: ids.secondAgent });
        expect((await jobs()).filter(job => job.name === 'notifications:createAndSend').map(job => job.args[0])).toContainEqual(expect.objectContaining({
            creatorId: ids.agent, title: 'Visit assignment changed',
        }));
    });

    it('allows only the owner/admin to cancel and notifies the assigned agent once', async () => {
        const { owner, otherOwner, agent, create, assign, events, jobs } = await setup();
        const row = await create(); await assign(row._id);
        await expect(otherOwner.mutation(api.visitRequests.cancel, { id: row._id, expectedRevision: 1 })).rejects.toThrow('not found');
        await expect(agent.mutation(api.visitRequests.cancel, { id: row._id, expectedRevision: 1 })).rejects.toThrow('sign in');
        expect(await owner.mutation(api.visitRequests.cancel, { id: row._id, expectedRevision: 1, reason: 'Plans changed', clerkId: 'owner' })).toMatchObject({ status: 'cancelled', revision: 2 });
        await expect(owner.mutation(api.visitRequests.cancel, { id: row._id, expectedRevision: 1 })).rejects.toThrow('changed');
        await expect(agent.mutation(api.visitRequests.accept, { id: row._id, expectedRevision: 2 })).rejects.toThrow('no longer');
        expect((await events()).filter(event => event.type === 'visit_cancelled')).toHaveLength(1);
        expect((await jobs()).filter(job => job.name === 'notifications:createAndSend' && (job.args[0] as { title?: string }).title === 'Shop visit cancelled')).toHaveLength(1);
    });

    it('guards every actor and revision after certification/account changes', async () => {
        const { t, ids, owner, admin, agent, create, assign } = await setup();
        const row = await create(); await assign(row._id);
        expect(await owner.query(api.visitRequests.getMine, { id: row._id, clerkId: 'another-session' })).toBeNull();
        expect(await agent.query(api.visitRequests.getAssigned, { id: row._id, clerkId: 'another-session' })).toBeNull();
        await expect(admin.query(api.visitRequests.listAdmin, { clerkId: 'another-session' })).rejects.toThrow('account changed');
        await expect(agent.mutation(api.visitRequests.accept, { id: row._id, expectedRevision: 1, clerkId: 'another-session' })).rejects.toThrow('certified');
        await t.run(ctx => ctx.db.patch(ids.agent, { certifiedAt: undefined }));
        expect(await agent.query(api.visitRequests.getAssigned, { id: row._id })).toBeNull();
        await expect(agent.mutation(api.visitRequests.accept, { id: row._id, expectedRevision: 1 })).rejects.toThrow('certified');
    });

    it('does not complete or reassign an unconfirmed/closed visit and rejects racing admin writes', async () => {
        const { admin, agent, ids, create, assign, events } = await setup();
        const row = await create();
        const results = await Promise.allSettled([assign(row._id), assign(row._id, 0, { agentId: ids.secondAgent })]);
        expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        const current = (await admin.query(api.visitRequests.listAdmin, {})).requests[0];
        const caller = current.assignedAgentId === ids.agent ? agent : admin;
        if (current.assignedAgentId === ids.agent) await expect(caller.mutation(api.visitRequests.complete, { id: row._id, expectedRevision: 1 })).rejects.toThrow('Confirm');
        await admin.mutation(api.visitRequests.cancel, { id: row._id, expectedRevision: 1 });
        await expect(assign(row._id, 2)).rejects.toThrow('no longer');
        expect((await events()).filter(event => event.type === 'visit_assigned')).toHaveLength(1);
    });
});
