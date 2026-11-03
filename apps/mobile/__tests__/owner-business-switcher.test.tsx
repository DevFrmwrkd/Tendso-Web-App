import React from 'react';
import { Share } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { OwnerBusinessSwitcher } from '../components/v2/owner/OwnerBusinessSwitcher';
import Today from '../app/(owner)/(tabs)/today';
import MySite from '../app/(owner)/(tabs)/site';
import type { OwnerMe, SiteSummary, SubmissionId } from '../lib/v2/ownerTypes';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockSelect = jest.fn(); const mockBegin = jest.fn();
let mockActor: string | null;
let mockMe: OwnerMe;
let mockSelected: string | null;
let mockNew: boolean;
let mockEpoch: number;
let mockRevision: number;
const mockListeners = new Set<() => void>();
const mockSubscribe = (listener: () => void) => { mockListeners.add(listener); return () => { mockListeners.delete(listener); }; };
function mockEmit() { mockRevision += 1; for (const listener of mockListeners) listener(); }
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ userId: mockActor }) }));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('../lib/v2/ownerFlags', () => ({ OWNER_SAMPLE_DATA: false }));
jest.mock('../lib/v2/ownerIntake', () => ({
  ownerIntake: { scope: () => mockEpoch, isCurrent: (epoch: number) => epoch === mockEpoch,
    selectBusiness: (...args: unknown[]) => mockSelect(...args), beginBusiness: () => mockBegin() },
  useOwnerIntake: () => ({}),
}));
jest.mock('../lib/v2/useOwnerSite', () => ({
  useOwnerSite: () => {
    require('react').useSyncExternalStore(mockSubscribe, () => mockRevision, () => mockRevision);
    const site = mockNew ? null : mockMe.sites.find(item => item.submissionId === mockSelected) ?? mockMe.sites[0] ?? null;
    return { me: mockMe, site, id: site?.submissionId ?? null, isNewBusiness: mockNew };
  }, firstName: () => 'Ben', greeting: () => 'Morning',
}));
jest.mock('../lib/v2/ownerData', () => ({
  usePreview: (id: string | null) => id ? { ready: true, publishedUrl: `https://${id}.sites.tendso.com` } : undefined,
  useOwnerSubmission: () => undefined,
}));
jest.mock('../components/v2/owner/OwnerUI', () => ({ Buddy: () => null, SiteFrame: () => null }));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'MockSvg', Path: 'MockPath', Defs: 'MockDefs', LinearGradient: 'MockGradient', Rect: 'MockRect', Stop: 'MockStop' }));

function business(id: string, extra: Partial<SiteSummary> = {}): SiteSummary {
  return { submissionId: id as SubmissionId, businessName: `${id} business`, businessType: 'Food', contentSource: 'owner_app',
    publishPolicy: 'pay_then_publish', status: 'completed', phase: 'live', publishedUrl: `https://${id}.sites.tendso.com`,
    total: 4999, amountPaid: 4999, balanceDue: 0, paidInFull: true, openChangeRequests: 0, createdAt: 1, ...extra };
}
function props() { return { me: mockMe, site: mockNew ? null : mockMe.sites.find(item => item.submissionId === mockSelected) ?? null, isNewBusiness: mockNew }; }
function open(screen: ReturnType<typeof render>) { fireEvent.press(screen.getByRole('button', { name: /Current business:/ })); }
function handler(node: any): () => void {
  while (typeof node.props.onPress !== 'function') { if (!node.parent) throw new Error('Press handler unavailable'); node = node.parent; }
  return node.props.onPress;
}
beforeEach(() => {
  jest.clearAllMocks(); mockActor = 'owner-subject'; mockEpoch = 1; mockRevision = 0; mockNew = false; mockSelected = 'first';
  mockMe = { owner: { _id: 'owner-1', name: 'Ben', email: 'ben@example.test', phone: null }, sites: [business('first'), business('second')] };
  mockSelect.mockReset().mockImplementation((id: string) => { mockSelected = id; mockNew = false; mockEpoch += 1; mockEmit(); });
  mockBegin.mockReset().mockImplementation(() => { mockSelected = null; mockNew = true; mockEpoch += 1; mockEmit(); });
});
afterEach(() => jest.restoreAllMocks());

