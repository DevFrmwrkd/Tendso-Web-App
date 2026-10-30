import React from 'react';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { ConvexError } from 'convex/values';
import { CreatorCodeEditor } from '../components/affiliate/CreatorCodeEditor';
import { CreatorCodeConfirmation } from '../components/affiliate/CreatorCodeConfirmation';
import type { Id } from '@tendso/convex-client';

const mockUpdate = jest.fn(), mockQuery = jest.fn();
const mockMutationHook = jest.fn();
let mockSetup: { creatorId: string; code: string | null; canChoose: boolean; chosenAt: number | null } | undefined;
let mockSetupError = false;
let mockAvailability: { value: string; available: boolean; error: string | null } | undefined;
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@tendso/convex-client', () => ({ api: { creatorProgram: { codeSetup: 'setup', checkCodeAvailability: 'check', updateCode: 'update' } } }));
jest.mock('convex/react', () => ({
  useMutation: () => { mockMutationHook(); return mockUpdate; },
  useQuery: (ref: unknown, args: unknown) => { if (ref === 'setup') { if (mockSetupError) throw new Error('Connection failed'); return mockSetup; } mockQuery(args); return args === 'skip' ? undefined : mockAvailability; },
}));
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); mockAvailability = undefined;
  mockSetupError = false;
  mockSetup = { creatorId: 'creator-1', code: 'AFF12345', canChoose: true, chosenAt: null };
  mockUpdate.mockReset().mockResolvedValue({ code: 'MIKA30' });
});
afterEach(() => jest.useRealTimers());
const actor = 'creator-1' as Id<'creators'>;
const setup = () => render(<CreatorCodeEditor accountId={actor} savedCode="AFF12345" offline={false} />);
const tick = () => act(() => jest.advanceTimersByTime(350));
const available = () => { mockAvailability = { value: 'MIKA30', available: true, error: null }; tick(); };

it('normalizes and debounces availability, then saves only the exact available code', async () => {
  const view = setup();
  expect(view.getByLabelText('Set my code')).toBeDisabled();
  fireEvent.changeText(view.getByLabelText('Creator code'), 'mika30');
  expect(view.getByDisplayValue('MIKA30')).toBeTruthy();
  expect(view.getByText('Checking availability…')).toBeTruthy();
  expect(mockQuery).not.toHaveBeenCalledWith({ code: 'MIKA30' });
  expect(view.getByLabelText('Set my code')).toBeDisabled(); available();
  expect(mockQuery).toHaveBeenLastCalledWith({ code: 'MIKA30' });
  expect(view.getByText('Available')).toBeTruthy();
  await act(async () => fireEvent.press(view.getByLabelText('Set my code')));
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(view.getByText('You won’t be able to change this code afterward.')).toBeTruthy();
  expect(view.getByText('MIKA30')).toBeTruthy();
  await act(async () => fireEvent.press(view.getByLabelText('Yes, set my code')));
  expect(mockUpdate).toHaveBeenCalledWith({ code: 'MIKA30' });
  expect(view.getByText('Your code is set. It can’t be changed.')).toBeTruthy();
  expect(view.queryByLabelText('Creator code')).toBeNull();
  expect(view.queryByLabelText('Set my code')).toBeNull();
});

it('blocks newly typed codes while an older available result is cached', () => {
  const view = setup(); fireEvent.changeText(view.getByLabelText('Creator code'), 'MIKA30'); available();
  fireEvent.changeText(view.getByLabelText('Creator code'), 'JOY30');
  expect(view.getByLabelText('Set my code')).toBeDisabled(); tick();
  expect(view.getByLabelText('Set my code')).toBeDisabled();
  fireEvent.press(view.getByLabelText('Set my code')); expect(mockUpdate).not.toHaveBeenCalled();
});

