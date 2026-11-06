import { Suspense } from "react";

import { OnboardingLoading } from "@/components/field-agent-onboarding/OnboardingShell";
import { LearnPage } from "./_funnel/LearnPage";

/**
 * Training (board Certification, stage 2 "Learn"). The lessons read ?lesson=
 * with useSearchParams, which in Next 16 has to sit under <Suspense>.
 */
export default function TrainingPage() {
    return (
        <Suspense fallback={<OnboardingLoading stage="learn" />}>
            <LearnPage guarded />
        </Suspense>
    );
}