it('shows a compact accessible current-business control and a popup with status and selected radio', () => {
  const screen = render(<OwnerBusinessSwitcher {...props()} />);
  expect(screen.queryByRole('header', { name: 'Your businesses' })).toBeNull();
  open(screen);
  expect(screen.getByRole('header', { name: 'Your businesses' })).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'first business, Live' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'second business, Live' })).not.toBeChecked();
  fireEvent.press(screen.getByRole('button', { name: 'Close business menu' }));
  expect(screen.queryByRole('radio')).toBeNull();
  expect(mockSelect).not.toHaveBeenCalled();
});

it('keeps the current tab when selecting a live business and deduplicates the action', () => {
  const screen = render(<OwnerBusinessSwitcher {...props()} />); open(screen);
  const select = handler(screen.getByRole('radio', { name: 'second business, Live' }));
  act(() => { select(); select(); });
  expect(mockSelect).toHaveBeenCalledTimes(1); expect(mockSelect).toHaveBeenCalledWith('second');
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(screen.queryByRole('radio')).toBeNull();
});

it('resumes a selected draft through owner routing using its latest status', () => {
  const screen = render(<OwnerBusinessSwitcher {...props()} />); open(screen);
  const select = handler(screen.getByRole('radio', { name: 'second business, Live' }));
  mockMe = { ...mockMe, sites: [mockMe.sites[0], business('second', { phase: 'draft', status: 'draft' })] };
  screen.rerender(<OwnerBusinessSwitcher {...props()} />);
  act(() => select());
  expect(mockSelect).toHaveBeenCalledWith('second'); expect(mockRouter.push).toHaveBeenCalledWith('/(owner)');
});

it('starts a separate business workspace once and opens the first setup question', () => {
  const screen = render(<OwnerBusinessSwitcher {...props()} />); open(screen);
  const add = handler(screen.getByRole('button', { name: 'Add business' }));
  act(() => { add(); add(); });
  expect(mockBegin).toHaveBeenCalledTimes(1); expect(mockRouter.push).toHaveBeenCalledTimes(1);
  expect(mockRouter.push).toHaveBeenCalledWith('/(owner)/start/sell'); expect(mockSelect).not.toHaveBeenCalled();
});

