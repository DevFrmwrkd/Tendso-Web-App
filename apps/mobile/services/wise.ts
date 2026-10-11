/**
 * Wise API Client — pure functions, no Convex dependencies.
 * Easily unit-testable via fetch mocks.
 *
 * Sandbox: https://api.sandbox.transferwise.tech
 * Production: https://api.wise.com
 */

/** Generate a RFC 4122 v4 UUID using only Math.random (no Node deps). */
function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const BASE_URL = {
  sandbox: "https://api.sandbox.transferwise.tech",
  production: "https://api.wise.com",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WiseConfig = {
  token: string;
  profileId: number;
  sandbox?: boolean; // defaults to true for safety
  privateKeyB64?: string; // Base64-encoded RSA private key PEM for SCA-signed funding
  /**
   * Wise "Creator Payout" jar/balance ID. When set, creator withdrawals
   * are funded from this jar instead of the main PHP balance.
   */
  creatorPayoutBalanceId?: number;
};

/** @deprecated Use EmailRecipientDetails instead for new Wise email-based withdrawals. */
export type RecipientDetails = {
  accountHolderName: string;
  accountNumber: string;
  bankCode: string;      // Wise short code (e.g. "BDO", "BPI", "MBTC") — from WISE_PH_BANKS
  city: string;          // Recipient's city (required by Wise for PH accounts)
  accountType?: string;  // Wise account type — defaults to "philippines"
};

export type EmailRecipientDetails = {
  email: string;              // Creator's Wise email address
  accountHolderName: string;  // Creator's full name
};

export type WiseRecipient = {
  id: number;
  currency: string;
  accountHolderName: string;
};

export type WiseQuote = {
  id: number;
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount: number;
  targetAmount: number;
  rate: number;
};

export type WiseTransfer = {
  id: number;
  targetAccount: number;
  status: string;
  reference: string;
  customerTransactionId: string;
};

export type WiseFundResult = {
  type: string;
  status: string;
  errorCode: string | null;
};

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class WiseError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly body: unknown
  ) {
    super(message);
    this.name = "WiseError";
  }
}

// ---------------------------------------------------------------------------
// Internal request helper
// ---------------------------------------------------------------------------

async function wiseRequest<T>(
  config: WiseConfig,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const base = config.sandbox === false ? BASE_URL.production : BASE_URL.sandbox;
  const url = `${base}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    let errorBody: unknown = {};
    try { errorBody = JSON.parse(errorText); } catch {}
    console.error(`[Wise API] ${method} ${path} → ${res.status}`, errorText);
    throw new WiseError(
      `Wise API ${method} ${path} returned ${res.status}: ${errorText}`,
      res.status,
      errorBody
    );
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

/**
 * Fetch the account requirements for a PHP transfer.
 * Use this to discover the correct `type` and required fields for recipients.
 *
 * Example:
 *   const reqs = await getAccountRequirements(config, 500);
 *   console.log(reqs.map(r => r.type)); // ["philippines", ...]
 */
export async function getAccountRequirements(
  config: WiseConfig,
  amountPHP: number
): Promise<unknown[]> {
  return wiseRequest<unknown[]>(
    config,
    "GET",
    `/v1/account-requirements?source=PHP&target=PHP&sourceAmount=${amountPHP}&targetCurrency=PHP`
  );
}

/**
 * Create an email-based recipient for PHP transfers via Wise.
 * The creator must have a Wise account registered with the given email.
 */
export async function createEmailRecipient(
  config: WiseConfig,
  details: EmailRecipientDetails
): Promise<WiseRecipient> {
  return wiseRequest<WiseRecipient>(config, "POST", "/v1/accounts", {
    currency: "PHP",
    type: "email",
    profile: config.profileId,
    ownedByCustomer: false,
    accountHolderName: details.accountHolderName,
    details: {
      email: details.email,
    },
  });
}

/**
 * @deprecated Use createEmailRecipient instead for new email-based withdrawals.
 * Create a recipient (bank account) for PHP transfers in the Philippines.
 * The `accountType` field should come from getAccountRequirements() — defaults to "philippines".
 */
export async function createRecipient(
  config: WiseConfig,
  details: RecipientDetails
): Promise<WiseRecipient> {
  const type = details.accountType ?? "philippines";

  return wiseRequest<WiseRecipient>(config, "POST", "/v1/accounts", {
    currency: "PHP",
    type,
    profile: config.profileId,
    ownedByCustomer: false,
    accountHolderName: details.accountHolderName,
    details: {
      legalType: "PRIVATE",
      bankCode: details.bankCode,
      accountNumber: details.accountNumber,
      address: {
        city: details.city,
        country: "PH",
      },
    },
  });
}

/**
 * Create a quote for a PHP-to-PHP transfer (same-currency local transfer).
 *
 * Uses `targetAmount` so the recipient receives the exact `amountPHP` requested;
 * Wise's transfer fee is added on top and debited from the platform's PHP
 * balance. With `sourceAmount` the fee would be deducted from `amountPHP`,
 * leaving the creator with less than they withdrew (e.g. ₱100 → ₱83.22 received).
 *
 * @param sourceBalanceId  Optional — Wise balance/jar ID to fund from.
 *   When provided, Wise will suggest this balance (e.g. "Creator Payout" jar)
 *   when the admin approves the transfer in the dashboard. Without this,
 *   Wise defaults to the main PHP balance.
 */
export async function createQuote(
  config: WiseConfig,
  amountPHP: number,
  sourceBalanceId?: number
): Promise<WiseQuote> {
  const body: Record<string, unknown> = {
    profile: config.profileId,
    source: "PHP",
    target: "PHP",
    targetAmount: amountPHP,
    rateType: "FIXED",
    type: "REGULAR",
  };

  if (sourceBalanceId) {
    body.payOut = "BALANCE";
    body.preferredPayIn = "BALANCE";
    body.sourceBalanceId = sourceBalanceId;
  }

  return wiseRequest<WiseQuote>(config, "POST", "/v1/quotes", body);
}

/**
 * Create a transfer using a quote and recipient.
 * @param reference  Used as the payment reference (e.g. the withdrawal Convex ID).
 */
export async function createTransfer(
  config: WiseConfig,
  recipientId: number,
  quoteId: number,
  reference: string
): Promise<WiseTransfer> {
  return wiseRequest<WiseTransfer>(config, "POST", "/v1/transfers", {
    targetAccount: recipientId,
    quote: quoteId,
    customerTransactionId: uuidv4(),
    details: { reference },
  });
}

/**
 * Fund and execute a transfer.
 * In sandbox: simulates processing via the simulation endpoint.
 * In production: skipped — admin manually approves/funds in the Wise dashboard.
 */
export async function fundTransfer(
  config: WiseConfig,
  transferId: number
): Promise<WiseFundResult> {
  if (config.sandbox !== false) {
    return wiseRequest<WiseFundResult>(
      config,
      "GET",
      `/v1/simulation/transfers/${transferId}/processing`
    );
  }

  // Production: transfer is created and visible in the Wise dashboard.
  // Admin manually funds it from there. Wise webhook notifies us when complete.
  console.log(`[Wise] Transfer ${transferId} created — awaiting manual funding in Wise dashboard`);
  return {
    type: "BALANCE",
    status: "WAITING_FOR_APPROVAL",
    errorCode: null,
  };
}

/**
 * Fetch the current state of a transfer.
 */
export async function getTransfer(
  config: WiseConfig,
  transferId: number
): Promise<WiseTransfer> {
  return wiseRequest<WiseTransfer>(config, "GET", `/v1/transfers/${transferId}`);
}
