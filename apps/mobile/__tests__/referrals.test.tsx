/**
 * Unit tests for app/(app)/referrals.tsx ("Invite field agents").
 */
import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import ReferralsScreen from "../app/(app)/referrals";

let mockRole = "creator";
jest.mock("../hooks/useMobileAccount", () => ({
  useMobileAccount: () => ({ isPreview: false, isAuthenticated: true, account: { role: mockRole } }),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@clerk/clerk-expo", () => ({ useUser: () => ({ user: { id: "clerk-user-1" } }) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../providers/NetworkProvider", () => ({ useNetwork: () => ({ isConnected: true }) }), { virtual: true });

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
  mockUseQuery.mockImplementation((key: string) => {
    if (key === "creators:getByClerkId") return { _id: "c1", referralCode: "RHEA123" };
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
    setup();
  });

  it("shows the title, the code and the Share / Copy buttons", () => {
    const { getByText, getByLabelText } = render(<ReferralsScreen />);
    expect(getByText("Invite field agents")).toBeTruthy();
    expect(getByText("RHEA123")).toBeTruthy();
    expect(getByLabelText("Share referral code")).toBeTruthy();
    expect(getByLabelText("Copy referral code")).toBeTruthy();
  });

  it("shows a status chip per person and keeps the pending bonus amount", () => {
    const { getByText, getAllByText } = render(<ReferralsScreen />);
    expect(getByText("Signed up")).toBeTruthy();
    // "Qualified" is both the count label and one person's chip.
    expect(getAllByText("Qualified").length).toBe(2);
    expect(getByText("Rewarded")).toBeTruthy();
    expect(getByText("₱1,000 bonus pending")).toBeTruthy();
  });

  it("copies the code", async () => {
    const Clipboard = require("expo-clipboard");
    const { getByLabelText, findByText } = render(<ReferralsScreen />);
    fireEvent.press(getByLabelText("Copy referral code"));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith("RHEA123"));
    expect(await findByText("Copied")).toBeTruthy();
  });

  it("says the 5% rule for creators and makes no peso claim for field agents", () => {
    mockRole = "affiliate";
    const creatorView = render(<ReferralsScreen />);
    expect(creatorView.getByText("You earn 5% of their sales")).toBeTruthy();
    creatorView.unmount();
    mockRole = "creator";
    const agentView = render(<ReferralsScreen />);
    expect(agentView.queryByText(/5%/)).toBeNull();
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
});
