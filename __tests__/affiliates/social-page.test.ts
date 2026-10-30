import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import {
    AFFILIATE_SOCIAL_PLATFORMS, affiliateSocialPlatformLinkError, getAffiliateSocialLinks,
    type AffiliateSocialLinks,
} from '../../lib/affiliates';

const modules = {
    './_generated/server.js': () => import('../../convex/_generated/server'),
    './affiliates.ts': () => import('../../convex/affiliates'),
    './creatorProgram.ts': () => import('../../convex/creatorProgram'),
};
const links: AffiliateSocialLinks = {
    messenger: 'https://m.me/mika', facebook: 'https://www.facebook.com/mika',
    instagram: 'https://instagram.com/mika', tiktok: 'https://www.tiktok.com/@mika', youtube: 'https://youtube.com/@mika',
};

async function setup() {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) => ctx.db.insert('creators', {
        clerkId: 'mika', email: 'private@example.com', phone: '09171234567', firstName: 'Mika',
        role: 'affiliate', status: 'active', affiliateHandle: 'mika', referralCode: 'MIKA',
        affiliateSocialLink: links.messenger, wiseEmail: 'private-wise@example.com',
        creatorSocials: [{ platform: 'instagram', handle: 'private-application-handle' }],
    }));
    return { t, id, actor: t.withIdentity({ subject: 'mika' }) };
}

describe('public creator page social settings', () => {
    it('keeps a legacy saved link, while an explicitly empty map clears it', () => {
        expect(getAffiliateSocialLinks(undefined, links.messenger)).toEqual({ messenger: links.messenger });
        expect(getAffiliateSocialLinks(undefined, links.facebook)).toEqual({ facebook: links.facebook });
        expect(getAffiliateSocialLinks({}, links.messenger)).toEqual({});
        expect(getAffiliateSocialLinks({ tiktok: links.tiktok, youtube: 'javascript:alert(1)' })).toEqual({ tiktok: links.tiktok });
    });

    it('validates every platform against its own host, HTTPS and credential rules', () => {
        for (const platform of AFFILIATE_SOCIAL_PLATFORMS) {
            expect(affiliateSocialPlatformLinkError(platform, links[platform]!)).toBeNull();
            expect(affiliateSocialPlatformLinkError(platform, '')).toBeNull();
            expect(affiliateSocialPlatformLinkError(platform, 'https://example.com/profile')).not.toBeNull();
            expect(affiliateSocialPlatformLinkError(platform, links[platform]!.replace('https:', 'http:'))).not.toBeNull();
            const withCredentials = new URL(links[platform]!);
            withCredentials.username = 'secret';
            expect(affiliateSocialPlatformLinkError(platform, withCredentials.href)).not.toBeNull();
            const lookalike = new URL(links[platform]!);
            lookalike.hostname += '.evil.test';
            expect(affiliateSocialPlatformLinkError(platform, lookalike.href)).not.toBeNull();
        }
        expect(affiliateSocialPlatformLinkError('messenger', links.youtube!)).not.toBeNull();
        expect(affiliateSocialPlatformLinkError('youtube', 'https://youtube.com:444/@mika')).not.toBeNull();
        expect(affiliateSocialPlatformLinkError('tiktok', 'https://tiktok.com/' + 'a'.repeat(2048))).not.toBeNull();
    });

    it('saves several trimmed links and a message, exposing only explicit public fields', async () => {
        const { t, id, actor } = await setup();
        await actor.mutation(api.affiliates.updatePage, { message: ' Hello, shop owners. ', socialLinks: {
            ...links, instagram: ` ${links.instagram} `,
        } });
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
            affiliateMessage: 'Hello, shop owners.', affiliateSocialLinks: links, affiliateSocialLink: links.messenger,
        });
        const card = await t.query(api.creatorProgram.getCreatorByHandle, { handle: 'mika' });
        expect(card).toMatchObject({ message: 'Hello, shop owners.', socialLinks: links });
        expect(Object.keys(card!).sort()).toEqual([
            'code', 'handle', 'listPrice', 'message', 'name', 'percentOff', 'photo', 'price', 'saving', 'socialLinks',
        ]);
        expect(JSON.stringify(card)).not.toContain('private');
        expect(await t.query(api.creatorProgram.getCreatorByCode, { code: 'MIKA' })).toEqual(card);
        expect(await t.query(api.affiliates.publicPage, { handle: 'mika' })).toMatchObject({ message: card!.message, socialLinks: links });
    });

    it('supports partial platform removal and clearing every public link and message', async () => {
        const { t, id, actor } = await setup();
        await actor.mutation(api.affiliates.updatePage, { socialLinks: links });
        await actor.mutation(api.affiliates.updatePage, { socialLinks: { youtube: links.youtube, messenger: '  ' } });
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ affiliateSocialLinks: { youtube: links.youtube } });
        expect((await t.run((ctx) => ctx.db.get(id)))?.affiliateSocialLink).toBeUndefined();
        await actor.mutation(api.affiliates.updatePage, { socialLinks: {}, message: '' });
        const row = await t.run((ctx) => ctx.db.get(id));
        expect(row?.affiliateSocialLinks).toEqual({});
        expect(row?.affiliateSocialLink).toBeUndefined();
        expect(row?.affiliateMessage).toBeUndefined();
        const card = await t.query(api.creatorProgram.getCreatorByHandle, { handle: 'mika' });
        expect(card).not.toHaveProperty('socialLinks');
        expect(card).not.toHaveProperty('message');
    });

    it('lets an older editor update its one link without dropping the other platforms', async () => {
        const { t, id, actor } = await setup();
        await actor.mutation(api.affiliates.updatePage, { socialLinks: links });
        await actor.mutation(api.affiliates.updatePage, { socialLink: 'https://m.me/new-mika' });
        expect((await t.run((ctx) => ctx.db.get(id)))?.affiliateSocialLinks).toEqual({ ...links, messenger: 'https://m.me/new-mika' });
        await actor.mutation(api.affiliates.updatePage, { socialLink: '' });
        expect((await t.run((ctx) => ctx.db.get(id)))?.affiliateSocialLinks).toEqual({
            facebook: links.facebook, instagram: links.instagram, tiktok: links.tiktok, youtube: links.youtube,
        });
    });

    it('rejects invalid platform links atomically and requires the active account owner', async () => {
        const { t, id, actor } = await setup();
        const payload = { message: 'Must not save', socialLinks: { youtube: links.instagram } };
        await expect(actor.mutation(api.affiliates.updatePage, payload)).rejects.toThrow('YouTube');
        expect((await t.run((ctx) => ctx.db.get(id)))?.affiliateMessage).toBeUndefined();
        await expect(t.mutation(api.affiliates.updatePage, { socialLinks: links })).rejects.toThrow('Not authenticated');
        await expect(t.withIdentity({ subject: 'other' }).mutation(api.affiliates.updatePage, { socialLinks: links })).rejects.toThrow('affiliate account');
        const unknownPlatform = { socialLinks: { ...links, other: 'https://example.com' } };
        await expect(actor.mutation(api.affiliates.updatePage, unknownPlatform)).rejects.toThrow();
        await t.run((ctx) => ctx.db.patch(id, { status: 'suspended' }));
        await expect(actor.mutation(api.affiliates.updatePage, { socialLinks: links })).rejects.toThrow('suspended');
        expect(await t.query(api.creatorProgram.getCreatorByHandle, { handle: 'mika' })).toBeNull();
        expect(await t.query(api.affiliates.publicPage, { handle: 'mika' })).toBeNull();
    });
});
