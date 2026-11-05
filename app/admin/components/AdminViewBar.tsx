"use client";

import { usePathname, useRouter } from "next/navigation";
import { useId } from "react";

import { useAdminAuth } from "@/hooks/useAdmin";
import { ADMIN_VIEWS, adminViewForPath } from "@/lib/admin-views";
import styles from "./AdminViewBar.module.css";

export default function AdminViewBar({ standalone = false }: { standalone?: boolean } = {}) {
    const { isAdmin } = useAdminAuth();
    const pathname = usePathname();
    const router = useRouter();
    const id = useId();
    if (!isAdmin) return null;
    if (standalone && !pathname?.startsWith('/admin/preview/')) return null;

    return (
        <div className={`${styles.control} ${standalone ? styles.standalone : ''}`}>
            <label htmlFor={id} className={styles.label}>View as</label>
            <select
                id={id}
                value={adminViewForPath(pathname)}
                className={styles.select}
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
