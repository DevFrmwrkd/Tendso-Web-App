import React from 'react';
import * as ReactNative from 'react-native';
import { Share } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { AffiliateHomeScreen, HomeContent } from '../components/affiliate/Home';
import { AffiliateAgentDetailScreen, AgentDetailContent } from '../components/affiliate/AgentDetail';
import { sampleAffiliate, samplePortal, type AffiliatePortal } from '../components/affiliate/model';
import { radius } from '../theme/v2';

const mockPush = jest.fn();
const mockQuery = jest.fn();
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }) }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('convex/react', () => ({ useQuery: (...args: unknown[]) => mockQuery(...args) }));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => ({ push: mockPush }) }));
jest.mock('../components/affiliate/ShareTools', () => ({ CopyButton: () => null }));
jest.mock('../components/affiliate/Screen', () => ({
  AffiliateAccess: ({ children }: { children: (props: unknown) => React.ReactNode }) => children({ account: require('../components/affiliate/model').sampleAffiliate, isAuthenticated: true, isPreview: false, isOffline: false }),
  AffiliateFrame: ({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) => require('react').createElement(require('react-native').View, null, children, footer),
  AffiliateLoading: ({ label }: { label: string }) => require('react').createElement(require('react-native').Text, null, label),
}));
jest.mock('../components/affiliate/AffiliateToolFrame', () => ({
  AffiliateToolFrame: ({ children }: { children: React.ReactNode }) => require('react').createElement(require('react-native').View, null, children),
}));

const access = { account: sampleAffiliate, isPreview: false, isOffline: false, isAuthenticated: true };
beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  // Motion preference transitions are covered in press-feedback.test; keep this
  // screen's loading/data assertions independent of asynchronous system events.
  jest.spyOn(ReactNative.AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise(() => {}));
  jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
  jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 9, 29));
  mockQuery.mockReturnValue(samplePortal);
  jest.mocked(Clipboard.setStringAsync).mockReset().mockResolvedValue(undefined);
});

it('shows the credited monthly total and real source amounts separately from available money', () => {
  const result = render(<HomeContent {...access} portal={{ ...samplePortal, month: { ...samplePortal.month, label: '2026-10' } }} />);
  expect(result.getByLabelText('October 2026 earnings, ₱2,750')).toBeTruthy();
  expect(result.getByLabelText('From your link, ₱2,500')).toBeTruthy();
  expect(result.getByLabelText('From your agents, ₱250')).toBeTruthy();
  expect(result.getByText('Paid website sales')).toBeTruthy();
  expect(result.getByText('5% team commission')).toBeTruthy();
  expect(result.queryByText('Available to cash out')).toBeNull();
});

it('keeps current-month Sales and Agents links in the same calendar-month context', () => {
  const result = render(<HomeContent {...access} portal={samplePortal} />);
  fireEvent.press(result.getByLabelText('Sales'));
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/(app)/affiliate/sales', params: { month: '2026-10' } });
  fireEvent.press(result.getByLabelText('View your agents earnings'));
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/(app)/(affiliate-tabs)/agents', params: { month: '2026-10' } });
});

it('gives Sales and My page matching rounded press highlights with an independent separator', () => {
  const result = render(<HomeContent {...access} portal={samplePortal} />);
  const divider = result.getByTestId('affiliate-home-tools-divider');
  expect(divider.props).toMatchObject({ pointerEvents: 'none', accessible: false });
  expect(divider.props.onPress).toBeUndefined();

  for (const label of ['Sales', 'My page']) {
    const row = result.getByRole('button', { name: label });
    const surface = ReactNative.StyleSheet.flatten(row.props.style);
    const highlight = row.findByType(ReactNative.Animated.View);
    expect(surface.borderRadius).toBe(radius.field);
    expect(surface.borderBottomWidth ?? 0).toBe(0);
    expect(ReactNative.StyleSheet.flatten(highlight.props.style).borderRadius).toBe(surface.borderRadius);
    expect(row.findAllByProps({ testID: 'affiliate-home-tools-divider' })).toHaveLength(0);
    fireEvent(row, 'pressIn', { nativeEvent: {} });
    expect(ReactNative.StyleSheet.flatten(result.getByRole('button', { name: label }).props.style)).toEqual(surface);
    expect(ReactNative.StyleSheet.flatten(highlight.props.style).borderRadius).toBe(radius.field);
    fireEvent(result.getByRole('button', { name: label }), 'pressOut', { nativeEvent: {} });
  }
});

