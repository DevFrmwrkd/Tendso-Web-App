import { useAction, useConvexAuth, useMutation, usePaginatedQuery } from "convex/react";
import { createElement, isValidElement, type FormEvent, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DashboardContent } from "@/app/affiliates/dashboard/_components/Dashboard";
import { PageSettings } from "@/app/affiliates/dashboard/_components/PageSettings";
import { PriceSettings } from "@/app/affiliates/dashboard/_components/PriceSettings";
import { Sales, SalesList, type AffiliateSale } from "@/app/affiliates/dashboard/_components/Sales";
import type { Doc } from "@/convex/_generated/dataModel";
import { AFFILIATE_MESSAGE_MAX_LENGTH } from "@/lib/affiliates";
import { formatPHP } from "@/lib/pricing";

jest.mock("convex/react", () => ({
    useAction: jest.fn(),
    useConvexAuth: jest.fn(),
    useMutation: jest.fn(),
    usePaginatedQuery: jest.fn(),
}));
jest.mock("@/convex/_generated/api", () => ({
    api: {
        affiliates: { sales: "affiliates:sales", updatePage: "affiliates:updatePage" },
        r2: { generateUploadUrl: "r2:generateUploadUrl" },
    },
}));
jest.mock("@/app/affiliates/dashboard/_components/ShareTools.module.css", () => ({}));

const account: Doc<"creators"> = {
    _id: "preview-affiliate" as Doc<"creators">["_id"],
    _creationTime: Date.UTC(2026, 9, 1),
    clerkId: "preview-clerk-affiliate",
    email: "preview@example.com",
    firstName: "Ana",
    lastName: "Cruz",
    role: "affiliate",
    status: "active",
    affiliateHandle: "ana-preview",
    affiliateDisplayName: "Ana's local offers",
    affiliatePhoto: "https://photos.example.com/preview.jpg",
    affiliateMessage: "Helping local shops get online.",
    affiliateSocialLink: "https://m.me/ana-preview",
    affiliatePrice: 2200,
    referralCode: "PREVIEW1",
    wiseEmail: "preview-payout@example.com",
    balance: 3250,
};

const liveSale: AffiliateSale = {
    _id: "live-sale" as AffiliateSale["_id"],
    businessName: "A real shop",
    createdAt: Date.UTC(2026, 9, 9),
    price: 2400,
    commission: 1200,
    status: "completed",
};
const updatePage = jest.fn();
const generateUploadUrl = jest.fn();

/** Inspect native disabled attributes while rendering the real button components. */
function buttonTag(html: string, label: string): string {
    const matches = (html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? []).filter((button) => button.includes(label));
    expect(matches).toHaveLength(1);
    return matches[0].slice(0, matches[0].indexOf(">") + 1);
}

type Submit = (event: FormEvent<HTMLFormElement>) => Promise<void>;
function findSubmit(node: ReactNode): Submit | undefined {
    if (Array.isArray(node)) {
        for (const child of node) {
            const submit = findSubmit(child);
            if (submit) return submit;
        }
        return undefined;
    }
    if (!isValidElement<{ children?: ReactNode; onSubmit?: Submit }>(node)) return undefined;
    if (node.type === "form" && node.props.onSubmit) return node.props.onSubmit;
    return findSubmit(node.props.children);
}

/** Render with React's real hooks, then exercise the actual form event handler. */
function captureSubmit(render: () => ReactNode) {
    let tree: ReactNode;
    function Capture() {
        tree = render();
        return tree;
    }
    renderToStaticMarkup(createElement(Capture));
    const submit = findSubmit(tree);
    if (!submit) throw new Error("Expected an editor form");
    return async () => {
        const preventDefault = jest.fn();
        await submit({ preventDefault } as unknown as FormEvent<HTMLFormElement>);
        expect(preventDefault).toHaveBeenCalledTimes(1);
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    (useMutation as jest.Mock).mockReturnValue(updatePage);
    (useAction as jest.Mock).mockReturnValue(generateUploadUrl);
    (useConvexAuth as jest.Mock).mockReturnValue({ isAuthenticated: true, isLoading: false });
    (usePaginatedQuery as jest.Mock).mockReturnValue({ results: [liveSale], status: "Exhausted", loadMore: jest.fn() });
});

