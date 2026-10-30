import React from 'react';
import { Alert, TextInput } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import EditProfileScreen from '../app/(app)/edit-profile';
import { Button } from '../components/v2';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockUpdate = jest.fn();
const mockResubmit = jest.fn();
const mockClerkUpdate = jest.fn();
const mockOtherClerkUpdate = jest.fn();
const mockRequestDelete = jest.fn();
const mockPermission = jest.fn();
const mockPicker = jest.fn();
const mockManipulate = jest.fn();
const mockCrop = jest.fn();
const mockResize = jest.fn();
const mockRenderImage = jest.fn();
const mockEncode = jest.fn();
const mockUploadTarget = jest.fn();
const mockFetch = jest.fn();
let mockUser: any;
let mockAccounts: Record<string, any>;
let mockParams: { review?: string; field?: string };
let mockDeleteState: { busy: boolean; canDelete: boolean };

jest.mock('@clerk/clerk-expo', () => ({ useUser: () => ({ user: mockUser, isLoaded: true }) }));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('../hooks/useDeleteAccount', () => ({ useDeleteAccount: () => ({
  ...mockDeleteState, requestDelete: mockRequestDelete,
}) }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }));
jest.mock('@tendso/convex-client', () => ({ api: {
  creators: { getByClerkId: 'account', update: 'update', resubmitProfileForReview: 'resubmit' },
  r2: { generateUploadUrl: 'upload-target' },
} }));
jest.mock('convex/react', () => ({
  useQuery: (_reference: string, args: any) => args === 'skip' ? undefined : mockAccounts[args.clerkId],
  useMutation: (reference: string) => reference === 'resubmit' ? mockResubmit : mockUpdate,
  useAction: () => mockUploadTarget,
}));
jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) => mockPermission(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockPicker(...args),
}));
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: (...args: unknown[]) => mockManipulate(...args) },
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'MockSvg', Path: 'MockPath', Defs: 'MockDefs',
  LinearGradient: 'MockGradient', Rect: 'MockRect', Stop: 'MockStop',
}));

