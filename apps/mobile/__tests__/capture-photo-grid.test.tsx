import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { CapturePhotoGrid, type CapturePhotoGridItem, type CapturePhotoGridProps } from '../components/field-agent/CapturePhotoGrid';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../components/ui/SwipeSheet', () => ({ SwipeSheet: ({ visible, children, testID }: any) => visible
  ? require('react').createElement(require('react-native').View, { testID }, children) : null }));

const photos: CapturePhotoGridItem[] = [
  { id: 'portrait', uri: 'file://portrait.jpg', label: 'The owner' },
  { id: 'front', uri: 'https://images.example.test/front.jpg', label: 'Shop entrance' },
  { id: 'work', uri: 'file://work.jpg', label: 'At work' },
];
let callbacks: Pick<CapturePhotoGridProps, 'onPreview' | 'onRetake' | 'onReplace' | 'onRename' | 'onRemove'>;
const draw = (props: Partial<CapturePhotoGridProps> = {}) => <CapturePhotoGrid items={photos} {...callbacks} {...props} />;
const confirmRemove = () => jest.mocked(Alert.alert).mock.calls.at(-1)![2]!.find(button => button.style === 'destructive')!.onPress!();

beforeEach(() => {
  callbacks = { onPreview: jest.fn(), onRetake: jest.fn(), onReplace: jest.fn(), onRename: jest.fn(), onRemove: jest.fn() };
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('shows descriptive labels alone while keeping photo numbers in accessible actions', () => {
  const screen = render(draw());
  expect(screen.getByText('Your photos')).toBeTruthy();
  expect(screen.getByText('3 photos added')).toBeTruthy();
  for (const [index, item] of photos.entries()) {
    expect(screen.getByText(item.label)).toBeTruthy();
    expect(screen.getByRole('button', { name: `View photo ${index + 1}: ${item.label}` })).toBeTruthy();
  }
  expect(screen.queryAllByText(/^Photo \d+$/)).toHaveLength(0);
  fireEvent.press(screen.getByRole('button', { name: 'View photo 2: Shop entrance' }));
  expect(callbacks.onPreview).toHaveBeenCalledWith('front');
  expect(callbacks.onRetake).not.toHaveBeenCalled(); expect(callbacks.onRemove).not.toHaveBeenCalled();
});

it('offers photo actions in a sheet and retakes or replaces the same item', () => {
  const screen = render(draw());
  fireEvent.press(screen.getByRole('button', { name: 'Photo 2 options' }));
  expect(screen.getByTestId('capture-photo-actions-sheet')).toBeTruthy();
  expect(screen.getByText('Photo options')).toBeTruthy();
  expect(screen.queryAllByText(/^Photo \d+$/)).toHaveLength(0);
  for (const name of ['Retake photo', 'Replace from library', 'Edit label', 'Remove photo']) expect(screen.getByRole('button', { name })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Retake photo' }));
  expect(callbacks.onRetake).toHaveBeenCalledWith('front');
  expect(screen.queryByTestId('capture-photo-actions-sheet')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Photo 2 options' }));
  fireEvent.press(screen.getByRole('button', { name: 'Replace from library' }));
  expect(callbacks.onReplace).toHaveBeenCalledWith('front');
  expect(callbacks.onRemove).not.toHaveBeenCalled();
});

it('offers Add label for an unlabeled photo and opens its existing editor directly', () => {
  const screen = render(draw({ items: [{ ...photos[0], label: '' }], suggestedLabels: ['Owner portrait'] }));
  expect(screen.getByText('Add label')).toBeTruthy();
  expect(screen.queryByText('Added photo')).toBeNull();
  expect(screen.queryAllByText(/^Photo \d+$/)).toHaveLength(0);
  fireEvent.press(screen.getByRole('button', { name: 'View photo 1: Unlabeled photo' }));
  expect(callbacks.onPreview).toHaveBeenCalledWith('portrait');
  fireEvent.press(screen.getByRole('button', { name: 'Add label to photo 1' }));
  expect(screen.getByText('Edit photo label')).toBeTruthy();
  expect(screen.getByLabelText('Photo label')).toHaveProp('value', '');
  fireEvent.press(screen.getByRole('button', { name: 'Use label: Owner portrait' }));
  fireEvent.press(screen.getByRole('button', { name: 'Save label' }));
  expect(callbacks.onRename).toHaveBeenCalledWith('portrait', 'Owner portrait');
});

it('keeps an unlabeled photo identifiable while Add label is disabled for a busy capture', () => {
  const screen = render(draw({ items: [{ ...photos[0], label: '   ' }], disabled: true }));
  expect(screen.getByRole('button', { name: 'Add label to photo 1' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'View photo 1: Unlabeled photo' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Add label to photo 1' }));
  expect(screen.queryByText('Edit photo label')).toBeNull();
  expect(callbacks.onRename).not.toHaveBeenCalled();
});

it('edits the visible label with a photo preview, presets and a 60-character limit', () => {
  const screen = render(draw({ suggestedLabels: ['Owner portrait', 'Shop entrance'] }));
  fireEvent.press(screen.getByRole('button', { name: 'Photo 1 options' }));
  fireEvent.press(screen.getByRole('button', { name: 'Edit label' }));
  expect(screen.getByLabelText('Label preview for photo 1')).toHaveProp('source', { uri: 'file://portrait.jpg' });
  expect(screen.getByLabelText('Photo label')).toHaveProp('maxLength', 60);
  expect(screen.getByLabelText('Photo label')).toHaveProp('value', 'The owner');
  fireEvent.press(screen.getByRole('button', { name: 'Use label: Owner portrait' }));
  expect(screen.getByLabelText('Photo label')).toHaveProp('value', 'Owner portrait');
  fireEvent.changeText(screen.getByLabelText('Photo label'), '  Owner at the counter  ');
  fireEvent.press(screen.getByRole('button', { name: 'Save label' }));
  expect(callbacks.onRename).toHaveBeenCalledWith('portrait', 'Owner at the counter');
  expect(screen.queryByTestId('capture-photo-actions-sheet')).toBeNull();
  expect(callbacks.onReplace).not.toHaveBeenCalled(); expect(callbacks.onRemove).not.toHaveBeenCalled();
});

it('prevents an empty label and bounds a callback even if a non-native input exceeds maxLength', () => {
  const screen = render(draw());
  fireEvent.press(screen.getByRole('button', { name: 'Photo 3 options' }));
  fireEvent.press(screen.getByRole('button', { name: 'Edit label' }));
  fireEvent.changeText(screen.getByLabelText('Photo label'), '   ');
  expect(screen.getByRole('button', { name: 'Save label' })).toBeDisabled();
  expect(callbacks.onRename).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Photo label'), 'x'.repeat(80));
  fireEvent.press(screen.getByRole('button', { name: 'Save label' }));
  expect(callbacks.onRename).toHaveBeenCalledWith('work', 'x'.repeat(60));
});

it('cancels label editing without changing the supplied photo', () => {
  const screen = render(draw());
  fireEvent.press(screen.getByRole('button', { name: 'Photo 1 options' }));
  fireEvent.press(screen.getByRole('button', { name: 'Edit label' }));
  fireEvent.changeText(screen.getByLabelText('Photo label'), 'Unsent edit');
  fireEvent.press(screen.getByRole('button', { name: 'Cancel label editing' }));
  expect(callbacks.onRename).not.toHaveBeenCalled();
  expect(screen.getByText('The owner')).toBeTruthy();
});

it('selects multiple photos and removes only those identities after count-specific confirmation', () => {
  const screen = render(draw());
  fireEvent.press(screen.getByRole('button', { name: 'Select photos' }));
  expect(screen.getByTestId('capture-photo-selection-bar')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Remove 0 selected photos' })).toBeDisabled();
  fireEvent.press(screen.getByRole('checkbox', { name: 'Select photo 1: The owner' }));
  fireEvent.press(screen.getByRole('checkbox', { name: 'Select photo 3: At work' }));
  expect(screen.getByRole('checkbox', { name: 'Select photo 1: The owner' })).toHaveAccessibilityState({ checked: true });
  expect(screen.getByRole('checkbox', { name: 'Select photo 2: Shop entrance' })).toHaveAccessibilityState({ checked: false });
  expect(screen.getByText('2 selected')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Remove 2 selected photos' }));
  expect(Alert.alert).toHaveBeenCalledWith('Remove 2 photos?', expect.any(String), expect.any(Array));
  expect(callbacks.onRemove).not.toHaveBeenCalled();
  act(confirmRemove);
  expect(callbacks.onRemove).toHaveBeenCalledWith(['portrait', 'work']);
  expect(screen.queryByTestId('capture-photo-selection-bar')).toBeNull();
});

it('supports selecting all and clearing the selection', () => {
  const screen = render(draw());
  fireEvent.press(screen.getByRole('button', { name: 'Select photos' }));
  fireEvent.press(screen.getByRole('button', { name: 'Select all photos' }));
  expect(screen.getByText('3 selected')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Clear selection' }));
  expect(screen.getByText('0 selected')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Remove 0 selected photos' })).toBeDisabled();
  expect(callbacks.onRemove).not.toHaveBeenCalled();
});

it('asks before single-photo removal and keeps everything when cancelled', () => {
  const screen = render(draw());
  fireEvent.press(screen.getByRole('button', { name: 'Photo 2 options' }));
  fireEvent.press(screen.getByRole('button', { name: 'Remove photo' }));
  expect(Alert.alert).toHaveBeenCalledWith('Remove this photo?', expect.any(String), expect.any(Array));
  act(() => jest.mocked(Alert.alert).mock.calls.at(-1)![2]!.find(button => button.text === 'Cancel')!.onPress?.());
  expect(callbacks.onRemove).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Close photo options' }));
  expect(screen.getByText('Shop entrance')).toBeTruthy();
});

it('prunes stale selections and rechecks identities when a removal alert is confirmed later', async () => {
  const screen = render(draw());
  fireEvent.press(screen.getByRole('button', { name: 'Select photos' }));
  fireEvent.press(screen.getByRole('button', { name: 'Select all photos' }));
  fireEvent.press(screen.getByRole('button', { name: 'Remove 3 selected photos' }));
  screen.rerender(draw({ items: [photos[1]] }));
  await waitFor(() => expect(screen.getByText('1 selected')).toBeTruthy());
  act(confirmRemove);
  expect(callbacks.onRemove).toHaveBeenCalledWith(['front']);
});

it.each(['disabled', 'unmounted'] as const)('ignores an old delete confirmation after the gallery becomes %s', mode => {
  const screen = render(draw());
  fireEvent.press(screen.getByRole('button', { name: 'Photo 1 options' }));
  fireEvent.press(screen.getByRole('button', { name: 'Remove photo' }));
  if (mode === 'disabled') screen.rerender(draw({ disabled: true })); else screen.unmount();
  act(confirmRemove);
  expect(callbacks.onRemove).not.toHaveBeenCalled();
});

it('closes an editor when its photo disappears and never renames a different item', async () => {
  const screen = render(draw());
  fireEvent.press(screen.getByRole('button', { name: 'Photo 1 options' }));
  fireEvent.press(screen.getByRole('button', { name: 'Edit label' }));
  screen.rerender(draw({ items: [photos[1], photos[2]] }));
  await waitFor(() => expect(screen.queryByTestId('capture-photo-actions-sheet')).toBeNull());
  expect(callbacks.onRename).not.toHaveBeenCalled();
});

it('keeps unavailable photos identifiable and offers a replacement without inventing an image', () => {
  const screen = render(draw({ items: [{ id: 'missing', uri: null, label: 'The original shop sign', missing: true }] }));
  expect(screen.getByText('Unavailable')).toBeTruthy();
  expect(screen.getByText('The original shop sign')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Photo 1 options' }));
  fireEvent.press(screen.getByRole('button', { name: 'Replace from library' }));
  expect(callbacks.onReplace).toHaveBeenCalledWith('missing');
  expect(callbacks.onRemove).not.toHaveBeenCalled();
});

it('disables preview, selection and photo actions while the owning capture is busy', () => {
  const screen = render(draw({ disabled: true }));
  for (const name of ['View photo 1: The owner', 'Photo 1 options', 'Select photos']) expect(screen.getByRole('button', { name })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'View photo 1: The owner' }));
  fireEvent.press(screen.getByRole('button', { name: 'Photo 1 options' }));
  expect(callbacks.onPreview).not.toHaveBeenCalled();
  expect(screen.queryByTestId('capture-photo-actions-sheet')).toBeNull();
});

it('reports thumbnail and label-preview failures for the current item and URI', () => {
  const onImageError = jest.fn();
  const screen = render(draw({ onImageError }));
  fireEvent(screen.getByTestId('capture-photo-thumbnail-portrait'), 'error');
  expect(onImageError).toHaveBeenCalledWith('portrait', 'file://portrait.jpg');
  fireEvent.press(screen.getByRole('button', { name: 'Photo 2 options' }));
  fireEvent.press(screen.getByRole('button', { name: 'Edit label' }));
  fireEvent(screen.getByLabelText('Label preview for photo 2'), 'error');
  expect(onImageError).toHaveBeenCalledWith('front', 'https://images.example.test/front.jpg');
  expect(callbacks.onRemove).not.toHaveBeenCalled();
});

it('ignores a delayed image error after that photo has received a replacement URI', () => {
  const onImageError = jest.fn();
  const screen = render(draw({ onImageError }));
  const oldError = screen.getByTestId('capture-photo-thumbnail-portrait').props.onError;
  screen.rerender(draw({ items: [{ ...photos[0], uri: 'file://replacement.jpg' }, ...photos.slice(1)], onImageError }));
  act(() => oldError());
  expect(onImageError).not.toHaveBeenCalled();
  expect(screen.getByTestId('capture-photo-thumbnail-portrait')).toHaveProp('source', { uri: 'file://replacement.jpg' });
});
