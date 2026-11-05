import { INTAKE_QUESTIONS, meetsAnswerMinimum } from "@/lib/narrativeFromQa";
import type { StartDraft } from "./draft";
import { visibleSlots } from "./photoSlots";

export type StartScreenId = "choose" | "name" | "reach" | "where" | `q${number}` | "products" | "photos" | "poster" | "review" | "done";

const questions = INTAKE_QUESTIONS.map((_, index) => `q${index}` as const);
const ordered = (giveaway: boolean): StartScreenId[] => ["name", "reach", "where", ...questions, "products", "photos", ...(giveaway ? ["poster" as const] : []), "review"];

/** A newer UI must not skip unfinished data or trust an arbitrary old cursor. */
export function firstIncompleteStartScreen(draft: StartDraft): StartScreenId {
    const b = draft.basics;
    if (!b.businessName.trim() || !b.businessType) return "name";
    if (!b.ownerName.trim() || b.ownerPhone.length !== 10 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.ownerEmail.trim())) return "reach";
    if (!b.address.trim() || !b.city.trim()) return "where";
    const missing = INTAKE_QUESTIONS.findIndex(question => !meetsAnswerMinimum(question, draft.answers[question.key] ?? ""));
    if (missing >= 0) return `q${missing}`;
    if (draft.hasProducts === null) return "products";
    if (visibleSlots(draft.hasProducts).some(slot => !slot.optional && !draft.photos[slot.index])) return "photos";
    if (draft.giveawayApplication && !draft.giveawayPosterPhoto) return "poster";
    return "review";
}

/** Both the previous four/five-step form and the V2 screen cursor resume safely. */
export function resumeStartScreen(draft: StartDraft, remembered: unknown): StartScreenId {
    const screens = ordered(draft.giveawayApplication);
    const legacy: StartScreenId = draft.step <= 1 ? "name" : draft.step === 2 ? `q${draft.questionIndex}`
        : draft.step === 3 ? draft.hasProducts === null ? "products" : "photos"
            : draft.giveawayApplication && draft.step === 4 ? "poster" : "review";
    const candidate = typeof remembered === "string" && screens.includes(remembered as StartScreenId) ? remembered as StartScreenId
        : screens.includes(legacy) ? legacy : "name";
    return screens[Math.min(screens.indexOf(candidate), screens.indexOf(firstIncompleteStartScreen(draft)))];
}

/** Keep the old draft cursors useful when a screen key is unavailable after migration. */
export function startPosition(draft: StartDraft, screen: StartScreenId): StartDraft {
    if (screen === "choose" || screen === "done") return draft;
    const step = screen === "name" || screen === "reach" || screen === "where" ? 1 : screen.startsWith("q") ? 2
        : screen === "photos" || screen === "products" ? 3 : screen === "poster" ? 4 : draft.giveawayApplication ? 5 : 4;
    return { ...draft, step, questionIndex: screen.startsWith("q") ? Number(screen.slice(1)) : draft.questionIndex };
}

/** Same syntactic bounds as the existing intake; availability is verified by the team. */
export function startDomainError(raw: string): string | undefined {
    const value = raw.trim().toLowerCase();
    if (!value) return "Type the address you’d like, such as alingnena.com.";
    if (value.length > 253 || value.split(".").some(part => part.length > 63)) return "That web address is too long.";
    if (value.includes("/") || value.startsWith("www.")) return "Just the address itself, without www., https:// or slashes.";
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z]{2,24})+$/.test(value)) return "Use letters, numbers and dashes, ending in .com or similar.";
    return undefined;
}
