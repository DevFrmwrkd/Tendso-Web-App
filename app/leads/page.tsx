"use client";

/**
 * /leads — the creator's Leads (board: Leads), inside the creator frame.
 *
 * The screen itself is app/leads/_components/LeadsScreen.tsx: the ranked
 * prospects and the team's interviewed leads, the lead drawer (?lead=<id>,
 * which /leads/[leadId] now redirects to), and Find a local business.
 *
 * URL state:
 *   (default)          For you: prospects nobody else has claimed
 *   ?tab=mine | all    Claimed by me | All shops
 *   ?tab=interviewed   The team's interviewed leads (the old default tab)
 *   ?tab=prospects     The old Prospects tab; opens For you
 *   ?lead=<id>         That lead, open in the right drawer
 *   ?find=1            Find a local business, open (the Leads map's
 *                      "Find more businesses" links here)
 * Other parameters are kept when one of these changes.
 *
 * Spec: docs/changes/WEB-BUILD-CRM.md (Creators platform integration).
 */
import { Suspense } from "react";

import { ErrorState } from "@/components/r1";
import { CreatorShell } from "@/components/shells/CreatorShell";

import { LeadsErrorBoundary } from "./_components/LeadsErrorBoundary";
import { LeadsLoading, LeadsScreen } from "./_components/LeadsScreen";

export default function CreatorLeadsPage() {
    return (
        <CreatorShell>
            <LeadsErrorBoundary fallback={(reference) => <ErrorState what="Leads" reference={reference} />}>
                {/* The screen reads ?tab=, ?lead= and ?find= with useSearchParams. In
                    Next 16 that has to render under a Suspense boundary, or the
                    production build fails. */}
                <Suspense fallback={<LeadsLoading />}>
                    <LeadsScreen />
                </Suspense>
            </LeadsErrorBoundary>
        </CreatorShell>
    );
}
