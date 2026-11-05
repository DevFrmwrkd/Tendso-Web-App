import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { internal } from './_generated/api';
import { requireAdmin } from './lib/auth';
import { getOwner, ownsSubmission } from './lib/ownerAuth';
import { isCertifiedFieldAgent } from './lib/communityFinds';
import { normalizePhone } from './lib/phone';

type Ctx = QueryCtx | MutationCtx;
type Visit = Doc<'ownerVisitRequests'>;
type Agent = Doc<'creators'>;
const status = v.union(v.literal('requested'), v.literal('assigned'), v.literal('confirmed'), v.literal('completed'), v.literal('cancelled'));
const actorArg = { clerkId: v.optional(v.string()) };
const changeArgs = { id: v.id('ownerVisitRequests'), expectedRevision: v.number(), ...actorArg };
const MAX_SCHEDULE_MS = 365 * 86400000;
const VISIT_SLOT_MS = 30 * 60000;
export type AssignedVisitAgent = { id: Id<'creators'>; name: string; phone: string | null; profileImage: string | null };
export type VisitRequestView = Omit<Visit, 'adminNote' | 'agentNote'> & {
    actorClerkId: string; assignedAgent: AssignedVisitAgent | null; adminNote?: string; agentNote?: string;
};

function reject(message: string): never { throw new ConvexError(message); }
function text(value: string, label: string, max: number, min = 1) {
    const result = value.trim();
    if (result.length < min || result.length > max) reject(`Please check ${label}.`);
    return result;
}
const note = (value: string | undefined) => value === undefined || !value.trim() ? undefined : text(value, 'the note', 1000);
const active = (row: Visit) => row.status !== 'cancelled' && row.status !== 'completed';
const eligibleAgent = (agent: Agent) => isCertifiedFieldAgent(agent) && (agent.status === undefined || agent.status === 'active');
const agentName = (agent: Agent) => [agent.firstName, agent.lastName].filter(Boolean).join(' ').trim() || 'Field agent';
async function ownerActor(ctx: Ctx, clerkId?: string) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.emailVerified !== true || clerkId !== undefined && clerkId !== identity.subject) return null;
    const owner = await getOwner(ctx);
    if (!owner || typeof identity.email !== 'string' || owner.email.trim().toLowerCase() !== identity.email.trim().toLowerCase()) return null;
    return { identity, owner };
}
async function agentActor(ctx: Ctx, clerkId?: string) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || clerkId !== undefined && clerkId !== identity.subject) return null;
    const agent = await ctx.db.query('creators').withIndex('by_clerk_id', q => q.eq('clerkId', identity.subject)).first();
    return agent && eligibleAgent(agent) ? { identity, agent } : null;
}
async function adminActor(ctx: Ctx, clerkId?: string) {
    const actor = await requireAdmin(ctx);
    if (clerkId !== undefined && clerkId !== actor.identity.subject) reject('Your account changed. Please reopen visits.');
    return actor;
}
async function view(ctx: Ctx, row: Visit, actorClerkId: string, audience: 'owner' | 'agent' | 'admin'): Promise<VisitRequestView> {
    const { adminNote, agentNote, ...fields } = row;
    const agent = row.assignedAgentId ? await ctx.db.get(row.assignedAgentId) : null;
    return { ...fields, actorClerkId,
        assignedAgent: agent ? { id: agent._id, name: agentName(agent), phone: agent.phone ?? null, profileImage: agent.profileImage ?? null } : null,
        ...(audience === 'admin' && adminNote ? { adminNote } : {}),
        ...(audience !== 'owner' && agentNote ? { agentNote } : {}),
    };
}
function revision(row: Visit, expected: number) {
    if (!Number.isSafeInteger(expected) || expected < 0 || row.revision !== expected) reject('This visit changed. Refresh and try again.');
}
async function rowFor(ctx: Ctx, id: Id<'ownerVisitRequests'>) {
    const row = await ctx.db.get(id);
    if (!row) reject('Visit request not found.');
    return row;
}
async function creatorNotice(ctx: MutationCtx, creatorId: Id<'creators'>, row: Visit, title: string, body: string) {
    await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
        creatorId, type: 'system', title, body, data: { visitRequestId: row._id, screen: 'visit' },
    });
}
async function adminNotice(ctx: MutationCtx, row: Visit, title: string, body: string) {
    const admins = await ctx.db.query('creators').filter(q => q.eq(q.field('role'), 'admin')).collect();
    for (const admin of admins) if (!admin.isDeleted && admin.status !== 'deleted' && admin.status !== 'suspended') {
        await creatorNotice(ctx, admin._id, row, title, body);
    }
}
async function ownerEvent(ctx: MutationCtx, row: Visit, type: string, title: string, body: string) {
    const dedupeKey = `visit:${row._id}:${row.revision}:${type}`;
    const existing = await ctx.db.query('ownerVisitEvents').withIndex('by_dedupe', q => q.eq('dedupeKey', dedupeKey)).first();
    if (!existing) {
        const id = await ctx.db.insert('ownerVisitEvents', { ownerId: row.ownerId, visitRequestId: row._id,
            type, title, body, createdAt: Date.now(), dedupeKey });
        await ctx.scheduler.runAfter(0, internal.ownerInbox.pushVisitEvent, { id });
    }
}
async function patch(ctx: MutationCtx, row: Visit, fields: Partial<Visit>) {
    await ctx.db.patch(row._id, { ...fields, updatedAt: Date.now(), revision: row.revision + 1 });
    return (await ctx.db.get(row._id))!;
}

