"use client";

import { usePathname, useRouter } from "next/navigation";
import { useId } from "react";

import { useAdminAuth } from "@/hooks/useAdmin";
import { ADMIN_VIEWS, adminViewForPath } from "@/lib/admin-views";

export default function AdminViewBar() {
    const { isAdmin } = useAdminAuth();
    const pathname = usePathname();
    const router = useRouter();
    const id = useId();
    if (!isAdmin) return null;

    return (
        <div className="r1 flex h-16 shrink-0 items-center justify-end gap-3 border-b border-r1-line bg-r1-paper px-4 py-2 sm:px-6 print:hidden">
            <label htmlFor={id} className="t-label">View as</label>
            <select
                id={id}
                value={adminViewForPath(pathname)}
                className="t-input min-h-11 w-auto min-w-40"
                onChange={(event) => {
                    const next = ADMIN_VIEWS.find((view) => view.value === event.target.value);
                    if (next && next.value !== adminViewForPath(pathname)) router.push(next.href);
                }}
            >
                {ADMIN_VIEWS.map((view) => <option key={view.value} value={view.value}>{view.label}</option>)}
            </select>
        </div>
    );
}
