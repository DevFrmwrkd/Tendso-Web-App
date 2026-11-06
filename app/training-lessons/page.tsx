import { Suspense } from "react";

import { OnboardingLoading } from "@/components/field-agent-onboarding/OnboardingShell";
import { LearnPage } from "@/app/training/_funnel/LearnPage";

/**
 * Training lessons (board Certification, stage 2 "Learn"): the same card as
 * /training, which now holds the lessons too. The route stays because the
 * quiz ("Back to lessons", "Review the lessons") and older links point here.
 */
export default function TrainingLessonsPage() {
    return (
        <Suspense fallback={<OnboardingLoading stage="learn" />}>
            <LearnPage guarded={false} />
        </Suspense>
    );
}
