/**
 * Unit tests for app/(app)/(tabs)/wallet.tsx
 *
 * Mocks Convex hooks, Clerk, and Expo Router.
 */

import React from "react";
import { act, render, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert, BackHandler, Keyboard, Platform, StyleSheet } from 'react-native';
import WalletScreen from "../app/(app)/(tabs)/wallet";
import { Button } from '../components/v2';
let mockClerkId: string | null = 'clerk-user-1';
let mockConnected = true;
let mockFocused = true;
const mockMobileAccount = { isPreview: false, isAuthenticated: true, account: { role: 'creator' } };
jest.mock('../hooks/useMobileAccount', () => ({
  useMobileAccount: () => mockMobileAccount,
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock('@tendso/convex-client', () => ({
  api: new Proxy({}, { get: (_target, module) => new Proxy({}, {
    get: (_functions, name) => `${String(module)}:${String(name)}`,
  }) }),
}));

jest.mock("@clerk/clerk-expo", () => ({
  useUser: () => ({ user: mockClerkId ? { id: mockClerkId } : null }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: (effect: () => undefined | (() => void)) => {
    require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]);
  },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34 }),
}));

const mockCreateWithdrawal = jest.fn();
const mockUpdateCreator = jest.fn();
const mockUseQuery = jest.fn();
const mockResolvePhotos = jest.fn();
const mockConvexClient = { query: (...args: any[]) => mockResolvePhotos(...args) };
const mockSetDefaultPrice = jest.fn();
jest.mock('../hooks/useFieldAgentPrice', () => ({
  useFieldAgentPrice: () => ({ price: 2999, loaded: true, saving: false, error: '', setPrice: mockSetDefaultPrice }),
}));
const mockUseMutation = jest.fn((mutationKey: string) => {
  if (mutationKey === "creators:update") {
    return mockUpdateCreator;
  }
  return mockCreateWithdrawal;
});

jest.mock("convex/react", () => ({
  useConvex: () => mockConvexClient,
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: (...args: any[]) => mockUseMutation(...args),
}));

jest.mock("../providers/NetworkProvider", () => ({
  useNetwork: () => ({ isConnected: mockConnected }),
}), { virtual: true });

jest.mock("../components/OfflineBanner", () => ({
  OfflineBanner: () => null,
}), { virtual: true });

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockCreator = {
  _id: "creator-id-1",
  clerkId: 'clerk-user-1',
  status: 'active',
  balance: 1500,
  totalEarnings: 3000,
  totalWithdrawn: 750,
  wiseEmail: "juan@wise.com",
  firstName: "Juan",
  lastName: "dela Cruz",
};

const mockCreatorNoWise = {
  ...mockCreator,
  wiseEmail: undefined,
};

const mockEarnings = [
  { _id: "e1", submissionId: "submission-1", businessName: "Kalan", type: "submission_approved", amount: 1000, status: 'available', createdAt: Date.now() - 86400000 },
  { _id: "e2", submissionId: "submission-2", businessName: "Laundry", type: "submission_approved", amount: 500, status: 'withdrawn', createdAt: Date.now() - 172800000 },
];

const mockWithdrawals = [
  {
    _id: "w1",
    amount: 500,
    payoutMethod: "wise_email",
    wiseEmail: "juan@wise.com",
    wiseTransferId: "12345",
    status: "completed",
    createdAt: Date.now() - 86400000,
  },
];

const mockLegacyWithdrawals = [
  {
    _id: "w2",
    amount: 300,
    payoutMethod: "bank_transfer",
    bankName: "BDO",
    wiseTransferId: "67890",
    status: "completed",
    createdAt: Date.now() - 172800000,
  },
];

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function setupQueries(
  creator = mockCreator as any,
  earnings: any = mockEarnings,
  withdrawals = mockWithdrawals as any[],
  submissions: any[] = [
    { _id: "submission-1", creatorId: mockCreator._id, amount: 1999, status: "completed", photos: [] },
    { _id: "submission-2", creatorId: mockCreator._id, amount: 999, status: "paid", photos: [] },
  ]
) {
  mockUseQuery.mockImplementation((queryKey: string) => {
    if (queryKey === "creators:getByClerkId") return creator;
    if (queryKey === "earnings:getByCreator")  return earnings;
    if (queryKey === "withdrawals:getByCreator") return withdrawals;
    if (queryKey === "submissions:getByCreatorId") return submissions;
    return undefined;
  });
}

