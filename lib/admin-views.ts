export const ADMIN_VIEWS = [
    { value: "admin", label: "Admin view", href: "/admin" },
    { value: "affiliate", label: "Affiliate view", href: "/admin/preview/affiliate" },
    { value: "creator", label: "Creator view", href: "/admin/preview/creator" },
] as const;

export function adminViewForPath(pathname: string) {
    return ADMIN_VIEWS.find((view) => view.value !== "admin"
        && (pathname === view.href || pathname.startsWith(`${view.href}/`)))?.value ?? "admin";
}
