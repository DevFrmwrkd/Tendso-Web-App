import React from 'react';
jest.mock('../hooks/useCaptureProgress', () => ({ useCaptureProgress: jest.fn() }));
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import SubmitDesignScreen from '../app/(app)/submit/design';
import type { CaptureDesignGalleryProps } from '../components/field-agent/CaptureDesignGallery';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockChoose = jest.fn();
const mockSubmit = jest.fn();
const mockRead = jest.fn();
const mockWrite = jest.fn();
let mockActor: string;
let mockOffline: boolean;
let mockRevision: number;
let mockFocused: boolean;
let mockParams: Record<string, string>;
let mockCache: Record<string, Record<string, any>>;
let mockSubmissions: Record<string, any>;
let mockSessions: Record<string, any>;
let mockGallery: CaptureDesignGalleryProps;
const mockClone = (value: unknown) => value == null ? null : JSON.parse(JSON.stringify(value));

jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void | (() => void)) => {
    require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]);
  },
}));
jest.mock('../hooks/useCaptureSession', () => ({ useCaptureSession: () => {
  const actor = mockActor;
  if (!mockSessions[actor]) {
    const isCurrent = () => actor === mockActor;
    mockSessions[actor] = {
      isCurrent,
      canMutate: () => isCurrent() && !mockOffline,
      read: async (key: string) => {
        if (!isCurrent()) return null;
        const result = await mockRead(actor, key);
        return isCurrent() ? result : null;
      },
      write: async (key: string, value: unknown) => {
        if (!isCurrent()) throw new Error('Account changed');
        await mockWrite(actor, key, value);
      },
    };
  }
  return { ...mockSessions[actor], actor: { creatorId: actor, clerkId: `clerk-${actor}` }, actorKey: actor,
    isReady: true, isOffline: mockOffline, canQuery: !mockOffline, revision: mockRevision };
} }));
jest.mock('@tendso/convex-client', () => ({ api: {
  submissions: { getById: 'submission', chooseDesign: 'choose', submit: 'submit' },
} }));
jest.mock('convex/react', () => ({
  useQuery: (_reference: string, args: any) => args === 'skip' ? undefined : mockSubmissions[args.id] ?? null,
  useMutation: (reference: string) => reference === 'choose' ? mockChoose : mockSubmit,
}));
jest.mock('../components/field-agent/CaptureDesignGallery', () => ({
  CaptureDesignGallery: (props: CaptureDesignGalleryProps) => {
    mockGallery = props;
    const { View, Text, Pressable } = require('react-native');
    return require('react').createElement(View, { testID: 'design-gallery' },
      require('react').createElement(Text, null, `Selected: ${props.selectedCode ?? 'none'}`),
      props.error ? require('react').createElement(Text, null, props.error) : null,
      require('react').createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: 'Select Forge',
        disabled: props.busy || props.disabled, onPress: () => props.onSelect('barbershop:F') }, require('react').createElement(Text, null, 'Select Forge')),
      require('react').createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: 'Use design',
        disabled: props.busy || props.disabled, onPress: () => props.onUse(props.selectedCode ?? props.designs[0].code) },
      require('react').createElement(Text, null, 'Use design')));
  },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path', Defs: 'Defs', LinearGradient: 'Gradient', Rect: 'Rect', Stop: 'Stop' }));

const flush = async () => { for (let count = 0; count < 15; count++) await Promise.resolve(); };
async function gallery() {
  const screen = render(<SubmitDesignScreen />);
  await waitFor(() => expect(screen.getByTestId('design-gallery')).toBeTruthy());
  return screen;
}

it('returns a resumed design step to its saved interview', async () => {
  mockParams = { resumed: '1' };
  await gallery();
  act(() => mockGallery.onBack());
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/(app)/submit/interview', params: { draftId: 'draft-1', resumed: '1' } });
  expect(mockRouter.back).not.toHaveBeenCalled();
});