it('loads each chosen month from the portal and carries it into Sales and Agents', () => {
  const september: AffiliatePortal = { ...samplePortal, month: { start: Date.UTC(2026, 7, 31, 16), end: Date.UTC(2026, 8, 30, 16), label: '2026-09' }, income: { directThisMonth: 80, teamThisMonth: 20, totalThisMonth: 100 } };
  mockQuery.mockImplementation((_api: unknown, args: { month?: string }) => args.month === '2026-09' ? september : samplePortal);
  const result = render(<AffiliateHomeScreen />);
  expect(mockQuery).toHaveBeenLastCalledWith(expect.anything(), {});
  fireEvent.press(result.getByLabelText('Change earnings month'));
  for (const label of ['October 2026', 'September 2026', 'August 2026', 'July 2026', 'June 2026', 'May 2026']) expect(result.getByLabelText(label)).toBeTruthy();
  expect(result.queryByLabelText('April 2026')).toBeNull();
  fireEvent.press(result.getByLabelText('September 2026'));
  expect(mockQuery).toHaveBeenLastCalledWith(expect.anything(), { month: '2026-09' });
  expect(result.getByLabelText('September 2026 earnings, ₱100')).toBeTruthy();
  expect(result.queryByLabelText('October 2026 earnings, ₱2,750')).toBeNull();
  fireEvent.press(result.getByLabelText('Sales'));
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/(app)/affiliate/sales', params: { month: '2026-09' } });
  fireEvent.press(result.getByLabelText('View your agents earnings'));
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/(app)/(affiliate-tabs)/agents', params: { month: '2026-09' } });
  fireEvent.press(result.getByLabelText('My page'));
  expect(mockPush).toHaveBeenLastCalledWith('/(app)/affiliate/page');
});

it('keeps zero income distinct from loading and never invents missing monthly data', () => {
  const result = render(<HomeContent {...access} portal={{ ...samplePortal, income: { directThisMonth: 0, teamThisMonth: 0, totalThisMonth: 0 } }} />);
  expect(result.getAllByText('₱0')).toHaveLength(3);
  result.rerender(<HomeContent {...access} portal={undefined} selectedMonth="2026-09" />);
  expect(result.getAllByText('Loading…')).toHaveLength(3);
  expect(result.queryByText('₱0')).toBeNull();
  expect(result.getByText('From your link and agents')).toBeTruthy();
  expect(result.getByLabelText('September 2026 earnings, loading')).toBeTruthy();
});

