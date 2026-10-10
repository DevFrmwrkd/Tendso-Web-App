import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Dashboard preview — Tendso admin",
    robots: { index: false, follow: false },
};

export default function DashboardPreviewLayout({ children }: { children: React.ReactNode }) {
    return children;
}
