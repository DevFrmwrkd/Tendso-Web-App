import { ConvexError, v } from 'convex/values';
import { internalAction, internalMutation, internalQuery, mutation, query } from './_generated/server';
import type { QueryCtx, MutationCtx } from './_generated/server';
import { internal } from './_generated/api';
import { getOwner } from './lib/ownerAuth';
import { ownerInboxItems, siteInboxFacts } from './lib/ownerInbox';

async function currentOwner(ctx: QueryCtx | MutationCtx, clerkId?: string) {
    const identity = await ctx.auth.getUserIdentity();
    if (clerkId && identity?.subject !== clerkId) throw new ConvexError('Your account changed. Please reopen notifications.');
    const owner = await getOwner(ctx);
    return owner && identity ? { owner, actorClerkId: identity.subject } : null;
}

export const list = query({ args: { clerkId: v.optional(v.string()) }, handler: async (ctx,args) => {
    const actor = await currentOwner(ctx,args.clerkId);
    if (!actor) return null;
    const items = await ownerInboxItems(ctx,actor.owner._id);
    return { ownerId: actor.owner._id, actorClerkId: actor.actorClerkId, unreadCount: items.filter(item => !item.read).length, items };
}});
export const markRead = mutation({ args: { key: v.string(), clerkId: v.optional(v.string()) }, handler: async (ctx,args) => {
    const actor = await currentOwner(ctx,args.clerkId);
    if (!actor) throw new ConvexError('Please sign in again.');
    if (!(await ownerInboxItems(ctx,actor.owner._id)).some(item => item.key === args.key)) throw new ConvexError('This notification is not available.');
    const old = await ctx.db.query('ownerNotificationReads').withIndex('by_owner_event', q => q.eq('ownerId',actor.owner._id).eq('eventKey',args.key)).first();
    if (!old) await ctx.db.insert('ownerNotificationReads',{ownerId:actor.owner._id,eventKey:args.key,readAt:Date.now()});
    return { read: true };
}});
export const markAllRead = mutation({ args: { clerkId: v.optional(v.string()) }, handler: async (ctx,args) => {
    const actor = await currentOwner(ctx,args.clerkId);
    if (!actor) throw new ConvexError('Please sign in again.');
    for (const item of await ownerInboxItems(ctx,actor.owner._id)) if (!item.read) await ctx.db.insert('ownerNotificationReads', {ownerId:actor.owner._id,eventKey:item.key,readAt:Date.now()});
    return { read: true };
}});

/** Capture workflow facts once. Reading an inbox never writes or marks it read. */
export const captureSiteUpdates = internalMutation({ args:{submissionId:v.id('submissions')}, handler:async(ctx,args)=>{
    const links=await ctx.db.query('websiteOwnerships').withIndex('by_submission',q=>q.eq('submissionId',args.submissionId)).collect();
    for(const link of links) for(const item of await siteInboxFacts(ctx,link.businessOwnerId,args.submissionId)) {
        const exists=await ctx.db.query('ownerSiteEvents').withIndex('by_owner_event',q=>q.eq('ownerId',link.businessOwnerId).eq('eventKey',item.key)).first();
        if(exists) continue;
        await ctx.db.insert('ownerSiteEvents',{ownerId:link.businessOwnerId,submissionId:args.submissionId,eventKey:item.key,type:item.type,title:item.title,body:item.body,createdAt:item.createdAt});
        if(Date.now()-item.createdAt<5*60_000) await ctx.scheduler.runAfter(0,internal.ownerInbox.sendPush,{ownerId:link.businessOwnerId,eventKey:item.key,title:item.title,body:item.body});
    }
}});
export const pushVisitEvent = internalMutation({args:{id:v.id('ownerVisitEvents')},handler:async(ctx,args)=>{
    const event=await ctx.db.get(args.id); if(!event) return;
    await ctx.scheduler.runAfter(0,internal.ownerInbox.sendPush,{ownerId:event.ownerId,eventKey:`visit:${event._id}`,title:event.title,body:event.body});
}});

/** Claim this installation for the current owner, including an explicit inactive opt-out. */
export const registerPushToken=mutation({args:{token:v.string(),platform:v.union(v.literal('ios'),v.literal('android')),clerkId:v.optional(v.string()),enabled:v.optional(v.boolean())},handler:async(ctx,args)=>{
    const actor=await currentOwner(ctx,args.clerkId); if(!actor) throw new ConvexError('Please sign in again.');
    if(!/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(args.token)||args.token.length>250) throw new ConvexError('Invalid device token.');
    const old=await ctx.db.query('ownerPushTokens').withIndex('by_token',q=>q.eq('token',args.token)).first();
    const active=args.enabled!==false;
    if(old) await ctx.db.patch(old._id,{ownerId:actor.owner._id,platform:args.platform,active});
    else await ctx.db.insert('ownerPushTokens',{ownerId:actor.owner._id,token:args.token,platform:args.platform,active});
    for(const token of await ctx.db.query('pushTokens').withIndex('by_token',q=>q.eq('token',args.token)).collect()) await ctx.db.patch(token._id,{active:false});
    return {registered:active};
}});
export const removePushToken=mutation({args:{token:v.string(),clerkId:v.optional(v.string())},handler:async(ctx,args)=>{
    const actor=await currentOwner(ctx,args.clerkId); if(!actor) return;
    for(const token of await ctx.db.query('ownerPushTokens').withIndex('by_token',q=>q.eq('token',args.token)).collect())
        if(token.ownerId===actor.owner._id) await ctx.db.patch(token._id,{active:false});
}});
export const pushRecipients=internalQuery({args:{ownerId:v.id('businessOwners'),eventKey:v.string()},handler:async(ctx,args)=>{
    const owner=await ctx.db.get(args.ownerId); if(!owner) return [];
    if(!(await ownerInboxItems(ctx,args.ownerId)).some(item=>item.key===args.eventKey)) return [];
    return (await ctx.db.query('ownerPushTokens').withIndex('by_owner',q=>q.eq('ownerId',args.ownerId)).collect()).filter(row=>row.active);
}});
export const deactivatePush=internalMutation({args:{id:v.id('ownerPushTokens')},handler:async(ctx,args)=>{
    if(await ctx.db.get(args.id)) await ctx.db.patch(args.id,{active:false});
}});
export const sendPush=internalAction({args:{ownerId:v.id('businessOwners'),eventKey:v.string(),title:v.string(),body:v.string()},handler:async(ctx,args)=>{
    const tokens=await ctx.runQuery(internal.ownerInbox.pushRecipients,{ownerId:args.ownerId,eventKey:args.eventKey});
    if(!tokens.length) return;
    try {
        const response=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(tokens.map(token=>({to:token.token,sound:'default',title:args.title,body:args.body,data:{ownerId:args.ownerId,ownerEventKey:args.eventKey}})))});
        if(!response.ok) return;
        const result=await response.json();
        for(let i=0;i<tokens.length;i++) if(result.data?.[i]?.details?.error==='DeviceNotRegistered') await ctx.runMutation(internal.ownerInbox.deactivatePush,{id:tokens[i]._id});
    } catch { /* An unavailable push service must not undo an inbox update. */ }
}});
