import { Suspense } from "react";

import { FunnelFallback } from "./_funnel/FunnelFrame";
import { LearnPage } from "./_funnel/LearnPage";

/**
 * Training (board Certification, stage 2 "Learn"). The lessons read ?lesson=
 * with useSearchParams, which in Next 16 has to sit under <Suspense>.
 */
export default function TrainingPage() {
    return (
        <Suspense fallback={<FunnelFallback view={2} />}>
            <LearnPage guarded />
        </Suspense>
    );
}