export const create = mutation({
    args: { requestKey: v.string(), submissionId: v.optional(v.id('submissions')), shopName: v.string(), ownerName: v.string(),
        phone: v.string(), email: v.optional(v.string()), address: v.string(), city: v.string(),
        coordinates: v.object({ lat: v.number(), lng: v.number() }), preferredWhen: v.string(), ...actorArg },
    handler: async (ctx, args): Promise<VisitRequestView> => {
        const actor = await ownerActor(ctx, args.clerkId);
        if (!actor) reject('Please sign in with your verified business owner email.');
        if (args.submissionId && (!await ctx.db.get(args.submissionId)
            || !await ownsSubmission(ctx, actor.owner._id, args.submissionId))) reject('We could not find that business.');
        const key = args.requestKey.trim();
        if (!/^[A-Za-z0-9_-]{8,100}$/.test(key)) reject('Please start a new visit request.');
        const existing = await ctx.db.query('ownerVisitRequests')
            .withIndex('by_owner_request', q => q.eq('ownerId', actor.owner._id).eq('requestKey', key)).unique();
        if (existing) return view(ctx, existing, actor.identity.subject, 'owner');
        const { lat, lng } = args.coordinates;
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 4 || lat > 22 || lng < 116 || lng > 127) reject('Please place the shop pin in the Philippines.');
        const phone = normalizePhone(args.phone);
        if (!phone || !/^639\d{9}$/.test(phone)) reject('Add a valid Philippine mobile number.');
        const email = args.email?.trim().toLowerCase() || actor.owner.email.trim().toLowerCase();
        if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) reject('Please check the contact email.');
        const prior = await ctx.db.query('ownerVisitRequests').withIndex('by_owner', q => q.eq('ownerId', actor.owner._id)).collect();
        if (prior.filter(active).length >= 3) reject('You already have three open visit requests. Finish or cancel one before requesting another.');
        if (prior.filter(row => row.createdAt >= Date.now() - 86400000).length >= 5) reject('Please wait before requesting another visit.');
        const now = Date.now();
        const id = await ctx.db.insert('ownerVisitRequests', { ownerId: actor.owner._id, submissionId: args.submissionId,
            requestKey: key, shopName: text(args.shopName, 'the shop name', 120, 2), ownerName: text(args.ownerName, 'your name', 120, 2),
            phone: `+${phone}`, email, address: text(args.address, 'the shop address', 300, 3), city: text(args.city, 'the city', 120, 2),
            coordinates: { lat, lng }, preferredWhen: text(args.preferredWhen, 'the preferred visit time', 120),
            status: 'requested', revision: 0, createdAt: now, updatedAt: now });
        const row = (await ctx.db.get(id))!;
        await ownerEvent(ctx, row, 'visit_requested', 'Visit request received', `We received your request for ${row.shopName}. The team will arrange a field agent.`);
        await adminNotice(ctx, row, 'New shop visit request', `${row.shopName} in ${row.city} requested a field agent visit.`);
        return view(ctx, row, actor.identity.subject, 'owner');
    },
});

