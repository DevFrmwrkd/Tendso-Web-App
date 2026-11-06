import { createElement, type ReactNode } from 'react';
import { getFunctionName } from 'convex/server';

import VerificationRejectedPage from '@/app/verification-rejected/page';
import { RejectedProfileForm } from '@/app/verification-rejected/_components/RejectedProfileForm';
import type { Doc } from '@/convex/_generated/dataModel';

jest.mock('react', () => jest.requireActual('../apps/mobile/node_modules/react'));
jest.mock('react/jsx-runtime', () => jest.requireActual('../apps/mobile/node_modules/react/jsx-runtime'));
jest.mock('react/jsx-dev-runtime', () => jest.requireActual('../apps/mobile/node_modules/react/jsx-dev-runtime'));
jest.mock('@clerk/nextjs', () => ({ useUser: () => auth }));
jest.mock('next/navigation', () => ({ useRouter: () => router }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, ...props }: { children?: ReactNode }) => jest.requireActual('../apps/mobile/node_modules/react').createElement('a', props, children) }));
jest.mock('@/components/field-agent-onboarding/OnboardingShell', () => ({
    OnboardingShell: ({ title, children }: { title: ReactNode; children: ReactNode }) => jest.requireActual('../apps/mobile/node_modules/react').createElement('main', null, title, children),
    OnboardingLoading: () => 'Loading',
}));
jest.mock('@/convex/_generated/api', () => ({ api: jest.requireActual('convex/server').anyApi }));
jest.mock('convex/react', () => ({
    useQuery: () => account,
    useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
        const name = getFunctionName(reference);
        if (name === 'creators:resubmitProfileForReview') return resubmit;
        if (name === 'creators:requestRecertification') return recertify;
        throw new Error(`Unexpected mutation: ${name}`);
    },
    useAction: () => upload,
}));

interface TestNode {
    type: unknown;
    props: Record<string, unknown>;
    children: (TestNode | string)[];
    findAllByType(type: string): TestNode[];
}
interface Renderer { root: TestNode; update(node: ReactNode): void; unmount(): void }
const { create, act } = jest.requireActual('../apps/mobile/node_modules/react-test-renderer') as {
    create(element: ReactNode): Renderer;
    act(callback: () => void | Promise<void>): Promise<void>;
};
const original: Doc<'creators'> = {
    _id: 'rejected-agent' as Doc<'creators'>['_id'], _creationTime: 1,
    clerkId: 'agent-user', email: 'alex@example.com', role: 'creator', status: 'active',
    firstName: 'Alex', lastName: 'Santos', phone: '09171234567',
    quizPassedAt: 100, rejectedAt: 200, rejectionReason: 'Please correct your name.',
};
let account: Doc<'creators'> | undefined | null;
let renderer: Renderer | undefined;
const auth = { isLoaded: true, isSignedIn: true, user: { id: 'agent-user' } };
const router = { replace: jest.fn() };
const resubmit = jest.fn();
const recertify = jest.fn();
const upload = jest.fn();
const submitted = jest.fn();
const cancelled = jest.fn();
let consoleError: jest.SpyInstance;
function text(node: TestNode | string): string { return typeof node === 'string' ? node : node.children.map(text).join(''); }
function button(label: string) { return renderer!.root.findAllByType('button').find(node => text(node).trim() === label)!; }
function input(autoComplete: string) { return renderer!.root.findAllByType('input').find(node => node.props.autoComplete === autoComplete)!; }
function form(creator: Doc<'creators'> = account!) { return createElement(RejectedProfileForm, { creator, onCancel: cancelled, onSubmitted: submitted }); }
async function mount(node: ReactNode) { await act(async () => { renderer = create(node); }); }
async function change(field: string, value: string) { await act(() => { (input(field).props.onChange as (event: unknown) => void)({ target: { value } }); }); }
async function send() { await act(async () => { await (renderer!.root.findAllByType('form')[0].props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault: jest.fn() }); }); }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }

