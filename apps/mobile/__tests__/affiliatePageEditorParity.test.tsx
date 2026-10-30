import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { AffiliatePageEditorScreen, PageEditorContent } from '../components/affiliate/PageEditor';
import { sampleAffiliate } from '../components/affiliate/model';
import type { CreatorCard } from '../../../lib/v2/creatorTypes';

const mockSave = jest.fn();
const mockSavePrice = jest.fn();
const mockPhoto = jest.fn();
const mockMutationSave = jest.fn();
const mockMutation = jest.fn();
const mockAction = jest.fn();
const mockPublicPreview = jest.fn();
const mockSharing = jest.fn();
const mockAccess = { account: sampleAffiliate, isPreview: false, isOffline: false, isAuthenticated: true };

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@tendso/convex-client', () => ({ api: { affiliates: { updatePage: 'affiliates:updatePage' }, r2: { generateUploadUrl: 'r2:generateUploadUrl' } } }));
jest.mock('convex/react', () => ({
  useMutation: (...args: unknown[]) => { mockMutation(...args); return mockMutationSave; },
  useAction: (...args: unknown[]) => { mockAction(...args); return jest.fn(); },
}));
jest.mock('expo-image-picker', () => ({ requestMediaLibraryPermissionsAsync: jest.fn(), launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: 'jpeg' } }));
jest.mock('../components/PriceSlider', () => ({ PriceSlider: () => null }));
jest.mock('../components/affiliate/Screen', () => ({
  AffiliateAccess: ({ children }: { children: (props: typeof mockAccess) => React.ReactNode }) => children(mockAccess),
  Notice: require('react-native').Text,
}));
jest.mock('../components/affiliate/AffiliateToolFrame', () => ({
  AffiliateToolFrame: ({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) => {
    const makeElement = require('react').createElement;
    return makeElement(require('react-native').View, null, children, footer);
  },
}));
jest.mock('../components/affiliate/ShareTools', () => ({
  ShareTools: (props: { handle: string; displayName: string; price: number; disabled?: boolean }) => {
    mockSharing(props);
    return require('react').createElement(require('react-native').Text, { testID: 'saved-sharing' }, `Saved sharing: ${props.displayName} / ${props.price}`);
  },
}));
jest.mock('../components/affiliate/PublicPagePreview', () => ({
  AffiliatePublicPagePreview: (props: { card: CreatorCard; dirty: boolean; paused: boolean; offline: boolean; sample: boolean }) => {
    mockPublicPreview(props);
    return require('react').createElement(require('react-native').Text, { testID: 'public-page-preview' }, 'Actual public shop page');
  },
}));

function props() {
  return { account: sampleAffiliate, isPreview: false, isOffline: false, isAuthenticated: true,
    onSave: mockSave, onSavePrice: mockSavePrice, onPhoto: mockPhoto, mode: 'page' as const };
}

type Editor = ReturnType<typeof render>;
function tab(view: Editor, name: 'Page details' | 'Your offer' | 'Sharing') {
  fireEvent.press(view.getByRole('tab', { name }));
}
function showPreview(view: Editor) {
  fireEvent.press(view.getByRole('tab', { name: 'Preview public page' }));
}
function showEditor(view: Editor) {
  fireEvent.press(view.getByRole('tab', { name: 'Edit page details' }));
}
function latestShare() {
  return mockSharing.mock.calls.at(-1)![0] as { handle: string; displayName: string; price: number; disabled?: boolean };
}
function latestPreview() {
  return mockPublicPreview.mock.calls.at(-1)![0] as { card: CreatorCard; dirty: boolean; paused: boolean; offline: boolean; sample: boolean };
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockAccess, { account: sampleAffiliate, isPreview: false, isOffline: false, isAuthenticated: true });
  mockSave.mockReset().mockResolvedValue(undefined);
  mockSavePrice.mockReset().mockResolvedValue(undefined);
  mockMutationSave.mockReset().mockResolvedValue(undefined);
  mockPhoto.mockReset().mockResolvedValue(undefined);
});

