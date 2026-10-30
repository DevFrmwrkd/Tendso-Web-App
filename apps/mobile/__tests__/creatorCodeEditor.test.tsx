import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ConvexError } from 'convex/values';
import { CreatorCodeEditor } from '../components/affiliate/CreatorCodeEditor';

const mockUpdate = jest.fn(), mockQuery = jest.fn();
let mockAvailability: { value: string; available: boolean; error: string | null } | undefined;
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@tendso/convex-client', () => ({ api: { creatorProgram: { checkCodeAvailability: 'check', updateCode: 'update' } } }));
jest.mock('convex/react', () => ({
  useMutation: () => mockUpdate,
  useQuery: (_ref: unknown, args: unknown) => { mockQuery(args); return args === 'skip' ? undefined : mockAvailability; },
}));
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); mockAvailability = undefined; mockUpdate.mockReset().mockResolvedValue({ code: 'MIKA30' }); });
afterEach(() => jest.useRealTimers());
const setup = () => render(<CreatorCodeEditor savedCode="AFF12345" offline={false} />);
const tick = () => act(() => jest.advanceTimersByTime(350));
const available = () => { mockAvailability = { value: 'MIKA30', available: true, error: null }; tick(); };

it('normalizes and debounces availability, then saves only the exact available code', async () => {
  const view = setup();
  expect(view.getByLabelText('Save code')).toBeDisabled();
  fireEvent.changeText(view.getByLabelText('Creator code'), 'mika30');
  expect(view.getByDisplayValue('MIKA30')).toBeTruthy();
  expect(view.getByText('Checking availability…')).toBeTruthy();
  expect(mockQuery).not.toHaveBeenCalledWith({ code: 'MIKA30' });
  expect(view.getByLabelText('Save code')).toBeDisabled(); available();
  expect(mockQuery).toHaveBeenLastCalledWith({ code: 'MIKA30' });
  expect(view.getByText('Available')).toBeTruthy();
  await act(async () => fireEvent.press(view.getByLabelText('Save code')));
  expect(mockUpdate).toHaveBeenCalledWith({ code: 'MIKA30' });
  expect(view.getByText('Code saved.')).toBeTruthy();
  expect(view.getByLabelText('Save code')).toBeDisabled();
});

it('blocks newly typed codes while an older available result is cached', () => {
  const view = setup(); fireEvent.changeText(view.getByLabelText('Creator code'), 'MIKA30'); available();
  fireEvent.changeText(view.getByLabelText('Creator code'), 'JOY30');
  expect(view.getByLabelText('Save code')).toBeDisabled(); tick();
  expect(view.getByLabelText('Save code')).toBeDisabled();
  fireEvent.press(view.getByLabelText('Save code')); expect(mockUpdate).not.toHaveBeenCalled();
});

it('shows a taken result without allowing save', () => {
  const view = setup(); fireEvent.changeText(view.getByLabelText('Creator code'), 'MIKA30');
  mockAvailability = { value: 'MIKA30', available: false, error: 'That code is already taken. Choose another one.' }; tick();
  expect(view.getByRole('alert')).toHaveTextContent(/already taken/);
  expect(view.getByLabelText('Save code')).toBeDisabled();
});

it.each(['ABC', 'MIKA 30', 'MIKA!30'])('rejects malformed code %s without querying availability', code => {
  const view = setup(); fireEvent.changeText(view.getByLabelText('Creator code'), code); tick();
  expect(view.getByRole('alert')).toBeTruthy();
  expect(mockQuery.mock.calls.every(([args]) => args === 'skip')).toBe(true);
  expect(view.getByLabelText('Save code')).toBeDisabled();
});

it('blocks checking and saving offline even with a cached available result', () => {
  const view = setup(); fireEvent.changeText(view.getByLabelText('Creator code'), 'MIKA30'); available();
  view.rerender(<CreatorCodeEditor savedCode="AFF12345" offline />);
  expect(mockQuery).toHaveBeenLastCalledWith('skip');
  expect(view.getByLabelText('Save code')).toBeDisabled();
  expect(view.getByText('Connect to check availability.')).toBeTruthy();
});

it('reports a server-side collision without changing the saved code', async () => {
  const view = setup(); fireEvent.changeText(view.getByLabelText('Creator code'), 'MIKA30'); available();
  mockUpdate.mockRejectedValueOnce(new ConvexError('That code is already taken. Choose another one.'));
  await act(async () => fireEvent.press(view.getByLabelText('Save code')));
  expect(view.getByRole('alert')).toHaveTextContent(/already taken/);
  expect(view.queryByText('Code saved.')).toBeNull();
  expect(view.getByText('Current code: AFF12345')).toBeTruthy();
});

it('refreshes clean saved data without erasing an in-progress code draft', () => {
  const view = setup(); view.rerender(<CreatorCodeEditor savedCode="MIKA30" offline={false} />);
  expect(view.getByDisplayValue('MIKA30')).toBeTruthy();
  fireEvent.changeText(view.getByLabelText('Creator code'), 'JOY30');
  view.rerender(<CreatorCodeEditor savedCode="ANA30" offline={false} />);
  expect(view.getByDisplayValue('JOY30')).toBeTruthy();
  expect(view.getByText('Current code: ANA30')).toBeTruthy();
});