it('never labels a previous month’s income as the selected month while the portal refreshes', () => {
  const result = render(<HomeContent {...access} portal={samplePortal} selectedMonth="2026-09" onMonthChange={jest.fn()} />);
  expect(result.getByLabelText('September 2026 earnings, loading')).toBeTruthy();
  expect(result.getByLabelText('From your link, loading')).toBeTruthy();
  expect(result.getByLabelText('From your agents, loading')).toBeTruthy();
  for (const staleValue of ['₱2,750', '₱2,500', '₱250']) expect(result.queryByText(staleValue)).toBeNull();
  fireEvent.press(result.getByLabelText('Sales'));
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/(app)/affiliate/sales', params: { month: '2026-09' } });
  fireEvent.press(result.getByLabelText('View your link earnings'));
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/(app)/affiliate/sales', params: { month: '2026-09' } });
  fireEvent.press(result.getByLabelText('View your agents earnings'));
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/(app)/(affiliate-tabs)/agents', params: { month: '2026-09' } });
  const september: AffiliatePortal = { ...samplePortal,
    month: { start: Date.UTC(2026, 7, 31, 16), end: Date.UTC(2026, 8, 30, 16), label: '2026-09' },
    income: { directThisMonth: 0, teamThisMonth: 0, totalThisMonth: 0 } };
  result.rerender(<HomeContent {...access} portal={september} selectedMonth="2026-09" onMonthChange={jest.fn()} />);
  expect(result.getByLabelText('September 2026 earnings, ₱0')).toBeTruthy();
  expect(result.getAllByText('₱0')).toHaveLength(3);
  expect(result.queryByText('Loading…')).toBeNull();
});

it('announces the full selected month and keeps every month option reachable on a small screen', () => {
  jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 320, height: 568, scale: 1, fontScale: 1.5 });
  const change = jest.fn();
  const result = render(<HomeContent {...access} portal={samplePortal} onMonthChange={change} />);
  const picker = result.getByLabelText('Change earnings month');
  expect(picker.props.accessibilityValue).toMatchObject({ text: 'October 2026' });
  expect(picker.props.accessibilityState.expanded).toBe(false);
  fireEvent.press(picker);
  expect(result.getByLabelText('Change earnings month').props.accessibilityState.expanded).toBe(true);
  const options = within(result.getByLabelText('Earnings month options'));
  expect(options.getByLabelText('October 2026').props.accessibilityState.selected).toBe(true);
  expect(options.getByLabelText('September 2026').props.accessibilityState.selected).toBe(false);
  fireEvent.press(options.getByLabelText('May 2026'));
  expect(change).toHaveBeenCalledWith('2026-05');
  expect(result.queryByLabelText('May 2026')).toBeNull();
  expect(result.getByLabelText('Change earnings month').props.accessibilityState.expanded).toBe(false);
});

it('dismisses the month chooser without changing the selected month', () => {
  const change = jest.fn();
  const result = render(<HomeContent {...access} portal={samplePortal} onMonthChange={change} />);
  fireEvent.press(result.getByLabelText('Change earnings month'));
  fireEvent.press(result.getByLabelText('Close earnings month'));
  expect(result.queryByLabelText('September 2026')).toBeNull();
  expect(result.getByLabelText('Change earnings month').props.accessibilityValue).toMatchObject({ text: 'October 2026' });
  expect(change).not.toHaveBeenCalled();
});

it('keeps complete large earnings values available at small widths and larger text settings', () => {
  jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 320, height: 667, scale: 1, fontScale: 1.6 });
  const result = render(<HomeContent {...access} portal={{ ...samplePortal,
    income: { totalThisMonth: 1234567890, directThisMonth: 987654321, teamThisMonth: 246913569 } }} />);
  for (const [label, value] of [
    ['October 2026 earnings, ₱1,234,567,890', '₱1,234,567,890'],
    ['From your link, ₱987,654,321', '₱987,654,321'],
    ['From your agents, ₱246,913,569', '₱246,913,569'],
  ]) {
    expect(result.getByLabelText(label)).toBeTruthy();
    expect(result.getByText(value).props.numberOfLines).toBeUndefined();
  }
});

it('copies and shares the saved shop URL and disables these actions in preview', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  const result = render(<HomeContent {...access} portal={samplePortal} />);
  await act(async () => { fireEvent.press(result.getByLabelText('Copy shop link')); });
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith('https://tendso.com/v2/a/sample-affiliate');
  expect(result.getByText('Copied.')).toBeTruthy();
  await act(async () => { fireEvent.press(result.getByLabelText('Share my shop link')); });
  expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://tendso.com/v2/a/sample-affiliate' }));
  result.rerender(<HomeContent {...access} isPreview portal={samplePortal} onMonthChange={jest.fn()} />);
  expect(result.getByLabelText('Copy shop link')).toBeDisabled();
  expect(result.getByLabelText('Share my shop link')).toBeDisabled();
  expect(result.getByLabelText('Change earnings month')).toBeDisabled();
});

