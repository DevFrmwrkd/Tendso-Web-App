import { usePaginatedQuery, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { Children, createElement, isValidElement, type FormEvent, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";

import { CreatorHome, CreatorHomeView } from "@/app/dashboard/_components/CreatorHome";
import { sampleCreator, sampleLeads, sampleSubmissions, sampleWithdrawals } from "@/app/admin/preview/_lib/samples";
import { CreatorShellView } from "@/components/shells/CreatorShell";
import { AffiliateDashboardPreview, CreatorDashboardPreview } from "@/app/admin/preview/_components/DashboardPreviews";
import { AFFILIATE_SECTIONS } from "@/app/affiliates/dashboard/_lib/navigation";
import { isAdminPreviewHref } from "@/lib/admin-preview-navigation";
import { PageSettings, type AffiliatePageDraft } from "@/app/affiliates/dashboard/_components/PageSettings";
import { SAMPLE_PICTURES } from "@/lib/v2/creatorSample";
import { OwnerDashboardPreview } from "@/app/admin/preview/_components/OwnerDashboardPreview";
import { OWNER_PREVIEW_SITES } from "@/app/admin/preview/_lib/ownerPreviewData";
import { SiteList, SiteOverview } from "@/app/my-business/_components/OwnerHome";
import { OwnerShellView } from "@/components/shells/OwnerShell";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";

const mockMutation = jest.fn();
const mockAction = jest.fn();

jest.mock("convex/react", () => ({
    useQuery: jest.fn(), useConvexAuth: jest.fn(),
    useMutation: jest.fn(() => mockMutation), useAction: jest.fn(() => mockAction), usePaginatedQuery: jest.fn(),
}));
jest.mock("@/convex/_generated/api", () => ({ api: jest.requireActual("convex/server").anyApi }));
jest.mock("@/app/affiliates/dashboard/_components/ShareTools.module.css", () => ({}));
jest.mock("@/components/v2/fonts", () => ({ v2Fonts: "test-v2-fonts" }));
jest.mock("@/components/v2/creators/creators.css", () => ({}));
jest.mock("@/components/v2/creators/PortalFrame.module.css", () => ({}));
jest.mock("@/components/v2/creators/CreatorPagePreview.module.css", () => ({}));
jest.mock("@/app/affiliates/dashboard/_components/AffiliatePageFrame.module.css", () => ({}));
jest.mock("@/app/affiliates/dashboard/_components/MyPage.module.css", () => ({}));
jest.mock("@clerk/nextjs", () => ({ useUser: jest.fn() }));
jest.mock("@/hooks/useOwnerAuth", () => ({ useOwnerAuth: jest.fn(() => { throw new Error("Preview attempted owner authentication"); }) }));
jest.mock("next/navigation", () => ({
    usePathname: () => "/admin/preview/creator",
    useRouter: jest.fn(),
}));

const referrals = { pending: 2, qualified: 0, paid: 1 };
const viewProps = {
    creator: sampleCreator,
    submissions: sampleSubmissions,
    leads: sampleLeads,
    withdrawals: sampleWithdrawals,
    referrals,
};

type PageFormProps = { children?: ReactNode; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>; 'data-preview-local-save'?: boolean };
function findPageForm(node: ReactNode): ReactElement<PageFormProps> | undefined {
    for (const child of Children.toArray(node)) {
        if (!isValidElement<{ children?: ReactNode }>(child)) continue;
        if (child.type === 'form') return child as ReactElement<PageFormProps>;
        const form = findPageForm(child.props.children);
        if (form) return form;
    }
}

type ButtonProps = { children?: ReactNode; disabled?: boolean; onClick?: () => void };
function findButton(node: ReactNode, label: string): ReactElement<ButtonProps> | undefined {
    for (const child of Children.toArray(node)) {
        if (!isValidElement<{ children?: ReactNode }>(child)) continue;
        if (child.type === 'button' && Children.toArray(child.props.children).includes(label)) return child as ReactElement<ButtonProps>;
        const button = findButton(child.props.children, label);
        if (button) return button;
    }
}

beforeEach(() => {
    jest.clearAllMocks();
    (useQuery as jest.Mock).mockImplementation(() => { throw new Error("Preview attempted a live query"); });
    (usePaginatedQuery as jest.Mock).mockImplementation(() => { throw new Error("Preview attempted a paginated live query"); });
    mockMutation.mockImplementation(() => { throw new Error("Preview attempted a mutation"); });
    mockAction.mockImplementation(() => { throw new Error("Preview attempted an action or upload"); });
});

describe('business owner dashboard preview', () => {
    function ownerMarkup(business?: string) {
        const $ = load(renderToStaticMarkup(createElement(OwnerDashboardPreview, { business })));
        expect($.text()).toContain('Business owner preview · Sample data');
        expect($.text()).toContain('Use View as above');
        expect($('nav[aria-label="Business workspace"]').text()).toContain('My businesses');
        expect($('iframe, object, embed, input[type="file"], form').length).toBe(0);
        $('a[href]').each((_, anchor) => expect(isAdminPreviewHref($(anchor).attr('href'), 'owner')).toBe(true));
        $('button').each((_, button) => expect($(button).is('[disabled]')).toBe(true));
        expect(useOwnerAuth).not.toHaveBeenCalled();
        expect(useQuery).not.toHaveBeenCalled();
        return $;
    }

    it('shows the actual multi-business workspace with draft, review, building, preview, payment and live samples', () => {
        const $ = ownerMarkup();
        expect($('main h1').text()).toBe('Your businesses');
        expect($('[id="businesses"]').length).toBe(1);
        expect($('article').length).toBe(6);
        for (const site of OWNER_PREVIEW_SITES) {
            const card = $('article').filter((_, article) => $(article).find('h3').text() === site.businessName);
            expect(card.length).toBe(1);
            expect(card.find('a').length).toBeGreaterThan(0);
            card.find('a').each((_, anchor) => expect($(anchor).attr('href')).toBe(`/admin/preview/owner?business=${site.submissionId}`));
        }
        for (const status of ['Live', 'Balance due', 'Check preview', 'Building', 'In review', 'Finish setup']) expect($('article').text()).toContain(status);
        expect($('article').text()).toContain('₱2,999');
    });

    it.each(OWNER_PREVIEW_SITES.map(site => [site.submissionId, site.businessName] as const))('opens %s as a local sample without loading a customer website or enabling account actions', (business, name) => {
        const $ = ownerMarkup(business);
        expect($('main h1').text()).toBe(name);
        expect($('main h2').first().text()).toBe(name);
        expect($.text()).toContain('Sample website preview');
        expect($.text()).toContain('Customer websites are not loaded');
        expect($('a').filter((_, anchor) => $(anchor).text().trim() === 'All businesses').attr('href')).toBe('/admin/preview/owner#businesses');
        expect($('a[href^="/pay/"], a[href^="/my-business"], a[target="_blank"]').length).toBe(0);
    });

    it('keeps live-site opening and clipboard sharing disabled while showing the sample public address', () => {
        const $ = ownerMarkup('preview-owner-live');
        expect($.text()).toContain('santos-store.example.com');
        for (const label of ['Open website', 'Copy address', 'Talk to the team', 'Request a change']) {
            const button = $('button').filter((_, button) => $(button).text().trim() === label);
            expect(button.length).toBe(1);
            expect(button.is('[disabled]')).toBe(true);
        }
    });

    it('does not write to the clipboard even if a disabled sample copy handler is invoked directly', () => {
        const writeText = jest.fn();
        const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
        Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText } } });
        try {
            let tree: ReactNode;
            function Capture() {
                tree = SiteOverview({ site: OWNER_PREVIEW_SITES[0]!, preview: true });
                return tree;
            }
            renderToStaticMarkup(createElement(Capture));
            const copy = findButton(tree, 'Copy address');
            expect(copy).toBeDefined();
            expect(copy!.props.disabled).toBe(true);
            copy!.props.onClick!();
            expect(writeText).not.toHaveBeenCalled();
            expect(useOwnerAuth).not.toHaveBeenCalled();
            expect(useQuery).not.toHaveBeenCalled();
        } finally {
            if (previous) Object.defineProperty(globalThis, 'navigator', previous);
            else Reflect.deleteProperty(globalThis, 'navigator');
        }
    });

    it.each(['unknown-business', '/my-business/real-business', 'https://example.test/private-site'])('returns a safe unavailable state for a forged sample business %s', business => {
        const $ = ownerMarkup(business);
        expect($('section[aria-label="Website not available"]').length).toBe(1);
        expect($('a').filter((_, anchor) => $(anchor).text().trim() === 'Back to my businesses').attr('href')).toBe('/admin/preview/owner#businesses');
        expect($.text()).not.toContain('Sample website preview');
    });

    it('preserves actual owner workspace destinations when preview is not set', () => {
        function OwnerWorkspace() {
            return OwnerShellView({ name: 'Alex Santos', children: createElement(SiteList, { sites: OWNER_PREVIEW_SITES }) });
        }
        const $ = load(renderToStaticMarkup(createElement(OwnerWorkspace)));
        for (const href of ['/my-business', '/profile', '/knowledge', '/contact', '/my-business/preview-owner-draft', 'https://santos-store.example.com/']) {
            expect($('a[href]').map((_, anchor) => $(anchor).attr('href')).get()).toContain(href);
        }
        expect($('a[href^="/admin/preview/owner"]').length).toBe(0);
        expect(useOwnerAuth).not.toHaveBeenCalled();
        expect(useQuery).not.toHaveBeenCalled();
    });
});

