import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { AffiliatePageEditorScreen, PageEditorContent } from '../components/affiliate/PageEditor';
import { AffiliateOfferScreen } from '../components/affiliate/Offer';
import { CREATOR_CODE_PRICE } from '../../../packages/shared/pricing';
import { sampleAffiliate } from '../components/affiliate/model';
import type { CreatorCard } from '../../../lib/v2/creatorTypes';

const mockSave = jest.fn();
const mockPhoto = jest.fn();
const mockMutationSave = jest.fn();
const mockMutation = jest.fn();
const mockAction = jest.fn();
const mockPublicPreview = jest.fn();
const mockSharing = jest.fn();
const mockCodeEditor = jest.fn();
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
jest.mock('../components/affiliate/CreatorCodeEditor', () => ({ CreatorCodeEditor: (props: unknown) => {
  mockCodeEditor(props);
  return require('react').createElement(require('react-native').Text, null, 'Choose your creator code');
} }));
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
  ShareTools: (props: { handle: string; displayName: string; photo?: string; referralCode?: string; price: number; disabled?: boolean }) => {
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
    onSave: mockSave, onPhoto: mockPhoto };
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
  return mockSharing.mock.calls.at(-1)![0] as { handle: string; displayName: string; photo?: string; referralCode?: string; price: number; disabled?: boolean };
}
function latestPreview() {
  return mockPublicPreview.mock.calls.at(-1)![0] as { card: CreatorCard; dirty: boolean; paused: boolean; offline: boolean; sample: boolean };
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockAccess, { account: sampleAffiliate, isPreview: false, isOffline: false, isAuthenticated: true });
  mockSave.mockReset().mockResolvedValue(undefined);
  mockMutationSave.mockReset().mockResolvedValue(undefined);
  mockPhoto.mockReset().mockResolvedValue(undefined);
});