it('shows a taken result without allowing save', () => {
  const view = setup(); fireEvent.changeText(view.getByLabelText('Creator code'), 'MIKA30');
  mockAvailability = { value: 'MIKA30', available: false, error: 'That code is already taken. Choose another one.' }; tick();
  expect(view.getByRole('alert')).toHaveTextContent(/already taken/);
  expect(view.getByLabelText('Set my code')).toBeDisabled();
});

it.each(['ABC', 'MIKA 30', 'MIKA!30'])('rejects malformed code %s without querying availability', code => {
  const view = setup(); fireEvent.changeText(view.getByLabelText('Creator code'), code); tick();
  expect(view.getByRole('alert')).toBeTruthy();
  expect(mockQuery.mock.calls.every(([args]) => args === 'skip')).toBe(true);
  expect(view.getByLabelText('Set my code')).toBeDisabled();
});

it('blocks checking and saving offline even with a cached available result', () => {
  const view = setup(); fireEvent.changeText(view.getByLabelText('Creator code'), 'MIKA30'); available();
  view.rerender(<CreatorCodeEditor accountId={actor} savedCode="AFF12345" offline />);
  expect(mockQuery).toHaveBeenLastCalledWith('skip');
  expect(view.getByLabelText('Set my code')).toBeDisabled();
  expect(view.getByText('Connect to check availability.')).toBeTruthy();
});

it('reports a server-side collision without changing the saved code', async () => {
  const view = setup(); fireEvent.changeText(view.getByLabelText('Creator code'), 'MIKA30'); available();
  mockUpdate.mockRejectedValueOnce(new ConvexError('That code is already taken. Choose another one.'));
  await act(async () => fireEvent.press(view.getByLabelText('Set my code')));
  await act(async () => fireEvent.press(view.getByLabelText('Yes, set my code')));
  expect(within(view.getByTestId('creator-code-confirmation')).getByRole('alert')).toHaveTextContent(/already taken/);
  expect(view.queryByText('Code saved.')).toBeNull();
  expect(view.getByText('Current code: AFF12345')).toBeTruthy();
});

it('removes an unsaved draft if setup is completed on another device', () => {
  const view = setup();
  fireEvent.changeText(view.getByLabelText('Creator code'), 'JOY30');
  mockSetup = { ...mockSetup!, code: 'ANA30', canChoose: false, chosenAt: 123 };
  view.rerender(<CreatorCodeEditor accountId={actor} savedCode="ANA30" offline={false} />);
  expect(view.getByText('ANA30')).toBeTruthy();
  expect(view.queryByLabelText('Creator code')).toBeNull();
  expect(view.queryByLabelText('Set my code')).toBeNull();
});

it('shows locked codes without mounting availability or mutation hooks', () => {
  mockSetup = { creatorId: 'creator-1', code: 'MIKA30', canChoose: false, chosenAt: 123 };
  const view = setup();
  expect(view.getByText('MIKA30')).toBeTruthy();
  expect(view.getByText('Your code is set. It can’t be changed.')).toBeTruthy();
  expect(view.queryByLabelText('Creator code')).toBeNull();
  expect(mockQuery).not.toHaveBeenCalled(); expect(mockMutationHook).not.toHaveBeenCalled();
});

it.each([undefined, { creatorId: 'someone-else', code: 'PRIVATE30', canChoose: true, chosenAt: null }])('waits for owned setup state before showing any controls', state => {
  mockSetup = state; const view = setup();
  expect(view.getByText('Loading code setup…')).toBeTruthy();
  expect(view.queryByText('PRIVATE30')).toBeNull();
  expect(mockQuery).not.toHaveBeenCalled(); expect(mockMutationHook).not.toHaveBeenCalled();
});

it('lets a legacy creator permanently keep the generated code after an availability check', async () => {
  const view = setup(); mockAvailability = { value: 'AFF12345', available: true, error: null }; tick();
  mockUpdate.mockResolvedValueOnce({ code: 'AFF12345' });
  expect(view.getByText('Choose carefully. You can’t change this code after confirming.')).toBeTruthy();
  await act(async () => fireEvent.press(view.getByLabelText('Set my code')));
  expect(mockUpdate).not.toHaveBeenCalled();
  await act(async () => fireEvent.press(view.getByLabelText('Yes, set my code')));
  expect(mockUpdate).toHaveBeenCalledWith({ code: 'AFF12345' });
  expect(view.queryByLabelText('Set my code')).toBeNull();
});

