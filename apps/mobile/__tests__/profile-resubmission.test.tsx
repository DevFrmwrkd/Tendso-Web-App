import React from 'react';
import { Keyboard, ScrollView, TextInput, type KeyboardEvent, type KeyboardEventName } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import VerificationRejectedScreen from '../app/(app)/verification-rejected';
import EditProfileScreen from '../app/(app)/edit-profile';
import { Button } from '../components/v2';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockResubmit = jest.fn();
const mockRecertify = jest.fn();
const mockUpdate = jest.fn();
const mockClerkUpdate = jest.fn();
const mockUnexpectedMutation = jest.fn();
const mockRequestDelete = jest.fn();
let mockDeleteState: { busy: boolean; canDelete: boolean };
let mockParams: { review?: string; field?: string };
let mockCreator: Record<string, unknown>;

jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('../hooks/useDeleteAccount', () => ({
  useDeleteAccount: () => ({ ...mockDeleteState, requestDelete: mockRequestDelete }),
}));
jest.mock('@clerk/clerk-expo', () => ({
  useUser: () => ({ isLoaded: true, user: {
    id: 'agent-user', update: mockClerkUpdate, imageUrl: null,
    primaryEmailAddress: { emailAddress: 'pablo@example.com' },
  } }),
  useClerk: () => ({ signOut: jest.fn() }),
}));
jest.mock('@tendso/convex-client', () => ({ api: {
  creators: {
    getByClerkId: 'creators:getByClerkId', update: 'creators:update',
    resubmitProfileForReview: 'creators:resubmitProfileForReview',
    requestRecertification: 'creators:requestRecertification',
  },
  r2: { generateUploadUrl: 'r2:generateUploadUrl' },
} }));
jest.mock('convex/react', () => ({
  useQuery: () => mockCreator,
  useAction: () => jest.fn(),
  useMutation: (reference: string) => {
    if (reference === 'creators:resubmitProfileForReview') return mockResubmit;
    if (reference === 'creators:requestRecertification') return mockRecertify;
    if (reference === 'creators:update') return mockUpdate;
    return mockUnexpectedMutation;
  },
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-image-picker', () => ({ MediaTypeOptions: { Images: 'Images' } }));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  removeItem: jest.fn(async () => {}),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'MockSvg', Path: 'MockPath', Defs: 'MockDefs',
  LinearGradient: 'MockGradient', Rect: 'MockRect', Stop: 'MockStop',
}));

function rejectedCreator() {
  return {
    _id: 'agent-1', clerkId: 'agent-user', role: 'creator', status: 'active',
    firstName: 'Pablo', lastName: 'Santos', phone: '09171234567',
    email: 'pablo@example.com', quizPassedAt: 1234, rejectedAt: 5678,
    rejectionReason: 'Please use your full legal name.',
  };
}

function resubmit(screen: ReturnType<typeof render>) {
  fireEvent.press(screen.getByRole('button', { name: 'Resubmit for review' }));
}