it('does not reset an already active new-business workspace when Add business is pressed again', () => {
  mockNew = true; mockSelected = null;
  const screen = render(<OwnerBusinessSwitcher {...props()} />); open(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Add business' }));
  expect(mockBegin).not.toHaveBeenCalled(); expect(mockRouter.push).toHaveBeenCalledWith('/(owner)/start/sell');
});

it('warns at three owner drafts but still allows switching businesses', () => {
  mockMe = { ...mockMe, sites: [business('first'), ...[1, 2, 3].map(index => business(`draft-${index}`, { phase: 'draft', status: 'draft' }))] };
  const screen = render(<OwnerBusinessSwitcher {...props()} />); open(screen);
  expect(screen.getByText('3 drafts in progress')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Add business' })).toBeDisabled();
  fireEvent.press(screen.getByRole('radio', { name: 'first business, Live' }));
  expect(mockSelect).toHaveBeenCalledWith('first'); expect(mockBegin).not.toHaveBeenCalled();
});

it('does not treat published businesses or agent-created drafts as owner draft-limit slots', () => {
  mockMe = { ...mockMe, sites: [...mockMe.sites, business('agent', { contentSource: 'field_agent', phase: 'draft', status: 'draft' }),
    business('draft-a', { phase: 'draft', status: 'draft' }), business('draft-b', { phase: 'draft', status: 'draft' })] };
  const screen = render(<OwnerBusinessSwitcher {...props()} />); open(screen);
  expect(screen.getByRole('button', { name: 'Add business' })).toBeEnabled();
  fireEvent.press(screen.getByRole('button', { name: 'Add business' })); expect(mockBegin).toHaveBeenCalledTimes(1);
});

it.each(['actor', 'scope', 'removed business'])('rejects an old popup action after the %s changed', (change) => {
  const screen = render(<OwnerBusinessSwitcher {...props()} />); open(screen);
  const select = handler(screen.getByRole('radio', { name: 'second business, Live' }));
  if (change === 'actor') mockActor = 'other-owner';
  if (change === 'scope') mockEpoch += 1;
  if (change === 'removed business') mockMe = { ...mockMe, sites: [mockMe.sites[0]] };
  screen.rerender(<OwnerBusinessSwitcher {...props()} />);
  act(() => select()); expect(mockSelect).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled();
});

it('rechecks the current draft count instead of trusting an older Add business callback', () => {
  const screen = render(<OwnerBusinessSwitcher {...props()} />); open(screen);
  const add = handler(screen.getByRole('button', { name: 'Add business' }));
  mockMe = { ...mockMe, sites: [...mockMe.sites, ...[1, 2, 3].map(index => business(`draft-${index}`, { phase: 'draft', status: 'draft' }))] };
  screen.rerender(<OwnerBusinessSwitcher {...props()} />);
  act(() => add()); expect(mockBegin).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled();
});

it('keeps complete long business names readable in the scrollable popup', () => {
  const longName = 'Ben and Family General Merchandise, Bakery, Cafe and Community Store';
  mockMe = { ...mockMe, sites: [business('first', { businessName: longName }), ...Array.from({ length: 15 }, (_, i) => business(`shop-${i}`))] };
  const screen = render(<OwnerBusinessSwitcher {...props()} />); open(screen);
  expect(screen.getByRole('radio', { name: `${longName}, Live` })).toBeTruthy();
  expect(screen.getAllByRole('radio')).toHaveLength(16);
});

it('never opens account business selection without an authenticated owner', () => {
  mockActor = null;
  const screen = render(<OwnerBusinessSwitcher {...props()} />);
  expect(screen.getByRole('button', { name: /Current business:/ })).toBeDisabled(); open(screen);
  expect(screen.queryByRole('radio')).toBeNull();
});

it('Today keeps the bell and contextual payment action when the selected business changes', () => {
  mockMe = { ...mockMe, sites: [business('first'), business('second', { amountPaid: 1000, balanceDue: 3999, paidInFull: false })] };
  const screen = render(<Today />);
  expect(screen.getByRole('button', { name: 'Open owner inbox' })).toBeTruthy(); open(screen);
  fireEvent.press(screen.getByRole('radio', { name: 'second business, Live' }));
  expect(screen.getByRole('button', { name: /Current business: second business/ })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Pay ₱3,999' }));
  expect(mockRouter.push).toHaveBeenCalledWith('/(owner)/pay');
});

it('My site shares the selected business URL and stops showing another site in new-business mode', () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  const screen = render(<MySite />); open(screen);
  fireEvent.press(screen.getByRole('radio', { name: 'second business, Live' }));
  fireEvent.press(screen.getByRole('button', { name: 'Share' }));
  expect(share).toHaveBeenCalledWith({ message: 'second business: https://second.sites.tendso.com/' });
  act(() => { mockNew = true; mockSelected = null; mockEpoch += 1; mockEmit(); });
  expect(screen.getByRole('button', { name: /Current business: New business/ })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  expect(screen.queryByRole('button', { name: /^Pay / })).toBeNull();
});

it('Today resumes a new-business workspace through owner routing instead of restarting the sell question', () => {
  mockNew = true; mockSelected = null;
  const screen = render(<Today />);
  fireEvent.press(screen.getByRole('button', { name: 'Make my website' }));
  expect(mockRouter.push).toHaveBeenCalledWith('/(owner)');
  expect(mockRouter.push).not.toHaveBeenCalledWith('/(owner)/start/sell');
});