beforeEach(() => {
  mockClerkId = 'clerk-user-1'; mockConnected = true; mockFocused = true;
  mockResolvePhotos.mockResolvedValue([]);
  mockSetDefaultPrice.mockResolvedValue(true);
  Object.assign(mockMobileAccount, { isPreview: false, isAuthenticated: true, account: { role: 'creator' } });
});
afterEach(() => jest.restoreAllMocks());

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WalletScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupQueries();
  });

  it("renders the monthly hero and the available cash-out action in PHP", () => {
    const { getByText, getByTestId } = render(<WalletScreen />);
    expect(getByTestId("withdraw-button")).toBeTruthy();
    expect(getByText(/^You earned in /)).toBeTruthy();
    expect(getByText("Cash out ₱1,500 to Wise")).toBeTruthy();
    expect(getByTestId("withdraw-button")).toBeTruthy();
  });

  it("renders total earned and withdrawn stats", () => {
    const { getByText, getByLabelText } = render(<WalletScreen />);
    fireEvent.press(getByLabelText('View all earnings and payouts'));
    expect(getByText("₱3,000")).toBeTruthy();  // totalEarnings
    expect(getByText("₱750")).toBeTruthy();    // totalWithdrawn
  });

  it("shows withdraw button when balance > 0", () => {
    const { getByTestId } = render(<WalletScreen />);
    const btn = getByTestId("withdraw-button");
    expect(btn).toBeTruthy();
  });

  it("disables withdraw button when balance is 0", () => {
    setupQueries({ ...mockCreator, balance: 0 });
    const { getByTestId, getByText } = render(<WalletScreen />);
    const btn = getByTestId("withdraw-button");
    expect(btn.props.accessibilityState?.disabled ?? btn.props.disabled).toBeTruthy();
    expect(getByText("No balance available")).toBeTruthy();
  });

  it("shows loading spinner while creator data is undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    const { getByTestId } = render(<WalletScreen />);
    expect(getByTestId("activity-indicator") ?? true).toBeTruthy();
  });

  it("shows empty state when no earnings", () => {
    setupQueries(mockCreator, []);
    const { getByText } = render(<WalletScreen />);
    expect(getByText("Your first paid site will appear here.")).toBeTruthy();
  });

  it("identifies team commission credits separately from earlier referral bonuses", () => {
    const earnings = [
      { _id: "team", type: "creator_override", amount: 250, createdAt: Date.now() },
      { _id: "bonus", type: "referral_bonus", amount: 1000, createdAt: Date.now() },
    ];
    setupQueries(mockCreator, earnings);
    const view = render(<WalletScreen />);
    expect(view.getByText("5% team commission")).toBeTruthy();
    fireEvent.press(view.getByLabelText('View all earnings and payouts'));
    fireEvent.press(view.getByLabelText('History: Earned'));
    expect(view.getByText("From your invites")).toBeTruthy();
    expect(view.getByText("+₱250")).toBeTruthy();
  });

  it("shows empty state when no withdrawals", () => {
    setupQueries(mockCreator, mockEarnings, []);
    const { getByText, getByLabelText } = render(<WalletScreen />);
    fireEvent.press(getByLabelText('View all earnings and payouts'));
    fireEvent.press(getByLabelText('History: Cashed out'));
    expect(getByText('No cash-outs yet')).toBeTruthy();
  });

  it("renders recent earnings as +₱ rows and the history status chip", () => {
    const view = render(<WalletScreen />);
    expect(view.getByText("+₱1,000")).toBeTruthy();
    expect(view.getByText("+₱500")).toBeTruthy();
    expect(view.queryByTestId('payout-w1')).toBeNull();
    fireEvent.press(view.getByLabelText('View all earnings and payouts'));
    expect(view.getByText("−₱500")).toBeTruthy();
    expect(view.getByText("Completed")).toBeTruthy();
  });

  it("keeps the field-agent home focused on its price and latest earnings", () => {
    const view = render(<WalletScreen />);
    expect(view.getByText('Your price')).toBeTruthy();
    expect(view.getByRole('header', { name: 'Latest' })).toBeTruthy();
    expect(view.queryByText('Invite field agents')).toBeNull();
    expect(view.queryByText('Cash outs')).toBeNull();
    expect(view.queryByText('Available to cash out')).toBeNull();
  });

  it("renders withdrawal history with Wise email and transfer ID", () => {
    const view = render(<WalletScreen />);
    fireEvent.press(view.getByLabelText('View all earnings and payouts'));
    fireEvent.press(view.getByLabelText('History: Cashed out'));
    expect(view.getByText('juan@wise.com')).toBeTruthy();
    expect(view.getByText(/Wise #12345/)).toBeTruthy();
  });

  it("renders legacy withdrawal history with bank name", () => {
    setupQueries(mockCreator, mockEarnings, mockLegacyWithdrawals);
    const { getByText, getByLabelText } = render(<WalletScreen />);
    fireEvent.press(getByLabelText('View all earnings and payouts'));
    expect(getByText("BDO")).toBeTruthy();
  });

  it("opens withdrawal modal directly when creator has Wise email", () => {
    const { getByTestId } = render(<WalletScreen />);
    fireEvent.press(getByTestId("withdraw-button"));
    expect(getByTestId("withdrawal-modal")).toBeTruthy();
  });

  it("opens Wise setup modal when creator has no Wise email", () => {
    setupQueries(mockCreatorNoWise);
    const { getByTestId } = render(<WalletScreen />);
    fireEvent.press(getByTestId("withdraw-button"));
    expect(getByTestId("wise-setup-modal")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Wise Setup Modal tests
// ---------------------------------------------------------------------------

describe("WiseSetupModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupQueries(mockCreatorNoWise);
  });

  function openSetup() {
    const tree = render(<WalletScreen />);
    fireEvent.press(tree.getByTestId("withdraw-button"));
    return tree;
  }

  it("renders the Wise setup email input", () => {
    const { getByTestId } = openSetup();
    expect(getByTestId("wise-setup-email-input")).toBeTruthy();
  });

  it("renders the Create Wise Account button", () => {
    const { getByLabelText } = openSetup();
    expect(getByLabelText("Create Wise account")).toBeTruthy();
  });

  it("shows validation error for empty email", async () => {
    const { getByText, getByLabelText } = openSetup();
    fireEvent.press(getByLabelText("Continue to withdrawal"));
    await waitFor(() => {
      expect(getByText(/Please enter your Wise email/)).toBeTruthy();
    });
  });

  it("shows validation error for invalid email", async () => {
    const { getByTestId, getByText, getByLabelText } = openSetup();
    fireEvent.changeText(getByTestId("wise-setup-email-input"), "not-an-email");
    fireEvent.press(getByLabelText("Continue to withdrawal"));
    await waitFor(() => {
      expect(getByText(/Please enter a valid email/)).toBeTruthy();
    });
  });

  it("saves a trimmed Wise email through the canonical profile mutation", async () => {
    mockUpdateCreator.mockResolvedValue(undefined);
    const { getByTestId, getByLabelText } = openSetup();
    fireEvent.changeText(getByTestId("wise-setup-email-input"), " Juan@Wise.com ");
    fireEvent.press(getByLabelText("Continue to withdrawal"));
    await waitFor(() => {
      expect(mockUpdateCreator).toHaveBeenCalledWith({ id: "creator-id-1", wiseEmail: "Juan@Wise.com" });
    });
    expect(mockCreateWithdrawal).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Withdrawal Modal tests
// ---------------------------------------------------------------------------

describe("WithdrawalModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupQueries();
  });

  function openModal() {
    const tree = render(<WalletScreen />);
    fireEvent.press(tree.getByTestId("withdraw-button"));
    return tree;
  }

  it("renders amount and Wise email fields", () => {
    const { getByTestId } = openModal();
    expect(getByTestId("amount-input")).toBeTruthy();
    expect(getByTestId("wise-email-input")).toBeTruthy();
  });

  it("pre-fills Wise email from creator record", () => {
    const { getByTestId } = openModal();
    const emailInput = getByTestId("wise-email-input");
    expect(emailInput.props.value).toBe("juan@wise.com");
  });

  it("shows validation error when amount is zero or invalid", async () => {
    const { getByTestId, getByText, getByLabelText } = openModal();
    fireEvent.changeText(getByTestId("amount-input"), "0");
    fireEvent.press(getByLabelText("Confirm withdrawal"));
    await waitFor(() => {
      expect(getByText(/Please enter a valid amount/)).toBeTruthy();
    });
  });

  it("pre-picks the whole balance and lets the quick-pick pills change it", () => {
    const { getByTestId, getByText, getByLabelText } = openModal();
    expect(getByTestId("amount-input").props.value).toBe("1500");
    expect(getByText("Send ₱1,500 to Wise")).toBeTruthy();
    fireEvent.press(getByLabelText("Cash out ₱1,000"));
    expect(getByTestId("amount-input").props.value).toBe("1000");
    expect(getByText("Send ₱1,000 to Wise")).toBeTruthy();
  });

  it("keeps an above-balance amount visible and blocks it at confirmation", () => {
    const { getByTestId, getByLabelText, getByText } = openModal();
    const amountInput = getByTestId("amount-input");
    fireEvent.changeText(amountInput, "");
    fireEvent.changeText(amountInput, "9999");
    expect(amountInput.props.value).toBe("9999");
    fireEvent.press(getByLabelText('Confirm withdrawal'));
    expect(getByText('Amount exceeds your available balance.')).toBeTruthy();
    expect(mockCreateWithdrawal).not.toHaveBeenCalled();
  });

  it("shows validation error when Wise email is empty", async () => {
    const { getByTestId, getByText, getByLabelText } = openModal();
    fireEvent.changeText(getByTestId("amount-input"), "500");
    fireEvent.changeText(getByTestId("wise-email-input"), "");
    fireEvent.press(getByLabelText("Confirm withdrawal"));
    await waitFor(() => {
      expect(getByText(/Wise email is required/)).toBeTruthy();
    });
  });

  it("shows validation error for invalid email format", async () => {
    const { getByTestId, getByText, getByLabelText } = openModal();
    fireEvent.changeText(getByTestId("amount-input"), "500");
    fireEvent.changeText(getByTestId("wise-email-input"), "bad-email");
    fireEvent.press(getByLabelText("Confirm withdrawal"));
    await waitFor(() => {
      expect(getByText(/Please enter a valid email/)).toBeTruthy();
    });
  });

  it("calls createWithdrawal mutation with correct args on valid submit", async () => {
    mockCreateWithdrawal.mockResolvedValue("withdrawal-id-1");
    const { getByTestId, getByLabelText } = openModal();

    fireEvent.changeText(getByTestId("amount-input"), "500");
    // Wise email is pre-filled from creator record
    fireEvent.press(getByLabelText("Confirm withdrawal"));

    await waitFor(() => {
      expect(mockCreateWithdrawal).toHaveBeenCalledWith({
        creatorId: "creator-id-1",
        amount: 500,
        wiseEmail: "juan@wise.com",
      });
    });
  });

  it("shows error message when createWithdrawal mutation throws", async () => {
    mockCreateWithdrawal.mockRejectedValue(new Error("Insufficient balance"));
    const { getByTestId, getByText, getByLabelText } = openModal();

    fireEvent.changeText(getByTestId("amount-input"), "500");
    fireEvent.press(getByLabelText("Confirm withdrawal"));

    await waitFor(() => {
      expect(getByText(/Insufficient balance/)).toBeTruthy();
    });
  });
});

describe('Earn design and complete history', () => {
  beforeEach(() => { jest.clearAllMocks(); setupQueries(); });

  it('starts with the unboxed month, price card and three latest owned shop-photo rows', async () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({ _id: `latest-${index}`, submissionId: `own-${index}`,
      businessName: `Own shop ${index}`, type: 'submission_approved', amount: 1000 + index, status: 'available', createdAt: Date.now() - index * 1000 }));
    const own = rows.map((row, index) => ({ _id: row.submissionId, creatorId: mockCreator._id, photos: [`own-cover-${index}`],
      amount: [1999, 2999, 3999, 4999, 999][index], status: 'completed' }));
    setupQueries(mockCreator, rows, mockWithdrawals, own);
    mockResolvePhotos.mockResolvedValue(['https://example.com/own0.jpg', 'https://example.com/own1.jpg', 'https://example.com/own2.jpg']);
    const view = render(<WalletScreen />);
    expect(view.queryByText('Earn')).toBeNull();
    expect(view.getByRole('header', { name: /^You earned in / })).toBeTruthy();
    expect(view.getByText('Your price')).toBeTruthy();
    expect(view.getByLabelText('View all earnings and payouts')).toHaveStyle({ width: 48, height: 48 });
    expect(view.getAllByTestId(/^earning-/)).toHaveLength(3);
    expect(view.queryByTestId('earning-latest-3')).toBeNull();
    expect(view.queryByTestId(/^payout-/)).toBeNull();
    await waitFor(() => expect(mockResolvePhotos).toHaveBeenCalledWith('files:getMultipleUrls', { storageIds: ['own-cover-0', 'own-cover-1', 'own-cover-2'] }));
    expect(view.getByText(/^Paid ₱1,999/)).toBeTruthy();
    await waitFor(() => expect(view.getByLabelText('Own shop 0 photo')).toBeTruthy());
    await act(async () => { fireEvent.press(view.getByLabelText('View all earnings and payouts')); });
    expect(view.getByRole('header', { name: 'Payouts' })).toBeTruthy();
    expect(view.getByTestId('earning-latest-4')).toBeTruthy();
    expect(view.queryByText('Payout history')).toBeNull();
  });

  it('changes the future-site default from the price pills without writing a withdrawal', () => {
    const view = render(<WalletScreen />);
    expect(view.getByLabelText('New site price ₱2,999').props.accessibilityState.checked).toBe(true);
    fireEvent.press(view.getByLabelText('New site price ₱3,999'));
    expect(mockSetDefaultPrice).toHaveBeenCalledWith(3999);
    expect(mockCreateWithdrawal).not.toHaveBeenCalled();
    expect(mockUpdateCreator).not.toHaveBeenCalled();
  });

  it('preserves exact preview money and a readable cash-out action with large text and long names', () => {
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width: 320, height: 812, scale: 3, fontScale: 1.5 });
    const businessName = 'A very long community business name that still belongs to the actual earning';
    const wiseEmail = 'a.long.account.name.for.our.actual.recipient@example.com';
    setupQueries({ ...mockCreator, balance: 1234567.89 }, [{ _id: 'long-money', amount: 1234567.89, status: 'available',
      businessName, createdAt: Date.now() }], [{ ...mockWithdrawals[0], amount: 1234567.89, wiseEmail }]);
    const view = render(<WalletScreen />);
    expect(view.getByText(businessName).props.numberOfLines).toBe(2);
    expect(view.getByText('+₱1,234,567.89').props.numberOfLines).toBeUndefined();
    expect(view.getByText('₱1,234,567.89 to Wise')).toBeTruthy();
    expect(view.getByText('Cash out')).toBeTruthy();
    expect(view.getByTestId('withdraw-button').props.accessibilityLabel).toBe('Cash out ₱1,234,567.89 to Wise');
    fireEvent.press(view.getByLabelText('View all earnings and payouts'));
    expect(view.getByText(wiseEmail).props.numberOfLines).toBe(2);
    expect(view.getByText('−₱1,234,567.89').props.numberOfLines).toBeUndefined();
  });

  it('uses real credited calendar-month earnings and keeps pending money out of the trend', () => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 2, 12).getTime();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 2, 12).getTime();
    setupQueries(mockCreator, [
      { _id: 'available', amount: 1200.5, status: 'available', createdAt: thisMonth, businessName: 'Kalan' },
      { _id: 'withdrawn', amount: 200, status: 'withdrawn', createdAt: thisMonth, businessName: 'Laundry' },
      { _id: 'pending', amount: 9000, status: 'pending', createdAt: thisMonth, businessName: 'Pending shop' },
      { _id: 'last-month', amount: 400, status: 'available', createdAt: Number.NaN, _creationTime: lastMonth },
    ]);
    const view = render(<WalletScreen />);
    expect(view.getByLabelText('Earned this month, ₱1,400.50')).toBeTruthy();
    expect(view.getByLabelText(`${new Date(lastMonth).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}, ₱400 earned`)).toBeTruthy();
    expect(view.getByTestId('earnings-six-month-trend').children).toHaveLength(6);
    expect(view.getByText('Cash out ₱1,500 to Wise')).toBeTruthy();
    expect(view.getByText('Kalan')).toBeTruthy();
    expect(view.getByText('Your price')).toBeTruthy();
    fireEvent.press(view.getByLabelText('View all earnings and payouts'));
    fireEvent.press(view.getByLabelText('History: Earned'));
    expect(view.getByText('Pending shop')).toBeTruthy();
    expect(view.getByText('Pending')).toBeTruthy();
  });

  it('does not show a zero or empty earnings state while the ledger is loading', () => {
    setupQueries(mockCreator, undefined, undefined as any);
    // setupQueries defaults are useful elsewhere; explicitly model pending subscriptions here.
    mockUseQuery.mockImplementation((key: string) => key === 'creators:getByClerkId' ? mockCreator : undefined);
    const view = render(<WalletScreen />);
    expect(view.getByText('Loading earnings…')).toBeTruthy();
    expect(view.getByText('Loading recent earnings…')).toBeTruthy();
    expect(view.queryByText('No earnings yet')).toBeNull();
    expect(view.queryByLabelText('Earned this month, ₱0')).toBeNull();
    expect(view.queryByTestId('earnings-six-month-trend')).toBeNull();
    fireEvent.press(view.getByLabelText('View all earnings and payouts'));
    expect(view.getByText('Loading history…')).toBeTruthy();
  });

  it('renders true zero data without manufactured bars or growth claims', () => {
    setupQueries({ ...mockCreator, balance: 0, totalEarnings: 0, totalWithdrawn: 0 }, [], []);
    const view = render(<WalletScreen />);
    expect(view.getByLabelText('Earned this month, ₱0')).toBeTruthy();
    expect(view.getByText('No earnings recorded in the last six months.')).toBeTruthy();
    expect(view.queryByTestId('earnings-six-month-trend')).toBeNull();
    expect(view.getByText('No balance available')).toBeTruthy();
  });

  it.each([3750.5, 1234567.89])('keeps the exact available balance %s in the payout summary at375pt', balance => {
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width: 375, height: 812, scale: 3, fontScale: 1 });
    setupQueries({ ...mockCreator, balance });
    const view = render(<WalletScreen />);
    fireEvent.press(view.getByLabelText('View all earnings and payouts'));
    const expected = `₱${balance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const text = view.getByLabelText(`Ready, ${expected}`);
    expect(text).toHaveTextContent(expected);
    const style = StyleSheet.flatten(text.props.style);
    expect(style.fontSize).toBeLessThanOrEqual(17);
    expect(style.fontSize).toBeGreaterThanOrEqual(16);
    expect(style.lineHeight).toBeGreaterThan(style.fontSize);
    expect(text.props.adjustsFontSizeToFit).not.toBe(true);
  });

  it.each([
    { earned: 41500.5, withdrawn: 37750.25 },
    { earned: 12345678.9, withdrawn: 9100000.12 },
  ])('preserves complete lifetime totals with centavos in Payouts ($earned / $withdrawn)', ({ earned, withdrawn }) => {
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width: 375, height: 812, scale: 3, fontScale: 1 });
    setupQueries({ ...mockCreator, totalEarnings: earned, totalWithdrawn: withdrawn });
    const view = render(<WalletScreen />);
    fireEvent.press(view.getByLabelText('View all earnings and payouts'));
    const earnedValue = view.getByLabelText(`Earned, ₱${earned.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    const withdrawnValue = view.getByLabelText(`Cashed out, ₱${withdrawn.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    expect(earnedValue).toHaveTextContent(`₱${earned.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    expect(withdrawnValue).toHaveTextContent(`₱${withdrawn.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    const earnedStyle = StyleSheet.flatten(earnedValue.props.style);
    const withdrawnStyle = StyleSheet.flatten(withdrawnValue.props.style);
    expect(earnedStyle.fontSize).toBeGreaterThanOrEqual(16);
    expect(earnedStyle.fontSize).toBeLessThanOrEqual(17);
    expect(earnedStyle.fontSize).toBe(withdrawnStyle.fontSize);
    expect(earnedValue.props.adjustsFontSizeToFit).not.toBe(true);
  });

  it('draws no visible current-month bar when its actual total is zero', () => {
    const now = new Date();
    setupQueries(mockCreator, [{ _id: 'prior-credit', amount: 500, status: 'available',
      createdAt: new Date(now.getFullYear(), now.getMonth() - 1, 2, 12).getTime() }]);
    const view = render(<WalletScreen />);
    const currentBar = StyleSheet.flatten(view.getByTestId(`earnings-bar-${now.getFullYear()}-${now.getMonth()}`).props.style);
    expect(currentBar.height).toBe(0);
    expect(currentBar.borderWidth ?? 0).toBe(0);
    expect(view.getByLabelText('Earned this month, ₱0')).toBeTruthy();
  });

  it('makes records beyond the home preview reachable and filters complete month-grouped history', () => {
    const now = new Date();
    const rows = Array.from({ length: 9 }, (_, index) => ({ _id: `long-${index}`, amount: index + 1,
      type: 'submission_approved', status: 'available', businessName: `History shop ${index}`,
      createdAt: new Date(now.getFullYear(), now.getMonth() - Math.floor(index / 3), 20 - index, 12).getTime() }));
    const payouts = Array.from({ length: 7 }, (_, index) => ({ ...mockWithdrawals[0], _id: `payout-${index}`, amount: index + 100,
      createdAt: new Date(now.getFullYear(), now.getMonth() - Math.floor(index / 3), 19 - index, 12).getTime() }));
    setupQueries(mockCreator, rows, payouts);
    const view = render(<WalletScreen />);
    expect(view.queryByText('History shop 8')).toBeNull();
    fireEvent.press(view.getByLabelText('View all earnings and payouts'));
    expect(view.getByTestId('wallet-history')).toBeTruthy();
    expect(view.getByText('History shop 8')).toBeTruthy();
    expect(view.getByTestId('payout-payout-6')).toBeTruthy();
    expect(view.getByText(new Date(now.getFullYear(), now.getMonth() - 2, 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }))).toBeTruthy();
    fireEvent.press(view.getByLabelText('History: Earned'));
    expect(view.getByText('History shop 8')).toBeTruthy();
    expect(view.queryByTestId('payout-payout-6')).toBeNull();
    fireEvent.press(view.getByLabelText('History: Cashed out'));
    expect(view.queryByText('History shop 8')).toBeNull();
    expect(view.getByTestId('payout-payout-6')).toBeTruthy();
    fireEvent.press(view.getByLabelText('History: All'));
    expect(view.getByText('History shop 8')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Back'));
    expect(view.queryByTestId('wallet-history')).toBeNull();
    expect(view.getByTestId('withdraw-button')).toBeTruthy();
  });

  it('opens complete mixed Payouts and switches between earnings and cash-outs', () => {
    const view = render(<WalletScreen />);
    fireEvent.press(view.getByLabelText('View all earnings and payouts'));
    expect(view.getByLabelText('History: All').props.accessibilityState.selected).toBe(true);
    expect(view.getByTestId('earning-e1')).toBeTruthy();
    expect(view.getByTestId('payout-w1')).toBeTruthy();
    fireEvent.press(view.getByLabelText('History: Earned'));
    expect(view.getByLabelText('History: Earned').props.accessibilityState.selected).toBe(true);
    expect(view.queryByTestId('payout-w1')).toBeNull();
    fireEvent.press(view.getByLabelText('History: Cashed out'));
    expect(view.getByLabelText('History: Cashed out').props.accessibilityState.selected).toBe(true);
    expect(view.queryByTestId('earning-e1')).toBeNull();
    expect(view.getByTestId('payout-w1')).toBeTruthy();
  });

  it('shows failed payout explanations and legacy bank transfers in full history', () => {
    setupQueries(mockCreator, mockEarnings, [{ ...mockLegacyWithdrawals[0], status: 'failed',
      failureReason: 'Recipient details could not be verified.', reference: 'PAYOUT-LEGACY-1' }]);
    const view = render(<WalletScreen />);
    fireEvent.press(view.getByLabelText('View all earnings and payouts'));
    fireEvent.press(view.getByLabelText('History: Cashed out'));
    expect(view.getByText('BDO')).toBeTruthy();
    expect(view.getByText('Failed')).toBeTruthy();
    expect(view.getByText('Recipient details could not be verified.')).toBeTruthy();
    expect(view.getByText('PAYOUT-LEGACY-1')).toBeTruthy();
    expect(view.getByText('Wise #67890')).toBeTruthy();
  });

  it('does not invent offline balances or leak an unmatched account ledger', () => {
    mockConnected = false;
    setupQueries(undefined as any);
    mockUseQuery.mockImplementation((key: string) => key === 'creators:getByClerkId' ? undefined : mockEarnings);
    const view = render(<WalletScreen />);
    expect(view.getByText('Balance unavailable')).toBeTruthy();
    expect(view.getByText('Reconnect to load your monthly earnings.')).toBeTruthy();
    expect(view.queryByText('₱0')).toBeNull();
    expect(view.queryByTestId('earning-e1')).toBeNull();
    expect(view.getByTestId('withdraw-button').props.accessibilityState.disabled).toBe(true);
  });

  it('keeps known history readable offline while blocking cash-out', () => {
    mockConnected = false;
    const view = render(<WalletScreen />);
    expect(view.getByTestId('withdraw-button').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(view.getByLabelText('View all earnings and payouts'));
    fireEvent.press(view.getByLabelText('History: Cashed out'));
    expect(view.getByText('Wise #12345')).toBeTruthy();
    expect(mockCreateWithdrawal).not.toHaveBeenCalled();
  });

  it('asks to reconnect for missing offline history without hiding known transfers', () => {
    mockConnected = false;
    mockUseQuery.mockImplementation((key: string) => key === 'creators:getByClerkId' ? mockCreator
      : key === 'withdrawals:getByCreator' ? mockWithdrawals : undefined);
    const view = render(<WalletScreen />);
    fireEvent.press(view.getByLabelText('View all earnings and payouts'));
    expect(view.getByText('Reconnect to load your complete history.')).toBeTruthy();
    expect(view.getByText('Wise #12345')).toBeTruthy();
    expect(view.queryByText('Loading history…')).toBeNull();
  });

  it('hides money when a creator response belongs to a different Clerk subject', () => {
    setupQueries({ ...mockCreator, clerkId: 'someone-else' });
    const view = render(<WalletScreen />);
    expect(view.getByTestId('activity-indicator')).toBeTruthy();
    expect(view.queryByText('₱1,500')).toBeNull();
    expect(view.queryByTestId('earning-e1')).toBeNull();
    expect(mockUseQuery).toHaveBeenCalledWith('earnings:getByCreator', 'skip');
  });

  it('masks stale query data when authentication is lost', () => {
    const view = render(<WalletScreen />);
    fireEvent.press(view.getByTestId('withdraw-button'));
    mockMobileAccount.isAuthenticated = false;
    view.rerender(<WalletScreen />);
    expect(view.queryByTestId('amount-input')).toBeNull();
    expect(view.queryByTestId('earning-e1')).toBeNull();
    expect(view.getByText('Balance unavailable')).toBeTruthy();
    expect(mockUseQuery).toHaveBeenCalledWith('creators:getByClerkId', 'skip');
  });

  it('uses the affiliate portal summary and histories through the shared wallet route', () => {
    mockMobileAccount.account.role = 'affiliate';
    mockUseQuery.mockImplementation((key: string) => {
      if (key === 'creators:getByClerkId') return { ...mockCreator, role: 'affiliate' };
      if (key === 'affiliates:portal') return { summary: { balance: 250.75, totalEarned: 4000, totalWithdrawn: 3749.25 },
        earnings: [{ _id: 'affiliate-e', amount: 250.75, status: 'available', type: 'creator_override', businessName: 'Team shop', createdAt: Date.now() }],
        withdrawals: [{ ...mockWithdrawals[0], _id: 'affiliate-w', amount: 3749.25 }] };
      return undefined;
    });
    const view = render(<WalletScreen />);
    expect(view.getByText('Cash out ₱250.75 to Wise')).toBeTruthy();
    expect(view.getByText('Team shop')).toBeTruthy();
    expect(view.getByText('₱4,000')).toBeTruthy();
    expect(view.queryByTestId('field-agent-price-card')).toBeNull();
    expect(mockUseQuery).toHaveBeenCalledWith('earnings:getByCreator', 'skip');
    expect(mockUseQuery).toHaveBeenCalledWith('withdrawals:getByCreator', 'skip');
    fireEvent.press(view.getByLabelText('All cash-outs'));
    expect(view.getByTestId('payout-affiliate-w')).toBeTruthy();
    expect(view.getByText('−₱3,749.25')).toBeTruthy();
  });

  it('handles Android hardware Back only while the history screen is focused', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const removed = jest.fn();
    let back: (() => boolean | null | undefined) | undefined;
    const listener = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => { back = handler; return { remove: removed }; });
    const view = render(<WalletScreen />);
    expect(listener).not.toHaveBeenCalled();
    fireEvent.press(view.getByLabelText('View all earnings and payouts'));
    expect(listener).toHaveBeenCalledTimes(1);
    mockFocused = false;
    view.rerender(<WalletScreen />);
    expect(removed).toHaveBeenCalledTimes(1);
    mockFocused = true;
    view.rerender(<WalletScreen />);
    expect(listener).toHaveBeenCalledTimes(2);
    act(() => { expect(back?.()).toBe(true); });
    expect(view.queryByTestId('wallet-history')).toBeNull();
    expect(view.getByTestId('withdraw-button')).toBeTruthy();
  });
});

describe('Wise payout lifecycle safety', () => {
  beforeEach(() => { jest.clearAllMocks(); setupQueries(); });

  it('preserves centavos and permits a positive cash-out below one peso', async () => {
    setupQueries({ ...mockCreator, balance: 0.5 });
    mockCreateWithdrawal.mockResolvedValue('tiny-payout');
    const view = render(<WalletScreen />);
    expect(view.getByText('Cash out ₱0.50 to Wise')).toBeTruthy();
    fireEvent.press(view.getByTestId('withdraw-button'));
    fireEvent.press(view.getByLabelText('Confirm withdrawal'));
    await waitFor(() => expect(mockCreateWithdrawal).toHaveBeenCalledWith({ creatorId: mockCreator._id, amount: 0.5, wiseEmail: mockCreator.wiseEmail }));
  });

  it.each(['100abc', '0.001', 'Infinity', '-1'])('rejects malformed or sub-cent amounts: %s', async input => {
    const view = render(<WalletScreen />);
    fireEvent.press(view.getByTestId('withdraw-button'));
    fireEvent.changeText(view.getByTestId('amount-input'), input);
    expect(view.getByTestId('amount-input').props.value).toBe(input);
    fireEvent.press(view.getByLabelText('Confirm withdrawal'));
    expect(view.getByText('Please enter a valid amount.')).toBeTruthy();
    expect(mockCreateWithdrawal).not.toHaveBeenCalled();
  });

  it('locks duplicate withdrawal calls synchronously until the request resolves', async () => {
    let resolve!: (value: string) => void;
    mockCreateWithdrawal.mockImplementation(() => new Promise<string>(done => { resolve = done; }));
    const view = render(<WalletScreen />);
    fireEvent.press(view.getByTestId('withdraw-button'));
    const submit = view.UNSAFE_getAllByType(Button).find(button => button.props.accessibilityLabel === 'Confirm withdrawal')!.props.onPress;
    act(() => { void submit(); void submit(); });
    expect(mockCreateWithdrawal).toHaveBeenCalledTimes(1);
    await act(async () => { resolve('withdrawal-id'); });
    expect(view.queryByTestId('amount-input')).toBeNull();
  });

  it('blocks a stale confirm callback after the network disconnects', () => {
    const view = render(<WalletScreen />);
    fireEvent.press(view.getByTestId('withdraw-button'));
    const submit = view.UNSAFE_getAllByType(Button).find(button => button.props.accessibilityLabel === 'Confirm withdrawal')!.props.onPress;
    mockConnected = false;
    view.rerender(<WalletScreen />);
    act(() => { void submit(); });
    expect(view.getByLabelText('Confirm withdrawal').props.accessibilityState.disabled).toBe(true);
    expect(mockCreateWithdrawal).not.toHaveBeenCalled();
  });

  it.each(['suspended', 'deleted'])('blocks cash-out when the account becomes %s', status => {
    const view = render(<WalletScreen />);
    fireEvent.press(view.getByTestId('withdraw-button'));
    setupQueries({ ...mockCreator, status });
    view.rerender(<WalletScreen />);
    fireEvent.press(view.getByLabelText('Confirm withdrawal'));
    expect(view.getByLabelText('Confirm withdrawal').props.accessibilityState.disabled).toBe(true);
    expect(mockCreateWithdrawal).not.toHaveBeenCalled();
  });

  it('does not show an old withdrawal result after switching accounts', async () => {
    let resolve!: (value: string) => void;
    mockCreateWithdrawal.mockImplementation(() => new Promise<string>(done => { resolve = done; }));
    const alert = jest.spyOn(Alert, 'alert');
    const view = render(<WalletScreen />);
    fireEvent.press(view.getByTestId('withdraw-button'));
    fireEvent.press(view.getByLabelText('Confirm withdrawal'));
    mockClerkId = 'clerk-user-2';
    setupQueries({ ...mockCreator, _id: 'creator-2', clerkId: mockClerkId, balance: 12, wiseEmail: 'second@wise.com' }, [], []);
    view.rerender(<WalletScreen />);
    expect(view.queryByTestId('amount-input')).toBeNull();
    expect(view.getByText('Cash out ₱12 to Wise')).toBeTruthy();
    await act(async () => { resolve('old-withdrawal'); });
    expect(alert).not.toHaveBeenCalled();
    expect(view.queryByTestId('amount-input')).toBeNull();
  });

  it('does not reopen an old Wise editor after an account switch', async () => {
    let resolve!: () => void;
    setupQueries(mockCreatorNoWise);
    mockUpdateCreator.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
    const view = render(<WalletScreen />);
    fireEvent.press(view.getByTestId('withdraw-button'));
    fireEvent.changeText(view.getByTestId('wise-setup-email-input'), 'old@wise.com');
    fireEvent.press(view.getByLabelText('Continue to withdrawal'));
    mockClerkId = 'clerk-user-2';
    setupQueries({ ...mockCreator, _id: 'creator-2', clerkId: mockClerkId, wiseEmail: 'new@wise.com' }, [], []);
    view.rerender(<WalletScreen />);
    await act(async () => { resolve(); });
    expect(view.queryByTestId('amount-input')).toBeNull();
    expect(view.queryByTestId('wise-setup-email-input')).toBeNull();
    expect(mockCreateWithdrawal).not.toHaveBeenCalled();
  });

  it('keeps withdrawal content scrollable and reduces its bounds while the keyboard is shown', () => {
    const callbacks = new Map<string, (event: any) => void>();
    jest.spyOn(Keyboard, 'addListener').mockImplementation((name, callback) => { callbacks.set(name, callback); return { remove: jest.fn() }; });
    const view = render(<WalletScreen />);
    fireEvent.press(view.getByTestId('withdraw-button'));
    const before = StyleSheet.flatten(view.getByTestId('wallet-withdraw-scroll').props.style).maxHeight;
    expect(view.getByTestId('wallet-withdraw-scroll').props.keyboardShouldPersistTaps).toBe('handled');
    act(() => callbacks.get(Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow')?.({ endCoordinates: { screenY: 100 } }));
    const after = StyleSheet.flatten(view.getByTestId('wallet-withdraw-scroll').props.style).maxHeight;
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThanOrEqual(160);
    act(() => callbacks.get('keyboardDidHide')?.({}));
    expect(StyleSheet.flatten(view.getByTestId('wallet-withdraw-scroll').props.style).maxHeight).toBe(before);
  });
});
