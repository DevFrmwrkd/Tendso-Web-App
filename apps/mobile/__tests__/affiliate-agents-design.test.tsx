import React from 'react';
import * as ReactNative from 'react-native';
import { Share } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AgentsContent } from '../components/affiliate/Agents';
import { sampleAffiliate, samplePortal, type AffiliatePortal } from '../components/affiliate/model';

const mockPush = jest.fn();
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => ({ push: mockPush }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('convex/react', () => ({ useQuery: () => undefined }));
jest.mock('../components/affiliate/Screen', () => ({
  AffiliateAccess: () => null,
  AffiliateFrame: ({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) => require('react').createElement(require('react-native').View, null, children, footer),
  AffiliateLoading: ({ label }: { label: string }) => require('react').createElement(require('react-native').Text, null, label),
}));
jest.mock('../components/affiliate/ShareTools', () => ({
  CopyButton: ({ value, label, disabled }: { value: string; label: string; disabled: boolean }) => require('react').createElement(require('react-native').View,
    { testID: 'fixture-invitation-copy', value, disabled }, require('react').createElement(require('react-native').Text, null, label)),
}));

const sampleTime = Date.UTC(2026, 9, 22);
const recruits = Array.from({ length: 5 }, (_, index) => ({
  _id: `agent-${index}` as AffiliatePortal['recruits'][number]['_id'], referredName: `Agent ${index + 1}`, photo: null,
  createdAt: sampleTime, endsAt: Date.UTC(2027, 9, 22), earning: true, totalEarned: 0,
  monthEarned: index === 0 ? 0 : index * 100, monthsLeft: index === 0 ? 5 : 12,
}));
const portal: AffiliatePortal = { ...samplePortal, recruits, referrals: [], recruitStats: { total: 5, earning: 5, totalEarned: 1000 } };
function screen(data: AffiliatePortal | undefined = portal, props: { isPreview?: boolean; month?: string } = {}) {
  return render(<AgentsContent account={sampleAffiliate} isPreview={false} isAuthenticated isOffline={false} portal={data} {...props} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
});

it('shows four real agents, zero earnings and the actual accessible months remaining', () => {
  const result = screen();
  for (let index = 1; index <= 4; index += 1) expect(result.getByText(`Agent ${index}`)).toBeTruthy();
  expect(result.queryByText('Agent 5')).toBeNull();
  expect(result.getByTestId('affiliate-agent-amount-agent-0').props.children).toBe('₱0');
  const progress = result.getByLabelText('Agent 1, 5 of 12 months remaining');
  expect(progress.props.accessibilityValue).toEqual({ min: 0, max: 12, now: 5 });
  expect(progress.props.accessibilityHint).toMatch(/^Until/);
  expect(result.getByText('5 months left')).toBeTruthy();
  expect(result.getByTestId('affiliate-agent-progress-agent-0')).toHaveStyle({ width: `${5 / 12 * 100}%` });
  expect(result.queryByTestId('affiliate-agent-month-agent-0-0')).toBeNull();
  expect(result.getByLabelText('Your monthly team share, ₱250')).toBeTruthy();
  expect(result.queryByText(/^Until/)).toBeNull();
  expect(result.queryByText('Simulated progress')).toBeNull();
});

it('opens the owned recruit details with the selected earnings month', () => {
  const result = screen(portal, { month: '2026-09' });
  fireEvent.press(result.getByLabelText('View Agent 1'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(app)/affiliate/agent/[agentId]', params: { agentId: 'agent-0', month: '2026-09' } });
});

it('filters ended periods by actual eligibility rather than simulated progress', () => {
  const result = screen({ ...portal, recruits: [
    { ...recruits[0], referredName: 'Active example', demoMonthsLeft: 0, earning: true },
    { ...recruits[1], referredName: 'Ended agent', monthsLeft: 0, earning: false },
  ] });
  fireEvent.press(result.getByLabelText('Agents whose period ended'));
  expect(result.getByText('Ended agent')).toBeTruthy();
  expect(result.queryByText('Active example')).toBeNull();
  expect(result.getByLabelText('Agents whose period ended').props.accessibilityState.selected).toBe(true);
  fireEvent.press(result.getByLabelText('All agents'));
  expect(result.getByText('Active example')).toBeTruthy();
});

it.each([0, 3, 6, 9, 12])('labels %s demo months as simulated without claiming a real expiry', demoMonthsLeft => {
  const data = { ...portal, recruits: [{ ...recruits[0], monthsLeft: 12, demoMonthsLeft, monthEarned: 123456789 }] };
  const result = screen(data);
  expect(result.getByText('Simulated progress')).toBeTruthy();
  const progress = result.getByLabelText(`Agent 1, simulated progress, ${demoMonthsLeft} of 12 months remaining in this example`);
  expect(progress.props.accessibilityValue).toEqual({ min: 0, max: 12, now: demoMonthsLeft });
  expect(progress.props.accessibilityHint).toBe('Example progress only. The actual commission period and expiry date are unchanged.');
  expect(result.queryByLabelText('Agent 1, 12 of 12 months remaining')).toBeNull();
  expect(result.getByTestId('affiliate-agent-amount-agent-0').props.children).toBe('₱123,456,789');
});

it.each([-1, 13, 2.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, undefined, null, '9'])('ignores invalid simulated month metadata %s', invalid => {
  const invalidRecruit = { ...recruits[0], demoMonthsLeft: invalid } as unknown as AffiliatePortal['recruits'][number];
  const result = screen({ ...portal, recruits: [invalidRecruit] });
  const progress = result.getByLabelText('Agent 1, 5 of 12 months remaining');
  expect(progress.props.accessibilityValue.now).toBe(5);
  expect(progress.props.accessibilityHint).toMatch(/^Until/);
  expect(result.queryByText('Simulated progress')).toBeNull();
});

it('keeps four agents per page and disables controls at the page boundaries', () => {
  const result = screen();
  expect(result.getByLabelText('Previous agents')).toBeDisabled();
  fireEvent.press(result.getByLabelText('Next agents'));
  expect(result.getByText('Agent 5')).toBeTruthy();
  expect(result.queryByText('Agent 1')).toBeNull();
  expect(result.getByLabelText('Page 2 of 2')).toBeTruthy();
  expect(result.getByLabelText('Next agents')).toBeDisabled();
  fireEvent.press(result.getByLabelText('Previous agents'));
  expect(result.getByText('Agent 1')).toBeTruthy();
});

it('reveals real invite and copy tools only after expanding the explicit control', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  const result = screen();
  expect(result.queryByTestId('affiliate-agent-invite-tools')).toBeNull();
  expect(result.getByLabelText('Invite field agents').props.accessibilityState.expanded).toBe(false);
  fireEvent.press(result.getByLabelText('Invite field agents'));
  expect(result.getByLabelText('Invite field agents').props.accessibilityState.expanded).toBe(true);
  expect(result.getByTestId('fixture-invitation-copy').props.value).toBe(sampleAffiliate.referralCode);
  await act(async () => { fireEvent.press(result.getByText('Share agent invite')); });
  expect(share).toHaveBeenCalledWith({ message: 'Join me on Tendso as a field agent: https://tendso.com/v2/a/sample-affiliate/earn' });
  fireEvent.press(result.getByLabelText('Invite field agents'));
  expect(result.queryByTestId('affiliate-agent-invite-tools')).toBeNull();
});

it('keeps complete large amounts readable at large font sizes', () => {
  jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 375, height: 667, scale: 1, fontScale: 1.5 });
  const data = { ...portal, recruits: [{ ...recruits[0], monthEarned: 123456789 }] };
  const result = screen(data);
  const amount = result.getByTestId('affiliate-agent-amount-agent-0');
  expect(amount.props.children).toBe('₱123,456,789');
  expect(amount.props.numberOfLines).toBeUndefined();
});

it('keeps loading and actual empty-account states without inventing recruits', () => {
  const result = render(<AgentsContent account={sampleAffiliate} isPreview={false} isAuthenticated isOffline={false} portal={undefined} />);
  expect(result.getByText('Loading your agents')).toBeTruthy();
  result.unmount();
  const empty = screen({ ...portal, recruits: [] });
  expect(empty.getByText('Your team starts here')).toBeTruthy();
  expect(empty.queryByTestId('affiliate-agent-list')).toBeNull();
  expect(empty.getByLabelText('Invite field agents')).toBeTruthy();
});

it('preserves earlier referral bonuses and disables sample sharing', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  const result = screen({ ...portal, referrals: [{ ...samplePortal.referrals[0], status: 'paid', bonusAmount: 1000 }] }, { isPreview: true });
  expect(result.getByText('Bonus paid · ₱1,000')).toBeTruthy();
  fireEvent.press(result.getByLabelText('Invite field agents'));
  fireEvent.press(result.getByText('Share agent invite'));
  expect(share).not.toHaveBeenCalled();
});