describe('fixed native creator offer and profile editor', () => {
  it('keeps page details and sharing reachable while the offer has no price input or save action', () => {
    const view = render(<PageEditorContent {...props()} account={{ ...sampleAffiliate, affiliatePrice: 2661 }} />);
    expect(view.getByLabelText('Display name').props.value).toBe(sampleAffiliate.affiliateDisplayName);
    for (const label of ['Show my photo', 'Show a message', 'Show social links']) expect(view.getByLabelText(label)).toBeTruthy();
    tab(view, 'Your offer');
    expect(view.getByText('₱3,499')).toBeTruthy();
    expect(view.getByText('₱1,500')).toBeTruthy();
    expect(view.getByText('₱1,750')).toBeTruthy();
    expect(view.getByText('30% off')).toBeTruthy();
    expect(view.queryByLabelText('Website price in pesos')).toBeNull();
    expect(view.queryByLabelText('Save price')).toBeNull();
    expect(view.queryByLabelText('Save page')).toBeNull();
    tab(view, 'Sharing');
    expect(latestShare()).toMatchObject({ handle: sampleAffiliate.affiliateHandle, price: CREATOR_CODE_PRICE, referralCode: sampleAffiliate.referralCode });
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('saves only normalized profile fields and never writes a legacy custom price', async () => {
    const view = render(<PageEditorContent {...props()} account={{ ...sampleAffiliate, affiliatePrice: 999 }} />);
    fireEvent.changeText(view.getByLabelText('Display name'), '  New public name  ');
    fireEvent.press(view.getByLabelText('Save page'));
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith({ photo: '', displayName: 'New public name', message: sampleAffiliate.affiliateMessage, socialLinks: {} }));
    expect(mockSave.mock.calls[0][0]).not.toHaveProperty('price');
    await waitFor(() => expect(view.getByText('Page saved.')).toBeTruthy());
    tab(view, 'Sharing');
    expect(latestShare()).toMatchObject({ displayName: 'New public name', price: CREATOR_CODE_PRICE });
  });

  it('keeps invalid social drafts and errors when visiting the read-only offer', () => {
    const view = render(<PageEditorContent {...props()} />);
    fireEvent.changeText(view.getByLabelText('Display name'), 'Unsaved public name');
    fireEvent(view.getByLabelText('Show social links'), 'valueChange', true);
    fireEvent.changeText(view.getByLabelText('YouTube link'), 'https://youtube.com.attacker.test/channel');
    fireEvent.press(view.getByLabelText('Save page'));
    expect(view.getByText(/^Use .*YouTube link/)).toBeTruthy();
    tab(view, 'Your offer');
    expect(view.queryByText(/^Use .*YouTube link/)).toBeNull();
    expect(view.queryByLabelText('Save price')).toBeNull();
    tab(view, 'Sharing');
    tab(view, 'Page details');
    expect(view.getByLabelText('Display name').props.value).toBe('Unsaved public name');
    expect(view.getByLabelText('YouTube link').props.value).toBe('https://youtube.com.attacker.test/channel');
    expect(view.getByText(/^Use .*YouTube link/)).toBeTruthy();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('returns to clean after optional fields are edited and cleared', () => {
    const view = render(<PageEditorContent {...props()} account={{ ...sampleAffiliate, affiliateMessage: '', affiliateSocialLinks: {} }} />);
    fireEvent(view.getByLabelText('Show a message'), 'valueChange', true);
    fireEvent.changeText(view.getByLabelText('Short message'), 'Temporary introduction');
    fireEvent.changeText(view.getByLabelText('Short message'), '');
    fireEvent(view.getByLabelText('Show social links'), 'valueChange', true);
    fireEvent.changeText(view.getByLabelText('TikTok link'), 'https://www.tiktok.com/@sam');
    fireEvent.changeText(view.getByLabelText('TikTok link'), '');
    expect(view.getByLabelText('Save page').props.accessibilityState.disabled).toBe(true);
    expect(view.queryByText('Unsaved changes.')).toBeNull();
  });

  it('shares the saved photo and name until the profile save completes, always with the fixed offer', async () => {
    const photo = 'https://pub-preview.r2.dev/saved.jpg';
    const changedPhoto = 'https://pub-preview.r2.dev/changed.jpg';
    mockPhoto.mockResolvedValueOnce(changedPhoto);
    const view = render(<PageEditorContent {...props()} account={{ ...sampleAffiliate, affiliatePhoto: photo, affiliatePrice: 4999 }} />);
    fireEvent.changeText(view.getByLabelText('Display name'), 'Draft public name');
    fireEvent.press(view.getByLabelText('Change page photo'));
    await waitFor(() => expect(mockPhoto).toHaveBeenCalledTimes(1));
    tab(view, 'Sharing');
    expect(latestShare()).toMatchObject({ displayName: 'Sam Santos', photo, price: CREATOR_CODE_PRICE, referralCode: sampleAffiliate.referralCode });
    tab(view, 'Page details');
    fireEvent.press(view.getByLabelText('Save page'));
    await waitFor(() => expect(view.getByText('Page saved.')).toBeTruthy());
    tab(view, 'Sharing');
    expect(latestShare()).toMatchObject({ displayName: 'Draft public name', photo: changedPhoto, price: CREATOR_CODE_PRICE });
  });

  it('preserves an unsaved profile when a legacy account price or balance changes', () => {
    const initial = { ...sampleAffiliate, affiliatePrice: 999 };
    const view = render(<PageEditorContent {...props()} account={initial} />);
    fireEvent.changeText(view.getByLabelText('Display name'), 'Keep this profile draft');
    view.rerender(<PageEditorContent {...props()} account={{ ...initial, affiliatePrice: 4999, balance: 9000 }} />);
    expect(view.getByLabelText('Display name').props.value).toBe('Keep this profile draft');
    showPreview(view);
    expect(latestPreview()).toMatchObject({ dirty: true, card: { name: 'Keep this profile draft', price: CREATOR_CODE_PRICE, saving: 1500, percentOff: 30 } });
    showEditor(view);
    expect(view.getByLabelText('Display name').props.value).toBe('Keep this profile draft');
  });
});

describe('native public preview and access', () => {
  it('previews the actual creator code with a fixed offer and excludes private account fields', () => {
    const account = { ...sampleAffiliate, affiliatePrice: 2661, clerkId: 'private-clerk-subject-123', email: 'private-account@example.com',
      referralCode: 'REAL-SAM-CODE', affiliatePhoto: 'https://pub-preview.r2.dev/sam.jpg',
      affiliateSocialLinks: { messenger: 'https://m.me/sam', instagram: 'https://www.instagram.com/sam' } };
    const view = render(<PageEditorContent {...props()} account={account} />);
    expect(mockPublicPreview).not.toHaveBeenCalled();
    showPreview(view);
    expect(latestPreview()).toMatchObject({ dirty: false, card: { handle: 'sample-affiliate', name: 'Sam Santos', code: 'REAL-SAM-CODE',
      price: CREATOR_CODE_PRICE, listPrice: 4999, saving: 1500, photo: account.affiliatePhoto, message: sampleAffiliate.affiliateMessage, socialLinks: account.affiliateSocialLinks } });
    expect(JSON.stringify(latestPreview().card)).not.toContain(account.email);
    expect(JSON.stringify(latestPreview().card)).not.toContain(account.clerkId);
  });

  it('preserves optional field clearing through preview and restores stashed drafts when toggled back on', () => {
    const photo = 'https://pub-preview.r2.dev/sam.jpg';
    const view = render(<PageEditorContent {...props()} account={{ ...sampleAffiliate, affiliatePhoto: photo,
      affiliateSocialLinks: { tiktok: 'https://www.tiktok.com/@sam' } }} />);
    fireEvent(view.getByLabelText('Show my photo'), 'valueChange', false);
    fireEvent(view.getByLabelText('Show a message'), 'valueChange', false);
    fireEvent(view.getByLabelText('Show social links'), 'valueChange', false);
    showPreview(view);
    expect(latestPreview()).toMatchObject({ dirty: true, card: { photo: null, price: CREATOR_CODE_PRICE } });
    expect(latestPreview().card.message).toBeUndefined();
    expect(latestPreview().card.socialLinks).toBeUndefined();
    showEditor(view);
    for (const label of ['Show my photo', 'Show a message', 'Show social links']) fireEvent(view.getByLabelText(label), 'valueChange', true);
    expect(view.getByLabelText('Short message').props.value).toBe(sampleAffiliate.affiliateMessage);
    expect(view.getByLabelText('TikTok link').props.value).toBe('https://www.tiktok.com/@sam');
    expect(view.getByLabelText('Save page').props.accessibilityState.disabled).toBe(true);
  });

  it.each(['admin preview', 'suspended', 'offline'] as const)('keeps profile writes and sharing locked for %s', condition => {
    const initial = { ...props(), account: { ...sampleAffiliate, affiliatePhoto: 'https://pub-preview.r2.dev/sam.jpg' } };
    const view = render(<PageEditorContent {...initial} />);
    fireEvent.changeText(view.getByLabelText('Display name'), 'Unsaved name');
    const locked = { ...initial, isPreview: condition === 'admin preview', isOffline: condition === 'offline',
      account: condition === 'suspended' ? { ...initial.account, status: 'suspended' as const } : initial.account };
    view.rerender(<PageEditorContent {...locked} />);
    expect(view.getByLabelText('Display name').props.editable).toBe(false);
    expect(view.getByLabelText('Save page').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(view.getByLabelText('Save page'));
    fireEvent.press(view.getByLabelText('Change page photo'));
    tab(view, 'Sharing');
    expect(latestShare().disabled).toBe(true);
    showPreview(view);
    expect(latestPreview()).toMatchObject({ paused: condition === 'suspended', sample: condition === 'admin preview', offline: condition === 'offline' });
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockPhoto).not.toHaveBeenCalled();
  });

  it('keeps a failed profile draft and the previous sharing baseline', async () => {
    mockSave.mockRejectedValueOnce(new Error('Network failure'));
    const view = render(<PageEditorContent {...props()} />);
    fireEvent.changeText(view.getByLabelText('Display name'), 'Keep my unsaved draft');
    fireEvent.press(view.getByLabelText('Save page'));
    await waitFor(() => expect(view.getByText('Your page was not saved. Please try again.')).toBeTruthy());
    tab(view, 'Sharing');
    expect(latestShare()).toMatchObject({ displayName: 'Sam Santos', price: CREATOR_CODE_PRICE });
    tab(view, 'Page details');
    expect(view.getByLabelText('Display name').props.value).toBe('Keep my unsaved draft');
    expect(view.getByText('Your page was not saved. Please try again.')).toBeTruthy();
  });
});

it('uses the live page mutation only for profile changes, never for visiting the fixed offer', async () => {
  const view = render(<AffiliatePageEditorScreen />);
  tab(view, 'Your offer');
  expect(view.queryByLabelText('Save price')).toBeNull();
  expect(mockCodeEditor).toHaveBeenCalledWith({ accountId: sampleAffiliate._id, savedCode: sampleAffiliate.referralCode, offline: false });
  expect(mockMutationSave).not.toHaveBeenCalled();
  tab(view, 'Page details');
  fireEvent.changeText(view.getByLabelText('Display name'), 'Live profile name');
  fireEvent.press(view.getByLabelText('Save page'));
  await waitFor(() => expect(mockMutationSave).toHaveBeenCalledWith({ photo: '', displayName: 'Live profile name', message: sampleAffiliate.affiliateMessage, socialLinks: {} }));
  expect(mockMutationSave.mock.calls[0][0]).not.toHaveProperty('price');
});

it.each([999, 2661, 4999])('shows a read-only offer for a legacy saved price of %s without mounting mutation hooks', legacyPrice => {
  mockAccess.account = { ...sampleAffiliate, affiliatePrice: legacyPrice };
  const view = render(<AffiliateOfferScreen />);
  expect(view.getByText('₱3,499')).toBeTruthy();
  expect(view.getByText('₱1,500')).toBeTruthy();
  expect(view.getByText('₱1,750')).toBeTruthy();
  expect(view.getByText('30% off')).toBeTruthy();
  expect(view.queryByLabelText('Website price in pesos')).toBeNull();
  expect(view.queryByLabelText('Save price')).toBeNull();
  expect(mockMutation).not.toHaveBeenCalled();
  expect(mockAction).not.toHaveBeenCalled();
});
