import React from 'react';
import * as ReactNative from 'react-native';
import { Share } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AgentsContent } from '../components/affiliate/Agents';
import { sampleAffiliate, samplePortal, type AffiliatePortal } from '../components/affiliate/model';
import type { AffiliateAccessProps } from '../components/affiliate/Screen';

const mockPush = jest.fn();
const mockClipboard = jest.fn();
const mockWindowDimensions = jest.fn();
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockWindowDimensions() }));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => ({ push: mockPush }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-clipboard', () => ({ setStringAsync: (...args: unknown[]) => mockClipboard(...args) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }) }));
jest.mock('convex/react', () => ({ useQuery: () => undefined }));
jest.mock('../components/affiliate/Screen', () => ({
  AffiliateAccess: () => null,
  AffiliateFrame: ({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) => require('react').createElement(require('react-native').View, null, children, footer),
  AffiliateLoading: ({ label }: { label: string }) => require('react').createElement(require('react-native').Text, null, label),
}));

const sampleTime = Date.UTC(2026, 9, 22);
const recruits = Array.from({ length: 5 }, (_, index) => ({
  _id: `agent-${index}` as AffiliatePortal['recruits'][number]['_id'], referredName: `Agent ${index + 1}`, photo: null,
  createdAt: sampleTime, endsAt: Date.UTC(2027, 9, 22), earning: true, totalEarned: 0,
  monthEarned: index === 0 ? 0 : index * 100, monthsLeft: index === 0 ? 5 : 12,
}));
const portal: AffiliatePortal = { ...samplePortal, recruits, referrals: [], recruitStats: { total: 5, earning: 5, totalEarned: 1000 } };
function screen(data: AffiliatePortal | undefined = portal, props: Partial<AffiliateAccessProps> & { month?: string } = {}) {
  return render(<AgentsContent account={sampleAffiliate} isPreview={false} isAuthenticated isOffline={false} portal={data} {...props} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  mockClipboard.mockResolvedValue(undefined);
  mockWindowDimensions.mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
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

it('opens the same native dialog from both invite buttons without resetting the current agent page', () => {
  const result = screen();
  expect(result.queryByTestId('affiliate-agent-invite-tools')).toBeNull();
  expect(result.getByLabelText('Invite field agents').props.accessibilityState.expanded).toBe(false);
  fireEvent.press(result.getByLabelText('Next agents'));
  fireEvent.press(result.getByLabelText('Invite field agents'));
  const modal = result.getByTestId('affiliate-agent-invite-modal');
  expect(modal.props.visible).toBe(true);
  expect(modal.props.animationType).toBe('fade');
  expect(modal.props.transparent).toBe(true);
  expect(result.getByTestId('affiliate-agent-invite-modal-root').props.accessibilityViewIsModal).toBe(true);
  fireEvent.press(result.getByLabelText('Close agent invite'));
  expect(result.getByText('Agent 5')).toBeTruthy();
  expect(result.getByLabelText('Page 2 of 2')).toBeTruthy();
  fireEvent.press(result.getByLabelText('Invite an agent'));
  expect(result.getByTestId('affiliate-agent-invite-tools')).toBeTruthy();
  fireEvent.press(result.getByLabelText('Dismiss agent invite'));
  expect(result.queryByTestId('affiliate-agent-invite-tools')).toBeNull();
  expect(result.getByText('Agent 5')).toBeTruthy();
  expect(result.getByLabelText('Page 2 of 2')).toBeTruthy();
});

it('dismisses with Android Back and accessibility Escape while retaining the ended filter and page', () => {
  const result = screen({ ...portal, recruits: recruits.map(recruit => ({ ...recruit, earning: false, monthsLeft: 0 })) });
  fireEvent.press(result.getByLabelText('Agents whose period ended'));
  fireEvent.press(result.getByLabelText('Next agents'));
  fireEvent.press(result.getByLabelText('Invite an agent'));
  fireEvent(result.getByTestId('affiliate-agent-invite-modal'), 'requestClose');
  expect(result.queryByTestId('affiliate-agent-invite-tools')).toBeNull();
  expect(result.getByLabelText('Agents whose period ended').props.accessibilityState.selected).toBe(true);
  expect(result.getByLabelText('Page 2 of 2')).toBeTruthy();
  fireEvent.press(result.getByLabelText('Invite field agents'));
  fireEvent(result.getByTestId('affiliate-agent-invite-tools'), 'accessibilityEscape');
  expect(result.queryByTestId('affiliate-agent-invite-tools')).toBeNull();
  expect(result.getByText('Agent 5')).toBeTruthy();
  expect(result.getByLabelText('Agents whose period ended').props.accessibilityState.selected).toBe(true);
});

it('copies the saved invitation link and code, and treats share cancellation as a normal dismissal', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction });
  const result = screen();
  fireEvent.press(result.getByLabelText('Invite field agents'));
  expect(result.getByText('https://tendso.com/v2/a/sample-affiliate/earn')).toBeTruthy();
  expect(result.getByText(sampleAffiliate.referralCode!)).toBeTruthy();
  expect(result.getByText('Earn 5% of their sales for 12 months, after each shop has paid in full.')).toBeTruthy();
  fireEvent.press(result.getByLabelText('Copy invite link'));
  await waitFor(() => expect(mockClipboard).toHaveBeenLastCalledWith('https://tendso.com/v2/a/sample-affiliate/earn'));
  expect(result.getByText('Invite link copied.')).toBeTruthy();
  fireEvent.press(result.getByLabelText('Copy invitation code'));
  await waitFor(() => expect(mockClipboard).toHaveBeenLastCalledWith(sampleAffiliate.referralCode));
  expect(result.getByText('Invitation code copied.')).toBeTruthy();
  await act(async () => { fireEvent.press(result.getByLabelText('Share agent invite')); });
  expect(share).toHaveBeenCalledWith({ message: 'Join me on Tendso as a field agent: https://tendso.com/v2/a/sample-affiliate/earn' });
  expect(result.queryByRole('alert')).toBeNull();
  expect(result.getByTestId('affiliate-agent-invite-tools')).toBeTruthy();
  expect(result.getByLabelText('Share agent invite')).not.toBeDisabled();
});

it('shows clipboard and share failures only in the current dialog and clears them on reopening', async () => {
  const share = jest.spyOn(Share, 'share').mockRejectedValue(new Error('Share unavailable'));
  mockClipboard.mockRejectedValueOnce(new Error('Clipboard unavailable'));
  const result = screen();
  fireEvent.press(result.getByLabelText('Invite an agent'));
  fireEvent.press(result.getByLabelText('Copy invite link'));
  await waitFor(() => expect(result.getByText('Could not copy your invite. Please try again.')).toBeTruthy());
  await act(async () => { fireEvent.press(result.getByLabelText('Share agent invite')); });
  expect(share).toHaveBeenCalledTimes(1);
  expect(result.getByText('Could not share your invite. Please try again.')).toBeTruthy();
  fireEvent.press(result.getByLabelText('Close agent invite'));
  fireEvent.press(result.getByLabelText('Invite an agent'));
  expect(result.queryByRole('alert')).toBeNull();
});

it('does not restore an old actor dialog or overwrite a new actor share when an earlier share fails', async () => {
  let rejectOld!: (reason: Error) => void;
  let finishNew!: (value: { action: string }) => void;
  const share = jest.spyOn(Share, 'share')
    .mockReturnValueOnce(new Promise((_resolve, reject) => { rejectOld = reject; }))
    .mockReturnValueOnce(new Promise(resolve => { finishNew = resolve; }));
  const result = screen();
  fireEvent.press(result.getByLabelText('Invite an agent'));
  fireEvent.press(result.getByLabelText('Share agent invite'));
  fireEvent.press(result.getByLabelText('Share agent invite'));
  expect(share).toHaveBeenCalledTimes(1);
  const nextAccount = { ...sampleAffiliate, _id: 'other-affiliate' as typeof sampleAffiliate._id, clerkId: 'other-clerk', affiliateHandle: 'other-handle', referralCode: 'OTHER' };
  result.rerender(<AgentsContent account={nextAccount} isPreview={false} isAuthenticated isOffline={false} portal={portal} />);
  expect(result.queryByTestId('affiliate-agent-invite-tools')).toBeNull();
  fireEvent.press(result.getByLabelText('Invite an agent'));
  expect(result.getByText('https://tendso.com/v2/a/other-handle/earn')).toBeTruthy();
  fireEvent.press(result.getByLabelText('Share agent invite'));
  await act(async () => { rejectOld(new Error('Old actor share failed')); });
  expect(result.queryByRole('alert')).toBeNull();
  expect(result.getByLabelText('Share agent invite')).toBeDisabled();
  await act(async () => { finishNew({ action: Share.sharedAction }); });
  expect(result.getByLabelText('Share agent invite')).not.toBeDisabled();
});

it('closes and resets a pending invite after status revocation and ignores its late failure', async () => {
  let rejectShare!: (reason: Error) => void;
  jest.spyOn(Share, 'share').mockReturnValue(new Promise((_resolve, reject) => { rejectShare = reject; }));
  const result = screen();
  fireEvent.press(result.getByLabelText('Invite field agents'));
  fireEvent.press(result.getByLabelText('Share agent invite'));
  result.rerender(<AgentsContent account={{ ...sampleAffiliate, status: 'suspended' }} isPreview={false} isAuthenticated isOffline={false} portal={portal} />);
  expect(result.queryByTestId('affiliate-agent-invite-tools')).toBeNull();
  fireEvent.press(result.getByLabelText('Invite field agents'));
  await act(async () => { rejectShare(new Error('Revoked share failed')); });
  expect(result.queryByRole('alert')).toBeNull();
  expect(result.getByLabelText('Share agent invite')).toBeDisabled();
  expect(result.getByLabelText('Copy invite link')).toBeDisabled();
  expect(result.getByLabelText('Copy invitation code')).toBeDisabled();
});

it('bounds the scrollable dialog within safe insets and lets large action labels wrap', () => {
  mockWindowDimensions.mockReturnValue({ width: 375, height: 667, scale: 1, fontScale: 1.5 });
  const result = screen();
  fireEvent.press(result.getByLabelText('Invite an agent'));
  const style = ReactNative.StyleSheet.flatten(result.getByTestId('affiliate-agent-invite-tools').props.style);
  expect(style.maxWidth).toBe(480);
  expect(style.maxHeight).toBeLessThanOrEqual(667 - 44 - 34);
  expect(result.getByText('Copy invitation code').props.numberOfLines).toBeUndefined();
  expect(result.getByText('Share agent invite').props.numberOfLines).toBeUndefined();
  expect(result.UNSAFE_getByType(ReactNative.ScrollView)).toBeTruthy();
});

it('shows missing-handle information and keeps only a saved referral code copyable', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  const result = screen(portal, { account: { ...sampleAffiliate, affiliateHandle: undefined } });
  fireEvent.press(result.getByLabelText('Invite an agent'));
  expect(result.getByText('Your invite link is not available yet.')).toBeTruthy();
  expect(result.getByLabelText('Copy invite link')).toBeDisabled();
  expect(result.getByLabelText('Share agent invite')).toBeDisabled();
  fireEvent.press(result.getByLabelText('Share agent invite'));
  fireEvent.press(result.getByLabelText('Copy invitation code'));
  await waitFor(() => expect(mockClipboard).toHaveBeenCalledWith(sampleAffiliate.referralCode));
  expect(share).not.toHaveBeenCalled();
});

it('keeps complete large amounts readable at large font sizes', () => {
  mockWindowDimensions.mockReturnValue({ width: 375, height: 667, scale: 1, fontScale: 1.5 });
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
  expect(result.getByLabelText('Copy invite link')).toBeDisabled();
  expect(result.getByLabelText('Copy invitation code')).toBeDisabled();
  fireEvent.press(result.getByLabelText('Share agent invite'));
  fireEvent.press(result.getByLabelText('Copy invitation code'));
  expect(share).not.toHaveBeenCalled();
  expect(mockClipboard).not.toHaveBeenCalled();
});
