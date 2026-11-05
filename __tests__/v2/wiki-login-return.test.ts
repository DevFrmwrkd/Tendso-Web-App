import { loginReturnPath } from "@/app/auth/_components/loginReturnPath";

describe("wiki sign-in return allowlist", () => {
    it("returns to the exact access-checked wiki route requested by the locked state", () => {
        expect(loginReturnPath("/knowledge?ws=wiki")).toBe("/knowledge?ws=wiki");
        expect(loginReturnPath(["/knowledge?ws=wiki", "https://example.invalid"])).toBe("/knowledge?ws=wiki");
    });

    const rejected: Array<string | string[] | undefined> = [
        undefined,
        "",
        "/dashboard",
        "https://example.invalid/knowledge?ws=wiki",
        "//example.invalid/knowledge?ws=wiki",
        "/\\example.invalid/knowledge?ws=wiki",
        "%2Fknowledge%3Fws%3Dwiki",
        "/knowledge?ws=wiki&redirect_url=https://example.invalid",
        "/knowledge?ws=wiki#unapproved",
        "/knowledge?ws=help",
        "/v2/my-site",
        ["https://example.invalid", "/knowledge?ws=wiki"],
    ];
    it.each(rejected.map(value => ({ value })))("leaves ordinary, ambiguous, and external returns on role routing: $value", ({ value }) => {
        expect(loginReturnPath(value)).toBe("/auth/continue");
    });

    it("retains an internal admin destination for the verified role boundary to authorize", () => {
        expect(loginReturnPath("/admin/bookings")).toBe("/admin/bookings");
    });
});
