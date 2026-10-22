import {
    AGENT_EXAMPLE,
    CODE_PRICE,
    CODE_SAVING,
    KEEP_PER_SHOP,
    OVERRIDE_PER_SALE,
    cleanHandle,
    codeFromHandle,
    exampleMonth,
    earnLinkFor,
    shopLinkFor,
    firstName,
    fmtDate,
    fmtDay,
    fmtMonthName,
    initials,
    peso,
} from "@/lib/v2/creatorProgram";
import { SAMPLE_PORTAL } from "@/lib/v2/creatorSample";
import { DEFAULT_STORE_LINKS, safeStoreUrl } from "@/lib/v2/appLinks";

describe("creator program numbers", () => {
    it("matches docs/CREATOR-PROGRAM.md", () => {
        expect(CODE_PRICE).toBe(3499);
        expect(CODE_SAVING).toBe(1500);
        expect(KEEP_PER_SHOP).toBe(1750);
        expect(OVERRIDE_PER_SALE).toBe(150);
        expect(AGENT_EXAMPLE.keepPerShop * AGENT_EXAMPLE.shopsPerWeek).toBe(7500);
    });

    it("formats pesos", () => {
        expect(peso(12250)).toBe("₱12,250");
        expect(peso(0)).toBe("₱0");
    });
});

describe("exampleMonth (the calculator)", () => {
    it("steady month: 5 shops, 40 agents", () => {
        expect(exampleMonth({ shops: 5, agents: 40, busy: "steady" })).toEqual({ active: 20, sales: 80, now: 8750, monthly: 12000, total: 20750 });
    });
    it("is zero with nobody", () => {
        expect(exampleMonth({ shops: 0, agents: 0, busy: "strong" })).toEqual({ active: 0, sales: 0, now: 0, monthly: 0, total: 0 });
    });
    it("slow and strong scale the same agents", () => {
        expect(exampleMonth({ shops: 0, agents: 100, busy: "slow" }).monthly).toBe(25 * 2 * 150);
        expect(exampleMonth({ shops: 0, agents: 100, busy: "strong" }).monthly).toBe(80 * 8 * 150);
    });
});

describe("dates are Asia/Manila", () => {
    it("prints the same day the shop saw", () => {
        // 2026-10-19 23:30 UTC is already 20 October in Manila
        const ms = Date.UTC(2026, 9, 19, 23, 30);
        expect(fmtDay(ms)).toBe("20 Oct");
        expect(fmtDate(ms)).toBe("20 Oct 2026");
        expect(fmtMonthName(ms)).toBe("October");
    });
});

describe("names and handles", () => {
    it("first name and initials", () => {
        expect(firstName("Mika Santos")).toBe("Mika");
        expect(initials("Mika Santos")).toBe("MS");
        expect(initials("")).toBe("?");
    });
    it("handle to code", () => {
        expect(cleanHandle("Mika.Santos_1")).toBe("mikasantos1");
        expect(cleanHandle("a".repeat(40))).toHaveLength(16);
        expect(codeFromHandle("mika-santos")).toBe("MIKASANTOS");
    });
});

describe("creator share links", () => {
    it("uses the v2 public routes for shops and agents", () => {
        expect(shopLinkFor("mika")).toBe("tendso.com/v2/a/mika");
        expect(earnLinkFor("mika")).toBe("tendso.com/v2/a/mika/earn");
    });
});

describe("sample portal", () => {
    const p = SAMPLE_PORTAL;
    it("adds up to the numbers on the program page", () => {
        expect(p.now.thisMonth).toBe(12250);
        expect(p.now.shopsThisMonth).toBe(7);
        expect(p.now.shops.reduce((t, s) => t + s.kept, 0)).toBe(p.now.thisMonth);
        expect(p.monthly.thisMonth).toBe(4350);
        expect(p.recruits.reduce((t, r) => t + r.overrideThisMonth, 0)).toBe(p.monthly.thisMonth);
        expect(p.recruits).toHaveLength(14);
        expect(p.recruits.filter((r) => r.salesThisMonth > 0)).toHaveLength(p.monthly.activeAgents);
        expect(p.monthly.activeAgents).toBe(9);
        expect(p.payouts.readyToSend).toBe(16000);
        expect(p.payouts.waitingForShops).toBe(600);
        expect(p.funnel.shop).toMatchObject({ clicks: 2480, downloads: 412, signUps: 63, sales: 7 });
    });
    it("each agent's 5% is at most 5% of a full-price sale", () => {
        for (const r of p.recruits.filter((x) => x.salesThisMonth > 0)) {
            expect(r.overrideThisMonth / r.salesThisMonth).toBeLessThanOrEqual(250);
        }
    });
    it("every agent is inside their 12 months", () => {
        for (const r of p.recruits) {
            expect(r.monthsLeft).toBeGreaterThan(0);
            expect(r.monthsLeft).toBeLessThanOrEqual(12);
        }
    });
});

describe("store links", () => {
    it("uses a settings link only when it is https without credentials", () => {
        expect(safeStoreUrl("https://apps.apple.com/ph/app/tendso/id1", "x")).toBe("https://apps.apple.com/ph/app/tendso/id1");
        expect(safeStoreUrl("http://evil.example", "x")).toBe("x");
        expect(safeStoreUrl("https://user:pw@evil.example", "x")).toBe("x");
        expect(safeStoreUrl(null, "x")).toBe("x");
        expect(safeStoreUrl("javascript:alert(1)", "x")).toBe("x");
    });
    it("leaves unconfirmed listings empty", () => {
        expect(DEFAULT_STORE_LINKS).toEqual({ appStore: "", googlePlay: "" });
    });
});
