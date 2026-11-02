/**
 * Unit tests for app/(app)/referrals.tsx ("Invite field agents").
 */
import React from "react";
import { Share } from 'react-native';
import { act, render, fireEvent, waitFor } from "@testing-library/react-native";
import ReferralsScreen from "../app/(app)/referrals";
import { Button } from '../components/v2';

let mockRole = "creator";
let mockUserId = 'clerk-user-1';
let mockAuthenticated = true;
let mockPreview = false;
let mockConnected = true;
let mockCreator: any;
jest.mock("../hooks/useMobileAccount", () => ({
  useMobileAccount: () => ({ isPreview: mockPreview, isAuthenticated: mockAuthenticated, account: { role: mockRole } }),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@clerk/clerk-expo", () => ({ useUser: () => ({ user: mockUserId ? { id: mockUserId } : null }) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../providers/NetworkProvider", () => ({ useNetwork: () => ({ isConnected: mockConnected }) }), { virtual: true });

// The shared Convex mock has no referrals module; add the ones this screen uses.
jest.mock("@tendso/convex-client", () => ({
  api: {
    creators: { getByClerkId: "creators:getByClerkId" },
    referrals: { getByReferrer: "referrals:getByReferrer", getStats: "referrals:getStats" },
    affiliates: { portal: "affiliates:portal" },
  },
}));

const mockUseQuery = jest.fn();
jest.mock("convex/react", () => ({ useQuery: (...args: any[]) => mockUseQuery(...args) }));

const people = [
  { _id: "r1", referredName: "Rhea Manalo", status: "pending", bonusAmount: 1000, createdAt: Date.now() - 86400000 },
  { _id: "r2", referredName: "Carlo Bautista", status: "qualified", createdAt: Date.now() - 172800000 },
  { _id: "r3", referredName: "Joy Dizon", status: "paid", createdAt: Date.now() - 259200000 },
];
const stats = { total: 3, pending: 1, qualified: 1, paid: 1, totalEarned: 1000 };

function setup(portal: Record<string, unknown> = { referrals: people, referralStats: stats }) {
  mockUseQuery.mockImplementation((key: string, args: unknown) => {
    if (args === 'skip') return undefined;
    if (key === "creators:getByClerkId") return { ...mockCreator, role: mockCreator?.role ?? mockRole };
    if (key === "referrals:getByReferrer") return people;
    if (key === "referrals:getStats") return stats;
    if (key === "affiliates:portal") return portal;
    return undefined;
  });
}

describe("ReferralsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRole = "creator";
    mockUserId = 'clerk-user-1'; mockAuthenticated = true; mockPreview = false; mockConnected = true;
    mockCreator = { _id: 'c1', clerkId: 'clerk-user-1', referralCode: 'RHEA123', status: 'active' };
    require('expo-clipboard').setStringAsync.mockReset().mockResolvedValue(undefined);
    jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    setup();
  });

  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  it("shows the title, the code and the Share / Copy buttons", () => {
    const { getByText, getByLabelText } = render(<ReferralsScreen />);
    expect(getByText("Invite field agents")).toBeTruthy();
    expect(getByText("RHEA123")).toBeTruthy();
    expect(getByLabelText("Share referral code")).toBeTruthy();
    expect(getByLabelText("Copy referral code")).toBeTruthy();
    expect(getByLabelText('Step 1. Share your code. Send it to someone who visits shops.')).toBeTruthy();
    expect(getByLabelText('Step 2. They join with it. They choose a field agent account and enter your code.')).toBeTruthy();
  });

  it("shows a status chip per person and keeps the pending bonus amount", () => {
    const { getByText, getAllByText } = render(<ReferralsScreen />);
    expect(getByText("Signed up")).toBeTruthy();
    // "Qualified" is both the count label and one person's chip.
    expect(getAllByText("Qualified").length).toBe(2);
    expect(getByText("Rewarded")).toBeTruthy();
    expect(getByText("₱1,000 bonus pending")).toBeTruthy();
    expect(getByText('Waiting for their first fully paid site')).toBeTruthy();
    expect(getAllByText('Bonus added to your Earn balance')).toHaveLength(2);
  });

  it("copies the code", async () => {
    const Clipboard = require("expo-clipboard");
    const { getByLabelText, findByText } = render(<ReferralsScreen />);
    fireEvent.press(getByLabelText("Copy referral code"));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith("RHEA123"));
    expect(await findByText("Copied")).toBeTruthy();
  });

  it("shows each account’s reward rule and the field-agent full-payment condition", () => {
    mockRole = "affiliate";
    const creatorView = render(<ReferralsScreen />);
    expect(creatorView.getByText("You earn 5% of their sales")).toBeTruthy();
    expect(creatorView.getByLabelText('Step 3. You earn 5% of their sales. For 12 months, one level only, paid once the shop has paid in full.')).toBeTruthy();
    expect(creatorView.queryByText('₱1,000 per friend')).toBeNull();
    expect(creatorView.queryByText('You earn ₱1,000')).toBeNull();
    creatorView.unmount();
    mockRole = "creator";
    const agentView = render(<ReferralsScreen />);
    expect(agentView.queryByText(/5%/)).toBeNull();
    expect(agentView.getByText('Earn ₱1,000 when a friend’s first site is fully paid.')).toBeTruthy();
    expect(agentView.getByRole('header', { name: '₱1,000 per friend' })).toBeTruthy();
    expect(agentView.getByText('A one-time bonus when their first website is fully paid. It’s added to your Earn balance.')).toBeTruthy();
    expect(agentView.getByText('You earn ₱1,000')).toBeTruthy();
    expect(agentView.getByText('Once their first website is fully paid, the one-time bonus is added to your Earn balance.')).toBeTruthy();
    expect(agentView.getByLabelText('Step 3. You earn ₱1,000. Once their first website is fully paid, the one-time bonus is added to your Earn balance.')).toBeTruthy();
  });

  it("shows post-cutover recruits even when there are no legacy referral records", () => {
    mockRole = "affiliate";
    setup({
      referrals: [], referralStats: { total: 0, pending: 0, qualified: 0, paid: 0, totalEarned: 0 },
      recruits: [{ _id: "new-agent", referredName: "New Agent", createdAt: Date.UTC(2026, 9, 22), endsAt: Date.UTC(2027, 9, 22), earning: true, totalEarned: 250 }],
      recruitStats: { total: 1, earning: 1, totalEarned: 250 },
    });
    const view = render(<ReferralsScreen />);
    expect(view.getByText("New Agent")).toBeTruthy();
    expect(view.getByText("5% team commissions · 1")).toBeTruthy();
    expect(view.getByText("5% active")).toBeTruthy();
    expect(view.getByText(/₱250 team commission earned/)).toBeTruthy();
    expect(view.queryByText("No one yet")).toBeNull();
    expect(view.queryByText("Earlier ₱1,000 referrals")).toBeNull();
  });

  it("keeps earlier bonuses separate from active and expired team commissions", () => {
    mockRole = "affiliate";
    setup({
      referrals: people, referralStats: stats,
      recruits: [{ _id: "expired-agent", referredName: "Earlier Team Agent", createdAt: Date.UTC(2026, 9, 22), endsAt: Date.UTC(2027, 9, 22), earning: false, totalEarned: 750 }],
      recruitStats: { total: 1, earning: 0, totalEarned: 750 },
    });
    const view = render(<ReferralsScreen />);
    expect(view.getByText("Earlier Team Agent")).toBeTruthy();
    expect(view.getByText("Ended")).toBeTruthy();
    expect(view.getByText("Earlier ₱1,000 referrals")).toBeTruthy();
    expect(view.getByText("Rhea Manalo")).toBeTruthy();
    expect(view.getByText("₱1,000 bonus pending")).toBeTruthy();
    expect(view.getByText(/₱750 team commission earned/)).toBeTruthy();
  });

  it.each(['missing code', 'foreign account', 'suspended', 'deleted', 'pending affiliate', 'admin', 'preview', 'signed out'])('never copies or shares an unavailable invitation: %s', async (condition) => {
    if (condition === 'missing code') mockCreator.referralCode = '';
    if (condition === 'foreign account') mockCreator.clerkId = 'someone-else';
    if (condition === 'suspended' || condition === 'deleted') mockCreator.status = condition;
    if (condition === 'admin') mockCreator.role = 'admin';
    if (condition === 'pending affiliate') { mockRole = 'affiliate'; mockCreator.status = 'pending'; }
    if (condition === 'preview') mockPreview = true;
    if (condition === 'signed out') mockAuthenticated = false;
    const view = render(<ReferralsScreen />);
    const copy = view.queryByRole('button', { name: 'Copy referral code' });
    const share = view.queryByRole('button', { name: 'Share referral code' });
    if (copy) { expect(copy).toBeDisabled(); fireEvent.press(copy); }
    if (share) { expect(share).toBeDisabled(); fireEvent.press(share); }
    expect(require('expo-clipboard').setStringAsync).not.toHaveBeenCalled();
    expect(Share.share).not.toHaveBeenCalled();
    if (condition !== 'missing code') {
      expect(mockUseQuery).not.toHaveBeenCalledWith('referrals:getByReferrer', expect.objectContaining({ referrerId: 'c1' }));
    }
  });

  it('reports clipboard and native share failures and lets the user retry', async () => {
    require('expo-clipboard').setStringAsync.mockRejectedValueOnce(new Error('Clipboard unavailable'));
    jest.mocked(Share.share).mockRejectedValueOnce(new Error('Sharing unavailable'));
    const view = render(<ReferralsScreen />);
    fireEvent.press(view.getByRole('button', { name: 'Copy referral code' }));
    expect(await view.findByText('Could not copy your code. Please try again.')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Share referral code' }));
    expect(await view.findByText('Could not open sharing. Please try again.')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Share referral code' }));
    await waitFor(() => expect(Share.share).toHaveBeenCalledTimes(2));
    expect(Share.share).toHaveBeenLastCalledWith(expect.objectContaining({ message: expect.stringContaining('Use my code: RHEA123') }));
  });

  it('deduplicates native actions before the disabled render and drops stale account callbacks', async () => {
    let finishCopy!: () => void;
    require('expo-clipboard').setStringAsync.mockReturnValueOnce(new Promise<void>(resolve => { finishCopy = resolve; }));
    const view = render(<ReferralsScreen />);
    const copy = view.UNSAFE_getAllByType(Button).find(node => node.props.accessibilityLabel === 'Copy referral code')!.props.onPress;
    const share = view.UNSAFE_getAllByType(Button).find(node => node.props.accessibilityLabel === 'Share referral code')!.props.onPress;
    act(() => { copy(); copy(); share(); });
    expect(require('expo-clipboard').setStringAsync).toHaveBeenCalledTimes(1);
    expect(Share.share).not.toHaveBeenCalled();
    mockUserId = 'clerk-next';
    mockCreator = { _id: 'c2', clerkId: 'clerk-next', role: 'creator', referralCode: 'NEXT123', status: 'active' };
    view.rerender(<ReferralsScreen />);
    await act(async () => { finishCopy(); await Promise.resolve(); });
    await act(async () => { await copy(); await share(); });
    expect(view.getByText('NEXT123')).toBeTruthy();
    expect(view.queryByText('Copied')).toBeNull();
    expect(require('expo-clipboard').setStringAsync).toHaveBeenCalledTimes(1);
    expect(Share.share).not.toHaveBeenCalled();
  });

  it('removes the copied timer on unmount and keeps known invitation codes usable offline', async () => {
    jest.useFakeTimers();
    const schedule = jest.spyOn(global, 'setTimeout');
    const cancel = jest.spyOn(global, 'clearTimeout');
    mockConnected = false;
    const view = render(<ReferralsScreen />);
    await act(async () => { fireEvent.press(view.getByRole('button', { name: 'Copy referral code' })); await Promise.resolve(); });
    expect(view.getByText('Copied')).toBeTruthy();
    const copiedTimer = schedule.mock.results[schedule.mock.calls.findIndex((call) => call[1] === 2500)].value;
    view.unmount();
    expect(cancel).toHaveBeenCalledWith(copiedTimer);
  });

  it('does not present offline missing invitation data as zero invitations', () => {
    mockConnected = false;
    mockUseQuery.mockImplementation((key: string, args: unknown) => args !== 'skip' && key === 'creators:getByClerkId' ? mockCreator : undefined);
    const view = render(<ReferralsScreen />);
    expect(view.getByLabelText('Invited, —')).toBeTruthy();
    expect(view.getByText('Reconnect to load your invitations.')).toBeTruthy();
    expect(view.queryByText('No one yet')).toBeNull();
  });
});
