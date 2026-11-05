import { createRequire } from 'node:module';
import { act, createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ fetch: vi.fn(), renderChallenge: vi.fn(), removeChallenge: vi.fn(), resetChallenge: vi.fn() }));
vi.mock('react', async () => {
    const { createRequire } = await import('node:module');
    return createRequire(import.meta.url)('../../apps/mobile/node_modules/react');
});
vi.mock('next/link', async () => {
    const { createElement: element } = await import('react');
    return { default: ({ children, ...props }: { children: ReactNode }) => element('a', props, children) };
});
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('next/script', async () => {
    const { useEffect } = await import('react');
    return { default: ({ onReady }: { onReady: () => void }) => { useEffect(() => { onReady(); }, [onReady]); return null; } };
});
vi.mock('../../components/v2', async () => {
    const { createElement: element } = await import('react');
    return { Button: ({ href, children, ...props }: { href?: string; children: ReactNode }) => element(href ? 'a' : 'button', { ...props, ...(href ? { href } : {}) }, children) };
});

import { HireForm } from '../../components/landing-v2/Paths';

type Node = { props: Record<string, any> };
type View = { root: { findAllByType(type: string): Node[] }; toJSON(): unknown; unmount(): void };
const renderer = createRequire(import.meta.url)('../../apps/mobile/node_modules/react-test-renderer') as { create(node: ReactNode, options?: object): View };
let view: View | undefined;
const text = () => JSON.stringify(view?.toJSON());
const response = (status: number, body: object) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
async function render() {
    await act(async () => { view = renderer.create(createElement(HireForm), { createNodeMock: () => ({}) }); });
}
async function fillAndSubmit() {
    await act(async () => {
        for (const [name, value] of [['shopName', 'Test shop'], ['area', 'Pasig'], ['mobile', '09171234567']]) {
            view!.root.findAllByType('input').find(node => node.props.name === name)!.props.onChange({ target: { value } });
        }
    });
    await act(async () => { await view!.root.findAllByType('form')[0].props.onSubmit({ preventDefault: vi.fn() }); });
}
beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '');
    vi.stubGlobal('fetch', state.fetch);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('window', { turnstile: { render: state.renderChallenge, remove: state.removeChallenge, reset: state.resetChallenge } });
    state.fetch.mockReset();
    state.renderChallenge.mockImplementation((_element, options) => { options.callback('challenge-token'); return 'widget'; });
});
afterEach(async () => {
    if (view) await act(async () => { view!.unmount(); });
    view = undefined;
    vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

describe('landing shop visit fallback', () => {
    it('offers the authenticated map-pin request flow when the public challenge is not configured', async () => {
        await render();
        expect(view!.root.findAllByType('a').some(node => node.props.href === '/my-business/visits/new')).toBe(true);
        expect(text()).toContain('Sign in to add your shop details and map pin');
        expect(text()).not.toContain('Visit requests are temporarily unavailable');
        expect(view!.root.findAllByType('form')).toHaveLength(0);
        expect(state.fetch).not.toHaveBeenCalled();
        expect(state.renderChallenge).not.toHaveBeenCalled();
    });

    it('uses the owner flow when the trusted public endpoint is unavailable on a local proxy', async () => {
        vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'site-key');
        state.fetch.mockResolvedValue(response(200, { publicFormAvailable: false }));
        await render();
        expect(state.fetch).toHaveBeenCalledWith('/api/landing-visit', expect.objectContaining({ method: 'GET', cache: 'no-store' }));
        expect(view!.root.findAllByType('form')).toHaveLength(0);
        expect(view!.root.findAllByType('a')[0].props.href).toBe('/my-business/visits/new');
        expect(state.renderChallenge).not.toHaveBeenCalled();
    });

    it('keeps configured anonymous submissions behind Turnstile and sends the verified token', async () => {
        vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'site-key');
        state.fetch.mockImplementation((_url, options) => Promise.resolve(options.method === 'GET'
            ? response(200, { publicFormAvailable: true }) : response(200, { ok: true, duplicate: false })));
        await render();
        expect(state.renderChallenge).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ sitekey: 'site-key', action: 'landing-visit' }));
        await fillAndSubmit();
        const post = state.fetch.mock.calls.find(([, options]) => options.method === 'POST');
        expect(JSON.parse(post![1].body)).toEqual({ shopName: 'Test shop', area: 'Pasig', mobile: '09171234567', token: 'challenge-token' });
        expect(text()).toContain('Request sent.');
        expect(state.resetChallenge).toHaveBeenCalled();
    });

    it('switches to a fixed owner request link if short-form deployment configuration fails at submission', async () => {
        vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'site-key');
        state.fetch.mockImplementation((_url, options) => Promise.resolve(options.method === 'GET'
            ? response(200, { publicFormAvailable: true }) : response(503, { requestUrl: 'https://untrusted.example/redirect' })));
        await render();
        await fillAndSubmit();
        expect(view!.root.findAllByType('form')).toHaveLength(0);
        expect(view!.root.findAllByType('a')[0].props.href).toBe('/my-business/visits/new');
        expect(text()).not.toContain('Request sent.');
        expect(text()).not.toContain('untrusted.example');
    });

    it('shows verification errors without pretending the request was sent', async () => {
        vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'site-key');
        state.fetch.mockImplementation((_url, options) => Promise.resolve(options.method === 'GET'
            ? response(200, { publicFormAvailable: true }) : response(400, { message: 'Please complete the bot check and try again.' })));
        await render();
        await fillAndSubmit();
        expect(text()).toContain('Please complete the bot check and try again.');
        expect(text()).not.toContain('Request sent.');
        expect(view!.root.findAllByType('form')).toHaveLength(1);
    });
});