beforeEach(() => {
    jest.clearAllMocks();
    account = { ...original };
    auth.isLoaded = true;
    auth.isSignedIn = true;
    resubmit.mockReset().mockResolvedValue(undefined);
    recertify.mockReset().mockResolvedValue(undefined);
    upload.mockReset().mockResolvedValue({ uploadUrl: 'https://upload.example.com/photo', publicUrl: 'https://images.example.com/new.jpg' });
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
    const report = console.error;
    consoleError = jest.spyOn(console, 'error').mockImplementation((message: unknown, ...rest: unknown[]) => {
        if (!String(message).includes('react-test-renderer is deprecated')) report(message, ...rest);
    });
});
afterEach(async () => {
    await act(() => renderer?.unmount());
    renderer = undefined;
    consoleError.mockRestore();
    Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
    jest.restoreAllMocks();
});

it('opens corrections from feedback without resetting the passed quiz', async () => {
    await mount(createElement(VerificationRejectedPage));
    expect(text(renderer!.root)).toContain("Passed. You don't need to take it again.");
    expect(text(renderer!.root)).toContain('Please correct your name.');
    await act(() => { (button('Fix and resend').props.onClick as () => void)(); });
    expect(input('given-name').props.value).toBe('Alex');
    expect(resubmit).not.toHaveBeenCalled();
    expect(recertify).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
});

it('submits one atomic correction, preserves the quiz and supports optional empty fields', async () => {
    await mount(form());
    await change('given-name', '  Alex Miguel  ');
    await change('family-name', '');
    await change('tel', '');
    await send();
    expect(resubmit).toHaveBeenCalledWith({ id: original._id, firstName: 'Alex Miguel', lastName: '', phone: '' });
    expect(submitted).toHaveBeenCalledTimes(1);
    expect(recertify).not.toHaveBeenCalled();
    expect(account?.quizPassedAt).toBe(100);
});

it('retains the edited draft after a live account refresh', async () => {
    await mount(form());
    await change('given-name', 'Alex Miguel');
    await act(() => { renderer!.update(form({ ...original, lastActiveAt: 300 })); });
    expect(input('given-name').props.value).toBe('Alex Miguel');
});

it.each([{ status: 'suspended' as const }, { status: 'deleted' as const }, { isDeleted: true }])('disables an inactive account with feedback while preserving its corrections: %j', async inactive => {
    await mount(form());
    await change('given-name', 'Alex Miguel');
    await act(() => { renderer!.update(form({ ...original, ...inactive })); });
    expect(text(renderer!.root)).toContain('Your account is currently unavailable.');
    expect(renderer!.root.findAllByType('fieldset')[0].props.disabled).toBe(true);
    expect(button('Resubmit for review').props.disabled).toBe(true);
    expect(button('Add photo').props.disabled).toBe(true);
    expect(button('Cancel').props.disabled).toBe(false);
    await send();
    expect(resubmit).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    await act(() => { renderer!.update(form(original)); });
    expect(input('given-name').props.value).toBe('Alex Miguel');
    expect(button('Resubmit for review').props.disabled).toBe(false);
    await send();
    expect(resubmit).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Alex Miguel' }));
});

it('keeps corrections on a failed request and retries the same atomic mutation', async () => {
    resubmit.mockRejectedValueOnce(new Error('Connection lost. Try again.'));
    await mount(form());
    await change('given-name', 'Alex Miguel');
    await send();
    expect(text(renderer!.root)).toContain('Connection lost. Try again.');
    expect(input('given-name').props.value).toBe('Alex Miguel');
    expect(submitted).not.toHaveBeenCalled();
    await send();
    expect(resubmit).toHaveBeenCalledTimes(2);
    expect(submitted).toHaveBeenCalledTimes(1);
});

it('deduplicates rapid submissions while the request is pending', async () => {
    const pending = deferred<void>();
    resubmit.mockReturnValueOnce(pending.promise);
    await mount(form());
    const submit = renderer!.root.findAllByType('form')[0].props.onSubmit as (event: unknown) => Promise<void>;
    let first!: Promise<void>;
    await act(() => { first = submit({ preventDefault: jest.fn() }); void submit({ preventDefault: jest.fn() }); });
    expect(resubmit).toHaveBeenCalledTimes(1);
    expect(button('Sending for review…').props.disabled).toBe(true);
    await act(async () => { pending.resolve(); await first; });
    expect(submitted).toHaveBeenCalledTimes(1);
    await send();
    expect(resubmit).toHaveBeenCalledTimes(1);
});

