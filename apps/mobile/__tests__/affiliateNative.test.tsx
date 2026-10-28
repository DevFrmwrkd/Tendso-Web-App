import React from 'react';
import { Share } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AffiliateHomeScreen, HomeContent } from '../components/affiliate/Home';
import { AffiliateAgentsScreen, AgentsContent } from '../components/affiliate/Agents';
import { AffiliatePageScreen } from '../components/affiliate/PageEditor';
import { AffiliateSalesScreen } from '../components/affiliate/Sales';
import { affiliateDraft, affiliatePagePayload, sampleAffiliate, samplePortal } from '../components/affiliate/model';
import { commissionFor, creatorDiscount, WEBSITE_PRICE } from '../../../packages/shared/pricing';

const mockAccount = {
  account: sampleAffiliate, isLoading: false, isAuthenticated: true, isOffline: false,
  isAdmin: false, view: 'affiliate', isPreview: false,
};
const mockQuery = jest.fn();
const mockPaginated = jest.fn();
const mockMutation = jest.fn();
const mockSave = jest.fn();
const mockAction = jest.fn();

jest.mock('@clerk/clerk-expo', () => ({ useClerk: () => ({ signOut: jest.fn() }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('../hooks/useMobileAccount', () => ({ useMobileAccount: () => mockAccount }));
jest.mock('../hooks/useDeleteAccount', () => ({ useDeleteAccount: () => ({ busy: false, canDelete: true, requestDelete: jest.fn() }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@tendso/convex-client', () => ({ api: { affiliates: { portal: 'affiliates:portal', sales: 'affiliates:sales', updatePage: 'affiliates:updatePage' }, r2: { generateUploadUrl: 'r2:generateUploadUrl' } } }));
jest.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => mockQuery(...args),
  usePaginatedQuery: (...args: unknown[]) => mockPaginated(...args),
  useMutation: (...args: unknown[]) => { mockMutation(...args); return mockSave; },
  useAction: (...args: unknown[]) => { mockAction(...args); return jest.fn(); },
}));
jest.mock('../components/affiliate/ShareTools', () => ({
  ShareTools: ({ price }: { price: number }) => { const makeElement = require('react').createElement; const { Text } = require('react-native'); return makeElement(Text, null, `Saved share price: ${price}`); },
  CopyButton: () => null,
}));
jest.mock('../components/PriceSlider', () => ({ PriceSlider: () => null }));
jest.mock('../components/ui/primitives', () => {
  const makeElement = require('react').createElement;
  const { View, Text, Pressable } = require('react-native');
  const text = ({ children, testID }: { children: React.ReactNode; testID?: string }) => makeElement(Text, { testID }, children);
  return { Body: text, Display: text, Label: text,
    Card: ({ children }: { children: React.ReactNode }) => makeElement(View, null, children),
    Door: ({ label, disabled, loading, onPress }: { label: string; disabled?: boolean; loading?: boolean; onPress?: () => void }) => makeElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: label, accessibilityState: { disabled: !!disabled || !!loading }, disabled: disabled || loading, onPress }, makeElement(Text, null, label)),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockAccount, { account: sampleAffiliate, isLoading: false, isAuthenticated: true, isOffline: false, isAdmin: false, view: 'affiliate', isPreview: false });
  mockQuery.mockReturnValue(samplePortal);
  mockPaginated.mockReturnValue({ results: [], status: 'Exhausted', loadMore: jest.fn() });
  mockSave.mockResolvedValue(undefined);
});

describe('native affiliate access and live data', () => {
  it('keeps admin affiliate previews off every affiliate-only hook', () => {
    Object.assign(mockAccount, { account: { ...sampleAffiliate, role: 'admin' }, isAdmin: true, isPreview: true });
    const home = render(<AffiliateHomeScreen />);
    expect(home.getByText(/Admin preview/)).toBeTruthy();
    expect(home.getByText('₱2,500')).toBeTruthy();
    home.unmount();
    const sales = render(<AffiliateSalesScreen />);
    expect(sales.getByText('Sample barbershop')).toBeTruthy();
    sales.unmount();
    const page = render(<AffiliatePageScreen />);
    expect(page.getByLabelText('Display name').props.editable).toBe(false);
    expect(page.getByLabelText('Save page and price').props.accessibilityState.disabled).toBe(true);
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockPaginated).not.toHaveBeenCalled();
    expect(mockMutation).not.toHaveBeenCalled();
    expect(mockAction).not.toHaveBeenCalled();
    page.unmount();
    const agents = render(<AffiliateAgentsScreen />);
    expect(agents.getByText('Bea Reyes')).toBeTruthy();
    expect(mockQuery).not.toHaveBeenCalled();
    agents.unmount();
  });

  it('shows actual zero totals and keeps missing totals loading', () => {
    const props = { account: sampleAffiliate, isPreview: false, isOffline: false, isAuthenticated: true };
    const zeroPortal = { ...samplePortal, income: { directThisMonth: 0, teamThisMonth: 0, totalThisMonth: 0 } };
    const view = render(<HomeContent {...props} portal={zeroPortal} />);
    expect(view.getAllByText('₱0')).toHaveLength(2);
    view.rerender(<HomeContent {...props} portal={undefined} />);
    expect(view.queryByText('₱0')).toBeNull();
    expect(view.getAllByText('Loading…')).toHaveLength(2);
  });

  it('shows team commissions alongside earlier one-time referral bonuses', () => {
    const portal = { ...samplePortal,
      recruits: [{ _id: 'new-agent' as typeof sampleAffiliate._id, referredName: 'New Team Agent', createdAt: Date.UTC(2026, 9, 22), endsAt: Date.UTC(2027, 9, 22), earning: true, totalEarned: 250 }],
      recruitStats: { total: 1, earning: 1, totalEarned: 250 },
    };
    const view = render(<AgentsContent account={sampleAffiliate} isPreview={false} isOffline={false} isAuthenticated portal={portal} />);
    expect(view.getByText('New Team Agent')).toBeTruthy();
    expect(view.getByText('My agents')).toBeTruthy();
    expect(view.getByText(/credited 5% share this month/)).toBeTruthy();
    expect(view.getByText('Earlier ₱1,000 referrals · 1')).toBeTruthy();
    expect(view.getByText('Alex Reyes')).toBeTruthy();
  });

  it('separates real monthly link and team income from the available balance', () => {
    const portal = { ...samplePortal, income: { directThisMonth: 6000, teamThisMonth: 450, totalThisMonth: 6450 } };
    const view = render(<HomeContent account={sampleAffiliate} isPreview={false} isOffline={false} isAuthenticated portal={portal} />);
    expect(view.getByLabelText('From your link, ₱6,000')).toBeTruthy();
    expect(view.getByLabelText('From your agents, ₱450')).toBeTruthy();
    expect(view.queryByText('₱2,500')).toBeNull();
    expect(view.getByText('October 2026')).toBeTruthy();
  });

  it('paginates every recruited agent without hiding their current-month credit', () => {
    const recruits = Array.from({ length: 6 }, (_, index) => ({ ...samplePortal.recruits[0], _id: `agent-${index}` as typeof sampleAffiliate._id,
      referredName: `Agent ${index + 1}`, monthEarned: (index + 1) * 50 }));
    const view = render(<AgentsContent account={sampleAffiliate} isPreview={false} isOffline={false} isAuthenticated portal={{ ...samplePortal, recruits }} />);
    expect(view.getByText('Agent 1')).toBeTruthy();
    expect(view.getByText('Agent 4')).toBeTruthy();
    expect(view.queryByText('Agent 5')).toBeNull();
    expect(view.getByLabelText('Agent 1, 12 of 12 months remaining')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Next agents'));
    expect(view.getByText('Agent 5')).toBeTruthy();
    expect(view.getByText('₱250')).toBeTruthy();
    expect(view.queryByText('Agent 1')).toBeNull();
    fireEvent.press(view.getByLabelText('Previous agents'));
    expect(view.getByText('Agent 1')).toBeTruthy();
  });

  it('shares only the creator’s saved link and prevents suspended/preview sharing', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    const props = { account: sampleAffiliate, isPreview: false, isOffline: false, isAuthenticated: true, portal: samplePortal };
    const view = render(<HomeContent {...props} />);
    fireEvent.press(view.getByLabelText('Share my link'));
    await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://tendso.com/v2/a/sample-affiliate' })));
    view.rerender(<HomeContent {...props} account={{ ...sampleAffiliate, status: 'suspended' }} />);
    expect(view.getByLabelText('Share my link').props.accessibilityState.disabled).toBe(true);
    view.rerender(<HomeContent {...props} isPreview />);
    expect(view.getByLabelText('Share my link').props.accessibilityState.disabled).toBe(true);
    share.mockRestore();
  });

  it('keeps suspended pages read-only without mounting write hooks', () => {
    mockAccount.account = { ...sampleAffiliate, status: 'suspended' };
    const view = render(<AffiliatePageScreen />);
    expect(view.getByLabelText('Website price in pesos').props.editable).toBe(false);
    expect(view.getByText(/account is suspended/)).toBeTruthy();
    expect(mockMutation).not.toHaveBeenCalled();
    expect(mockAction).not.toHaveBeenCalled();
  });

  it('paginates only the signed-in affiliate sales with frozen amounts', () => {
    const loadMore = jest.fn();
    mockPaginated.mockReturnValue({ results: [{ _id: 'sale', businessName: 'A real shop', price: 999, commission: 500, status: 'paid', createdAt: 1000 }], status: 'CanLoadMore', loadMore });
    const view = render(<AffiliateSalesScreen />);
    expect(mockPaginated).toHaveBeenCalledWith('affiliates:sales', {}, { initialNumItems: 10 });
    expect(view.getByText('₱999')).toBeTruthy();
    expect(view.getByText('+₱500')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Show more sales'));
    expect(loadMore).toHaveBeenCalledWith(10);
  });

  it('saves only normalized page settings and preserves unsaved edits during account updates', async () => {
    const view = render(<AffiliatePageScreen />);
    fireEvent.changeText(view.getByLabelText('Display name'), '  My shop offer  ');
    fireEvent.changeText(view.getByLabelText('Website price in pesos'), '998');
    expect(view.getByText('Saved share price: 3999')).toBeTruthy();
    mockAccount.account = { ...sampleAffiliate, balance: 9000 };
    view.rerender(<AffiliatePageScreen />);
    expect(view.getByLabelText('Display name').props.value).toBe('  My shop offer  ');
    fireEvent.press(view.getByLabelText('Save page and price'));
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith({ photo: '', displayName: 'My shop offer', message: sampleAffiliate.affiliateMessage, socialLink: '', price: 999 }));
    expect(view.getByText('Page and price saved.')).toBeTruthy();
    expect(view.getByText('Saved share price: 999')).toBeTruthy();
  });
});

describe('native affiliate pricing and page validation', () => {
  it('shares rounded/clamped prices and commission/discount rules with the web', () => {
    const draft = affiliateDraft(sampleAffiliate);
    expect(affiliatePagePayload({ ...draft, price: '4999.7' }).price).toBe(4999);
    expect(affiliatePagePayload({ ...draft, price: '1' }).price).toBe(999);
    expect(affiliatePagePayload({ ...draft, price: '3999.4' }).price).toBe(3999);
    expect(commissionFor(999)).toBe(500);
    expect(creatorDiscount(4999, WEBSITE_PRICE)).toBeNull();
    expect(creatorDiscount(3999, WEBSITE_PRICE)?.percentOff).toBe(20);
  });

  it('rejects nonfinite/empty prices, oversized messages, and social lookalikes', () => {
    const draft = affiliateDraft(sampleAffiliate);
    for (const price of ['', 'NaN', 'Infinity']) expect(() => affiliatePagePayload({ ...draft, price })).toThrow();
    expect(() => affiliatePagePayload({ ...draft, message: 'x'.repeat(201) })).toThrow(/200/);
    expect(() => affiliatePagePayload({ ...draft, socialLink: 'https://facebook.com.attacker.test/name' })).toThrow(/Facebook/);
    expect(affiliatePagePayload({ ...draft, message: 'x'.repeat(200), socialLink: 'https://m.me/my-page' }).socialLink).toBe('https://m.me/my-page');
  });
});