describe('focused native page editor sections', () => {
  it('keeps the existing fields and optional switches behind three reachable section tabs', () => {
    const view = render(<PageEditorContent {...props()} />);
    expect(view.getByRole('tab', { name: 'Page details' }).props.accessibilityState.selected).toBe(true);
    expect(view.getByLabelText('Display name').props.value).toBe(sampleAffiliate.affiliateDisplayName);
    expect(view.getByLabelText('Short message').props.value).toBe(sampleAffiliate.affiliateMessage);
    for (const label of ['Show my photo', 'Show a message', 'Show social links']) expect(view.getByLabelText(label)).toBeTruthy();
    fireEvent(view.getByLabelText('Show social links'), 'valueChange', true);
    for (const platform of ['Messenger', 'Facebook', 'Instagram', 'TikTok', 'YouTube']) expect(view.getByLabelText(`${platform} link`)).toBeTruthy();
    expect(view.queryByLabelText('Website price in pesos')).toBeNull();
    expect(view.getByLabelText('Save page').props.accessibilityState.disabled).toBe(true);
    tab(view, 'Your offer');
    expect(view.getByLabelText('Website price in pesos').props.value).toBe('3999');
    expect(view.getByLabelText('Save price').props.accessibilityState.disabled).toBe(true);
    tab(view, 'Sharing');
    expect(view.getByTestId('saved-sharing')).toBeTruthy();
    expect(view.queryByLabelText('Save page')).toBeNull();
    expect(mockPublicPreview).not.toHaveBeenCalled();
  });

  it('saves a page independently of an invalid price and retains that unsaved price draft', async () => {
    const view = render(<PageEditorContent {...props()} />);
    tab(view, 'Your offer');
    fireEvent.changeText(view.getByLabelText('Website price in pesos'), '');
    tab(view, 'Page details');
    fireEvent.changeText(view.getByLabelText('Display name'), '  New public name  ');
    fireEvent.press(view.getByLabelText('Save page'));
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith({ photo: '', displayName: 'New public name', message: sampleAffiliate.affiliateMessage, socialLinks: {}, price: 3999 }));
    await waitFor(() => expect(view.getByText('Page saved.')).toBeTruthy());
    expect(mockSavePrice).not.toHaveBeenCalled();
    tab(view, 'Your offer');
    expect(view.getByLabelText('Website price in pesos').props.value).toBe('');
    fireEvent.press(view.getByLabelText('Save price'));
    expect(view.getByText('Enter your website price in whole pesos.')).toBeTruthy();
    expect(mockSavePrice).not.toHaveBeenCalled();
  });

  it('saves only the price while preserving invalid public-page fields for correction', async () => {
    const view = render(<PageEditorContent {...props()} />);
    fireEvent(view.getByLabelText('Show social links'), 'valueChange', true);
    fireEvent.changeText(view.getByLabelText('Instagram link'), 'https://instagram.com.attacker.test/name');
    tab(view, 'Your offer');
    fireEvent.changeText(view.getByLabelText('Website price in pesos'), '998');
    fireEvent.press(view.getByLabelText('Save price'));
    await waitFor(() => expect(mockSavePrice).toHaveBeenCalledWith(999));
    await waitFor(() => expect(view.getByText('Price saved.')).toBeTruthy());
    expect(mockSave).not.toHaveBeenCalled();
    tab(view, 'Page details');
    expect(view.getByLabelText('Instagram link').props.value).toBe('https://instagram.com.attacker.test/name');
    fireEvent.press(view.getByLabelText('Save page'));
    expect(view.getByText(/^Use .*Instagram link/)).toBeTruthy();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('keeps page errors and field drafts when switching tabs without leaking them into the price section', () => {
    const view = render(<PageEditorContent {...props()} />);
    fireEvent.changeText(view.getByLabelText('Display name'), 'Unsaved public name');
    fireEvent(view.getByLabelText('Show social links'), 'valueChange', true);
    fireEvent.changeText(view.getByLabelText('YouTube link'), 'https://youtube.com.attacker.test/channel');
    fireEvent.press(view.getByLabelText('Save page'));
    expect(view.getByText(/^Use .*YouTube link/)).toBeTruthy();
    tab(view, 'Your offer');
    expect(view.queryByText(/^Use .*YouTube link/)).toBeNull();
    fireEvent.changeText(view.getByLabelText('Website price in pesos'), '3200');
    tab(view, 'Sharing');
    tab(view, 'Page details');
    expect(view.getByLabelText('Display name').props.value).toBe('Unsaved public name');
    expect(view.getByLabelText('YouTube link').props.value).toBe('https://youtube.com.attacker.test/channel');
    expect(view.getByText(/^Use .*YouTube link/)).toBeTruthy();
  });

  it('returns to clean after optional empty fields are enabled, edited and cleared', () => {
    const view = render(<PageEditorContent {...props()} account={{ ...sampleAffiliate, affiliateMessage: '', affiliateSocialLinks: {} }} />);
    fireEvent(view.getByLabelText('Show a message'), 'valueChange', true);
    fireEvent.changeText(view.getByLabelText('Short message'), 'Temporary introduction');
    fireEvent.changeText(view.getByLabelText('Short message'), '');
    fireEvent(view.getByLabelText('Show social links'), 'valueChange', true);
    fireEvent.changeText(view.getByLabelText('TikTok link'), 'https://www.tiktok.com/@sam');
    fireEvent.changeText(view.getByLabelText('TikTok link'), '');
    expect(view.getByLabelText('Save page').props.accessibilityState.disabled).toBe(true);
    expect(view.queryByText('Unsaved changes.')).toBeNull();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('shares saved values until each independent section has been saved', async () => {
    const view = render(<PageEditorContent {...props()} />);
    fireEvent.changeText(view.getByLabelText('Display name'), 'Draft public name');
    tab(view, 'Your offer');
    fireEvent.changeText(view.getByLabelText('Website price in pesos'), '3500');
    tab(view, 'Sharing');
    expect(view.getByText('Saved sharing: Sam Santos / 3999')).toBeTruthy();
    expect(latestShare()).toMatchObject({ handle: 'sample-affiliate', displayName: 'Sam Santos', price: 3999, disabled: false });
    tab(view, 'Page details');
    fireEvent.press(view.getByLabelText('Save page'));
    await waitFor(() => expect(view.getByText('Page saved.')).toBeTruthy());
    tab(view, 'Sharing');
    expect(view.getByText('Saved sharing: Draft public name / 3999')).toBeTruthy();
    tab(view, 'Your offer');
    expect(view.getByLabelText('Website price in pesos').props.value).toBe('3500');
    fireEvent.press(view.getByLabelText('Save price'));
    await waitFor(() => expect(view.getByText('Price saved.')).toBeTruthy());
    tab(view, 'Sharing');
    expect(view.getByText('Saved sharing: Draft public name / 3500')).toBeTruthy();
  });
});

describe('public native preview parity', () => {
  it('lazily receives the real saved code and normalized public fields without private account data', () => {
    const account = { ...sampleAffiliate, clerkId: 'private-clerk-subject-123', email: 'private-account@example.com',
      referralCode: 'REAL-SAM-CODE', affiliatePhoto: 'https://pub-preview.r2.dev/sam.jpg',
      affiliateSocialLinks: { messenger: 'https://m.me/sam', instagram: 'https://www.instagram.com/sam' } };
    const view = render(<PageEditorContent {...props()} account={account} />);
    expect(mockPublicPreview).not.toHaveBeenCalled();
    showPreview(view);
    expect(view.getByTestId('public-page-preview')).toBeTruthy();
    expect(latestPreview()).toMatchObject({ dirty: false, paused: false, offline: false, sample: false,
      card: { handle: 'sample-affiliate', name: 'Sam Santos', code: 'REAL-SAM-CODE', price: 3999, listPrice: 4999, saving: 1000,
        photo: account.affiliatePhoto, message: sampleAffiliate.affiliateMessage, socialLinks: account.affiliateSocialLinks } });
    expect(Object.keys(latestPreview().card).sort()).toEqual(['code', 'handle', 'listPrice', 'message', 'name', 'percentOff', 'photo', 'price', 'saving', 'socialLinks'].sort());
    expect(JSON.stringify(latestPreview().card)).not.toContain(account.email);
    expect(JSON.stringify(latestPreview().card)).not.toContain(account.clerkId);
  });

  it('previews cleared optional fields and the draft price, then returns to the same editor draft', () => {
    const account = { ...sampleAffiliate, referralCode: 'SAVED-CODE', affiliatePhoto: 'https://pub-preview.r2.dev/sam.jpg',
      affiliateSocialLinks: { tiktok: 'https://www.tiktok.com/@sam' } };
    const view = render(<PageEditorContent {...props()} account={account} />);
    fireEvent.changeText(view.getByLabelText('Display name'), '');
    fireEvent(view.getByLabelText('Show my photo'), 'valueChange', false);
    fireEvent(view.getByLabelText('Show a message'), 'valueChange', false);
    fireEvent(view.getByLabelText('Show social links'), 'valueChange', false);
    tab(view, 'Your offer');
    fireEvent.changeText(view.getByLabelText('Website price in pesos'), '2999');
    showPreview(view);
    expect(latestPreview()).toMatchObject({ dirty: true, card: { name: 'Sam Santos', code: 'SAVED-CODE', photo: null, price: 2999, saving: 2000 } });
    expect(latestPreview().card.message).toBeUndefined();
    expect(latestPreview().card.socialLinks).toBeUndefined();
    showEditor(view);
    expect(view.getByLabelText('Website price in pesos').props.value).toBe('2999');
    tab(view, 'Page details');
    expect(view.getByLabelText('Display name').props.value).toBe('');
    for (const label of ['Show my photo', 'Show a message', 'Show social links']) expect(view.getByLabelText(label).props.value).toBe(false);
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockSavePrice).not.toHaveBeenCalled();
  });
});

describe('editor locks and save failures', () => {
  it.each(['admin preview', 'suspended', 'offline'] as const)('locks dirty fields, saves, photo and saved sharing for %s', condition => {
    const initial = { ...props(), account: { ...sampleAffiliate, affiliatePhoto: 'https://pub-preview.r2.dev/sam.jpg' } };
    const view = render(<PageEditorContent {...initial} />);
    fireEvent.changeText(view.getByLabelText('Display name'), 'Unsaved name');
    tab(view, 'Your offer');
    fireEvent.changeText(view.getByLabelText('Website price in pesos'), '3000');
    const locked = { ...initial, isPreview: condition === 'admin preview', isOffline: condition === 'offline',
      account: condition === 'suspended' ? { ...initial.account, status: 'suspended' as const } : initial.account };
    view.rerender(<PageEditorContent {...locked} />);
    expect(view.getByLabelText('Website price in pesos').props.editable).toBe(false);
    expect(view.getByLabelText('Save price').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(view.getByLabelText('Save price'));
    tab(view, 'Page details');
    expect(view.getByLabelText('Display name').props.editable).toBe(false);
    expect(view.getByLabelText('Show my photo').props.disabled).toBe(true);
    expect(view.getByLabelText('Change page photo').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(view.getByLabelText('Change page photo'));
    expect(view.getByLabelText('Save page').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(view.getByLabelText('Save page'));
    tab(view, 'Sharing');
    expect(latestShare().disabled).toBe(true);
    showPreview(view);
    expect(latestPreview()).toMatchObject({ paused: condition === 'suspended', sample: condition === 'admin preview', offline: condition === 'offline' });
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockSavePrice).not.toHaveBeenCalled();
    expect(mockPhoto).not.toHaveBeenCalled();
  });

  it('preserves the draft and sharing baseline after a failed asynchronous page save', async () => {
    let rejectSave!: (error: Error) => void;
    mockSave.mockReturnValueOnce(new Promise((_, reject) => { rejectSave = reject; }));
    const view = render(<PageEditorContent {...props()} />);
    fireEvent.changeText(view.getByLabelText('Display name'), 'Keep my unsaved draft');
    fireEvent.press(view.getByLabelText('Save page'));
    expect(view.getByLabelText('Display name').props.editable).toBe(false);
    fireEvent.press(view.getByLabelText('Save page'));
    expect(mockSave).toHaveBeenCalledTimes(1);
    await act(async () => { rejectSave(new Error('Network failure')); });
    await waitFor(() => expect(view.getByText('Your page was not saved. Please try again.')).toBeTruthy());
    expect(view.getByLabelText('Display name').props.value).toBe('Keep my unsaved draft');
    expect(view.getByLabelText('Save page').props.accessibilityState.disabled).toBe(false);
    tab(view, 'Sharing');
    expect(view.getByText('Saved sharing: Sam Santos / 3999')).toBeTruthy();
    tab(view, 'Page details');
    expect(view.getByText('Your page was not saved. Please try again.')).toBeTruthy();
  });

  it('preserves a failed price draft without changing the saved sharing price', async () => {
    mockSavePrice.mockRejectedValueOnce(new Error('Network failure'));
    const view = render(<PageEditorContent {...props()} />);
    tab(view, 'Your offer');
    fireEvent.changeText(view.getByLabelText('Website price in pesos'), '3200');
    fireEvent.press(view.getByLabelText('Save price'));
    await waitFor(() => expect(view.getByText('Your price was not saved. Please try again.')).toBeTruthy());
    expect(view.getByLabelText('Website price in pesos').props.value).toBe('3200');
    tab(view, 'Sharing');
    expect(latestShare().price).toBe(3999);
    tab(view, 'Your offer');
    expect(view.getByText('Your price was not saved. Please try again.')).toBeTruthy();
    expect(view.getByLabelText('Save price').props.accessibilityState.disabled).toBe(false);
  });
});

it('sends separate page and price mutations from the actual focused live wrapper', async () => {
  const view = render(<AffiliatePageEditorScreen />);
  tab(view, 'Your offer');
  fireEvent.changeText(view.getByLabelText('Website price in pesos'), '3200');
  fireEvent.press(view.getByLabelText('Save price'));
  await waitFor(() => expect(mockMutationSave).toHaveBeenCalledWith({ price: 3200 }));
  await waitFor(() => expect(view.getByText('Price saved.')).toBeTruthy());
  tab(view, 'Page details');
  fireEvent.changeText(view.getByLabelText('Display name'), 'Only my page fields');
  fireEvent.press(view.getByLabelText('Save page'));
  await waitFor(() => expect(mockMutationSave).toHaveBeenLastCalledWith({ photo: '', displayName: 'Only my page fields', message: sampleAffiliate.affiliateMessage, socialLinks: {} }));
  expect(mockMutationSave).toHaveBeenCalledTimes(2);
  expect(mockMutation).toHaveBeenCalledWith('affiliates:updatePage');
});