function watchKeyboard() {
  const subscriptions: { event: KeyboardEventName; listener: (event: KeyboardEvent) => void; remove: jest.Mock; active: boolean }[] = [];
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
  jest.spyOn(Keyboard, 'addListener').mockImplementation((event, listener) => {
    const subscription = { event, listener, active: true, remove: jest.fn() };
    subscription.remove.mockImplementation(() => { subscription.active = false; });
    subscriptions.push(subscription);
    return subscription as ReturnType<typeof Keyboard.addListener>;
  });
  const event: KeyboardEvent = { duration: 250, easing: 'keyboard', endCoordinates: { screenX: 0, screenY: 544, width: 390, height: 300 } };
  return (name: KeyboardEventName) => act(() => {
    subscriptions.filter((subscription) => subscription.active && subscription.event === name).forEach((subscription) => subscription.listener(event));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { review: '1' };
  mockDeleteState = { busy: false, canDelete: true };
  mockCreator = rejectedCreator();
  mockResubmit.mockReset().mockResolvedValue(undefined);
  mockRecertify.mockReset().mockResolvedValue(undefined);
  mockUpdate.mockReset().mockResolvedValue(undefined);
  mockClerkUpdate.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('opens profile corrections from rejection without resetting the passed quiz', () => {
  const screen = render(<VerificationRejectedScreen />);
  expect(screen.getByText("Passed. You don't need to take it again.")).toBeTruthy();
  expect(screen.queryByText('Take it again. It is free.')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Edit profile' }));
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/(app)/edit-profile', params: { review: '1' } });
  expect(mockUnexpectedMutation).not.toHaveBeenCalled();
  expect(mockRecertify).not.toHaveBeenCalled();
  expect(mockResubmit).not.toHaveBeenCalled();
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('uses an explicit certification path only for a legacy rejected account without a quiz pass', async () => {
  mockCreator = { ...mockCreator, quizPassedAt: undefined };
  const screen = render(<VerificationRejectedScreen />);
  expect(screen.getByText('Complete certification before submitting for review.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Edit profile' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Finish certification' }));
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/training'));
  expect(mockRecertify).toHaveBeenCalledWith({ id: 'agent-1' });
  expect(mockResubmit).not.toHaveBeenCalled();
});

it('lets a legacy rejected agent correct their name without entering the passed-quiz review editor', () => {
  mockCreator = { ...mockCreator, quizPassedAt: undefined };
  const screen = render(<VerificationRejectedScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Edit full name' }));
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/(app)/edit-profile', params: { field: 'name' } });
  expect(mockRecertify).not.toHaveBeenCalled();
  expect(mockResubmit).not.toHaveBeenCalled();
});

it.each([
  ['Edit full name', 'name'],
  ['Edit mobile', 'phone'],
])('opens the %s correction without resetting the passed quiz', (label, field) => {
  const screen = render(<VerificationRejectedScreen />);
  fireEvent.press(screen.getByRole('button', { name: label }));
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: '/(app)/edit-profile', params: { review: '1', field },
  });
  expect(mockRecertify).not.toHaveBeenCalled();
  expect(mockResubmit).not.toHaveBeenCalled();
});

it('guards a direct review-editor link when the rejected account has no passed quiz', () => {
  mockCreator = { ...mockCreator, quizPassedAt: undefined };
  const screen = render(<EditProfileScreen />);
  expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/verification-rejected');
  expect(screen.queryByText('Correct your details below. Your quiz pass stays saved.')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Resubmit for review' })).toBeNull();
  expect(mockResubmit).not.toHaveBeenCalled();
  expect(mockRecertify).not.toHaveBeenCalled();
});

it('reacts to a resubmitted profile by returning to review with the original quiz pass', () => {
  const screen = render(<VerificationRejectedScreen />);
  mockCreator = { ...mockCreator, rejectedAt: undefined, rejectionReason: undefined };
  screen.rerender(<VerificationRejectedScreen />);
  expect(mockRouter.replace).toHaveBeenLastCalledWith('/(app)/pending-review');
  expect(mockUnexpectedMutation).not.toHaveBeenCalled();
});

it('prefills the rejected details and preserves corrections across live profile updates', () => {
  const screen = render(<EditProfileScreen />);
  expect(screen.getByText('Please use your full legal name.')).toBeTruthy();
  expect(screen.getByLabelText('First name').props.value).toBe('Pablo');
  fireEvent.changeText(screen.getByLabelText('First name'), 'Pablo Miguel');
  mockCreator = { ...mockCreator, lastActiveAt: Date.now() };
  screen.rerender(<EditProfileScreen />);
  expect(screen.getByLabelText('First name').props.value).toBe('Pablo Miguel');
});

it.each([
  ['name', 'First name', 'Phone number'],
  ['phone', 'Phone number', 'First name'],
])('focuses the requested %s field and reveals it again after the keyboard reduces the viewport', (field, selectedLabel, otherLabel) => {
  jest.useFakeTimers();
  mockParams = { review: '1', field };
  const emitKeyboard = watchKeyboard();
  const screen = render(<EditProfileScreen />);
  // Keep the real Field and ScreenShell, replacing only their native methods.
  const input = (label: string) => screen.UNSAFE_getAllByType(TextInput).find((node) => node.props.accessibilityLabel === label)!.instance;
  const selected = input(selectedLabel);
  const other = input(otherLabel);
  selected.focus = jest.fn();
  other.focus = jest.fn();
  const scroll = screen.UNSAFE_getByType(ScrollView).instance;
  scroll.scrollTo = jest.fn();
  expect(selected.focus).not.toHaveBeenCalled();

  fireEvent(screen.getByLabelText(selectedLabel), 'layout', { nativeEvent: { layout: { x: 0, y: 540, width: 342, height: 72 } } });
  act(() => jest.advanceTimersByTime(20));
  expect(selected.focus).toHaveBeenCalledTimes(1);
  expect(other.focus).not.toHaveBeenCalled();
  expect(scroll.scrollTo).toHaveBeenCalledTimes(1);
  const firstReveal = scroll.scrollTo.mock.calls[0][0];
  expect(firstReveal).toEqual({ y: expect.any(Number), animated: false });
  expect(firstReveal.y).toBeGreaterThanOrEqual(0);
  expect(firstReveal.y).toBeLessThan(540);

  emitKeyboard('keyboardDidShow');
  act(() => jest.advanceTimersByTime(20));
  expect(scroll.scrollTo).toHaveBeenCalledTimes(2);
  expect(scroll.scrollTo).toHaveBeenLastCalledWith(firstReveal);

  // Later keyboard events and live data updates must not steal focus or scroll.
  emitKeyboard('keyboardDidShow');
  mockCreator = { ...mockCreator, lastActiveAt: 9999 };
  screen.rerender(<EditProfileScreen />);
  act(() => jest.advanceTimersByTime(20));
  expect(selected.focus).toHaveBeenCalledTimes(1);
  expect(scroll.scrollTo).toHaveBeenCalledTimes(2);
});

it('atomically resubmits corrected details and returns to review even if Clerk name sync fails', async () => {
  mockClerkUpdate.mockRejectedValueOnce(new Error('Clerk temporarily unavailable'));
  const screen = render(<EditProfileScreen />);
  fireEvent.changeText(screen.getByLabelText('First name'), '  Pablo Miguel  ');
  fireEvent.changeText(screen.getByLabelText('Last name'), '  Santos  ');
  resubmit(screen);
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/pending-review'));
  expect(mockResubmit).toHaveBeenCalledWith({
    id: 'agent-1', firstName: 'Pablo Miguel', lastName: 'Santos', phone: '09171234567',
  });
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockUnexpectedMutation).not.toHaveBeenCalled();
});

it.each([
  ['First name', '   ', 'First name is required.'],
  ['Phone number', '0917', 'Please enter a valid PH mobile number, or leave it blank.'],
])('keeps an invalid %s in the editor without resubmitting', (label, value, message) => {
  const screen = render(<EditProfileScreen />);
  fireEvent.changeText(screen.getByLabelText(label), value);
  resubmit(screen);
  expect(screen.getByText(message)).toBeTruthy();
  expect(mockResubmit).not.toHaveBeenCalled();
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('allows a name-only correction without requiring an optional phone number', async () => {
  mockCreator = { ...mockCreator, phone: undefined };
  const screen = render(<EditProfileScreen />);
  fireEvent.changeText(screen.getByLabelText('First name'), 'Pablo Miguel');
  resubmit(screen);
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/pending-review'));
  expect(mockResubmit).toHaveBeenCalledWith({
    id: 'agent-1', firstName: 'Pablo Miguel', lastName: 'Santos', phone: '',
  });
});

it('keeps the corrected draft after a server failure and lets the agent retry', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockResubmit.mockRejectedValueOnce(new Error('Connection lost. Try again.'));
  const screen = render(<EditProfileScreen />);
  fireEvent.changeText(screen.getByLabelText('First name'), 'Pablo Miguel');
  resubmit(screen);
  expect(await screen.findByText('Connection lost. Try again.')).toBeTruthy();
  expect(screen.getByLabelText('First name').props.value).toBe('Pablo Miguel');
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(mockClerkUpdate).not.toHaveBeenCalled();
  resubmit(screen);
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/pending-review'));
  expect(mockResubmit).toHaveBeenCalledTimes(2);
});

it('deduplicates rapid resubmit presses until the server finishes', async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  mockResubmit.mockReturnValueOnce(pending);
  const screen = render(<EditProfileScreen />);
  const button = screen.UNSAFE_getAllByType(Button).find((node) => node.props.title === 'Resubmit for review')!;
  // Both taps can reach the handler before React renders the disabled button.
  act(() => { button.props.onPress(); button.props.onPress(); });
  expect(mockResubmit).toHaveBeenCalledTimes(1);
  expect(mockRouter.replace).not.toHaveBeenCalled();
  await act(async () => { finish(); await pending; });
  expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/pending-review');
});

it('keeps account deletion separate from correcting and resubmitting a rejected profile', () => {
  const screen = render(<EditProfileScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Delete my account' }));
  expect(mockRequestDelete).toHaveBeenCalledTimes(1);
  expect(mockResubmit).not.toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockRecertify).not.toHaveBeenCalled();
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it.each([
  { busy: true, canDelete: true },
  { busy: false, canDelete: false },
])('blocks account deletion when the hook reports %j', (state) => {
  mockDeleteState = state;
  const screen = render(<EditProfileScreen />);
  const button = screen.getByRole('button', { name: 'Delete my account' });
  expect(button.props.accessibilityState.disabled).toBe(true);
  fireEvent.press(button);
  expect(mockRequestDelete).not.toHaveBeenCalled();
});

it('blocks profile resubmission while account deletion is in progress', () => {
  mockDeleteState = { busy: true, canDelete: true };
  const screen = render(<EditProfileScreen />);
  const button = screen.getByRole('button', { name: 'Resubmit for review' });
  expect(button.props.accessibilityState.disabled).toBe(true);
  fireEvent.press(button);
  expect(mockResubmit).not.toHaveBeenCalled();
});

it('blocks account deletion while the corrected profile is being resubmitted', async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  mockResubmit.mockReturnValueOnce(pending);
  const screen = render(<EditProfileScreen />);
  resubmit(screen);
  expect(mockResubmit).toHaveBeenCalledTimes(1);
  const deleteButton = screen.getByRole('button', { name: 'Delete my account' });
  expect(deleteButton.props.accessibilityState.disabled).toBe(true);
  fireEvent.press(deleteButton);
  expect(mockRequestDelete).not.toHaveBeenCalled();
  await act(async () => { finish(); await pending; });
  expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/pending-review');
});

it('blocks a same-batch deletion callback before the save-disabled state has rendered', async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  mockResubmit.mockReturnValueOnce(pending);
  const screen = render(<EditProfileScreen />);
  const buttons = screen.UNSAFE_getAllByType(Button);
  const save = buttons.find((node) => node.props.title === 'Resubmit for review')!;
  const remove = buttons.find((node) => node.props.title === 'Delete my account')!;
  act(() => { save.props.onPress(); remove.props.onPress(); });
  expect(mockResubmit).toHaveBeenCalledTimes(1);
  expect(mockRequestDelete).not.toHaveBeenCalled();
  await act(async () => { finish(); await pending; });
  expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/pending-review');
});

it('leaves the correction editor if an admin approves the account while it is open', () => {
  const screen = render(<EditProfileScreen />);
  mockCreator = { ...mockCreator, certifiedAt: 9999 };
  screen.rerender(<EditProfileScreen />);
  expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/(tabs)/');
  expect(mockResubmit).not.toHaveBeenCalled();
});

it('keeps ordinary profile saves on the existing update and back-navigation flow', async () => {
  jest.useFakeTimers();
  mockParams = {};
  mockCreator = { ...mockCreator, rejectedAt: undefined, certifiedAt: 9999 };
  const screen = render(<EditProfileScreen />);
  fireEvent.changeText(screen.getByLabelText('First name'), 'Pablo Miguel');
  fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
  await act(async () => { await Promise.resolve(); });
  expect(mockUpdate).toHaveBeenCalledWith({
    id: 'agent-1', firstName: 'Pablo Miguel', lastName: 'Santos', phone: '09171234567',
  });
  expect(screen.getByText('Profile updated')).toBeTruthy();
  expect(mockResubmit).not.toHaveBeenCalled();
  expect(mockRouter.replace).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(1200));
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});