const originalFetch = global.fetch;
const mockJpegBlob = { type: 'image/jpeg', content: 'normalized-avatar' };
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
function switchAccount() {
  mockUser = { id: 'clerk-second', update: mockOtherClerkUpdate, imageUrl: 'https://avatars.example.com/clerk-second.jpg',
    primaryEmailAddress: { emailAddress: 'second@example.com' } };
}
async function pickPhoto(view: ReturnType<typeof render>) {
  await act(async () => { fireEvent.press(view.getByRole('button', { name: 'Change profile photo' })); await flush(); });
}
async function save(view: ReturnType<typeof render>) {
  await act(async () => { fireEvent.press(view.getByRole('button', { name: 'Save changes' })); await flush(); });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockDeleteState = { busy: false, canDelete: true };
  mockUser = { id: 'clerk-mika', update: mockClerkUpdate, imageUrl: 'https://avatars.example.com/clerk-mika.jpg',
    primaryEmailAddress: { emailAddress: 'clerk-mika@example.com' } };
  mockAccounts = {
    'clerk-mika': { _id: 'agent-mika', clerkId: 'clerk-mika', role: 'creator', firstName: 'Mika', lastName: 'Santos',
      email: 'mika@example.com', phone: '09171234567', profileImage: 'https://avatars.example.com/mika.jpg', certifiedAt: 1234 },
    'clerk-second': { _id: 'agent-second', clerkId: 'clerk-second', role: 'creator', firstName: 'Second', lastName: 'Agent',
      email: 'second@example.com', phone: '' },
  };
  mockUpdate.mockReset().mockResolvedValue(undefined);
  mockResubmit.mockReset().mockResolvedValue(undefined);
  mockClerkUpdate.mockReset().mockResolvedValue(undefined);
  mockOtherClerkUpdate.mockReset().mockResolvedValue(undefined);
  mockPermission.mockReset().mockResolvedValue({ status: 'granted' });
  mockPicker.mockReset().mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///picked.heic', width: 1000, height: 600 }] });
  mockManipulate.mockReset().mockReturnValue({ crop: mockCrop });
  mockCrop.mockReset().mockReturnValue({ resize: mockResize });
  mockResize.mockReset().mockReturnValue({ renderAsync: mockRenderImage });
  mockRenderImage.mockReset().mockResolvedValue({ saveAsync: mockEncode });
  mockEncode.mockReset().mockResolvedValue({ uri: 'file:///normalized-avatar.jpg' });
  mockUploadTarget.mockReset().mockResolvedValue({
    uploadUrl: 'https://uploads.example.com/avatar', publicUrl: 'https://avatars.example.com/updated-mika.jpg',
  });
  mockFetch.mockReset().mockImplementation(async (_url: string, options?: { method?: string }) => options?.method === 'PUT'
    ? { ok: true } : { blob: async () => mockJpegBlob });
  global.fetch = mockFetch as unknown as typeof fetch;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it.each(['creator', 'affiliate'])('shows the normal edit design with real profile fields and locked email for %s accounts', (role) => {
  mockAccounts['clerk-mika'].role = role;
  const view = render(<EditProfileScreen />);
  expect(view.getByRole('header', { name: 'Edit profile' })).toBeTruthy();
  expect(view.getByRole('image', { name: "Mika Santos's photo" })).toHaveStyle({ width: 96, height: 96 });
  expect(view.getByRole('button', { name: 'Change profile photo' })).toBeTruthy();
  expect(view.getByText('Tap the photo to change it')).toBeTruthy();
  expect(view.getByLabelText('First name').props.value).toBe('Mika');
  expect(view.getByLabelText('Last name').props.value).toBe('Santos');
  expect(view.getByLabelText('Phone number').props.value).toBe('09171234567');
  expect(view.getByLabelText("Email: mika@example.com. Can't change.")).toBeTruthy();
  expect(view.UNSAFE_getAllByType(TextInput).some(input => input.props.value === 'mika@example.com')).toBe(false);
  expect(view.getByRole('button', { name: 'Save changes' })).toBeTruthy();
  expect(view.getByRole('button', { name: 'Delete my account' })).toBeTruthy();
  expect(view.queryByText('Your quiz pass stays saved.')).toBeNull();
});

it('requires a first name while keeping the last name and normal mobile field optional', async () => {
  jest.useFakeTimers();
  const view = render(<EditProfileScreen />);
  fireEvent.changeText(view.getByLabelText('First name'), '   ');
  await save(view);
  expect(view.getByText('First name is required.')).toBeTruthy();
  expect(mockUpdate).not.toHaveBeenCalled();
  fireEvent.changeText(view.getByLabelText('First name'), '  Mika Marie  ');
  fireEvent.changeText(view.getByLabelText('Last name'), '  ');
  fireEvent.changeText(view.getByLabelText('Phone number'), '');
  await save(view);
  expect(mockUpdate).toHaveBeenCalledWith({ id: 'agent-mika', firstName: 'Mika Marie', lastName: '', phone: '' });
  expect(mockResubmit).not.toHaveBeenCalled();
});

it('keeps a successful normal save successful when best-effort Clerk name sync fails', async () => {
  jest.useFakeTimers();
  mockAccounts['clerk-mika'].role = 'affiliate';
  mockClerkUpdate.mockRejectedValueOnce(new Error('Clerk temporarily unavailable'));
  const view = render(<EditProfileScreen />);
  fireEvent.changeText(view.getByLabelText('First name'), 'Mika Marie');
  await save(view);
  expect(mockUpdate).toHaveBeenCalledWith({ id: 'agent-mika', firstName: 'Mika Marie', lastName: 'Santos', phone: '09171234567' });
  expect(mockClerkUpdate).toHaveBeenCalledWith({ firstName: 'Mika Marie', lastName: 'Santos' });
  expect(view.getByText('Profile updated')).toBeTruthy();
  expect(mockRouter.replace).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(1200));
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});

it('preserves the centered JPEG avatar normalization and canonical R2 profile upload flow', async () => {
  jest.useFakeTimers();
  const view = render(<EditProfileScreen />);
  await pickPhoto(view);
  expect(mockPicker).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: true, aspect: [1, 1] }));
  expect(mockManipulate).toHaveBeenCalledWith('file:///picked.heic');
  expect(mockCrop).toHaveBeenCalledWith({ originX: 200, originY: 0, width: 600, height: 600 });
  expect(mockResize).toHaveBeenCalledWith({ width: 512, height: 512 });
  expect(mockEncode).toHaveBeenCalledWith({ compress: 0.85, format: 'jpeg' });
  await save(view);
  expect(mockUploadTarget).toHaveBeenCalledWith({ folder: 'profile', filename: 'avatar-agent-mika.jpg', contentType: 'image/jpeg' });
  expect(mockFetch).toHaveBeenCalledWith('file:///normalized-avatar.jpg');
  expect(mockFetch).toHaveBeenCalledWith('https://uploads.example.com/avatar', {
    method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: mockJpegBlob,
  });
  expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 'agent-mika', profileImage: 'https://avatars.example.com/updated-mika.jpg' }));
});

