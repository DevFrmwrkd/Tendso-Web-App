import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { GiveawayApproval } from "@/app/admin/submissions/_queue/GiveawayApproval";
import { GiveawayFilters } from "@/app/admin/submissions/_queue/GiveawayFilters";
import { giveawayCounts, listRows, statusNotes, statusOf, type QueueRow } from "@/app/admin/submissions/_queue/model";
import { QueueRowButton } from "@/app/admin/submissions/_queue/Rows";
import { giveawayReview, giveawayWebsiteStatus } from "@/lib/giveawayReview";

const NOW = Date.UTC(2026, 9, 13);
const row = (name: string, patch: Partial<QueueRow> = {}): QueueRow => ({
    _id: name as QueueRow["_id"], _creationTime: NOW,
    creatorId: "house" as QueueRow["creatorId"], creator: null, reviewedByName: null,
    businessName: name, businessType: "Salon", ownerName: "Owner", ownerPhone: "09170000000",
    address: "Main Street", city: "Manila", status: "submitted", giveawayApplication: true,
    ...patch,
});
const approved = (patch: Partial<QueueRow> = {}) => row("Approved shop", {
    status: "approved", reviewedBy: "otr-reviewer", reviewedAt: NOW,
    giveawayReviewSource: "otr", ...patch,
});
const renderRow = (submission: QueueRow) => renderToStaticMarkup(createElement(QueueRowButton, {
    row: submission, now: NOW, selected: false, onOpen: () => {},
}));

describe("giveaway eligibility in admin submissions", () => {
    it("separates pending, OTR approval, admin approval and rejection directly in row labels", () => {
        expect(statusOf(row("Waiting")).word).toBe("Awaiting OTR review");
        expect(statusOf(approved()).word).toBe("Approved by OTR");
        expect(statusOf(approved({ giveawayReviewSource: "admin" })).word).toBe("Approved by admin");
        expect(statusOf(approved({ status: "rejected" })).word).toBe("Rejected by OTR");
        expect(statusOf(approved({ status: "rejected", giveawayReviewSource: "admin" })).word).toBe("Rejected by admin");
    });

    it("does not call eligibility approval a generated website or a payment", () => {
        const html = renderRow(approved());
        expect(html).toContain("Approved by OTR");
        expect(html).toContain("Website · Ready to build");
        expect(html).not.toContain("Site generated");
        const free = renderRow(approved({ status: "completed", pricingMode: "comped" }));
        expect(free).toContain("Approved by OTR");
        expect(free).toContain("Website · Website given free");
        expect(free).not.toContain(">Paid<");
        const live = renderRow(approved({ status: "pending_payment" }));
        expect(live).toContain("Website · Website live");
        expect(live).not.toContain("awaiting payment");
    });

    it("preserves approval provenance as the website progresses through later stages", () => {
        for (const status of ["approved", "website_generated", "deployed", "pending_payment", "completed", "unpublished"]) {
            expect(giveawayReview(approved({ status }))).toMatchObject({ state: "approved", word: "Approved by OTR" });
        }
        expect(giveawayWebsiteStatus(approved({ status: "website_generated" }))?.word).toBe("Site generated");
        expect(giveawayWebsiteStatus(approved({ status: "unpublished", pricingMode: "comped" }))?.word).toBe("Unpublished");
    });

    it("never treats a bare workflow status as proof of approval, or guesses an OTR reviewer", () => {
        for (const patch of [{ reviewedAt: undefined }, { reviewedBy: undefined }, { reviewedAt: NaN }, { reviewedAt: 1e100 }]) {
            expect(giveawayReview(approved(patch))).toMatchObject({ state: "unknown", word: "Giveaway review required" });
        }
        expect(giveawayReview(approved({ giveawayReviewSource: undefined }))).toMatchObject({ state: "approved", word: "Giveaway approved" });
        expect(giveawayReview(approved({ status: "rejected", giveawayReviewSource: undefined }))?.word).toBe("Giveaway rejected");
    });

    it("treats a reopened application as pending even when its old review audit is retained", () => {
        const reopened = approved({ status: "in_review" });
        expect(giveawayReview(reopened)).toMatchObject({ state: "pending", reviewer: null, reviewedAt: null });
        expect(giveawayWebsiteStatus(reopened)?.word).toBe("Not started");
        expect(statusNotes(reopened)[0].text).toBe("Website · Not started");
    });

    it("shows the reviewer, review date, rejection reason and guidance in the same admin workspace", () => {
        const rejected = renderToStaticMarkup(createElement(GiveawayApproval, { submission: approved({
            status: "rejected", reviewedByName: "OTR Reviewer", rejectionReason: "Poster is not visible.",
        }) }));
        expect(rejected).toContain("Rejected by OTR");
        expect(rejected).toContain("Reviewed by OTR Reviewer");
        expect(rejected).toContain(new Date(NOW).toISOString());
        expect(rejected).toContain("Reason: Poster is not visible.");
        expect(rejected).toContain("Do not start this website");
        const pending = renderToStaticMarkup(createElement(GiveawayApproval, { submission: row("Waiting") }));
        expect(pending).toContain("Wait for OTR or an admin");
        expect(pending).not.toContain("Reviewed by");
    });

    it("filters eligibility across fulfillment stages and excludes unknown approvals and ordinary gifts", () => {
        const rows = [
            row("Waiting"), approved(), approved({ businessName: "Built", status: "website_generated", giveawayReviewSource: "admin" }),
            approved({ businessName: "Given", status: "completed", pricingMode: "comped" }),
            approved({ businessName: "Rejected", status: "rejected" }),
            approved({ businessName: "No audit", reviewedAt: undefined }),
            approved({ businessName: "Ordinary gift", giveawayApplication: false, pricingMode: "comped" }),
        ];
        const filter = { tab: "all" as const, query: "", domainOnly: false, ownerOnly: false, giveawayOnly: true, sort: "oldest" as const };
        expect(listRows(rows, { ...filter, giveawayReview: "approved" }).map((s) => s.businessName)).toEqual(["Approved shop", "Built", "Given"]);
        expect(listRows(rows, { ...filter, giveawayReview: "pending" }).map((s) => s.businessName)).toEqual(["Waiting"]);
        expect(listRows(rows, { ...filter, giveawayReview: "rejected" }).map((s) => s.businessName)).toEqual(["Rejected"]);
        expect(listRows(rows, { ...filter, giveawayReview: "all" })).toHaveLength(6);
        expect(giveawayCounts(rows)).toEqual({ all: 6, pending: 1, approved: 3, rejected: 1 });
    });

    it("offers counted approval shortcuts and a ready-to-build instruction", () => {
        const html = renderToStaticMarkup(createElement(GiveawayFilters, {
            value: "approved", counts: { all: 6, pending: 1, approved: 3, rejected: 1 }, onChange: () => {},
        }));
        expect(html).toContain('aria-label="Giveaway approval filters"');
        expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
        expect(html).toContain("Approved giveaways");
        expect(html).toContain("Ready to build");
    });

    it("leaves ordinary paid and creator submissions on their existing status labels", () => {
        const ordinary = row("Creator shop", { giveawayApplication: false, status: "approved" });
        expect(giveawayReview(ordinary)).toBeNull();
        expect(giveawayWebsiteStatus(ordinary)).toBeNull();
        expect(statusOf(ordinary).word).toBe("Site generated");
        expect(statusOf({ ...ordinary, status: "completed" }).word).toBe("Paid");
        expect(renderToStaticMarkup(createElement(GiveawayApproval, { submission: ordinary }))).toBe("");
    });
});
