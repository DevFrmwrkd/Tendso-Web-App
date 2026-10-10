import { Children, createElement, isValidElement, type ChangeEvent, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ isAdmin: true, pathname: "/admin", push: vi.fn() }));
vi.mock("@/hooks/useAdmin", () => ({ useAdminAuth: () => ({ isAdmin: state.isAdmin }) }));
vi.mock("next/navigation", () => ({
    usePathname: () => state.pathname,
    useRouter: () => ({ push: state.push }),
}));

import AdminViewBar from "../../app/admin/components/AdminViewBar";
import { adminViewForPath } from "../../lib/admin-views";

type SelectProps = { children?: ReactNode; onChange: (event: ChangeEvent<HTMLSelectElement>) => void; value: string };
function findSelect(node: ReactNode): ReactElement<SelectProps> | undefined {
    for (const child of Children.toArray(node)) {
        if (!isValidElement<{ children?: ReactNode }>(child)) continue;
        if (child.type === "select") return child as ReactElement<SelectProps>;
        const nested = findSelect(child.props.children);
        if (nested) return nested;
    }
}

function renderBar() {
    let tree: ReactNode;
    function Capture() {
        tree = AdminViewBar();
        return tree;
    }
    const html = renderToStaticMarkup(createElement(Capture));
    return { html, select: findSelect(tree) };
}

beforeEach(() => {
    state.isAdmin = true;
    state.pathname = "/admin";
    state.push.mockReset();
});

describe("admin dashboard view switch", () => {
    it("shows a labelled native selector with all three views and does not navigate on mount", () => {
        const { html, select } = renderBar();
        expect(html).toContain("View as");
        expect(html).toContain("Admin view");
        expect(html).toContain("Affiliate view");
        expect(html).toContain("Creator view");
        const id = html.match(/<select\b[^>]*id="([^"]+)"/)?.[1];
        expect(id).toBeTruthy();
        expect(html).toContain(`for="${id}"`);
        expect(select?.props.value).toBe("admin");
        expect(state.push).not.toHaveBeenCalled();
    });

    it("renders no selector when the authenticated access hook does not grant admin access", () => {
        state.isAdmin = false;
        expect(renderBar().html).toBe("");
        expect(state.push).not.toHaveBeenCalled();
    });

    it.each([
        ["/admin/preview/affiliate", "affiliate"],
        ["/admin/preview/creator", "creator"],
        ["/admin/preview/creator/", "creator"],
        ["/admin/submissions", "admin"],
        ["/admin/preview/creator-forged", "admin"],
    ])("reflects %s as %s", (pathname, selected) => {
        state.pathname = pathname;
        expect(renderBar().select?.props.value).toBe(selected);
        expect(adminViewForPath(pathname)).toBe(selected);
    });

    it.each([
        ["/admin", "affiliate", "/admin/preview/affiliate"],
        ["/admin", "creator", "/admin/preview/creator"],
        ["/admin/preview/affiliate", "creator", "/admin/preview/creator"],
        ["/admin/preview/creator", "admin", "/admin"],
    ])("navigates from %s to the selected %s view", (pathname, value, destination) => {
        state.pathname = pathname;
        renderBar().select!.props.onChange({ target: { value } } as ChangeEvent<HTMLSelectElement>);
        expect(state.push).toHaveBeenCalledExactlyOnceWith(destination);
    });

    it.each(["admin", "https://evil.example", "staff", ""])("does not navigate for unchanged or unknown value %s", (value) => {
        renderBar().select!.props.onChange({ target: { value } } as ChangeEvent<HTMLSelectElement>);
        expect(state.push).not.toHaveBeenCalled();
    });
});
