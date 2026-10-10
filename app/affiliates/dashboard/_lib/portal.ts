import type { FunctionReturnType } from "convex/server";

import { buildLedger, type LedgerRow } from "@/app/wallet/_lib/ledger";
import type { api } from "@/convex/_generated/api";

export type AffiliatePortal = FunctionReturnType<typeof api.affiliates.portal>;

/** The portal already contains the caller's history, with no owner contacts. */
export function affiliateLedger(portal: AffiliatePortal): LedgerRow[] {
    return buildLedger(portal.earnings, portal.withdrawals, undefined);
}
