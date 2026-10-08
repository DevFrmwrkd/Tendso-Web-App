import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { GiveawayEvidence, giveawayMapUrls } from "@/app/admin/submissions/[id]/_components/GiveawayEvidence";
import { RejectDialog } from "@/app/admin/submissions/[id]/_components/ActionDialogs";
import { priceFact } from "@/app/admin/submissions/[id]/_components/DetailsPanel";
import type { SubmissionDoc } from "@/app/admin/submissions/[id]/_components/review";

jest.mock("@/convex/_generated/api", () => ({ api: {} }));

const submission = {
    businessName: "The Corner Shop",
    address: "15 Mabini Street",
    city: "Quezon City",
    coordinates: { lat: 14.676, lng: 121.0437 },
    giveawayApplication: true,
    giveawayPosterPhoto: "https://photos.r2.dev/poster.jpg",
    photos: ["https://photos.r2.dev/storefront.jpg"],
} as SubmissionDoc;

const rejectProps = {
    open: true,
    onClose: () => {},
    onConfirm: () => {},
    busy: false,
    reason: "",
    onReason: () => {},
    showError: false,
};

describe("giveaway application review", () => {
    it("labels a giveaway as Free with its reservation state instead of payment instructions", () => {
        expect(priceFact({ ...submission, status: "in_review", amount: 0 })).toEqual({ text: "Free", meta: "Giveaway application · slot held" });
        expect(priceFact({ ...submission, status: "rejected", amount: 0 }).meta).toBe("Giveaway application · slot released");
        expect(priceFact({ ...submission, status: "paid", pricingMode: "comped", amount: 0 }).meta).toBe("Giveaway website · given");
        const paid = priceFact({ ...submission, giveawayApplication: false, status: "in_review", amount: 4999 });
        expect(paid.text).toBe("₱4,999");
        expect(paid.meta).toContain("paid after it’s live");
        expect(priceFact({ ...submission, giveawayApplication: false, pricingMode: "comped", amount: 4999 }).text).toContain("Free (promo)");
    });

    it("shows uncropped poster evidence separately from the website's photos", () => {
        const html = renderToStaticMarkup(createElement(GiveawayEvidence, { s: submission, posterUrl: submission.giveawayPosterPhoto! }));
        expect(html).toContain("Poster photo");
        expect(html).toContain("object-contain");
        expect(html).toContain('href="https://photos.r2.dev/poster.jpg"');
        expect(html).not.toContain("storefront.jpg");
        expect(html).toContain("15 Mabini Street");
        expect(html).toContain('title="Map of The Corner Shop"');
        expect(html).toContain("14.676%2C121.0437");
    });

    it("uses the submitted coordinates for the map, falling back to an address for absent or invalid pins", () => {
        expect(giveawayMapUrls(submission)?.search).toContain("query=14.676%2C121.0437");
        const address = "15%20Mabini%20Street%2C%20Quezon%20City";
        expect(giveawayMapUrls({ ...submission, coordinates: undefined })?.embed).toContain(address);
        expect(giveawayMapUrls({ ...submission, coordinates: { lat: NaN, lng: 300 } })?.embed).toContain(address);
        expect(giveawayMapUrls({ address: "", city: "", coordinates: undefined })).toBeNull();
    });

    it("keeps poster evidence off ordinary submissions and waits for storage-backed evidence", () => {
        const ordinary = renderToStaticMarkup(createElement(GiveawayEvidence, { s: { ...submission, giveawayApplication: false }, posterUrl: null }));
        expect(ordinary).toBe("");
        const pending = renderToStaticMarkup(createElement(GiveawayEvidence, { s: { ...submission, giveawayPosterPhoto: "storage-id" }, posterUrl: null }));
        expect(pending).toContain("Loading the poster photo");
        expect(pending).not.toContain("storefront.jpg");
    });

    it("offers the exact giveaway rejection choices while retaining confirmation", () => {
        const html = renderToStaticMarkup(createElement(RejectDialog, {
            ...rejectProps,
            giveawayReason: { selected: null, onSelect: () => {} },
        }));
        expect(html).toContain("Reject this submission?");
        expect(html.match(/type="radio"/g)).toHaveLength(4);
        for (const reason of ["Poster not visible in the photo", "Not a walk-in business", "Duplicate application", "Other"]) {
            expect(html).toContain(reason);
        }
        expect(html).not.toContain("<textarea");
        expect(html).toContain("reserved slot is released");
    });

    it("requires a free-text explanation for Other and keeps ordinary rejections as free text", () => {
        const other = renderToStaticMarkup(createElement(RejectDialog, {
            ...rejectProps,
            showError: true,
            giveawayReason: { selected: "Other", onSelect: () => {} },
        }));
        expect(other).toContain("Other reason");
        expect(other).toContain("<textarea");
        expect(other).toContain("Add a reason before rejecting.");
        const ordinary = renderToStaticMarkup(createElement(RejectDialog, { ...rejectProps, reason: "Missing owner consent" }));
        expect(ordinary).not.toContain('type="radio"');
        expect(ordinary).toContain("Missing owner consent");
        expect(ordinary).toContain("Saved on the submission so the next admin knows why.");
    });
});