it('introduces the saved shop link with the fixed creator offer rather than a legacy custom price', () => {
  const result = render(<HomeContent {...access} account={{ ...sampleAffiliate, affiliatePrice: 2661 }} portal={samplePortal} />);
  expect(result.getByText('Share with shop owners')).toBeTruthy();
  expect(result.getByText('tendso.com/v2/a/sample-affiliate')).toBeTruthy();
  expect(result.getByText(/30%/)).toBeTruthy();
  expect(result.queryByText('₱2,661')).toBeNull();
});

it('groups the saved URL, copy and single share action in one shop-owner card', () => {
  const result = render(<HomeContent {...access} portal={samplePortal} />);
  const sharing = within(result.getByTestId('affiliate-shop-sharing'));
  expect(sharing.getByText('Share with shop owners')).toBeTruthy();
  expect(sharing.getByText('tendso.com/v2/a/sample-affiliate')).toBeTruthy();
  expect(sharing.getByLabelText('Copy shop link')).toBeTruthy();
  expect(sharing.getByLabelText('Share my shop link')).toBeTruthy();
  expect(sharing.getByText('Share link')).toBeTruthy();
  expect(result.getAllByLabelText('Share my shop link')).toHaveLength(1);
});

it('keeps copy and share unavailable for a suspended account or a missing creator handle', () => {
  const result = render(<HomeContent {...access} account={{ ...sampleAffiliate, status: 'suspended' }} portal={samplePortal} />);
  expect(result.getByLabelText('Copy shop link')).toBeDisabled();
  expect(result.getByLabelText('Share my shop link')).toBeDisabled();
  result.rerender(<HomeContent {...access} account={{ ...sampleAffiliate, affiliateHandle: undefined }} portal={samplePortal} />);
  expect(result.getByLabelText('Copy shop link')).toBeDisabled();
  expect(result.getByLabelText('Share my shop link')).toBeDisabled();
  fireEvent.press(result.getByLabelText('Copy shop link'));
  expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
});

it('reports copy and share failures while allowing a later retry', async () => {
  jest.mocked(Clipboard.setStringAsync).mockRejectedValueOnce(new Error('Clipboard unavailable'));
  const share = jest.spyOn(Share, 'share').mockRejectedValueOnce(new Error('Sharing unavailable'));
  const result = render(<HomeContent {...access} portal={samplePortal} />);
  await act(async () => { fireEvent.press(result.getByLabelText('Copy shop link')); });
  expect(within(result.getByTestId('affiliate-shop-sharing')).getByText('Could not copy. Please try again.')).toBeTruthy();
  await act(async () => { fireEvent.press(result.getByLabelText('Copy shop link')); });
  expect(within(result.getByTestId('affiliate-shop-sharing')).getByText('Copied.')).toBeTruthy();
  await act(async () => { fireEvent.press(result.getByLabelText('Share my shop link')); });
  expect(within(result.getByTestId('affiliate-shop-sharing')).getByText('Could not share your link. Please try again.')).toBeTruthy();
  share.mockResolvedValueOnce({ action: Share.sharedAction });
  await act(async () => { fireEvent.press(result.getByLabelText('Share my shop link')); });
  expect(share).toHaveBeenCalledTimes(2);
  expect(result.queryByText('Could not share your link. Please try again.')).toBeNull();
});