afterEach(() => {
    expect(mockMutation).not.toHaveBeenCalled();
    expect(mockAction).not.toHaveBeenCalled();
    expect(usePaginatedQuery).not.toHaveBeenCalled();
});

describe("creator dashboard presentation", () => {
    it.each(AFFILIATE_SECTIONS)("renders affiliate %s preview without live queries or financial writes", (section) => {
        const html = renderToStaticMarkup(createElement(AffiliateDashboardPreview, { section }));
        expect(html).toContain("Affiliate preview · Sample data");
        expect(html).toContain("Use View as above");
        expect(html).not.toContain('href="/affiliates/dashboard');
        expect(html).not.toContain('href="/wallet');
        expect(html).not.toContain('href="/v2/creators/portal');
        expect(useQuery).not.toHaveBeenCalled();
        const $ = load(html);
        $('a[href]').each((_, anchor) => expect(isAdminPreviewHref($(anchor).attr('href'), 'affiliate')).toBe(true));
    });

    it('uses the current portal presentation for affiliate links, funnel, agents, shops and payouts', () => {
        const $ = load(renderToStaticMarkup(createElement(AffiliateDashboardPreview)));
        expect($('nav[aria-label="Creator portal"]').text()).toContain('Home');
        for (const label of ['Your links and code', 'From click to sale', 'Your field agents', 'Shops that used your code', 'Payouts']) {
            expect($(`section[aria-label="${label}"]`).length).toBe(1);
        }
        expect($('section[aria-label="Your links and code"] button').length).toBeGreaterThan(0);
        $('section[aria-label="Your links and code"] button').each((_, button) => expect($(button).is('[disabled]')).toBe(true));
        expect($('section[aria-label="Payouts"] [aria-disabled="true"]').length).toBeGreaterThan(0);
        expect($('main').text()).toContain('Sample data');
    });

    it('keeps the actual affiliate page editor and public page preview without enabling photo uploads', () => {
        const $ = load(renderToStaticMarkup(createElement(AffiliateDashboardPreview, { section: 'my-page' })));
        expect($('iframe[srcdoc]').length).toBeGreaterThan(0);
        $('iframe[srcdoc]').each((_, frame) => expect($(frame).attr('sandbox') ?? '').not.toContain('allow-scripts'));
        expect($('input[type="file"]').length).toBe(1);
        expect($('input[type="file"]').is('[disabled]')).toBe(true);
        for (const label of ['Display name', 'Personal message', 'Social links', 'Shop page preview']) expect($.text()).toContain(label);
    });

    it('saves a page draft with its bundled preview photo locally without invoking account or upload transport', async () => {
        const draft: AffiliatePageDraft = {
            photo: SAMPLE_PICTURES.creator!, displayName: '  Mika Preview  ', message: '  I can help your shop get online.  ',
            socialLinks: { instagram: 'https://www.instagram.com/mika.preview/' },
        };
        expect(draft.photo).toMatch(/^\/v2\//);
        const onSaved = jest.fn();
        let tree: ReactNode;
        function Capture() {
            tree = PageSettings({ draft, defaultName: 'Mika Santos', handle: 'preview-mika', dirty: true, disabled: false,
                preview: true, onChange: jest.fn(), onSaved });
            return tree;
        }
        renderToStaticMarkup(createElement(Capture));
        const form = findPageForm(tree);
        expect(form).toBeDefined();
        expect(form!.props['data-preview-local-save']).toBe(true);
        const event = { preventDefault: jest.fn() } as unknown as FormEvent<HTMLFormElement>;
        await form!.props.onSubmit(event);
        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(onSaved).toHaveBeenCalledTimes(1);
        expect(onSaved).toHaveBeenCalledWith({ ...draft, displayName: 'Mika Preview', message: 'I can help your shop get online.' });
        expect(mockMutation).not.toHaveBeenCalled();
        expect(mockAction).not.toHaveBeenCalled();
        expect(useQuery).not.toHaveBeenCalled();
    });

    it('keeps payout and account side effects visibly disabled in affiliate preview', () => {
        const wallet = load(renderToStaticMarkup(createElement(AffiliateDashboardPreview, { section: 'wallet' })));
        expect(wallet.text()).toContain('Withdrawals are disabled in this preview.');
        const account = load(renderToStaticMarkup(createElement(AffiliateDashboardPreview, { section: 'account' })));
        for (const label of ['Edit profile', 'Change password', 'Sign out']) {
            const control = account('button').filter((_, button) => account(button).text().trim() === label);
            expect(control.length).toBe(1);
            expect(control.is('[disabled]')).toBe(true);
        }
    });

    it.each([
        ["Creator", CreatorDashboardPreview],
        ["Affiliate", AffiliateDashboardPreview],
    ])("mounts the actual %s preview with a sample-data notice and no live reads", (view, component) => {
        const html = renderToStaticMarkup(createElement(component));
        expect(html).toContain(`${view} preview · Sample data`);
        expect(html).toContain("Use View as above");
        expect(useQuery).not.toHaveBeenCalled();
        const $ = load(html);
        $('a[href]').each((_, anchor) => expect(isAdminPreviewHref($(anchor).attr('href'), view === 'Affiliate' ? 'affiliate' : 'creator')).toBe(true));
    });

    it("renders the current home and navigation from samples without loading any accounts", () => {
        const html = renderToStaticMarkup(createElement(CreatorShellView, {
            name: "Sam Reyes", open: 2, unread: 2, preview: true,
        }, createElement(CreatorHomeView, { ...viewProps, preview: true })));
        for (const text of ["Sam", "Get Corner Coffee paid", "Sunrise Bakery", "SAMPLE-C", "Recent activity", "New submission", "Submissions", "Wallet", "Referrals", "Sam Reyes"]) {
            expect(html).toContain(text);
        }
        expect(useQuery).not.toHaveBeenCalled();
        const $ = load(html);
        const hrefs = $('a[href]').map((_, anchor) => $(anchor).attr('href')!).get();
        expect(hrefs.length).toBeGreaterThan(10);
        expect(hrefs.every((href) => href.startsWith("/admin/preview/creator#"))).toBe(true);
    });

    it("keeps empty/new creator preview actions within the preview", () => {
        const html = renderToStaticMarkup(createElement(CreatorHomeView, {
            ...viewProps, creator: { ...sampleCreator, balance: 0, totalEarnings: 0 }, submissions: [], withdrawals: [], preview: true,
        }));
        expect(html).toContain("New submission");
        expect(html).toContain('href="/admin/preview/creator#submit-info"');
        expect(html).not.toContain('href="/submit/info"');
        expect(useQuery).not.toHaveBeenCalled();
    });

    it("retains live creator destinations when preview is not set", () => {
        const html = renderToStaticMarkup(createElement(CreatorShellView, {
            name: "Sam Reyes", open: 2, unread: 2,
        }, createElement(CreatorHomeView, viewProps)));
        for (const href of ["/dashboard", "/submit/info", "/leads", "/wallet", "/referrals", "/submissions?open=preview-payment"]) {
            expect(html).toContain(`href="${href}"`);
        }
        expect(html).not.toContain('href="/admin/preview/creator#');
    });

    it("preserves live home query arguments and renders the same presentation", () => {
        (useQuery as jest.Mock).mockImplementation((reference) => {
            switch (getFunctionName(reference)) {
                case "submissions:getByCreatorId": return sampleSubmissions;
                case "leads:listForMobileCRM": return { leads: sampleLeads };
                case "withdrawals:getByCreator": return sampleWithdrawals;
                case "referrals:getStats": return referrals;
                default: throw new Error("Unexpected live query");
            }
        });
        const actual = renderToStaticMarkup(createElement(CreatorHome, { creator: sampleCreator }));
        const expected = renderToStaticMarkup(createElement(CreatorHomeView, viewProps));
        expect(actual).toBe(expected);
        expect((useQuery as jest.Mock).mock.calls.map(([reference, args]) => [getFunctionName(reference), args])).toEqual([
            ["submissions:getByCreatorId", { creatorId: sampleCreator._id }],
            ["leads:listForMobileCRM", {}],
            ["withdrawals:getByCreator", { creatorId: sampleCreator._id }],
            ["referrals:getStats", { referrerId: sampleCreator._id }],
        ]);
    });
});
