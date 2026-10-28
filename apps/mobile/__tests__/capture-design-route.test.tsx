import React from 'react';
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
      require('react').createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: 'Select Glacier',
        disabled: props.busy || props.disabled, onPress: () => props.onSelect('barbershop:BP') }, require('react').createElement(Text, null, 'Select Glacier')),
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
function selectGlacier(screen: ReturnType<typeof render>) {
  fireEvent.press(screen.getByRole('button', { name: 'Select Glacier' }));
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
    'draft-2': { _id: 'draft-2', creatorId: 'agent-2', status: 'draft', businessType: 'Restaurant', templateId: 'generic:B' },
  };
  mockChoose.mockReset().mockResolvedValue({ ok: true }); mockSubmit.mockReset();
  mockRead.mockReset().mockImplementation(async (actor: string, key: string) => mockClone(mockCache[actor]?.[key]));
  mockWrite.mockReset().mockImplementation(async (actor: string, key: string, value: unknown) => { mockCache[actor][key] = mockClone(value); });
});

it('saves the own-draft design before opening Review and never submits from the picker', async () => {
  let resolve!: () => void;
  mockChoose.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
  const screen = await gallery(); selectGlacier(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Use design' }));
  await waitFor(() => expect(mockChoose).toHaveBeenCalledWith({ id: 'draft-1', templateId: 'barbershop:BP' }));
  expect(mockCache['agent-1'].submission_design).toEqual({ submissionId: 'draft-1', templateId: 'barbershop:BP', savedAt: expect.any(Number) });
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
  const screen = await gallery(); selectGlacier(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Use design' }));
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/(app)/submit/review'));
  expect(mockCache['agent-1']).toEqual({ ...before,
    submission_design: { submissionId, templateId: 'barbershop:BP', savedAt: expect.any(Number) },
  });
  expect(mockChoose).not.toHaveBeenCalled(); expectNoSubmit();
});

it('restores a canonical server choice outside the suggested designs without silently replacing it', async () => {
  mockSubmissions['draft-1'].templateId = 'florist:BR';
  const screen = await gallery();
  await waitFor(() => expect(mockGallery.selectedCode).toBe('florist:BR'));
  expect(mockGallery.designs[0]).toMatchObject({ code: 'florist:BR', name: 'Bloom', preview: '/template-previews/br.html' });
  expect(screen.getByText('Selected: florist:BR')).toBeTruthy();
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
  const screen = await gallery(); selectGlacier(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Use design' }));
  await waitFor(() => expect(screen.getByText('Design could not sync')).toBeTruthy());
  expect(mockGallery.selectedCode).toBe('barbershop:BP');
  expect(mockCache['agent-1'].submission_design.templateId).toBe('barbershop:BP');
  expect(mockRouter.back).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Use design' }));
  await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(1));
  expect(mockChoose).toHaveBeenCalledTimes(2); expect(mockRouter.push).not.toHaveBeenCalled(); expectNoSubmit();
});

it('reports a device-storage failure without claiming that the choice was saved', async () => {
  mockWrite.mockRejectedValueOnce(new Error('Device storage is full'));
  const screen = await gallery(); selectGlacier(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Use design' }));
  await waitFor(() => expect(screen.getByText('Device storage is full')).toBeTruthy());
  expect(mockCache['agent-1'].submission_design).toBeUndefined();
  expect(mockChoose).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled(); expectNoSubmit();
});

it('does not navigate or copy a pending save into the next signed-in account', async () => {
  let resolve!: () => void;
  mockChoose.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
  const screen = await gallery(); selectGlacier(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Use design' }));
  await waitFor(() => expect(mockChoose).toHaveBeenCalledTimes(1));
  mockActor = 'agent-2'; screen.rerender(<SubmitDesignScreen />);
  await waitFor(() => expect(mockGallery.selectedCode).toBe('generic:B'));
  await act(async () => { resolve(); await flush(); });
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.back).not.toHaveBeenCalled();
  expect(mockCache['agent-1'].submission_design.templateId).toBe('barbershop:BP');
  expect(mockCache['agent-2'].submission_design).toBeUndefined(); expectNoSubmit();
});

it('does not finish an older draft save after the current capture changes', async () => {
  let resolve!: () => void;
  mockChoose.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
  const screen = await gallery(); selectGlacier(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Use design' }));
  await waitFor(() => expect(mockChoose).toHaveBeenCalledTimes(1));
  mockCache['agent-1'].current_submission_id = 'draft-new'; mockRevision++;
  mockSubmissions['draft-new'] = { ...mockSubmissions['draft-1'], _id: 'draft-new', templateId: 'generic:B' };
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
  const screen = await gallery(); selectGlacier(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Use design' }));
  await waitFor(() => expect(mockChoose).toHaveBeenCalledTimes(1));
  mockCache['agent-1'].current_submission_id = 'draft-new';
  await act(async () => { resolve(); await flush(); });
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.back).not.toHaveBeenCalled();
  expect(mockCache['agent-1'].current_submission_id).toBe('draft-new');
  expect(mockCache['agent-1'].submission_design).toMatchObject({ submissionId: 'draft-1', templateId: 'barbershop:BP' });
  expect(mockWrite).toHaveBeenCalledTimes(1); expectNoSubmit();
});

it('does not navigate from a pending save after the design route loses focus', async () => {
  let resolve!: () => void;
  mockChoose.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
  const screen = await gallery(); selectGlacier(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Use design' }));
  await waitFor(() => expect(mockChoose).toHaveBeenCalledTimes(1));
  mockFocused = false; screen.rerender(<SubmitDesignScreen />);
  await waitFor(() => expect(screen.queryByTestId('design-gallery')).toBeNull());
  await act(async () => { resolve(); await flush(); });
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.back).not.toHaveBeenCalled();
  expect(mockCache['agent-1'].submission_design).toMatchObject({ submissionId: 'draft-1', templateId: 'barbershop:BP' });
  expect(mockCache['agent-1'].current_submission_id).toBe('draft-1'); expectNoSubmit();
});
