import type { Tone } from "@/components/r1";

/**
 * The five stages of certification (board Certification, the left rail) and
 * where this person is in them.
 *
 * Each route is one stage: /onboarding 1, /training and /training-lessons 2,
 * /certification-quiz 3, /pending 4 (5 once the approval lands while the page
 * is open), /verification-rejected the rejected state of 4. The words come
 * from the board: Done, Your turn, Waiting on Tendso, Certified, Not
 * approved, Not yet.
 */

export type FunnelView = 1 | 2 | 3 | 4 | 5 | "rejected";

/** The certification timestamps on a creators row. */
export type Lifecycle = { quizPassedAt?: number | null; certifiedAt?: number | null; rejectedAt?: number | null } | null | undefined;

export type RailStep = {
    title: string;
    /** The name the phone's stepper shows (it only has room for a short one). */
    short: string;
    meta: string;
    marker: "done" | "now" | "bad" | "todo";
    current: boolean;
    tone: Tone;
    word: string;
};

const STAGES = [
    { title: "Your profile", short: "Profile", meta: "Name and phone" },
    { title: "Learn", short: "Learn", meta: "5 short lessons" },
    { title: "Quiz", short: "Quiz", meta: "5 questions, pass with 4" },
    { title: "Waiting for approval", short: "Approval", meta: "Usually within 24 hours" },
    { title: "Approved", short: "Certified", meta: "Your certificate" },
] as const;

/** 1–5: the stage on screen. Rejected is stage 4, not approved. */
export function stageOf(view: FunnelView): number {
    return view === "rejected" ? 4 : view;
}

export function railFor(view: FunnelView, c: Lifecycle): RailStep[] {
    const at = stageOf(view);
    // What the data already proves, whatever page is open: passing the quiz
    // means the lessons and the quiz are behind them.
    const passed = !!(c?.quizPassedAt || c?.certifiedAt);
    return STAGES.map((s, i): RailStep => {
        const n = i + 1;
        const current = n === at;
        const base = { title: s.title, short: s.short, meta: s.meta, current };
        if (view === "rejected") {
            if (n < 4) return { ...base, marker: "done", tone: "done", word: "Done" };
            if (n === 4) return { ...base, marker: "bad", tone: "bad", word: "Not approved" };
            return { ...base, marker: "todo", tone: "off", word: "Not yet" };
        }
        if (n === 5 && current) return { ...base, marker: "done", tone: "done", word: "Certified" };
        if (n < at || (passed && n <= 3)) return { ...base, marker: "done", tone: "done", word: "Done" };
        if (current) {
            return n === 4
                ? { ...base, marker: "now", tone: "progress", word: "Waiting on Tendso" }
                : { ...base, marker: "now", tone: "attn", word: "Your turn" };
        }
        return { ...base, marker: "todo", tone: "off", word: "Not yet" };
    });
}

/** The Stepper's current index: every step done on stage 5, the 4th on rejected. */
export function stepperIndex(view: FunnelView): number {
    return view === 5 ? 5 : stageOf(view) - 1;
}