it('returns a rejected design correction to Review even when the capture was resumed', async () => {
  mockParams = { draftId: 'draft-1', resumed: '1', returnTo: 'review' };
  mockSubmissions['draft-1'].status = 'rejected';
  await gallery();
  act(() => mockGallery.onBack());
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('does not replace an explicit draft route with another shop from the current pointer', async () => {
  mockParams = { draftId: 'draft-2', resumed: '1' };
  const screen = render(<SubmitDesignScreen />);
  await waitFor(() => expect(screen.getByText('Open your capture first')).toBeTruthy());
  expect(screen.queryByTestId('design-gallery')).toBeNull();
  expect(mockCache['agent-1'].current_submission_id).toBe('draft-1');
  expect(mockChoose).not.toHaveBeenCalled();
  expect(mockWrite).not.toHaveBeenCalled();
});

it.each([
  ['already sent', { status: 'submitted' }],
  ['owner app', { status: 'draft', contentSource: 'owner_app' }],
  ['owner intake', { status: 'draft', contentSource: 'owner_intake' }],
])('does not allow an offline design edit for the known %s capture', async (_label, overrides) => {
  mockOffline = true;
  mockCache['agent-1'].submission_snapshot = { submissionId: 'draft-1', creatorId: 'agent-1',
    businessType: 'Barber/Salon', ...overrides };
  const screen = render(<SubmitDesignScreen />);
  await waitFor(() => expect(screen.getByText('Open your capture first')).toBeTruthy());
  expect(screen.queryByTestId('design-gallery')).toBeNull();
  expect(mockChoose).not.toHaveBeenCalled(); expect(mockWrite).not.toHaveBeenCalled();
});

it('keeps rejected feedback and the same capture when correcting a design offline', async () => {
  mockOffline = true;
  mockParams = { draftId: 'draft-1', returnTo: 'review' };
  mockCache['agent-1'].submission_snapshot = { submissionId: 'draft-1', creatorId: 'agent-1',
    status: 'rejected', businessType: 'Law Office', rejectionReason: 'Choose a legal-office design.', templateId: 'business:CP' };
  await gallery();
  expect(mockGallery.reviewFeedback).toBe('Choose a legal-office design.');
  await act(async () => { await mockGallery.onUse('business:CQ'); });
  expect(mockCache['agent-1'].submission_design).toMatchObject({ submissionId: 'draft-1', templateId: 'business:CQ' });
  expect(mockChoose).not.toHaveBeenCalled();
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(mockRouter.push).not.toHaveBeenCalled();
});

it('preserves a locally confirmed design while the same offline capture receives its server ID', async () => {
  mockOffline = true;
  mockParams = { draftId: 'offline_pending', resumed: '1' };
  mockCache['agent-1'] = { current_submission_id: 'offline_pending',
    submission_pending_sync: { creatorId: 'agent-1', formData: { businessType: 'Barber/Salon' } },
    submission_snapshot: { submissionId: 'offline_pending', creatorId: 'agent-1', businessType: 'Barber/Salon' },
    submission_design: { submissionId: 'offline_pending', templateId: 'business:CB', savedAt: 1 } };
  const screen = await gallery();
  expect(mockGallery.selectedCode).toBe('business:CB');
  mockOffline = false; mockRevision++;
  mockCache['agent-1'].current_submission_id = 'draft-1';
  mockCache['agent-1'].submission_pending_sync.existingDraftId = 'draft-1';
  screen.rerender(<SubmitDesignScreen />);
  await act(async () => { await flush(); });
  await waitFor(() => expect(mockGallery.selectedCode).toBe('business:CB'));
  await act(async () => { await mockGallery.onUse('business:CB'); });
  expect(mockChoose).toHaveBeenCalledWith({ id: 'draft-1', templateId: 'business:CB' });
  expect(mockCache['agent-1'].submission_design).toMatchObject({ submissionId: 'draft-1', templateId: 'business:CB' });
  expect(mockRouter.push).toHaveBeenCalledWith('/(app)/submit/review');
});

it('uses the queued category while reconnecting without applying its design to the old server category', async () => {
  mockCache['agent-1'].submission_pending_sync = { creatorId: 'agent-1', existingDraftId: 'draft-1',
    formData: { businessType: 'Law Office' } };
  const original = mockClone(mockSubmissions['draft-1']);
  await gallery();
  expect(mockGallery.designs.map(design => design.code)).toEqual(['business:CP', 'business:CQ', 'business:CR']);
  await act(async () => { await mockGallery.onUse('business:CP'); });
  expect(mockCache['agent-1'].submission_design).toMatchObject({ submissionId: 'draft-1', templateId: 'business:CP' });
  expect(mockChoose).not.toHaveBeenCalled();
  expect(mockSubmissions['draft-1']).toEqual(original);
  expect(mockCache['agent-1'].submission_pending_sync.formData.businessType).toBe('Law Office');
  expect(mockRouter.push).toHaveBeenCalledWith('/(app)/submit/review');
});

it('requires a matching choice if the business category changes during the design save', async () => {
  let resolve!: () => void;
  mockChoose.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
  const screen = await gallery(); selectForge(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Use design' }));
  await waitFor(() => expect(mockChoose).toHaveBeenCalledTimes(1));
  mockSubmissions['draft-1'] = { ...mockSubmissions['draft-1'], businessType: 'Law Office' };
  screen.rerender(<SubmitDesignScreen />);
  await act(async () => { resolve(); await flush(); });
  await waitFor(() => expect(screen.getByText('The business type changed. Choose a matching design.')).toBeTruthy());
  expect(mockGallery.selectedCode).toBeNull();
  expect(mockGallery.designs.map(design => design.code)).toEqual(['business:CP', 'business:CQ', 'business:CR']);
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.back).not.toHaveBeenCalled();
  mockChoose.mockResolvedValue({ ok: true });
  await act(async () => { await mockGallery.onUse('business:CP'); });
  expect(mockChoose).toHaveBeenLastCalledWith({ id: 'draft-1', templateId: 'business:CP' });
  expect(mockRouter.push).toHaveBeenCalledWith('/(app)/submit/review');
});

it('drops the old barber selection when the same capture becomes a Law Office', async () => {
  mockSubmissions['draft-1'].businessType = 'Law Office';
  mockSubmissions['draft-1'].templateId = 'barbershop:F';
  await gallery();
  expect(mockGallery.selectedCode).toBeNull();
  expect(mockGallery.designs.map(design => design.code)).toEqual(['business:CP', 'business:CQ', 'business:CR']);
  await act(async () => { await mockGallery.onUse('barbershop:F'); });
  expect(mockChoose).not.toHaveBeenCalled();
  await act(async () => { await mockGallery.onUse('business:CP'); });
  expect(mockChoose).toHaveBeenCalledWith({ id: 'draft-1', templateId: 'business:CP' });
});

it('saves and reopens an approved design using the same canonical ID and capture', async () => {
  const screen = await gallery();
  await act(async () => { await mockGallery.onUse('business:CB'); });
  expect(mockChoose).toHaveBeenCalledWith({ id: 'draft-1', templateId: 'business:CB' });
  expect(mockCache['agent-1'].submission_design).toMatchObject({ submissionId: 'draft-1', templateId: 'business:CB' });
  expect(mockRouter.push).toHaveBeenCalledWith('/(app)/submit/review');
  screen.unmount();
  mockSubmissions['draft-1'].templateId = 'business:CB';
  mockChoose.mockClear(); mockRouter.push.mockClear();
  await gallery();
  expect(mockGallery.selectedCode).toBe('business:CB');
  expect(mockGallery.designs.map(design => design.code)).toEqual(['business:CA', 'business:CB', 'business:CC']);
  expect(mockChoose).not.toHaveBeenCalled();
  expect(mockRouter.push).not.toHaveBeenCalled();
});
function selectForge(screen: ReturnType<typeof render>) {
  fireEvent.press(screen.getByRole('button', { name: 'Select Forge' }));
}
function expectNoSubmit() {
  expect(mockSubmit).not.toHaveBeenCalled();
  expect(mockWrite.mock.calls.some((call: unknown[]) => call[1] === 'submission_pending_submit')).toBe(false);
}

beforeEach(() => {
  jest.clearAllMocks(); mockActor = 'agent-1'; mockOffline = false; mockRevision = 0; mockFocused = true; mockParams = {}; mockSessions = {};
  mockCache = { 'agent-1': { current_submission_id: 'draft-1' }, 'agent-2': { current_submission_id: 'draft-2' } };
  mockSubmissions = {
    'draft-1': { _id: 'draft-1', creatorId: 'agent-1', status: 'draft', businessType: 'Barber/Salon' },
    'draft-2': { _id: 'draft-2', creatorId: 'agent-2', status: 'draft', businessType: 'Law Office', templateId: 'generic:B' },
  };
  mockChoose.mockReset().mockResolvedValue({ ok: true }); mockSubmit.mockReset();
  mockRead.mockReset().mockImplementation(async (actor: string, key: string) => mockClone(mockCache[actor]?.[key]));
  mockWrite.mockReset().mockImplementation(async (actor: string, key: string, value: unknown) => { mockCache[actor][key] = mockClone(value); });
});

it.each(['draft', 'rejected'])('saves the own %s design before opening Review and never submits from the picker', async status => {
  mockSubmissions['draft-1'].status = status;
  let resolve!: () => void;
  mockChoose.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
  const screen = await gallery(); selectForge(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Use design' }));
  await waitFor(() => expect(mockChoose).toHaveBeenCalledWith({ id: 'draft-1', templateId: 'barbershop:F' }));
  expect(mockCache['agent-1'].submission_design).toEqual({ submissionId: 'draft-1', templateId: 'barbershop:F', savedAt: expect.any(Number) });
  expect(mockRouter.push).not.toHaveBeenCalled(); expectNoSubmit();
  fireEvent.press(screen.getByRole('button', { name: 'Use design' }));
  expect(mockChoose).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(); await flush(); });
  expect(mockRouter.push).toHaveBeenCalledTimes(1);
  expect(mockRouter.push).toHaveBeenCalledWith('/(app)/submit/review');
  expect(mockRouter.back).not.toHaveBeenCalled(); expectNoSubmit();
});

it.each(['draft-1', 'offline_pending'])('stores only draft-scoped design metadata offline for %s', async (submissionId) => {
  mockOffline = true;
  mockCache['agent-1'] = { current_submission_id: submissionId,
    submission_snapshot: { submissionId, creatorId: 'agent-1', businessType: 'Barber/Salon' },
    ...(submissionId === 'offline_pending' ? { submission_pending_sync: { creatorId: 'agent-1', formData: { businessType: 'Barber/Salon' } } } : {}),
  };
  const before = mockClone(mockCache['agent-1']);
  const screen = await gallery(); selectForge(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Use design' }));
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/(app)/submit/review'));
  expect(mockCache['agent-1']).toEqual({ ...before,
    submission_design: { submissionId, templateId: 'barbershop:F', savedAt: expect.any(Number) },
  });
  expect(mockChoose).not.toHaveBeenCalled(); expectNoSubmit();
});

it.each([
  ['florist:BR', 'Bloom', '/template-previews/br.html', 'Craft/Producer'],
  ['barbershop:BP', 'Glacier', '/template-previews/bp.html', 'Barber/Salon'],
])('restores the saved %s design outside the suggestions without silently replacing it', async (code, name, preview, businessType) => {
  mockSubmissions['draft-1'].businessType = businessType;
  mockSubmissions['draft-1'].templateId = code;
  const screen = await gallery();
  await waitFor(() => expect(mockGallery.selectedCode).toBe(code));
  expect(mockGallery.designs[0]).toMatchObject({ code, name, preview });
  expect(screen.getByText(`Selected: ${code}`)).toBeTruthy();
  expect(mockChoose).not.toHaveBeenCalled(); expect(mockWrite).not.toHaveBeenCalled(); expectNoSubmit();
});

it.each([
  ['foreign owner', { creatorId: 'another-agent' }],
  ['sent capture', { status: 'submitted' }],
  ['owner app', { contentSource: 'owner_app' }],
  ['owner intake', { contentSource: 'owner_intake' }],
])('refuses the %s draft instead of offering a design save', async (_label, override) => {
  Object.assign(mockSubmissions['draft-1'], override);
  const screen = render(<SubmitDesignScreen />);
  await waitFor(() => expect(screen.getByText('Open your capture first')).toBeTruthy());
  expect(screen.queryByTestId('design-gallery')).toBeNull();
  expect(mockChoose).not.toHaveBeenCalled(); expect(mockWrite).not.toHaveBeenCalled(); expectNoSubmit();
});

it('keeps the local choice after a failed save and retries back to the existing Review', async () => {
  mockParams = { returnTo: 'review' };
  mockChoose.mockRejectedValueOnce(new Error('Design could not sync')).mockResolvedValueOnce({ ok: true });
  const screen = await gallery(); selectForge(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Use design' }));
  await waitFor(() => expect(screen.getByText('Design could not sync')).toBeTruthy());
  expect(mockGallery.selectedCode).toBe('barbershop:F');
  expect(mockCache['agent-1'].submission_design.templateId).toBe('barbershop:F');
  expect(mockRouter.back).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Use design' }));
  await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(1));
  expect(mockChoose).toHaveBeenCalledTimes(2); expect(mockRouter.push).not.toHaveBeenCalled(); expectNoSubmit();
});

it('reports a device-storage failure without claiming that the choice was saved', async () => {
  mockWrite.mockRejectedValueOnce(new Error('Device storage is full'));
  const screen = await gallery(); selectForge(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Use design' }));
  await waitFor(() => expect(screen.getByText('Device storage is full')).toBeTruthy());
  expect(mockCache['agent-1'].submission_design).toBeUndefined();
  expect(mockChoose).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled(); expectNoSubmit();
});

it('does not navigate or copy a pending save into the next signed-in account', async () => {
  let resolve!: () => void;
  mockChoose.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
  const screen = await gallery(); selectForge(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Use design' }));
  await waitFor(() => expect(mockChoose).toHaveBeenCalledTimes(1));
  mockActor = 'agent-2'; screen.rerender(<SubmitDesignScreen />);
  await waitFor(() => expect(mockGallery.selectedCode).toBe('generic:B'));
  await act(async () => { resolve(); await flush(); });
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.back).not.toHaveBeenCalled();
  expect(mockCache['agent-1'].submission_design.templateId).toBe('barbershop:F');
  expect(mockCache['agent-2'].submission_design).toBeUndefined(); expectNoSubmit();
});

it('does not finish an older draft save after the current capture changes', async () => {
  let resolve!: () => void;
  mockChoose.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
  const screen = await gallery(); selectForge(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Use design' }));
  await waitFor(() => expect(mockChoose).toHaveBeenCalledTimes(1));
  mockCache['agent-1'].current_submission_id = 'draft-new'; mockRevision++;
  mockSubmissions['draft-new'] = { ...mockSubmissions['draft-1'], _id: 'draft-new', businessType: 'Law Office', templateId: 'generic:B' };
  screen.rerender(<SubmitDesignScreen />);
  await waitFor(() => expect(mockGallery.selectedCode).toBe('generic:B'));
  await act(async () => { resolve(); await flush(); });
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.back).not.toHaveBeenCalled();
  expect(mockCache['agent-1'].current_submission_id).toBe('draft-new');
  expect(mockCache['agent-1'].submission_design.submissionId).toBe('draft-1');
  expect(mockChoose).toHaveBeenCalledTimes(1); expectNoSubmit();
});

it('rechecks the stored draft pointer after saving even before cache revisions rerender the route', async () => {
  let resolve!: () => void;
  mockChoose.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
  const screen = await gallery(); selectForge(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Use design' }));
  await waitFor(() => expect(mockChoose).toHaveBeenCalledTimes(1));
  mockCache['agent-1'].current_submission_id = 'draft-new';
  await act(async () => { resolve(); await flush(); });
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.back).not.toHaveBeenCalled();
  expect(mockCache['agent-1'].current_submission_id).toBe('draft-new');
  expect(mockCache['agent-1'].submission_design).toMatchObject({ submissionId: 'draft-1', templateId: 'barbershop:F' });
  expect(mockWrite).toHaveBeenCalledTimes(1); expectNoSubmit();
});

it('does not navigate from a pending save after the design route loses focus', async () => {
  let resolve!: () => void;
  mockChoose.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
  const screen = await gallery(); selectForge(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Use design' }));
  await waitFor(() => expect(mockChoose).toHaveBeenCalledTimes(1));
  mockFocused = false; screen.rerender(<SubmitDesignScreen />);
  await waitFor(() => expect(screen.queryByTestId('design-gallery')).toBeNull());
  await act(async () => { resolve(); await flush(); });
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.back).not.toHaveBeenCalled();
  expect(mockCache['agent-1'].submission_design).toMatchObject({ submissionId: 'draft-1', templateId: 'barbershop:F' });
  expect(mockCache['agent-1'].current_submission_id).toBe('draft-1'); expectNoSubmit();
});
