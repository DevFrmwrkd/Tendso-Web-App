import { createElement, type ReactNode } from 'react';
import StartThanksPage from '@/app/start/thanks/page';
import type { SubmittedReceipt } from '@/app/start/draft';

jest.mock('react', () => jest.requireActual('../../apps/mobile/node_modules/react'));
jest.mock('react/jsx-runtime', () => jest.requireActual('../../apps/mobile/node_modules/react/jsx-runtime'));
jest.mock('react/jsx-dev-runtime', () => jest.requireActual('../../apps/mobile/node_modules/react/jsx-dev-runtime'));
jest.mock('@/app/start/draft', () => ({ readSubmitted: () => receipt === null ? null : { ...receipt } }));
jest.mock('@/components/v2', () => {
    const React = jest.requireActual('../../apps/mobile/node_modules/react');
    return { Button: ({ children, href }: { children?: ReactNode; href?: string }) => React.createElement('a', { href }, children) };
});
jest.mock('@/components/v2/pages-b/shared', () => ({ CheckIcon: () => null, PbBrand: () => null }));

interface Node { children: (Node | string)[] }
interface Renderer { toJSON(): Node; unmount(): void }
const { create, act } = jest.requireActual('../../apps/mobile/node_modules/react-test-renderer') as {
    create(element: ReactNode): Renderer;
    act(callback: () => void): Promise<void>;
};
const text = (node: Node | string): string => typeof node === 'string' ? node : (node.children ?? []).map(text).join(' ');
const saved: SubmittedReceipt = {
    email: 'owner@example.test', businessName: 'Saved Shop', city: 'Marikina',
    amount: 4999, campaign: null, customDomain: false,
};
let receipt: SubmittedReceipt | null;
let renderer: Renderer | undefined;
let errors: jest.SpyInstance;

beforeEach(() => {
    receipt = saved;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const error = console.error;
    errors = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
        if (String(args[0]).includes('react-test-renderer is deprecated')) return;
        error(...args);
    });
});
afterEach(async () => { if (renderer) await act(() => renderer!.unmount()); renderer = undefined; errors.mockRestore(); });

it('opens a saved receipt without looping when storage returns a fresh object on every read', async () => {
    await act(() => { renderer = create(createElement(StartThanksPage)); });
    const output = text(renderer!.toJSON());
    expect(output).toContain('owner@example.test');
    expect(output).toContain('Saved Shop');
    expect(output).toContain('₱4,999');
    expect(output).toContain('private preview');
    expect(errors.mock.calls.some(args => /cached|infinite|maximum update/i.test(String(args[0])))).toBe(false);
});

it('opens a receipt safely after refresh without requiring an active intake draft', async () => {
    await act(() => { renderer = create(createElement(StartThanksPage)); });
    await act(() => renderer!.unmount());
    renderer = undefined;
    await act(() => { renderer = create(createElement(StartThanksPage)); });
    expect(text(renderer!.toJSON())).toContain('Saved Shop');
    expect(text(renderer!.toJSON())).toContain('pay once to publish');
});

it('uses a generic confirmation when this tab has no saved receipt', async () => {
    receipt = null;
    await act(() => { renderer = create(createElement(StartThanksPage)); });
    expect(text(renderer!.toJSON())).toContain('the address you gave us');
    expect(text(renderer!.toJSON())).not.toContain('₱4,999');
});

it('explains giveaway review without asking the applicant to pay', async () => {
    receipt = { ...saved, giveawayApplication: true, amount: 0 };
    await act(() => { renderer = create(createElement(StartThanksPage)); });
    const output = text(renderer!.toJSON());
    expect(output).toContain('Application received.');
    expect(output).toContain('Free, if your application qualifies');
    expect(output).not.toContain('pay once to publish');
});