export const listMine = query({ args: actorArg, handler: async (ctx, args) => {
    const actor = await ownerActor(ctx, args.clerkId);
    if (!actor) return null;
    const rows = await ctx.db.query('ownerVisitRequests').withIndex('by_owner', q => q.eq('ownerId', actor.owner._id)).order('desc').take(100);
    return { actorClerkId: actor.identity.subject, ownerId: actor.owner._id,
        requests: await Promise.all(rows.map(row => view(ctx, row, actor.identity.subject, 'owner'))) };
} });
export const getMine = query({ args: { id: v.id('ownerVisitRequests'), ...actorArg }, handler: async (ctx, args): Promise<VisitRequestView | null> => {
    const actor = await ownerActor(ctx, args.clerkId);
    if (!actor) return null;
    const row = await ctx.db.get(args.id);
    return row?.ownerId === actor.owner._id ? view(ctx, row, actor.identity.subject, 'owner') : null;
} });
export const listAdmin = query({ args: { status: v.optional(status), ...actorArg }, handler: async (ctx, args) => {
    const actor = await adminActor(ctx, args.clerkId);
    const rows = args.status ? await ctx.db.query('ownerVisitRequests').withIndex('by_status', q => q.eq('status', args.status!)).order('desc').take(200)
        : await ctx.db.query('ownerVisitRequests').order('desc').take(200);
    return { actorClerkId: actor.identity.subject, requests: await Promise.all(rows.map(row => view(ctx, row, actor.identity.subject, 'admin'))) };
} });
export const listAssignableAgents = query({ args: actorArg, handler: async (ctx, args) => {
    const actor = await adminActor(ctx, args.clerkId);
    const agents = (await ctx.db.query('creators').collect()).filter(eligibleAgent);
    return { actorClerkId: actor.identity.subject, agents: agents.map(agent => ({ id: agent._id, name: agentName(agent), email: agent.email,
        phone: agent.phone ?? null, workCity: agent.workCity ?? null, profileImage: agent.profileImage ?? null })) };
} });
export const assign = mutation({ args: { ...changeArgs, agentId: v.id('creators'), scheduledAt: v.number(), adminNote: v.optional(v.string()) },
    handler: async (ctx, args): Promise<VisitRequestView> => {
        const actor = await adminActor(ctx, args.clerkId), row = await rowFor(ctx, args.id);
        revision(row, args.expectedRevision);
        if (row.status !== 'requested' && row.status !== 'assigned') reject('This visit can no longer be assigned.');
        const agent = await ctx.db.get(args.agentId);
        if (!agent || !eligibleAgent(agent)) reject('Choose an active certified field agent.');
        if (!Number.isSafeInteger(args.scheduledAt) || args.scheduledAt <= Date.now() || args.scheduledAt > Date.now() + MAX_SCHEDULE_MS) reject('Choose a future visit time within the next year.');
        const adminNote = note(args.adminNote);
        if (row.status === 'assigned' && row.assignedAgentId === agent._id && row.scheduledAt === args.scheduledAt && row.adminNote === adminNote) return view(ctx, row, actor.identity.subject, 'admin');
        const appointments = await ctx.db.query('ownerVisitRequests').withIndex('by_agent', q => q.eq('assignedAgentId', agent._id)).collect();
        if (appointments.some(appointment => appointment._id !== row._id
            && (appointment.status === 'assigned' || appointment.status === 'confirmed')
            && typeof appointment.scheduledAt === 'number'
            && Math.abs(appointment.scheduledAt - args.scheduledAt) < VISIT_SLOT_MS)) {
            reject('This field agent already has a visit within 30 minutes of that time. Choose another time or agent.');
        }
        const updated = await patch(ctx, row, { status: 'assigned', assignedAgentId: agent._id, scheduledAt: args.scheduledAt,
            assignedAt: Date.now(), acceptedAt: undefined, adminNote, agentNote: undefined, declineReason: undefined });
        await ownerEvent(ctx, updated, 'visit_assigned', 'Field agent assigned', `${agentName(agent)} has been assigned to ${row.shopName}. The visit time is proposed until the agent confirms.`);
        if (row.assignedAgentId && row.assignedAgentId !== agent._id) await creatorNotice(ctx, row.assignedAgentId, updated, 'Visit assignment changed', `You are no longer assigned to ${row.shopName}.`);
        await creatorNotice(ctx, agent._id, updated, 'Shop visit assigned', `Please review and confirm your visit to ${row.shopName}.`);
        return view(ctx, updated, actor.identity.subject, 'admin');
    } });

export const listAssigned = query({ args: actorArg, handler: async (ctx, args) => {
    const actor = await agentActor(ctx, args.clerkId);
    if (!actor) return null;
    const rows = await ctx.db.query('ownerVisitRequests').withIndex('by_agent', q => q.eq('assignedAgentId', actor.agent._id)).order('desc').take(100);
    return { actorClerkId: actor.identity.subject, agentId: actor.agent._id,
        requests: await Promise.all(rows.map(row => view(ctx, row, actor.identity.subject, 'agent'))) };
} });
export const getAssigned = query({ args: { id: v.id('ownerVisitRequests'), ...actorArg }, handler: async (ctx, args): Promise<VisitRequestView | null> => {
    const actor = await agentActor(ctx, args.clerkId);
    if (!actor) return null;
    const row = await ctx.db.get(args.id);
    return row?.assignedAgentId === actor.agent._id ? view(ctx, row, actor.identity.subject, 'agent') : null;
} });

