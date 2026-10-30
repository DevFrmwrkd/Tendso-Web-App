import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AffiliatePageEditorScreen } from '../components/affiliate/PageEditor';
import { AffiliateSocialButtons } from '../components/affiliate/Offer';
import { affiliateDraft, affiliatePagePayload, sampleAffiliate } from '../components/affiliate/model';
import type { AffiliateSocialLinks } from '../../../lib/affiliates';

const mockAccess = { account: sampleAffiliate, isPreview: false, isOffline: false, isAuthenticated: true };
const mockSave = jest.fn();
const mockMutation = jest.fn();
const mockAction = jest.fn();
const mockRouter = { push: jest.fn(), canGoBack: jest.fn(), back: jest.fn(), replace: jest.fn() };

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('@tendso/convex-client', () => ({ api: { affiliates: { updatePage: 'affiliates:updatePage' }, r2: { generateUploadUrl: 'r2:generateUploadUrl' } } }));
jest.mock('convex/react', () => ({
  useMutation: (...args: unknown[]) => { mockMutation(...args); return mockSave; },
  useAction: (...args: unknown[]) => { mockAction(...args); return jest.fn(); },
}));
jest.mock('../components/affiliate/Screen', () => ({
  AffiliateAccess: ({ children }: { children: (props: typeof mockAccess) => React.ReactNode }) => children(mockAccess),
  Notice: require('react-native').Text,
}));
jest.mock('../components/PriceSlider', () => ({ PriceSlider: () => null }));
jest.mock('../components/affiliate/ShareTools', () => ({ CopyButton: () => null, ShareTools: () => null }));

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockAccess, { account: sampleAffiliate, isPreview: false, isOffline: false, isAuthenticated: true });
  mockSave.mockResolvedValue(undefined);
  mockRouter.canGoBack.mockReturnValue(true);
});

it('recovers saved legacy profiles and respects an explicitly cleared canonical map', () => {
  expect(affiliateDraft({ ...sampleAffiliate, affiliateSocialLink: ' https://m.me/sam ' }).socialLinks).toEqual({ messenger: 'https://m.me/sam' });
  expect(affiliateDraft({ ...sampleAffiliate, affiliateSocialLink: 'https://www.facebook.com/sam' }).socialLinks).toEqual({ facebook: 'https://www.facebook.com/sam' });
  expect(affiliateDraft({ ...sampleAffiliate, affiliateSocialLink: 'https://m.me/sam', affiliateSocialLinks: {} }).socialLinks).toEqual({});
  expect(affiliateDraft({ ...sampleAffiliate, affiliateSocialLink: 'https://m.me/sam', affiliateSocialLinks: { tiktok: 'https://www.tiktok.com/@sam' } }).socialLinks).toEqual({ tiktok: 'https://www.tiktok.com/@sam' });
});

it('normalizes multiple profiles without accepting unsafe or mismatched platform links', () => {
  const draft = affiliateDraft(sampleAffiliate);
  const socialLinks: AffiliateSocialLinks = { messenger: ' https://m.me/sam ', instagram: '', tiktok: ' https://www.tiktok.com/@sam ', youtube: 'https://www.youtube.com/@sam' };
  expect(affiliatePagePayload({ ...draft, socialLinks }).socialLinks).toEqual({ messenger: 'https://m.me/sam', tiktok: 'https://www.tiktok.com/@sam', youtube: 'https://www.youtube.com/@sam' });
  for (const invalid of ['https://tiktok.com.attacker.test/@sam', 'https://attacker@www.tiktok.com/@sam', 'http://www.tiktok.com/@sam', 'https://www.instagram.com/sam', 'https://www.tiktok.com:8443/@sam']) {
    expect(() => affiliatePagePayload({ ...draft, socialLinks: { tiktok: invalid } })).toThrow(/TikTok/);
  }
});