describe("affiliate dashboard preview", () => {
    it("renders only the page editor and offer without subscribing to sales or payouts", () => {
        const html = renderToStaticMarkup(createElement(DashboardContent, { account, preview: true }));

        expect(html).toContain("My page");
        expect(html).toContain("Ana&#x27;s local offers");
        expect(html).toContain(formatPHP(2200));
        expect(html).toContain(formatPHP(1100));
        expect(html).not.toContain("Getting paid");
        expect(html).not.toContain(account.wiseEmail);
        expect(html).not.toContain(liveSale.businessName);
        expect(useConvexAuth).not.toHaveBeenCalled();
        expect(usePaginatedQuery).not.toHaveBeenCalled();
        expect(updatePage).not.toHaveBeenCalled();
        expect(generateUploadUrl).not.toHaveBeenCalled();
    });

    it("disables photo uploads and sharing in the sample editor", () => {
        const html = renderToStaticMarkup(createElement(DashboardContent, { account, preview: true }));

        for (const label of ["Change photo", "Download QR PNG", "Print A4 poster"]) {
            expect(buttonTag(html, label)).toContain('disabled=""');
        }
        expect(html.match(/<input\b[^>]*type="file"[^>]*>/)?.[0]).toContain('disabled=""');
        expect(html).toContain("Photo uploads are disabled in this preview.");
    });

    it("keeps the sample page and price editors usable", () => {
        const pageHtml = renderToStaticMarkup(createElement(PageSettings, {
            draft: { photo: "", displayName: "Edited preview", message: "Sample offer", socialLink: "" },
            defaultName: "Ana Cruz",
            handle: account.affiliateHandle,
            dirty: true,
            disabled: false,
            preview: true,
            onChange: jest.fn(),
            onSaved: jest.fn(),
        }));
        const priceHtml = renderToStaticMarkup(createElement(PriceSettings, {
            value: "2400",
            previewPrice: 2400,
            dirty: true,
            disabled: false,
            preview: true,
            onChange: jest.fn(),
            onSaved: jest.fn(),
        }));

        expect(buttonTag(pageHtml, "Save page")).not.toContain("disabled");
        expect(pageHtml.match(/<input\b[^>]*value="Edited preview"[^>]*>/)?.[0]).not.toContain("disabled");
        expect(buttonTag(priceHtml, "Save price")).not.toContain("disabled");
        expect(priceHtml.match(/<input\b[^>]*type="number"[^>]*>/)?.[0]).not.toContain("disabled");
        expect(priceHtml).toContain(formatPHP(1200));
        expect(buttonTag(pageHtml, "Add photo")).toContain('disabled=""');
        expect(updatePage).not.toHaveBeenCalled();
        expect(generateUploadUrl).not.toHaveBeenCalled();
    });

    it("renders an empty sample list without falling back to a live sales subscription", () => {
        const html = renderToStaticMarkup(createElement(Sales, { sampleSales: [] }));

        expect(html).toContain("No sales yet");
        expect(html).not.toContain(liveSale.businessName);
        expect(useConvexAuth).not.toHaveBeenCalled();
        expect(usePaginatedQuery).not.toHaveBeenCalled();
    });

    it("uses the same sale presentation for supplied rows without fetching data", () => {
        const html = renderToStaticMarkup(createElement(SalesList, { sales: [liveSale] }));

        expect(html).toContain(liveSale.businessName);
        expect(html).toContain(formatPHP(liveSale.price));
        expect(html).toContain(formatPHP(liveSale.commission));
        expect(html).toContain('dateTime="2026-10-09T00:00:00.000Z"');
        expect(usePaginatedQuery).not.toHaveBeenCalled();
    });

    it("retains live page/upload controls while leaving financial subscriptions in their own sections", () => {
        const html = renderToStaticMarkup(createElement(DashboardContent, { account }));

        expect(usePaginatedQuery).not.toHaveBeenCalled();
        expect(html).not.toContain(liveSale.businessName);
        expect(buttonTag(html, "Change photo")).not.toContain("disabled");
        expect(html.match(/<input\b[^>]*type="file"[^>]*>/)?.[0]).not.toContain("disabled");
    });

});

