/**
 * Unit tests for app/(app)/(tabs)/wallet.tsx
 *
 * Mocks Convex hooks, Clerk, and Expo Router.
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import WalletScreen from "../app/(app)/(tabs)/wallet";
jest.mock('../hooks/useMobileAccount', () => ({
  useMobileAccount: () => ({ isPreview: false, account: { role: 'creator' } }),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@clerk/clerk-expo", () => ({
  useUser: () => ({ user: { id: "clerk-user-1" } }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34 }),
}));

const mockCreateWithdrawal = jest.fn();
const mockUpdateCreator = jest.fn();
const mockUseQuery = jest.fn();
const mockUseMutation = jest.fn((mutationKey: string) => {
  if (mutationKey === "creators:update") {
    return mockUpdateCreator;
  }
  return mockCreateWithdrawal;
});

jest.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: (...args: any[]) => mockUseMutation(...args),
}));

jest.mock("../providers/NetworkProvider", () => ({
  useNetwork: () => ({ isConnected: true }),
}), { virtual: true });

jest.mock("../components/OfflineBanner", () => ({
  OfflineBanner: () => null,
}), { virtual: true });

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockCreator = {
  _id: "creator-id-1",
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
  { _id: "e1", amount: 1000, createdAt: Date.now() - 86400000 },
  { _id: "e2", amount: 500,  createdAt: Date.now() - 172800000 },
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
  earnings = mockEarnings,
  withdrawals = mockWithdrawals as any[]
) {
  mockUseQuery.mockImplementation((queryKey: string) => {
    if (queryKey === "creators:getByClerkId") return creator;
    if (queryKey === "earnings:getByCreator")  return earnings;
    if (queryKey === "withdrawals:getByCreator") return withdrawals;
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WalletScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupQueries();
  });

  it("renders the available balance and the cash out button in PHP", () => {
    const { getByText, getByTestId } = render(<WalletScreen />);
    expect(getByText("₱1,500")).toBeTruthy();
    expect(getByText("Available to cash out")).toBeTruthy();
    expect(getByText("Cash out ₱1,500 to Wise")).toBeTruthy();
    expect(getByTestId("withdraw-button")).toBeTruthy();
  });

  it("renders total earned and withdrawn stats", () => {
    const { getByText } = render(<WalletScreen />);
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
    expect(getByText("No earnings yet")).toBeTruthy();
  });

  it("shows empty state when no withdrawals", () => {
    setupQueries(mockCreator, mockEarnings, []);
    const { getByText } = render(<WalletScreen />);
    expect(getByText(/Your withdrawal history will show up here once you cash out/)).toBeTruthy();
  });

  it("renders recent earnings as +₱ rows and the history status chip", () => {
    const { getByText } = render(<WalletScreen />);
    expect(getByText("+₱1,000")).toBeTruthy();
    expect(getByText("+₱500")).toBeTruthy();
    expect(getByText("−₱500")).toBeTruthy();
    expect(getByText("Completed")).toBeTruthy();
  });

  it("links to the Invite field agents screen", () => {
    const { getByLabelText, getByText } = render(<WalletScreen />);
    expect(getByText("Invite field agents")).toBeTruthy();
    expect(getByLabelText("View your referrals")).toBeTruthy();
  });

  it("renders withdrawal history with Wise email and transfer ID", () => {
    const { getByText } = render(<WalletScreen />);
    expect(getByText(/Wise \u00b7 juan@wise\.com/)).toBeTruthy();
    expect(getByText(/Wise #12345/)).toBeTruthy();
  });

  it("renders legacy withdrawal history with bank name", () => {
    setupQueries(mockCreator, mockEarnings, mockLegacyWithdrawals);
    const { getByText } = render(<WalletScreen />);
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

  it("prevents typing amount exceeding balance (input is capped)", () => {
    const { getByTestId } = openModal();
    const amountInput = getByTestId("amount-input");
    fireEvent.changeText(amountInput, "");
    fireEvent.changeText(amountInput, "9999");
    // The onChangeText handler rejects values > balance, so the input stays empty
    expect(amountInput.props.value).toBe("");
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
