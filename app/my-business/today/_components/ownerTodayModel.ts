import type { OwnerSite } from "../../_components/ownerSite";
import type { OwnerInboxItem } from "@/convex/lib/ownerInbox";
import type { VisitRequestView } from "@/convex/visitRequests";

export type OwnerTodayVisit = Pick<VisitRequestView, "_id" | "shopName" | "status" | "scheduledAt" | "createdAt" | "preferredWhen" | "assignedAgent">;
export type OwnerTodayInboxItem = OwnerInboxItem;
export type OwnerTodayInbox = { unreadCount: number; items: readonly OwnerTodayInboxItem[] };

const ATTENTION_PHASES = new Set<OwnerSite["phase"]>(["draft", "ready_to_check", "awaiting_payment", "rejected", "offline"]);
export function hasLiveBalance(site: OwnerSite): boolean {
    return site.phase === "live" && !site.paidInFull && site.total > 0 && site.balanceDue > 0;
}
export function needsOwner(site: OwnerSite): boolean {
    return ATTENTION_PHASES.has(site.phase) || hasLiveBalance(site);
}
export function manilaDay(time: number): string {
    return new Date(time).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}
export function ownerTodayModel(sites: readonly OwnerSite[], visits: readonly OwnerTodayVisit[], now: number) {
    const attention = sites.filter(needsOwner);
    const primary = attention.find(site => site.phase === "ready_to_check")
        ?? attention.find(site => site.phase === "awaiting_payment" || hasLiveBalance(site)) ?? attention[0];
    const activeVisits = visits.filter(visit => visit.status !== "cancelled" && visit.status !== "completed")
        .sort((a, b) => (a.scheduledAt ?? Number.MAX_SAFE_INTEGER) - (b.scheduledAt ?? Number.MAX_SAFE_INTEGER)
            || b.createdAt - a.createdAt || String(a._id).localeCompare(String(b._id)));
    const todayVisit = activeVisits.find(visit => visit.status === "confirmed" && visit.scheduledAt
        && manilaDay(visit.scheduledAt) === manilaDay(now));
    return {
        attention, primary, todayVisit, nextVisit: activeVisits[0],
        liveCount: sites.filter(site => site.phase === "live").length,
        openDrafts: sites.filter(site => site.phase === "draft" && site.contentSource === "owner_app").length,
        remaining: sites.filter(site => site.phase === "awaiting_payment" || site.phase === "live")
            .reduce((sum, site) => sum + (site.paidInFull ? 0 : Math.max(0, site.balanceDue)), 0),
    };
}
export const ownerTodayPeso = (value: number) => `₱${value.toLocaleString("en-PH")}`;
export function ownerTodayAction(site: OwnerSite): string {
    if (hasLiveBalance(site)) return `Pay ${ownerTodayPeso(site.balanceDue)}`;
    switch (site.phase) {
        case "draft": return "Continue setup";
        case "ready_to_check": return "Check preview";
        case "awaiting_payment": return "View payment";
        case "rejected": case "offline": return "View details";
        default: return "Open business";
    }
}
export function ownerTodayFocus(site: OwnerSite | undefined, count: number): string {
    if (!site) return count ? "You’re up to date." : "Let’s bring your business online.";
    if (site.phase === "ready_to_check") return "Your preview is ready to check.";
    if (site.phase === "awaiting_payment" || hasLiveBalance(site)) return "Your website has a payment waiting.";
    return site.phase === "draft" ? "Pick up where you left off." : "Your business needs attention.";
}
export function ownerTodayPhase(phase: OwnerSite["phase"]): string {
    return ({ draft: "Not sent yet", in_review: "Being checked", building: "Being built", ready_to_check: "Ready to check",
        changes_requested: "Making your change", awaiting_payment: "Waiting for payment", publishing: "Going live",
        live: "Live", rejected: "Needs a fix", offline: "Offline" })[phase];
}
export function ownerVisitLabel(status: OwnerTodayVisit["status"]): string {
    return ({ requested: "Request received", assigned: "Awaiting acceptance", confirmed: "Visit confirmed", completed: "Visit completed", cancelled: "Cancelled" })[status];
}
export function ownerVisitSchedule(time: number | undefined): string {
    return typeof time === "number" && Number.isFinite(time) && time > 0 ? `${new Date(time).toLocaleString("en-PH", {
        timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
    })} · Philippine time` : "Time not set yet";
}
export function ownerTodayGreeting(now: number): string {
    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "numeric", hourCycle: "h23" }).format(now));
    return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}
