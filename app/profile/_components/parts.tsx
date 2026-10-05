import { Lock } from "lucide-react";
import { useId, type ReactNode } from "react";

import { Icon, cx } from "@/components/r1";

/*
 * The pieces every Account card is made of (board Account, `ac-` classes):
 * a card head (title, the one line that says why it is there, at most one
 * small action), then lines of "key, value, action". On a phone the key sits
 * above its value so the action keeps its room; from `sm` it is a column on
 * the left, as on the board.
 */

export function AccountCard({
    id,
    title,
    meta,
    action,
    children,
    className,
}: {
    id?: string;
    title: ReactNode;
    meta?: ReactNode;
    action?: ReactNode;
    children?: ReactNode;
    className?: string;
}) {
    const headingId = useId();
    return (
        <section id={id} className={cx("t-card overflow-hidden", className)} aria-labelledby={headingId}>
            <div className="flex items-start justify-between gap-4 px-4 pb-4 pt-5 sm:px-6">
                <div className="flex min-w-0 flex-col gap-0.5">
                    <h2 className="t-h2" id={headingId}>
                        {title}
                    </h2>
                    {meta && <p className="t-meta">{meta}</p>}
                </div>
                {action && <div className="flex-none">{action}</div>}
            </div>
            {children}
        </section>
    );
}

/** One "key · value · action" line of a card. */
export function Line({ label, children, action }: { label: ReactNode; children: ReactNode; action?: ReactNode }) {
    return (
        <div className="flex items-center gap-3 border-t border-r1-line-3 px-4 py-3 sm:min-h-[60px] sm:gap-4 sm:px-6">
            <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                <span className="t-label sm:w-[84px] sm:flex-none">{label}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</div>
            </div>
            {action && <div className="flex-none">{action}</div>}
        </div>
    );
}

/** The value of a line. */
export function Value({ children, className }: { children: ReactNode; className?: string }) {
    return <span className={cx("text-sm leading-5 text-r1-ink [overflow-wrap:anywhere]", className)}>{children}</span>;
}

/** A small "why it is like this" note under a value, with the lock. */
export function LockedNote({ children }: { children: ReactNode }) {
    return (
        <span className="t-meta flex items-start gap-1.5">
            <Icon icon={Lock} size={14} className="mt-0.5 flex-none text-r1-ink-3" />
            <span>{children}</span>
        </span>
    );
}

/** The one-line explanation in a drawer, above its fields ("Now paying to", "Email"). */
export function NowBlock({ label, children }: { label: ReactNode; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-0.5 rounded-r1 bg-r1-fill-2 px-4 py-3">
            <span className="t-label">{label}</span>
            <span className="t-body [overflow-wrap:anywhere]">{children}</span>
        </div>
    );
}

/** Same check the Wallet uses for a Wise email. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "j•••@gmail.com". The board shows your own email masked on Account, so a
 * shared screen or a screenshot does not hand it out.
 */
export function maskEmail(email: string | null | undefined): string {
    if (!email) return "";
    const at = email.indexOf("@");
    if (at < 1) return email;
    return `${email[0]}•••${email.slice(at)}`;
}

/** "0917 ••• 4173", the kit's masked phone. Short or odd values are shown as they are. */
export function maskPhone(phone: string | null | undefined): string {
    if (!phone) return "";
    if (phone.length < 8) return phone;
    return `${phone.slice(0, 4)} ••• ${phone.slice(-4)}`;
}

/** Clerk's error, read the way the old pages read it (longMessage first). */
export function clerkError(err: unknown): { code?: string; message?: string; param?: string } {
    const e = err as { errors?: { code?: string; longMessage?: string; message?: string; meta?: { paramName?: string } }[]; message?: string } | null;
    const first = e?.errors?.[0];
    return { code: first?.code, message: first?.longMessage || first?.message || e?.message, param: first?.meta?.paramName };
}

/** "Apr 2026" */
export function monthShort(ms: number): string {
    return new Date(ms).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** "April 2026" */
export function monthLong(ms: number): string {
    return new Date(ms).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