it.each([['given-name', '', 'Enter your first name.'], ['tel', '123', 'Enter a Philippine mobile number']])('validates %s before writing', async (field, value, error) => {
    await mount(form());
    await change(field, value);
    await send();
    expect(text(renderer!.root)).toContain(error);
    expect(resubmit).not.toHaveBeenCalled();
});

it('saves a replacement photo only when the corrected profile is submitted', async () => {
    const fetcher = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);
    await mount(form());
    const file = { name: 'portrait.jpg', type: 'image/jpeg', size: 2048 };
    const photoInput = renderer!.root.findAllByType('input').find(node => node.props.type === 'file')!;
    await act(async () => { await (photoInput.props.onChange as (event: unknown) => Promise<void>)({ target: { files: [file], value: 'photo' } }); });
    expect(fetcher).toHaveBeenCalledWith('https://upload.example.com/photo', { method: 'PUT', body: file, headers: { 'Content-Type': 'image/jpeg' } });
    expect(resubmit).not.toHaveBeenCalled();
    await send();
    expect(resubmit).toHaveBeenCalledWith(expect.objectContaining({ profileImage: 'https://images.example.com/new.jpg' }));
});

it('does not upload or submit to an account that changed while choosing a photo', async () => {
    const pending = deferred<{ uploadUrl: string; publicUrl: string }>();
    const fetcher = jest.spyOn(globalThis, 'fetch');
    upload.mockReturnValueOnce(pending.promise);
    await mount(form());
    const photoInput = renderer!.root.findAllByType('input').find(node => node.props.type === 'file')!;
    let uploading!: Promise<void>;
    await act(() => { uploading = (photoInput.props.onChange as (event: unknown) => Promise<void>)({ target: { files: [{ name: 'a.jpg', type: 'image/jpeg', size: 12 }], value: 'photo' } }); });
    await act(() => { renderer!.update(form({ ...original, _id: 'other-agent' as Doc<'creators'>['_id'], clerkId: 'other-user' })); });
    await act(async () => { pending.resolve({ uploadUrl: 'https://upload.example.com/photo', publicUrl: 'https://images.example.com/new.jpg' }); await uploading; });
    await send();
    expect(fetcher).not.toHaveBeenCalled();
    expect(resubmit).not.toHaveBeenCalled();
});

it('routes a live resubmission back to pending and an approval to the dashboard', async () => {
    await mount(createElement(VerificationRejectedPage));
    account = { ...original, rejectedAt: undefined };
    await act(() => { renderer!.update(createElement(VerificationRejectedPage)); });
    expect(router.replace).toHaveBeenLastCalledWith('/pending');
    account = { ...original, rejectedAt: undefined, certifiedAt: 300 };
    await act(() => { renderer!.update(createElement(VerificationRejectedPage)); });
    expect(router.replace).toHaveBeenLastCalledWith('/dashboard');
});

it('uses the explicit legacy finish-certification path only when there is no saved quiz', async () => {
    account = { ...original, quizPassedAt: undefined };
    await mount(createElement(VerificationRejectedPage));
    expect(button('Fix and resend')).toBeUndefined();
    await act(async () => { await (button('Finish certification').props.onClick as () => Promise<void>)(); });
    expect(recertify).toHaveBeenCalledWith({ id: original._id });
    expect(resubmit).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenLastCalledWith('/training');
});

it.each([['affiliate', '/affiliates/dashboard'], ['staff', '/admin'], ['admin', '/dashboard']])('keeps the %s role redirect', async (role, target) => {
    account = { ...original, role: role as Doc<'creators'>['role'] };
    await mount(createElement(VerificationRejectedPage));
    expect(router.replace).toHaveBeenLastCalledWith(target);
    expect(resubmit).not.toHaveBeenCalled();
});