async function assignedFor(ctx: MutationCtx, args: { id: Id<'ownerVisitRequests'>; expectedRevision: number; clerkId?: string }) {
    const actor = await agentActor(ctx, args.clerkId);
    if (!actor) reject('An active certified field agent account is required.');
    const row = await rowFor(ctx, args.id);
    if (row.assignedAgentId !== actor.agent._id) reject('This visit is not assigned to your account.');
    revision(row, args.expectedRevision);
    return { actor, row };
}
export const accept = mutation({ args: { ...changeArgs, agentNote: v.optional(v.string()) }, handler: async (ctx, args): Promise<VisitRequestView> => {
    const { actor, row } = await assignedFor(ctx, args);
    if (row.status !== 'assigned') reject('This visit is no longer waiting for confirmation.');
    if (!Number.isSafeInteger(row.scheduledAt) || row.scheduledAt! <= Date.now()) reject('The proposed visit time has passed. Ask the team to reschedule before confirming.');
    const updated = await patch(ctx, row, { status: 'confirmed', acceptedAt: Date.now(), agentNote: note(args.agentNote) });
    await ownerEvent(ctx, updated, 'visit_confirmed', 'Your shop visit is confirmed', `${agentName(actor.agent)} confirmed the visit to ${row.shopName}. Open the request for the scheduled time and contact details.`);
    return view(ctx, updated, actor.identity.subject, 'agent');
} });
export const decline = mutation({ args: { ...changeArgs, reason: v.string() }, handler: async (ctx, args): Promise<VisitRequestView> => {
    const { actor, row } = await assignedFor(ctx, args);
    if (row.status !== 'assigned') reject('This visit is no longer waiting for confirmation.');
    const updated = await patch(ctx, row, { status: 'requested', assignedAgentId: undefined, scheduledAt: undefined,
        assignedAt: undefined, acceptedAt: undefined, agentNote: undefined, declineReason: text(args.reason, 'the reason', 500, 2) });
    await ownerEvent(ctx, updated, 'visit_declined', 'We’re arranging another field agent', `The team is finding another field agent for ${row.shopName}. Your request is still open.`);
    await adminNotice(ctx, updated, 'Shop visit needs reassignment', `${agentName(actor.agent)} could not take the visit to ${row.shopName}. Review the request and assign another agent.`);
    return view(ctx, updated, actor.identity.subject, 'agent');
} });
export const complete = mutation({ args: { ...changeArgs, agentNote: v.optional(v.string()) }, handler: async (ctx, args): Promise<VisitRequestView> => {
    const { actor, row } = await assignedFor(ctx, args);
    if (row.status !== 'confirmed') reject('Confirm the visit before marking it complete.');
    if (!Number.isSafeInteger(row.scheduledAt) || row.scheduledAt! > Date.now()) reject('You can mark this visit complete once its scheduled time has arrived.');
    const updated = await patch(ctx, row, { status: 'completed', completedAt: Date.now(), agentNote: note(args.agentNote) });
    await ownerEvent(ctx, updated, 'visit_completed', 'Shop visit completed', `${agentName(actor.agent)} marked the visit to ${row.shopName} complete. This does not submit or publish a website.`);
    return view(ctx, updated, actor.identity.subject, 'agent');
} });
export const cancel = mutation({ args: { ...changeArgs, reason: v.optional(v.string()) }, handler: async (ctx, args): Promise<VisitRequestView> => {
    let admin: Awaited<ReturnType<typeof adminActor>> | null = null;
    try { admin = await adminActor(ctx, args.clerkId); } catch { /* Owners have separate authority over their own request. */ }
    const owner = admin ? null : await ownerActor(ctx, args.clerkId);
    if (!admin && !owner) reject('Please sign in again.');
    const row = await rowFor(ctx, args.id);
    if (!admin && row.ownerId !== owner!.owner._id) reject('Visit request not found.');
    revision(row, args.expectedRevision);
    if (!active(row)) reject('This visit is already closed.');
    const updated = await patch(ctx, row, { status: 'cancelled', cancelledAt: Date.now(), cancellationReason: note(args.reason) });
    await ownerEvent(ctx, updated, 'visit_cancelled', 'Shop visit cancelled', `The visit request for ${row.shopName} was cancelled.`);
    if (row.assignedAgentId) await creatorNotice(ctx, row.assignedAgentId, updated, 'Shop visit cancelled', `The visit to ${row.shopName} was cancelled. Please do not travel for this appointment.`);
    return view(ctx, updated, (admin ?? owner)!.identity.subject, admin ? 'admin' : 'owner');
} });
