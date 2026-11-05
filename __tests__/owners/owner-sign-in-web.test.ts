import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type WidgetProps = { appearance: { elements: Record<string, unknown> }; routing: string; forceRedirectUrl: string; signInUrl?: string; signUpUrl?: string };
const state = vi.hoisted(() => ({ params: new URLSearchParams(), signedIn: false, widgets: [] as { kind: string; props: WidgetProps }[] }));
vi.mock("next/navigation", () => ({ useSearchParams: () => state.params }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: { children: ReactNode }) => createElement("a", props, children) }));
vi.mock("next/image", () => ({ default: (props: Record<string, unknown>) => createElement("img", props) }));
vi.mock("@clerk/nextjs", () => ({
    useAuth: () => ({ isSignedIn: state.signedIn }),
    SignIn: (props: WidgetProps) => { state.widgets.push({ kind: "signin", props }); return createElement("div", { "aria-label": "Clerk sign-in" }, "Email verification managed by Clerk"); },
    SignUp: (props: WidgetProps) => { state.widgets.push({ kind: "signup", props }); return createElement("div", { "aria-label": "Clerk account setup" }, "Account setup managed by Clerk"); },
}));
vi.mock("../../components/r1", () => ({ LinkTabs: ({ label, tabs, current }: { label: string; tabs: { href: string; label: string }[]; current: string }) =>
    createElement("nav", { "aria-label": label }, tabs.map(tab => createElement("a", { key: tab.href, href: tab.href, "aria-current": tab.href === current ? "page" : undefined }, tab.label))) }));

import OwnerSignInPage from "../../app/my-business/sign-in/page";
import { AuthFrame, AuthTabs } from "../../app/auth/_components/AuthFrame";
import { AUTH_CLERK_APPEARANCE } from "../../app/auth/_components/authAppearance";

const tokenPath = `/pay/${"a".repeat(64)}`;
const render = () => renderToStaticMarkup(createElement(OwnerSignInPage));
beforeEach(() => { state.params = new URLSearchParams(); state.signedIn = false; state.widgets = []; });

describe("owner sign-in presentation and destinations", () => {
    it("uses Today for a new visit to sign-in and keeps Clerk’s email verification controls mounted", () => {
        const html = render();
        expect(state.widgets).toHaveLength(1);
        expect(state.widgets[0]).toMatchObject({ kind: "signin", props: { routing: "hash", forceRedirectUrl: "/my-business/today" } });
        expect(state.widgets[0].props.appearance).toBe(AUTH_CLERK_APPEARANCE);
        expect(state.widgets[0].props.appearance.elements).not.toHaveProperty("header.display", "none");
        expect(state.widgets[0].props.appearance.elements).not.toHaveProperty("identityPreviewEditButton.display", "none");
        expect(html).toContain("Use your business email"); expect(html).toContain("Email verification managed by Clerk");
        expect(html).toContain(`href="/my-business/sign-in?mode=signup&amp;returnTo=${encodeURIComponent("/my-business/today")}"`);
    });
    it("preserves a complete payment link through both sign-in and signup mode switches", () => {
        state.params = new URLSearchParams({ returnTo: tokenPath });
        const signInHtml = render();
        expect(state.widgets[0].props.forceRedirectUrl).toBe(tokenPath);
        expect(state.widgets[0].props.signUpUrl).toBe(`/my-business/sign-in?mode=signup&returnTo=${encodeURIComponent(tokenPath)}`);
        expect(signInHtml).toContain("Create an owner account");
        state.widgets = []; state.params.set("mode", "signup");
        const signUpHtml = render();
        expect(state.widgets[0]).toMatchObject({ kind: "signup", props: { routing: "hash", forceRedirectUrl: tokenPath,
            signInUrl: `/my-business/sign-in?mode=signin&returnTo=${encodeURIComponent(tokenPath)}` } });
        expect(state.widgets[0].props.appearance).toBe(AUTH_CLERK_APPEARANCE);
        expect(signUpHtml).toContain("Already have an account?"); expect(signUpHtml).toContain("Account setup managed by Clerk");
    });
    it.each(["https://elsewhere.example", "//elsewhere.example", "/admin", "/my-business/sign-in"])
    ("does not send the refreshed widget or its alternate account link to an unsafe destination: %s", returnTo => {
        state.params = new URLSearchParams({ returnTo });
        render();
        expect(state.widgets[0].props.forceRedirectUrl).toBe("/my-business");
        expect(state.widgets[0].props.signUpUrl).toBe(`/my-business/sign-in?mode=signup&returnTo=${encodeURIComponent("/my-business")}`);
    });
    it("offers the existing safe continuation when already signed in instead of mounting another auth form", () => {
        state.params = new URLSearchParams({ returnTo: tokenPath }); state.signedIn = true;
        const html = render();
        expect(state.widgets).toHaveLength(0); expect(html).toContain(`href="${tokenPath}"`);
        expect(html).toContain("Continue"); expect(html).toContain("You’re signed in.");
        expect(html).not.toContain("Create an owner account");
    });
});

describe("shared auth frame", () => {
    it("keeps one page heading, form content, public exit, help and route tabs accessible", () => {
        function Frame() {
            return AuthFrame({ title: "Check your email", sub: "Enter your verification code.",
                tabs: createElement(AuthTabs, { current: "create" }), children: createElement("form", { "aria-label": "Verification code" }, createElement("input", { name: "code", autoComplete: "one-time-code" })) });
        }
        const html = renderToStaticMarkup(createElement(Frame));
        expect(html.match(/<h1\b/g)).toHaveLength(1); expect(html).toContain("Check your email");
        expect(html).toContain('src="/v2/brand/mark-ink-256.png"'); expect(html).toContain("Tendso home");
        expect(html).toContain('aria-label="Back to site"');
        expect(html).toContain('href="/signup" aria-current="page"'); expect(html).toContain('href="/login"');
        expect(html).toContain('href="/knowledge"'); expect(html).toContain('autoComplete="one-time-code"');
        expect(html).toContain("Skip to account access");
    });
});
