import { ImageIcon } from "lucide-react";
import type { ComponentPropsWithRef, ReactNode } from "react";

import { cx } from "./cx";
import { Icon } from "./Icon";
import { Status } from "./Status";
import type { StatusWord } from "./statusWords";

/*
 * Cards: one number and one status per card. One highlighted card per
 * screen, at most. Cards have a hairline border and no shadow.
 */

export function Card({ pad = false, className, ...rest }: ComponentPropsWithRef<"div"> & { pad?: boolean }) {
    return <div className={cx("t-card", pad && "t-card-pad", className)} {...rest} />;
}

/** The one gold surface a screen may have. */
export function Highlight({ className, ...rest }: ComponentPropsWithRef<"div">) {
    return <div className={cx("t-hl", className)} {...rest} />;
}

/** One number and one status. A card that would read 0 is cut, not shown. */
export function StatCard({ label, value, status, className }: { label: ReactNode; value: ReactNode; status?: StatusWord; className?: string }) {
    return (
        <div className={cx("t-card t-card-pad flex flex-col gap-2", className)}>
            <span className="t-label">{label}</span>
            <span className="t-figure">{value}</span>
            {status && <Status {...status} />}
        </div>
    );
}

/** "Your next step": the one highlighted card on a home. */
export function NextStepCard({
    label = "Your next step",
    title,
    body,
    actions,
    className,
}: {
    label?: ReactNode;
    title: ReactNode;
    body?: ReactNode;
    actions?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cx("t-hl flex flex-col gap-2 p-5 sm:p-6", className)}>
            <span className="t-label t-hl-label">{label}</span>
            <h2 className="t-h2">{title}</h2>
            {body && <p className="t-body">{body}</p>}
            {actions && <div className="flex flex-wrap gap-2 pt-2">{actions}</div>}
        </div>
    );
}

/** A customer site: its screenshot (or an empty frame), name, place, status and one action. */
export function SiteCard({
    image,
    alt,
    title,
    meta,
    status,
    action,
    emptyLabel = "No site yet",
    className,
}: {
    image?: string | null;
    alt?: string;
    title: ReactNode;
    meta?: ReactNode;
    status?: StatusWord;
    action?: ReactNode;
    emptyLabel?: string;
    className?: string;
}) {
    return (
        <div className={cx("t-card t-site", className)}>
            {image ? (
                // Screenshots come from customer sites and storage on many hosts.
                // eslint-disable-next-line @next/next/no-img-element
                <img className="t-site-img" src={image} alt={alt ?? ""} loading="lazy" />
            ) : (
                <div className="t-site-empty">
                    <Icon icon={ImageIcon} size={18} />
                    <span className="t-meta">{emptyLabel}</span>
                </div>
            )}
            <div className="t-site-body">
                <div className="flex flex-col gap-0.5">
                    <h3 className="t-h2">{title}</h3>
                    {meta && <span className="t-meta">{meta}</span>}
                </div>
                {(status || action) && (
                    <div className="t-site-foot">
                        {status ? <Status {...status} /> : <span />}
                        {action}
                    </div>
                )}
            </div>
        </div>
    );
}

/** Money lines: a breakdown or a ledger. Format amounts with formatMoney(). */
export function MoneyLines({ className, children }: { className?: string; children: ReactNode }) {
    return <div className={cx("t-mlines", className)}>{children}</div>;
}

export function MoneyLine({
    label,
    meta,
    amount,
    total = false,
    className,
}: {
    label: ReactNode;
    meta?: ReactNode;
    amount: ReactNode;
    total?: boolean;
    className?: string;
}) {
    return (
        <div className={cx("t-mline", total && "t-mtotal", className)}>
            {meta ? (
                <span className="flex flex-col">
                    <span>{label}</span>
                    <span className="t-meta">{meta}</span>
                </span>
            ) : (
                <span>{label}</span>
            )}
            <span className="t-mamt">{amount}</span>
        </div>
    );
}

/** Facts in a drawer or card: term on the left, value on the right. */
export function DefList({ className, children }: { className?: string; children: ReactNode }) {
    return <dl className={cx("t-dl", className)}>{children}</dl>;
}

export function DefRow({ term, children, className }: { term: ReactNode; children: ReactNode; className?: string }) {
    return (
        <div className={cx("t-dl-row", className)}>
            <dt>{term}</dt>
            <dd>{children}</dd>
        </div>
    );
}

/** A short history: one dot per step, the date (or "waiting", "next") on the right. */
export function Timeline({ items, className }: { items: { tone: StatusWord["tone"]; label: ReactNode; date?: ReactNode }[]; className?: string }) {
    return (
        <ol className={cx("t-tl", className)}>
            {items.map((it, i) => (
                <li key={i}>
                    <span className={cx("t-dot", `is-${it.tone}`)} aria-hidden="true" />
                    {it.label}
                    {it.date != null && <span className="t-tl-date">{it.date}</span>}
                </li>
            ))}
        </ol>
    );
}
