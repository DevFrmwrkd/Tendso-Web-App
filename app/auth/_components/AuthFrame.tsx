import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { FunnelHeader, LinkTabs, PublicPage } from "@/components/r1";
import { OPERATOR } from "@/lib/contact";

/**
 * The frame every sign-in screen shares (board: SignIn): the funnel header
 * (wordmark and "Back to site", no navigation), the page's one heading, the
 * card, and the operator line under it. No footer: a funnel has one way on
 * and one way out.
 *
 * Phone first. The card is the full width of a phone and 420px from there up;
 * the heading centres above it at every size.
 */
export function AuthFrame({
    title,
    sub,
    tabs,
    foot,
    children,
}: {
    title: ReactNode;
    sub?: ReactNode;
    /** <AuthTabs>, on the two screens that have them (sign in, create account). */
    tabs?: ReactNode;
    /** An extra line under the card, above the operator line. */
    foot?: ReactNode;
    children: ReactNode;
}) {
    return (
        <PublicPage
            header={<FunnelHeader exit={{ href: "/", label: "Back to site", icon: ArrowLeft }} />}
            mainClassName="items-center gap-6 px-4 pb-10 pt-8 sm:px-6 sm:pt-14"
        >
            <div className="flex max-w-[520px] flex-col items-center gap-1.5 text-center">
                <h1 className="t-h1">{title}</h1>
                {sub && <p className="t-sub">{sub}</p>}
            </div>
            <section className="t-card w-full max-w-[420px]" aria-label="Account access">
                {tabs}
                {children}
            </section>
            <div className="flex flex-col items-center gap-2 text-center">
                {foot}
                <p className="t-meta">
                    Tendso is operated by {OPERATOR}. Trouble signing in?{" "}
                    <Link href="/knowledge" className="t-link">
                        Get help
                    </Link>
                </p>
            </div>
        </PublicPage>
    );
}

/**
 * Sign in | Create account. Two routes, so the tabs are links: the current one
 * carries aria-current, and each keeps its own address for emails and the app
 * to link to.
 */
export function AuthTabs({ current }: { current: "signin" | "create" }) {
    return (
        <div className="px-5 sm:px-6">
            <LinkTabs
                label="Sign in or create an account"
                current={current === "signin" ? "/login" : "/signup"}
                tabs={[
                    { href: "/login", label: "Sign in" },
                    { href: "/signup", label: "Create account" },
                ]}
            />
        </div>
    );
}

/** The padded column inside the card that holds a form: the board's 16px rhythm, 24px padding (20px on a phone, like every r1 card). */
export const AUTH_BODY = "flex flex-col gap-4 p-5 sm:p-6";
