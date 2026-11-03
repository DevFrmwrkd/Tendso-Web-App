import type { Metadata } from "next";
import { Suspense } from "react";

import { OwnerPageHeader, OwnerShell } from "@/components/shells/OwnerShell";
import { OwnerSectionBoundary } from "../_components/OwnerSectionBoundary";
import { OwnerNotifications, OwnerNotificationsView } from "./_components/OwnerNotifications";

export const metadata: Metadata = {
    title: "Notifications — Your businesses",
    robots: { index: false, follow: false },
};

export default function OwnerNotificationsPage() {
    return <OwnerShell>
        <OwnerPageHeader title="Notifications" subtitle="Your visits, payments and website updates, together." />
        <OwnerSectionBoundary label="Notifications">
            <Suspense fallback={<OwnerNotificationsView inbox={undefined} />}>
                <OwnerNotifications />
            </Suspense>
        </OwnerSectionBoundary>
    </OwnerShell>;
}
