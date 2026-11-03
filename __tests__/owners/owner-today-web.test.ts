import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OwnerSite } from "../../app/my-business/_components/ownerSite";
import type { OwnerTodayInbox, OwnerTodayVisit } from "../../app/my-business/today/_components/ownerTodayModel";

const state = vi.hoisted(() => ({ scope: {} as Record<string, unknown>, queries: [] as { name: string; args: unknown }[],
    visits: undefined as unknown, inbox: undefined as unknown }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: { children: ReactNode }) => createElement("a", props, children) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("../../hooks/useOwnerWebScope", () => ({ useOwnerWebScope: () => state.scope }));
vi.mock("convex/react", () => ({ useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(ref); state.queries.push({ name, args });
    if (args === "skip") return undefined;
    if (name === "visitRequests:listMine") return state.visits;
    if (name === "ownerInbox:list") return state.inbox;
    throw new Error(`Unexpected query ${name}`);
} }));
vi.mock("../../components/shells/OwnerShell", () => ({
    OwnerShell: ({ children }: { children: ReactNode }) => createElement("div", {}, children),
    OwnerPageHeader: ({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) => createElement("header", {}, createElement("h1", {}, title), subtitle, action),
}));
vi.mock("../../app/my-business/_components/OwnerSectionBoundary", () => ({ OwnerSectionBoundary: ({ children }: { children: ReactNode }) => createElement("div", {}, children) }));
vi.mock("../../app/my-business/_components/OwnerHome", () => ({ SiteOverviewLoading: () => createElement("p", {}, "Loading businesses") }));

import OwnerTodayPage from "../../app/my-business/today/page";
import { OwnerTodayView } from "../../app/my-business/today/_components/OwnerToday";
import { manilaDay, ownerTodayModel } from "../../app/my-business/today/_components/ownerTodayModel";

const NOW = Date.parse("2026-11-03T16:10:00Z"); // November 4 in Manila.
function site(name: string, overrides: Partial<OwnerSite> = {}): OwnerSite {
    return { submissionId: name as OwnerSite["submissionId"], businessName: name, businessType: "shop", contentSource: "owner_app",
        publishPolicy: "pay_then_publish", status: "draft", phase: "draft", publishedUrl: null, total: 4999,
        amountPaid: 0, balanceDue: 4999, paidInFull: false, openChangeRequests: 0, createdAt: NOW, ...overrides };
}
function visit(name: string, overrides: Partial<OwnerTodayVisit> = {}): OwnerTodayVisit {
    return { _id: name as OwnerTodayVisit["_id"], shopName: name, status: "requested", createdAt: NOW, preferredWhen: "Tomorrow afternoon",
        assignedAgent: null, ...overrides };
}
function inbox(): OwnerTodayInbox {
    return { unreadCount: 1, items: [{ key: "visit:one/? value", title: "Your agent accepted", body: "Luna Shop · Your visit is confirmed.",
        createdAt: NOW, submissionId: null, visitRequestId: "visit-one" as OwnerTodayInbox["items"][number]["visitRequestId"], type: "visit_confirmed", read: false },
    { key: "already-read", title: "Payment recorded", body: "A real payment was recorded.", createdAt: NOW - 1000, submissionId: null,
        visitRequestId: null, type: "payment_received", read: true }] };
}

describe("owner Today priorities", () => {
    it("counts all businesses and real attention states without treating a retained balance as a due bill in every phase", () => {
        const rows = [site("draft"), site("preview", { phase: "ready_to_check" }), site("due", { phase: "awaiting_payment", balanceDue: 1500 }),
            site("live balance", { phase: "live", balanceDue: 250, amountPaid: 4749 }),
            site("live paid", { phase: "live", paidInFull: true, balanceDue: 0 }), site("building", { phase: "building" }),
            site("rejected", { phase: "rejected" }), site("offline", { phase: "offline" })];
        const result = ownerTodayModel(rows, [], NOW);
        expect(result.attention.map(row => row.businessName)).toEqual(["draft", "preview", "due", "live balance", "rejected", "offline"]);
        expect(result.liveCount).toBe(2); expect(result.remaining).toBe(1750); expect(result.primary?.businessName).toBe("preview");
        expect(ownerTodayModel(rows.filter(row => row.phase !== "ready_to_check"), [], NOW).primary?.businessName).toBe("due");
        expect(ownerTodayModel([rows[0], rows[5]], [], NOW).primary?.businessName).toBe("draft");
    });
    it("picks a confirmed visit on Manila’s current day and otherwise the next active visit", () => {
        const today = visit("Today", { status: "confirmed", scheduledAt: Date.parse("2026-11-04T01:00:00Z") });
        const yesterday = visit("Yesterday", { status: "confirmed", scheduledAt: Date.parse("2026-11-03T10:00:00Z") });
        const done = visit("Completed", { status: "completed", scheduledAt: NOW - 1000 });
        const cancelled = visit("Cancelled", { status: "cancelled", scheduledAt: NOW - 500 });
        expect(manilaDay(NOW)).toBe(manilaDay(today.scheduledAt!));
        expect(ownerTodayModel([], [done, cancelled, yesterday, today], NOW).todayVisit?._id).toBe(today._id);
        expect(ownerTodayModel([], [done, cancelled, today, visit("Unscheduled")], NOW).nextVisit?._id).toBe(today._id);
        expect(ownerTodayModel([], [done, cancelled], NOW).nextVisit).toBeUndefined();
    });
});

describe("owner Today presentation", () => {
    it("uses all-business counts and direct business destinations without invented analytics", () => {
        const rows = Array.from({ length: 7 }, (_, index) => site(`Business ${index + 1}`, { phase: "building" }));
        rows[4] = site("Ready preview", { phase: "ready_to_check" });
        const html = renderToStaticMarkup(createElement(OwnerTodayView, { sites: rows, visits: [], inbox: inbox(), now: NOW, name: "Poru Test" }));
        expect(html).toContain("<strong>7</strong>"); expect(html).toContain("Good morning, Poru");
        expect(html).toContain('href="/my-business/Ready preview"'); expect(html).toContain("Your preview is ready to check.");
        expect(html).toContain('href="/my-business/visits/new"'); expect(html).toContain('href="/v2/start"');
        expect(html).not.toContain("Visitors"); expect(html).not.toContain("Sales");
    });
    it("links a recent update by its encoded event key and marks only unread items visually", () => {
        const html = renderToStaticMarkup(createElement(OwnerTodayView, { sites: [], visits: [], inbox: inbox(), now: NOW }));
        expect(html).toContain('href="/my-business/notifications?eventKey=visit%3Aone%2F%3F%20value"');
        expect(html.match(/aria-label="Unread"/g)).toHaveLength(1);
        expect(html).toContain("Your agent accepted"); expect(html).toContain("Payment recorded");
    });
    it("keeps the admin sample on preview destinations and supports a confirmed visit primary action", () => {
        const today = visit("Today", { status: "confirmed", scheduledAt: NOW + 1000 });
        const html = renderToStaticMarkup(createElement(OwnerTodayView, { sites: [site("Draft")], visits: [today], inbox: inbox(), now: NOW, preview: true }));
        expect(html).toContain("An agent is visiting today."); expect(html).toContain("View today’s visit");
        const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map(match => match[1]);
        expect(hrefs.length).toBeGreaterThan(5); expect(hrefs.every(href => href.startsWith("/admin/preview/owner#"))).toBe(true);
    });
    it("limits starting another owner-app draft while leaving existing drafts and visits accessible", () => {
        const html = renderToStaticMarkup(createElement(OwnerTodayView, { sites: [site("One"), site("Two"), site("Three")], visits: [], inbox: { items: [], unreadCount: 0 }, now: NOW }));
        expect(html).toContain("Finish one of your three drafts before adding another business.");
        expect(html).toContain('href="/my-business/One"'); expect(html).toContain('href="/my-business/visits/new"');
        expect(html).not.toContain('href="/v2/start"');
    });
});

describe("owner Today account boundary", () => {
    beforeEach(() => {
        state.queries = []; state.scope = { owner: { _id: "owner-one", name: "Poru" }, sites: [site("Owned business")],
            userId: "user-one", sessionId: "session-one", scopeKey: "user-one:session-one:owner-one", ready: true, loading: false,
            error: null, isSignedIn: true, isOwner: true, isCurrent: () => true };
        state.visits = { actorClerkId: "user-one", ownerId: "owner-one", requests: [] };
        state.inbox = { actorClerkId: "user-one", ownerId: "owner-one", unreadCount: 0, items: [] };
    });
    it("skips account reads before the owner scope is ready", () => {
        state.scope = { ...state.scope, ready: false, loading: true, sites: undefined };
        const html = renderToStaticMarkup(createElement(OwnerTodayPage));
        expect(state.queries).toEqual([{ name: "visitRequests:listMine", args: "skip" }, { name: "ownerInbox:list", args: "skip" }]);
        expect(html).toContain("Loading businesses"); expect(html).not.toContain("Owned business");
    });
    it("sends the current actor and rejects cached data from a different actor or owner", () => {
        state.visits = { actorClerkId: "another-user", ownerId: "owner-one", requests: [visit("Foreign visit")] };
        state.inbox = { actorClerkId: "user-one", ownerId: "another-owner", ...inbox() };
        const html = renderToStaticMarkup(createElement(OwnerTodayPage));
        expect(state.queries.every(query => JSON.stringify(query.args) === JSON.stringify({ clerkId: "user-one" }))).toBe(true);
        expect(html).toContain("Owned business"); expect(html).not.toContain("Foreign visit"); expect(html).not.toContain("Your agent accepted");
    });
});