it('keeps failed setup read-only and retries without mounting write hooks before recovery', () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    mockSetupError = true;
    const view = setup();
    expect(view.getByText('Could not load your code setup. Try again when connected.')).toBeTruthy();
    expect(mockMutationHook).not.toHaveBeenCalled();
    mockSetupError = false;
    fireEvent.press(view.getByLabelText('Retry code setup'));
    expect(view.getByLabelText('Creator code')).toBeTruthy();
    expect(view.getByLabelText('Set my code')).toBeDisabled();
  } finally { log.mockRestore(); }
});

it('cancels confirmation without changing the draft or saving a code', () => {
  const view = setup(); fireEvent.changeText(view.getByLabelText('Creator code'), 'MIKA30'); available();
  fireEvent.press(view.getByLabelText('Set my code'));
  expect(view.getByTestId('creator-code-confirmation')).toBeTruthy();
  fireEvent.press(view.getByLabelText('Keep editing'));
  expect(view.queryByTestId('creator-code-confirmation')).toBeNull();
  expect(view.getByDisplayValue('MIKA30')).toBeTruthy(); expect(mockUpdate).not.toHaveBeenCalled();
});

it('rejects queued confirmation callbacks after canceling and reopening the same code', async () => {
  const view = setup(); fireEvent.changeText(view.getByLabelText('Creator code'), 'MIKA30'); available();
  fireEvent.press(view.getByLabelText('Set my code'));
  const canceledConfirm = view.UNSAFE_getByType(CreatorCodeConfirmation).props.onConfirm;
  fireEvent.press(view.getByLabelText('Keep editing'));
  await act(async () => canceledConfirm());
  expect(mockUpdate).not.toHaveBeenCalled();
  fireEvent.press(view.getByLabelText('Set my code'));
  await act(async () => canceledConfirm());
  expect(mockUpdate).not.toHaveBeenCalled();
  await act(async () => fireEvent.press(view.getByLabelText('Yes, set my code')));
  expect(mockUpdate).toHaveBeenCalledTimes(1);
  expect(mockUpdate).toHaveBeenCalledWith({ code: 'MIKA30' });
});

it('blocks a stale confirmation after the candidate or connection changes', () => {
  const view = setup(); fireEvent.changeText(view.getByLabelText('Creator code'), 'MIKA30'); available();
  fireEvent.press(view.getByLabelText('Set my code'));
  fireEvent.changeText(view.getByLabelText('Creator code'), 'JOY30');
  expect(view.getByLabelText('Yes, set my code')).toBeDisabled();
  fireEvent.press(view.getByLabelText('Yes, set my code')); expect(mockUpdate).not.toHaveBeenCalled();
  view.rerender(<CreatorCodeEditor accountId={actor} savedCode="AFF12345" offline />);
  expect(view.getByLabelText('Yes, set my code')).toBeDisabled();
});

it('submits a confirmed code only once while the mutation is pending', async () => {
  let finish!: (value: { code: string }) => void;
  mockUpdate.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = setup(); fireEvent.changeText(view.getByLabelText('Creator code'), 'MIKA30'); available();
  fireEvent.press(view.getByLabelText('Set my code'));
  const confirm = view.getByLabelText('Yes, set my code');
  fireEvent.press(confirm); fireEvent.press(confirm);
  expect(mockUpdate).toHaveBeenCalledTimes(1);
  expect(view.getByLabelText('Keep editing')).toBeDisabled();
  await act(async () => finish({ code: 'MIKA30' }));
  expect(view.queryByTestId('creator-code-confirmation')).toBeNull();
});
