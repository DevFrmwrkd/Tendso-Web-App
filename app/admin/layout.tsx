import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { api } from "@/convex/_generated/api";
import { ADMIN_PATH_HEADER, adminAccessFor, adminLoginPath } from "@/lib/admin-access";
import { AdminAccessGate } from "./components/AdminLayout";

export default async function AdminRouteLayout({ children }: { children: React.ReactNode }) {
    const pathname = (await headers()).get(ADMIN_PATH_HEADER) ?? "/admin";
    const { userId, getToken } = await auth();
    if (!userId) redirect(adminLoginPath(pathname));

    const token = await getToken({ template: "convex" });
    if (!token) redirect(adminLoginPath(pathname));

    const session = await fetchQuery(api.adminAccess.me, {}, { token });
    if (!session || session.clerkId !== userId) redirect(adminLoginPath(pathname));
    const access = adminAccessFor(session, pathname);
    if (!access.allowed) redirect(access.redirectTo!);

    // Layouts persist across client navigation. The client boundary checks
    // each pathname again, as well as live role changes and auth hydration.
    return <AdminAccessGate>{children}</AdminAccessGate>;
}