describe("affiliate preview form saves", () => {
    const draft = {
        photo: "  https://photos.example.com/preview.jpg  ",
        displayName: "  Ana's sample offer  ",
        message: "  Helping your shop get online.  ",
        socialLink: "  https://m.me/demo-affiliate  ",
    };
    const normalized = {
        photo: "https://photos.example.com/preview.jpg",
        displayName: "Ana's sample offer",
        message: "Helping your shop get online.",
        socialLink: "https://m.me/demo-affiliate",
    };

    it("saves normalized preview page values locally without a mutation or upload", async () => {
        const onSaved = jest.fn();
        const submit = captureSubmit(() => PageSettings({
            draft, defaultName: "Ana Cruz", handle: "demo-affiliate", dirty: true, disabled: false,
            preview: true, onChange: jest.fn(), onSaved,
        }));
        await submit();
        expect(onSaved).toHaveBeenCalledTimes(1);
        expect(onSaved).toHaveBeenCalledWith(normalized);
        expect(updatePage).not.toHaveBeenCalled();
        expect(generateUploadUrl).not.toHaveBeenCalled();
    });

    it.each([
        [" 2400.4 ", 2400], ["1", 999], ["9999", 4999],
    ])("saves preview price %s as %s locally without calling services", async (value, expected) => {
        const onSaved = jest.fn();
        const submit = captureSubmit(() => PriceSettings({
            value, previewPrice: 2200, dirty: true, disabled: false, preview: true, onChange: jest.fn(), onSaved,
        }));
        await submit();
        expect(onSaved).toHaveBeenCalledTimes(1);
        expect(onSaved).toHaveBeenCalledWith(expected);
        expect(updatePage).not.toHaveBeenCalled();
        expect(generateUploadUrl).not.toHaveBeenCalled();
    });

    it.each(["", "not-a-price", "Infinity"])("does not save invalid preview price %j", async (value) => {
        const onSaved = jest.fn();
        const submit = captureSubmit(() => PriceSettings({
            value, previewPrice: 2200, dirty: true, disabled: false, preview: true, onChange: jest.fn(), onSaved,
        }));
        await submit();
        expect(onSaved).not.toHaveBeenCalled();
        expect(updatePage).not.toHaveBeenCalled();
        expect(generateUploadUrl).not.toHaveBeenCalled();
    });

    it("does not save a preview message beyond the public page limit", async () => {
        const onSaved = jest.fn();
        const submit = captureSubmit(() => PageSettings({
            draft: { ...draft, message: "x".repeat(AFFILIATE_MESSAGE_MAX_LENGTH + 1) },
            defaultName: "Ana Cruz", dirty: true, disabled: false, preview: true, onChange: jest.fn(), onSaved,
        }));
        await submit();
        expect(onSaved).not.toHaveBeenCalled();
        expect(updatePage).not.toHaveBeenCalled();
        expect(generateUploadUrl).not.toHaveBeenCalled();
    });

    it("keeps the default live page save calling the backend with normalized values", async () => {
        const onSaved = jest.fn();
        const submit = captureSubmit(() => PageSettings({
            draft, defaultName: "Ana Cruz", dirty: true, disabled: false, onChange: jest.fn(), onSaved,
        }));
        await submit();
        expect(updatePage).toHaveBeenCalledTimes(1);
        expect(updatePage).toHaveBeenCalledWith(normalized);
        expect(onSaved).toHaveBeenCalledWith(normalized);
        expect(generateUploadUrl).not.toHaveBeenCalled();
    });

    it("keeps the default live price save calling the backend with the rounded price", async () => {
        const onSaved = jest.fn();
        const submit = captureSubmit(() => PriceSettings({
            value: "2400.4", previewPrice: 2400, dirty: true, disabled: false, onChange: jest.fn(), onSaved,
        }));
        await submit();
        expect(updatePage).toHaveBeenCalledTimes(1);
        expect(updatePage).toHaveBeenCalledWith({ price: 2400 });
        expect(onSaved).toHaveBeenCalledWith(2400);
        expect(generateUploadUrl).not.toHaveBeenCalled();
    });
});
