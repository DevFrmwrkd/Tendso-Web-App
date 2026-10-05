import { Suspense } from "react";

import AccountView, { AccountFallback } from "./_components/AccountView";

/**
 * /profile is Account (board Account), for every role. The view reads
 * ?edit=… and ?certificate=1 with useSearchParams, which in Next 16 has to sit
 * under a <Suspense> boundary or the production build fails.
 */
export default function ProfilePage() {
    return (
        <Suspense fallback={<AccountFallback />}>
            <AccountView />
        </Suspense>
    );
}