it('saves multiple optional profiles, restores toggled drafts and explicitly clears every link', async () => {
  mockAccess.account = { ...sampleAffiliate, affiliateSocialLink: 'https://m.me/sam' };
  const view = render(<AffiliatePageEditorScreen />);
  expect(view.getByLabelText('Messenger link').props.value).toBe('https://m.me/sam');
  fireEvent.changeText(view.getByLabelText('TikTok link'), ' https://www.tiktok.com/@sam ');
  fireEvent.changeText(view.getByLabelText('YouTube link'), 'https://www.youtube.com/@sam');
  fireEvent.press(view.getByLabelText('Save page'));
  await waitFor(() => expect(mockSave).toHaveBeenLastCalledWith({ photo: '', displayName: 'Sam Santos', message: sampleAffiliate.affiliateMessage, socialLinks: { messenger: 'https://m.me/sam', tiktok: 'https://www.tiktok.com/@sam', youtube: 'https://www.youtube.com/@sam' } }));
  fireEvent(view.getByLabelText('Show social links'), 'valueChange', false);
  expect(view.queryByLabelText('TikTok link')).toBeNull();
  fireEvent(view.getByLabelText('Show social links'), 'valueChange', true);
  expect(view.getByLabelText('TikTok link').props.value).toBe('https://www.tiktok.com/@sam');
  fireEvent(view.getByLabelText('Show social links'), 'valueChange', false);
  fireEvent.press(view.getByLabelText('Save page'));
  await waitFor(() => expect(mockSave).toHaveBeenLastCalledWith({ photo: '', displayName: 'Sam Santos', message: sampleAffiliate.affiliateMessage, socialLinks: {} }));
});

it('keeps invalid social drafts unsaved and preserves them through unrelated account updates', async () => {
  const view = render(<AffiliatePageEditorScreen />);
  fireEvent(view.getByLabelText('Show social links'), 'valueChange', true);
  fireEvent.changeText(view.getByLabelText('Instagram link'), 'https://instagram.com.attacker.test/sam');
  mockAccess.account = { ...sampleAffiliate, balance: 9000 };
  view.rerender(<AffiliatePageEditorScreen />);
  expect(view.getByLabelText('Instagram link').props.value).toBe('https://instagram.com.attacker.test/sam');
  fireEvent.press(view.getByLabelText('Save page'));
  await waitFor(() => expect(view.getByText(/^Use .*Instagram link/)).toBeTruthy());
  expect(mockSave).not.toHaveBeenCalled();
});

it('shows separate saved platform buttons and prevents disabled navigation', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const socialLinks = { messenger: 'https://m.me/sam', tiktok: 'https://www.tiktok.com/@sam' };
  const view = render(<AffiliateSocialButtons socialLinks={socialLinks} />);
  expect(view.getByRole('button', { name: 'Messenger' })).toBeTruthy();
  expect(view.getByRole('button', { name: 'TikTok' })).toBeTruthy();
  expect(view.queryByText(/Message on TikTok/)).toBeNull();
  fireEvent.press(view.getByRole('button', { name: 'TikTok' }));
  await waitFor(() => expect(open).toHaveBeenCalledWith('https://www.tiktok.com/@sam'));
  view.rerender(<AffiliateSocialButtons socialLinks={socialLinks} disabled />);
  expect(view.getByRole('button', { name: 'TikTok' }).props.accessibilityState.disabled).toBe(true);
  open.mockClear();
  fireEvent.press(view.getByRole('button', { name: 'TikTok' }));
  expect(open).not.toHaveBeenCalled();
  open.mockRestore();
});
it('omits invalid profile buttons and never resurrects legacy links after a canonical clear', () => {
  const view = render(<AffiliateSocialButtons socialLinks={{ instagram: 'https://instagram.com.attacker.test/sam', youtube: 'https://www.youtube.com/@sam' }} socialLink="https://m.me/sam" />);
  expect(view.queryByRole('button', { name: 'Instagram' })).toBeNull();
  expect(view.queryByRole('button', { name: 'Messenger' })).toBeNull();
  expect(view.getByRole('button', { name: 'YouTube' })).toBeTruthy();
  view.rerender(<AffiliateSocialButtons socialLinks={{}} socialLink="https://m.me/sam" />);
  expect(view.queryByRole('button')).toBeNull();
});

it('locks every optional profile field without mounting preview write hooks', () => {
  mockAccess.account = { ...sampleAffiliate, affiliateSocialLinks: { instagram: 'https://www.instagram.com/sam' } };
  mockAccess.isPreview = true;
  const view = render(<AffiliatePageEditorScreen />);
  expect(view.getByLabelText('Instagram link').props.editable).toBe(false);
  expect(view.getByLabelText('Show social links').props.disabled).toBe(true);
  expect(view.getByLabelText('Save page').props.accessibilityState.disabled).toBe(true);
  expect(mockMutation).not.toHaveBeenCalled();
  expect(mockAction).not.toHaveBeenCalled();
});