it('keeps the saved avatar when photo permission is denied or the picker is cancelled', async () => {
  mockPermission.mockResolvedValueOnce({ status: 'denied' });
  const view = render(<EditProfileScreen />);
  await pickPhoto(view);
  expect(Alert.alert).toHaveBeenCalledWith('Permission Required', expect.any(String));
  expect(mockPicker).not.toHaveBeenCalled();
  mockPicker.mockResolvedValueOnce({ canceled: true, assets: [] });
  await pickPhoto(view);
  expect(mockManipulate).not.toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled();
});

it.each(['permission', 'picker', 'normalization'])('drops a delayed photo %s result after the editor account changes', async (stage) => {
  let finish!: (result: any) => void;
  const pending = new Promise(resolve => { finish = resolve; });
  if (stage === 'permission') mockPermission.mockReturnValueOnce(pending);
  if (stage === 'picker') mockPicker.mockReturnValueOnce(pending);
  if (stage === 'normalization') mockEncode.mockReturnValueOnce(pending);
  const view = render(<EditProfileScreen />);
  await pickPhoto(view);
  switchAccount();
  view.rerender(<EditProfileScreen />);
  await act(async () => {
    finish(stage === 'permission' ? { status: 'granted' } : stage === 'picker'
      ? { canceled: false, assets: [{ uri: 'file:///old-account.heic', width: 600, height: 600 }] }
      : { uri: 'file:///old-account-normalized.jpg' });
    await flush();
  });
  expect(view.getByLabelText('First name').props.value).toBe('Second');
  if (stage === 'permission') expect(mockPicker).not.toHaveBeenCalled();
  if (stage === 'picker') expect(mockManipulate).not.toHaveBeenCalled();
  expect(mockUploadTarget).not.toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
});

it.each(['suspended', 'deleted', 'unavailable'])('stops a pending picker when the live account becomes %s without changing Clerk subjects', async (status) => {
  const activeAccount = { ...mockAccounts['clerk-mika'] };
  let grantPermission!: (result: { status: string }) => void;
  mockPermission.mockReturnValueOnce(new Promise(resolve => { grantPermission = resolve; }));
  const view = render(<EditProfileScreen />);
  await pickPhoto(view);
  if (status === 'unavailable') mockAccounts['clerk-mika'] = undefined;
  else mockAccounts['clerk-mika'].status = status;
  view.rerender(<EditProfileScreen />);
  await act(async () => { grantPermission({ status: 'granted' }); await flush(); });
  expect(mockPicker).not.toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockRequestDelete).not.toHaveBeenCalled();
  // A temporary unavailable/revoked record must not leave this same actor's
  // editor busy forever after eligibility is restored.
  mockAccounts['clerk-mika'] = activeAccount;
  view.rerender(<EditProfileScreen />);
  expect(view.getByRole('button', { name: 'Change profile photo' })).toBeEnabled();
  expect(view.getByRole('button', { name: 'Save changes' })).toBeEnabled();
});

it('blocks rapid duplicate photo pickers, saves and deletion before the picking-disabled state renders', async () => {
  let grantPermission!: (result: { status: string }) => void;
  mockPermission.mockReturnValueOnce(new Promise(resolve => { grantPermission = resolve; }));
  mockPicker.mockResolvedValueOnce({ canceled: true, assets: [] });
  const view = render(<EditProfileScreen />);
  let photoNode = view.getByRole('button', { name: 'Change profile photo' });
  // NativeWind wraps Pressable, while its native View omits onPress. Find the
  // nearest wrapping handler so both callbacks run before the disabled render.
  while (typeof photoNode.props.onPress !== 'function') {
    if (!photoNode.parent) throw new Error('Profile photo press handler is unavailable');
    photoNode = photoNode.parent;
  }
  const pick = photoNode.props.onPress;
  const buttons = view.UNSAFE_getAllByType(Button);
  const saveButton = buttons.find(button => button.props.title === 'Save changes')!;
  const deleteButton = buttons.find(button => button.props.title === 'Delete my account')!;
  act(() => { pick(); pick(); saveButton.props.onPress(); deleteButton.props.onPress(); });
  expect(mockPermission).toHaveBeenCalledTimes(1);
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockRequestDelete).not.toHaveBeenCalled();
  expect(view.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  expect(view.getByRole('button', { name: 'Delete my account' })).toBeDisabled();
  await act(async () => { grantPermission({ status: 'granted' }); await flush(); });
  expect(view.getByRole('button', { name: 'Save changes' })).toBeEnabled();
});

