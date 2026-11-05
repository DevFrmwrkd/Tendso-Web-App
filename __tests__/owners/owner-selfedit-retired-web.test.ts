import { NextRequest } from 'next/server';
import { getFunctionName } from 'convex/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    userId: 'owner-user' as string | null,
    token: 'test-token' as string | null,
    pipeline: false,
    creator: { role: 'creator' } as { role: string },
    query: vi.fn(), build: vi.fn(),
    redirect: vi.fn((href: string) => { throw new Error(`REDIRECT:${href}`); }),
}));
vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: state.userId, getToken: async () => state.token }) }));
vi.mock('convex/nextjs', () => ({ fetchQuery: state.query }));
vi.mock('next/navigation', () => ({ redirect: state.redirect }));
vi.mock('../../lib/astro-builder', () => ({ buildAstroSite: state.build }));
vi.mock('../../lib/services/groq.service', () => ({ groqService: {}, delimitTranscript: vi.fn(), hasSuppliedTestimonials: vi.fn(), stripFabricatedTestimonials: vi.fn() }));
vi.mock('../../lib/aiPipeline/internalAuth', () => ({ isAiPipelineBuildRequest: () => state.pipeline }));
vi.mock('../../lib/security', () => ({ checkRateLimit: () => ({ allowed: true }), RATE_LIMITS: { expensive: { maxRequests: 5, windowMs: 60_000 } } }));

import MySitePage from '../../app/v2/my-site/page';
import { POST as oldOwnerBuild } from '../../app/api/owner-site/route';
import { POST as generateWebsite } from '../../app/api/generate-website/route';

beforeEach(() => {
    state.userId = 'owner-user'; state.token = 'test-token'; state.pipeline = false; state.creator = { role: 'creator' };
    state.query.mockReset(); state.build.mockReset(); state.redirect.mockClear();
    state.query.mockImplementation(async reference => getFunctionName(reference) === 'creators:getByClerkId' ? state.creator : null);
});

const request = (body: unknown) => new NextRequest('https://app.example.test/api/generate-website', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });

describe('retired owner editor web entry points', () => {
    it('sends old editor bookmarks to the private owner workspace without mounting an editor', () => {
        expect(() => MySitePage()).toThrow('REDIRECT:/my-business');
        expect(state.redirect).toHaveBeenCalledWith('/my-business');
        expect(state.query).not.toHaveBeenCalled(); expect(state.build).not.toHaveBeenCalled();
    });

    it('keeps the legacy build API authenticated, then directs signed-in callers to request changes', async () => {
        state.userId = null;
        expect((await oldOwnerBuild()).status).toBe(401);
        state.userId = 'owner-user';
        const response = await oldOwnerBuild();
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({ code: 'OWNER_WEBSITE_CHANGES_BY_REQUEST', error: expect.stringContaining('Ask for a change') });
        expect(state.query).not.toHaveBeenCalled(); expect(state.build).not.toHaveBeenCalled();
    });

    it.each([true, false])('blocks direct owner generation before reading saved drafts or building (preview=%s)', async preview => {
        const response = await generateWebsite(request({ asOwner: true, submissionId: 'site-id', preview, content: { hero: 'Changed' } }));
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({ code: 'OWNER_WEBSITE_CHANGES_BY_REQUEST', error: expect.stringContaining('Ask for a change') });
        expect(state.query).not.toHaveBeenCalled(); expect(state.build).not.toHaveBeenCalled();
    });

    it('does not treat an administrator using the retired owner flag as a new editing path', async () => {
        state.creator = { role: 'admin' };
        expect((await generateWebsite(request({ asOwner: true, submissionId: 'site-id' }))).status).toBe(403);
        expect(state.query).not.toHaveBeenCalled(); expect(state.build).not.toHaveBeenCalled();
    });

    it('keeps normal administrator generation authorization and validation intact', async () => {
        const nonAdmin = await generateWebsite(request({}));
        expect(nonAdmin.status).toBe(403); expect(await nonAdmin.json()).toEqual({ error: 'Admin access required' });
        state.query.mockClear(); state.creator = { role: 'admin' };
        const admin = await generateWebsite(request({}));
        expect(admin.status).toBe(400); expect(await admin.json()).toEqual({ error: 'Submission ID is required' });
        expect(state.query).toHaveBeenCalledOnce();
        expect(getFunctionName(state.query.mock.calls[0][0])).toBe('creators:getByClerkId');
        expect(state.build).not.toHaveBeenCalled();
    });

    it('leaves authenticated internal pipeline builds on their existing validation path', async () => {
        state.pipeline = true; state.userId = null;
        const response = await generateWebsite(request({}));
        expect(response.status).toBe(400); expect(await response.json()).toEqual({ error: 'Submission ID is required' });
        expect(state.query).not.toHaveBeenCalled(); expect(state.build).not.toHaveBeenCalled();
    });

    it('does not reveal editing policy instead of authentication when no session exists', async () => {
        state.userId = null;
        const response = await generateWebsite(request({ asOwner: true, submissionId: 'site-id' }));
        expect(response.status).toBe(401); expect(state.query).not.toHaveBeenCalled(); expect(state.build).not.toHaveBeenCalled();
    });
});
