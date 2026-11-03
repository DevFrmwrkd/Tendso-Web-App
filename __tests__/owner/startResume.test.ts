import { emptyDraft, type StartDraft } from "@/app/start/draft";
import { firstIncompleteStartScreen, resumeStartScreen, startDomainError, startPosition } from "@/app/start/resume";
import { INTAKE_QUESTIONS } from "@/lib/narrativeFromQa";
import { visibleSlots } from "@/app/start/photoSlots";

const ready = (): StartDraft => ({ ...emptyDraft(), step: 4, basics: { ...emptyDraft().basics,
    businessName: "Test kitchen", businessType: "Restaurant", ownerName: "Alex", ownerPhone: "9171234567", ownerEmail: "alex@example.test", address: "12 Main Street", city: "Marikina" },
    answers: Object.fromEntries(INTAKE_QUESTIONS.map(question => [question.key, "A detailed saved answer about our family shop and the things we make each day for our customers."])),
    hasProducts: false, photos: Object.fromEntries(visibleSlots(false).filter(slot => !slot.optional).map(slot => [slot.index, `https://uploads.example.test/${slot.index}.jpg`])) });

describe("anonymous intake resume across the old and new entry points", () => {
    it("keeps the old photo-step position, sparse uploaded URLs and answers", () => {
        const draft = { ...ready(), step: 3 };
        const before = JSON.stringify(draft);
        expect(resumeStartScreen(draft, null)).toBe("photos");
        expect(JSON.stringify(draft)).toBe(before);
        expect(firstIncompleteStartScreen(draft)).toBe("review");
    });
    it("keeps the legacy interview question and rejects stale or arbitrary V2 screens", () => {
        const draft = { ...ready(), step: 2, questionIndex: 3 };
        expect(resumeStartScreen(draft, null)).toBe("q3");
        expect(resumeStartScreen(draft, "q999")).toBe("q3");
        expect(resumeStartScreen(draft, "done")).toBe("q3");
        expect(resumeStartScreen(draft, "poster")).toBe("q3");
    });
    it("clamps a review cursor to an unfinished required answer", () => {
        const draft = ready(); delete draft.answers[INTAKE_QUESTIONS[2].key];
        expect(resumeStartScreen(draft, "review")).toBe("q2");
        expect(resumeStartScreen(draft, "where")).toBe("where");
    });
    it("resumes giveaway evidence without counting the poster as a website photo", () => {
        const draft = { ...ready(), giveawayApplication: true, step: 4 };
        expect(resumeStartScreen(draft, "review")).toBe("poster");
        draft.giveawayPosterPhoto = "https://uploads.example.test/poster.jpg";
        expect(resumeStartScreen(draft, "review")).toBe("review");
    });
    it("writes backwards-compatible cursors without changing content", () => {
        const draft = ready();
        expect(startPosition(draft, "q4")).toMatchObject({ step: 2, questionIndex: 4, photos: draft.photos, answers: draft.answers });
        expect(startPosition({ ...draft, giveawayApplication: true }, "review").step).toBe(5);
    });
    it("retains custom-domain validation before the final submit", () => {
        expect(startDomainError("alingnena.com")).toBeUndefined();
        for (const bad of ["", "https://alingnena.com", "www.alingnena.com", "not a domain", `${"a".repeat(64)}.com`]) expect(startDomainError(bad)).toEqual(expect.any(String));
    });
});