it('stops after a delayed upload target if the signed-in editor changes before local photo upload', async () => {
  let finishTarget!: (value: any) => void;
  mockUploadTarget.mockReturnValueOnce(new Promise(resolve => { finishTarget = resolve; }));
  const view = render(<EditProfileScreen />);
  await pickPhoto(view);
  await save(view);
  expect(mockUploadTarget).toHaveBeenCalledTimes(1);
  switchAccount();
  view.rerender(<EditProfileScreen />);
  await act(async () => {
    finishTarget({ uploadUrl: 'https://uploads.example.com/old', publicUrl: 'https://avatars.example.com/old.jpg' });
    await flush();
  });
  expect(mockFetch).not.toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockOtherClerkUpdate).not.toHaveBeenCalled();
});

it('does not sync Clerk or navigate the new account after an old account’s save finishes', async () => {
  jest.useFakeTimers();
  let finishSave!: () => void;
  mockUpdate.mockReturnValueOnce(new Promise<void>(resolve => { finishSave = resolve; }));
  const view = render(<EditProfileScreen />);
  await save(view);
  switchAccount();
  view.rerender(<EditProfileScreen />);
  await act(async () => { finishSave(); await flush(); jest.advanceTimersByTime(1200); });
  expect(view.getByLabelText('First name').props.value).toBe('Second');
  expect(mockClerkUpdate).not.toHaveBeenCalled();
  expect(mockOtherClerkUpdate).not.toHaveBeenCalled();
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(view.queryByText('Profile updated')).toBeNull();
});

it('cancels a saved editor’s delayed back navigation when the account switches', async () => {
  jest.useFakeTimers();
  const view = render(<EditProfileScreen />);
  await save(view);
  expect(view.getByText('Profile updated')).toBeTruthy();
  switchAccount();
  view.rerender(<EditProfileScreen />);
  act(() => jest.advanceTimersByTime(1200));
  expect(mockRouter.back).not.toHaveBeenCalled();
});

it('keeps normal deletion on the existing confirmation flow and blocks it while save is pending', async () => {
  let finishSave!: () => void;
  mockUpdate.mockReturnValueOnce(new Promise<void>(resolve => { finishSave = resolve; }));
  const view = render(<EditProfileScreen />);
  fireEvent.press(view.getByRole('button', { name: 'Delete my account' }));
  expect(mockRequestDelete).toHaveBeenCalledTimes(1);
  expect(mockUpdate).not.toHaveBeenCalled();
  mockRequestDelete.mockClear();
  await save(view);
  expect(view.getByRole('button', { name: 'Delete my account' })).toBeDisabled();
  expect(view.getByRole('button', { name: 'Change profile photo' })).toBeDisabled();
  fireEvent.press(view.getByRole('button', { name: 'Delete my account' }));
  fireEvent.press(view.getByRole('button', { name: 'Change profile photo' }));
  expect(mockRequestDelete).not.toHaveBeenCalled();
  expect(mockPermission).not.toHaveBeenCalled();
  // Unmount rather than advancing into a success route while finishing cleanup.
  view.unmount();
  await act(async () => { finishSave(); await flush(); });
});

it('disables editing, saving and picking a photo while deletion is in progress', () => {
  mockDeleteState.busy = true;
  const view = render(<EditProfileScreen />);
  expect(view.getByLabelText('First name')).toBeDisabled();
  expect(view.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  expect(view.getByRole('button', { name: 'Change profile photo' })).toBeDisabled();
  expect(view.getByRole('button', { name: 'Delete my account' })).toBeDisabled();
  fireEvent.press(view.getByRole('button', { name: 'Save changes' }));
  fireEvent.press(view.getByRole('button', { name: 'Change profile photo' }));
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockPermission).not.toHaveBeenCalled();
});

it('does not expose stale saved fields from a creator record for another Clerk subject', () => {
  mockAccounts['clerk-mika'].clerkId = 'clerk-foreign';
  const view = render(<EditProfileScreen />);
  expect(view.queryByLabelText('First name')).toBeNull();
  expect(view.queryByLabelText("Email: mika@example.com. Can't change.")).toBeNull();
  expect(mockUpdate).not.toHaveBeenCalled();
});
