import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useQuery } from "convex/react";
import { StoreStatus } from "@/components/landing-v2/StoreStatus";
import { Stores } from "@/components/v2/pages-a/Stores";
import { StoreRow } from "@/components/v2/creators/Stores";
import { RELEASED_STORE_LINKS } from "@/lib/v2/appLinks";

jest.mock("@clerk/nextjs", () => ({ useAuth: jest.fn() }));
jest.mock("convex/react", () => ({ useConvex: jest.fn(), useConvexAuth: jest.fn(), useMutation: jest.fn(), useQuery: jest.fn() }));
jest.mock("@/convex/_generated/api", () => ({ api: jest.requireActual("convex/server").anyApi }));

const renderers = [
    ["landing hero", () => createElement(StoreStatus, { variant: "icons" })],
    ["landing download", () => createElement(StoreStatus, { variant: "badges" })],
    ["business and field-agent pages", () => createElement(Stores)],
    ["creator and affiliate pages", () => createElement(StoreRow)],
] as const;

describe.each(renderers)("released app links: %s", (_label, element) => {
    it.each([undefined, null, "javascript:alert(1)"])("shows working released listings when settings are %s", (setting) => {
        jest.mocked(useQuery).mockReturnValue(setting);
        const html = renderToStaticMarkup(element());
        expect(html).toContain(`href="${RELEASED_STORE_LINKS.appStore}"`);
        expect(html).toContain(`href="${RELEASED_STORE_LINKS.googlePlay}"`);
        expect(html).not.toContain("Coming soon");
        expect(html).not.toContain("javascript:");
    });

    it("uses configured store links ahead of the released defaults", () => {
        jest.mocked(useQuery).mockImplementation((_reference: unknown, args?: unknown) => {
            const key = (args as { key: string }).key;
            return key === "app_store_url"
                ? "https://apps.apple.com/ph/app/tendso/id6786666106?ct=campaign"
                : "https://play.google.com/store/apps/details?id=com.negosyodigital.app&referrer=campaign";
        });
        const html = renderToStaticMarkup(element());
        expect(html).toContain("?ct=campaign");
        expect(html).toContain("&amp;referrer=campaign");
        expect(html).not.toContain("Coming soon");
    });
});
