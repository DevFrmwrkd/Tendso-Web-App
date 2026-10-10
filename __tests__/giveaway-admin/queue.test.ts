import { Children, createElement, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { GiveawaySummary } from "@/app/admin/submissions/_queue/GiveawaySummary";
import { listRows, ownerPaysLine, ownerPaysWhen, ownerPrice, type ListFilter, type QueueRow } from "@/app/admin/submissions/_queue/model";
import { QueueRowButton } from "@/app/admin/submissions/_queue/Rows";

const NOW = Date.UTC(2026, 9, 8);
type ReviewStatus = NonNullable<ComponentProps<typeof GiveawaySummary>["status"]>;
const reviewStatus = (patch: Partial<ReviewStatus> = {}): ReviewStatus => ({
    held: 0, given: 0, slotsLeft: 100, cap: 100, enabled: false, open: false,
    ...patch,
});
const renderSummary = (props: ComponentProps<typeof GiveawaySummary> = {}) =>
    renderToStaticMarkup(createElement(GiveawaySummary, props));
const switchTag = (html: string) => html.match(/<button\b[^>]*role="switch"[^>]*>/)?.[0] ?? "";
type SwitchProps = { children?: ReactNode; role?: string; onClick?: () => void; "aria-checked"?: boolean };
function findSwitch(node: ReactNode): ReactElement<SwitchProps> | undefined {
    for (const child of Children.toArray(node)) {
        if (!isValidElement<SwitchProps>(child)) continue;
        if (child.props.role === "switch") return child;
        const nested = findSwitch(child.props.children);
        if (nested) return nested;
    }
}
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
            status: reviewStatus({ held: 100, given: 63, slotsLeft: 0 }),
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

    it.each([false, true])("shows the saved enabled=%s state with an accessible interactive switch", (enabled) => {
        const html = renderSummary({ status: reviewStatus({ enabled, open: enabled }), onEnabledChange: () => {} });
        expect(switchTag(html)).toContain('aria-label="Accept giveaway applications"');
        expect(switchTag(html)).toContain(`aria-checked="${enabled}"`);
        expect(switchTag(html)).not.toContain("disabled");
        expect(html).toContain(enabled ? "New applications: Open" : "New applications: Closed");
        expect(html).toContain(enabled ? ">On</span>" : ">Off</span>");
    });

    it("disables the switch during loading, while saving, or without an authorized change callback", () => {
        for (const props of [
            { onEnabledChange: () => {} },
            { status: reviewStatus(), onEnabledChange: () => {}, busy: true },
            { status: reviewStatus() },
        ]) {
            expect(switchTag(renderSummary(props))).toContain("disabled");
        }
        const saving = renderSummary({ status: reviewStatus(), onEnabledChange: () => {}, busy: true });
        expect(switchTag(saving)).toContain('aria-busy="true"');
        expect(saving).toContain("Saving");
    });

    it.each([false, true])("requests the opposite of enabled=%s without changing the saved state itself", (enabled) => {
        const onEnabledChange = jest.fn();
        const control = findSwitch(GiveawaySummary({ status: reviewStatus({ enabled, open: enabled }), onEnabledChange }));
        expect(control).toBeDefined();
        control!.props.onClick!();
        expect(onEnabledChange).toHaveBeenCalledWith(!enabled);
        expect(control!.props["aria-checked"]).toBe(enabled);
    });

    it("distinguishes full or expired availability from an enabled flag", () => {
        const full = renderSummary({ status: reviewStatus({ enabled: true, held: 100, slotsLeft: 0 }) });
        expect(full).toContain("New applications: Full");
        expect(switchTag(full)).toContain('aria-checked="true"');
        const expired = renderSummary({ status: reviewStatus({ enabled: true, endsAt: NOW - 1 }) });
        expect(expired).toContain("New applications: Deadline passed");
        expect(switchTag(expired)).toContain('aria-checked="true"');
    });

    it("shows a failed save as an alert while keeping the server's saved switch state", () => {
        const html = renderSummary({ status: reviewStatus(), onEnabledChange: () => {}, error: "The giveaway deadline has passed." });
        expect(html).toContain('role="alert"');
        expect(html).toContain("The giveaway deadline has passed.");
        expect(switchTag(html)).toContain('aria-checked="false"');
        expect(switchTag(html)).not.toContain("disabled");
    });

    it("keeps held applications reviewable while closed and explains the manual giveaway decisions", () => {
        const html = renderSummary({ status: reviewStatus({ held: 20, given: 5, slotsLeft: 80 }) });
        expect(html).toContain("Closing intake preserves held applications for review.");
        expect(html).toContain("Review the poster and business location.");
        expect(html).toContain("Approve &amp; publish");
        expect(html).toContain("Give free (comp)");
        expect(html).toContain("Rejecting an application frees its slot.");
        expect(html).toContain(">20</dd>");
        expect(html).toContain(">80</dd>");
    });
});
