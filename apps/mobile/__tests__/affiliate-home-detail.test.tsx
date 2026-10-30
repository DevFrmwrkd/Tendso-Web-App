import React from 'react';
import * as ReactNative from 'react-native';
import { Share } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { AffiliateHomeScreen, HomeContent } from '../components/affiliate/Home';
import { AffiliateAgentDetailScreen, AgentDetailContent } from '../components/affiliate/AgentDetail';
import { sampleAffiliate, samplePortal, type AffiliatePortal } from '../components/affiliate/model';

const mockPush = jest.fn();
const mockQuery = jest.fn();
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
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
  jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
  jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 9, 29));
  mockQuery.mockReturnValue(samplePortal);
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
  expect(result.getByText('September earnings')).toBeTruthy();
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
