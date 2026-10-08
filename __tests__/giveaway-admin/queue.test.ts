import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { GiveawaySummary } from "@/app/admin/submissions/_queue/GiveawaySummary";
import { listRows, ownerPaysLine, ownerPaysWhen, ownerPrice, type ListFilter, type QueueRow } from "@/app/admin/submissions/_queue/model";
import { QueueRowButton } from "@/app/admin/submissions/_queue/Rows";

const NOW = Date.UTC(2026, 9, 8);
const row = (name: string, patch: Partial<QueueRow> = {}): QueueRow => ({
    _id: name as QueueRow["_id"], _creationTime: NOW,
    creatorId: "creator" as QueueRow["creatorId"], creator: null, reviewedByName: null,
    businessName: name, businessType: "Salon", ownerName: "Owner",
    ownerPhone: "09170000000", ownerEmail: "owner@example.com",
    address: "123 Main Street", city: "Quezon City", status: "submitted",
    ...patch,
});
const filter = (patch: Partial<ListFilter> = {}): ListFilter => ({
    tab: "all", query: "", domainOnly: false, ownerOnly: false,
    giveawayOnly: false, sort: "oldest", ...patch,
});

describe("giveaway submissions queue", () => {
    it("filters by the application marker rather than free pricing or remembered campaigns", () => {
        const rows = [
            row("Giveaway", { giveawayApplication: true }),
            row("Ordinary gift", { pricingMode: "comped" }),
            row("Legacy campaign", { campaign: "giveaway" }),
            row("Ordinary", { giveawayApplication: false }),
        ];
        expect(listRows(rows, filter({ giveawayOnly: true })).map((r) => r.businessName)).toEqual(["Giveaway"]);
        expect(listRows(rows, filter())).toHaveLength(4);
    });

    it("combines the Giveaway filter with status, owner submission, search and sort", () => {
        const rows = [
            row("Older salon", { giveawayApplication: true, contentSource: "owner_intake", _creationTime: NOW - 1000 }),
            row("New salon", { giveawayApplication: true, contentSource: "owner_intake" }),
            row("Rejected salon", { giveawayApplication: true, contentSource: "owner_intake", status: "rejected" }),
            row("Field salon", { giveawayApplication: true }),
            row("Paid salon", { contentSource: "owner_intake" }),
            row("Cafe", { businessType: "Cafe", giveawayApplication: true, contentSource: "owner_intake" }),
        ];
        expect(listRows(rows, filter({ tab: "review", giveawayOnly: true, ownerOnly: true, query: " SALON " }))
            .map((r) => r.businessName)).toEqual(["Older salon", "New salon"]);
        expect(listRows(rows, filter({ giveawayOnly: true, domainOnly: true }))).toEqual([]);
        expect(rows[0].businessName).toBe("Older salon");
    });

    it("tags giveaway rows before or after review without tagging ordinary comped sites", () => {
        const render = (submission: QueueRow) => renderToStaticMarkup(createElement(QueueRowButton, {
            row: submission, now: NOW, selected: false, onOpen: () => {},
        }));
        expect(render(row("Shop", { giveawayApplication: true }))).toContain("Giveaway");
        expect(render(row("Shop", { giveawayApplication: true, status: "rejected" }))).toContain("Giveaway");
        expect(render(row("Shop", { pricingMode: "comped" }))).not.toContain("Giveaway");
    });

    it("shows giveaway pricing as Free without a payment-due promise, preserving ordinary pricing", () => {
        const giveaway = row("Gift", { giveawayApplication: true, amount: 0 });
        expect(ownerPrice(giveaway)).toBe("Free");
        expect(ownerPaysLine(giveaway)).toBe("Free · giveaway");
        expect(ownerPaysWhen(giveaway)).toBeNull();
        expect(ownerPrice(row("Paid", { amount: 4999 }))).toBe("₱4,999");
        expect(ownerPrice(row("Other gift", { amount: 4999, pricingMode: "comped" }))).toBe("₱0");
        expect(ownerPrice(row("Unset"))).toBe("—");
    });

    it("shows all three totals, including zero, and explains that given sites still hold slots", () => {
        const html = renderToStaticMarkup(createElement(GiveawaySummary, {
            status: { held: 100, given: 63, slotsLeft: 0, cap: 100 },
        }));
        expect(html).toContain("Held");
        expect(html).toContain("Given");
        expect(html).toContain("Left");
        expect(html).toContain(">63</dd>");
        expect(html).toContain(">0</dd>");
        expect(html).toContain("Held includes websites already given.");
        expect(html).toContain('aria-busy="false"');
    });

    it("keeps totals loading until the backend supplies them", () => {
        const html = renderToStaticMarkup(createElement(GiveawaySummary));
        expect(html).toContain('aria-busy="true"');
        expect(html).not.toContain(">0</dd>");
        expect(html).not.toContain("100 total");
    });
});