it('ignores repeated share taps until the native share sheet finishes', async () => {
  let finish!: (value: Awaited<ReturnType<typeof Share.share>>) => void;
  const share = jest.spyOn(Share, 'share').mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const result = render(<HomeContent {...access} portal={samplePortal} />);
  fireEvent.press(result.getByLabelText('Share my shop link'));
  fireEvent.press(result.getByLabelText('Share my shop link'));
  expect(share).toHaveBeenCalledTimes(1);
  await act(async () => { finish({ action: Share.sharedAction }); });
});

it('shows only an owned recruit’s monthly share, lifetime earnings, rate and actual dates', () => {
  const recruit = { ...samplePortal.recruits[0], monthEarned: 0, totalEarned: 123465789, creditedTotalEarned: 123456789, monthsLeft: 12, demoMonthsLeft: 3 };
  const result = render(<AgentDetailContent {...access} portal={{ ...samplePortal, recruits: [recruit] }} agentId={recruit._id} />);
  expect(result.getByText(recruit.referredName)).toBeTruthy();
  expect(result.getByLabelText('Your monthly share, ₱0')).toBeTruthy();
  expect(result.getByText('₱123,456,789')).toBeTruthy();
  expect(result.getByText('5%')).toBeTruthy();
  expect(result.getByText('Recruited 22 Oct 2026')).toBeTruthy();
  expect(result.getByText('22 Oct 2027')).toBeTruthy();
  expect(result.getByText('Commission ends')).toBeTruthy();
  expect(result.getByText('12 months left')).toBeTruthy();
  expect(result.getByLabelText(`${recruit.referredName}, 12 of 12 months remaining`).props.accessibilityValue.now).toBe(12);
  expect(result.queryByText(/simulated progress/i)).toBeNull();
  expect(result.queryByLabelText(/simulated progress/i)).toBeNull();
  result.rerender(<AgentDetailContent {...access} portal={{ ...samplePortal, recruits: [recruit] }} agentId="someone-elses-agent" />);
  expect(result.getByText('Agent not found')).toBeTruthy();
  expect(result.queryByText(recruit.referredName)).toBeNull();
  expect(result.queryByText('₱123,456,789')).toBeNull();
});

it('does not present pending legacy commission as earned lifetime income on an older backend', () => {
  const recruit = { ...samplePortal.recruits[0], totalEarned: 9300, creditedTotalEarned: undefined };
  const result = render(<AgentDetailContent {...access} portal={{ ...samplePortal, recruits: [recruit] }} agentId={recruit._id} />);
  expect(result.getByText('Unavailable')).toBeTruthy();
  expect(result.queryByText('₱9,300')).toBeNull();
  result.rerender(<AgentDetailContent {...access} portal={{ ...samplePortal, recruits: [{ ...recruit, totalEarned: 0 }] }} agentId={recruit._id} />);
  expect(result.getByText('₱0')).toBeTruthy();
});

it('resolves detail ids only through the authenticated creator portal', () => {
  const result = render(<AffiliateAgentDetailScreen agentId="someone-elses-agent" month="2026-09" />);
  expect(mockQuery).toHaveBeenCalledWith('affiliates:portal', { month: '2026-09' });
  expect(result.getByText('Agent not found')).toBeTruthy();
  expect(result.queryByText('Bea Reyes')).toBeNull();
});

it('keeps agent-detail loading and ended periods explicit with complete large amounts', () => {
  jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 320, height: 667, scale: 1, fontScale: 1.5 });
  const recruit = { ...samplePortal.recruits[0], monthEarned: 987654321, earning: false, monthsLeft: 0 };
  const result = render(<AgentDetailContent {...access} portal={undefined} agentId={recruit._id} />);
  expect(result.getByText('Loading agent details')).toBeTruthy();
  result.rerender(<AgentDetailContent {...access} portal={{ ...samplePortal, recruits: [recruit] }} agentId={recruit._id} />);
  expect(result.getByText('Period ended')).toBeTruthy();
  expect(result.getByText('Commission ended')).toBeTruthy();
  expect(result.getByText('₱987,654,321').props.numberOfLines).toBeUndefined();
});
