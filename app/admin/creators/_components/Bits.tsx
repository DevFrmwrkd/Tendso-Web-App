"use client";

import type { ReactNode } from "react";

import { cx } from "@/components/r1";
import type { Id } from "@/convex/_generated/dataModel";

import { formatPhone } from "../_lib/creators";
import styles from "./CreatorDetails.module.css";

/*
 * The drawer's building blocks from the Creators board (its cr- classes),
 * written with the Round 1 tokens: a titled section, a bordered line with an
 * action on the right, and the three-figure facts strip.
 */

export function Section({ title, aside, help, id, children }: { title: ReactNode; aside?: ReactNode; help?: ReactNode; id?: string; children: ReactNode }) {
    return (
        <section className={cx("flex flex-col gap-3", styles.section)} aria-labelledby={id}>
            <div className={styles.sectionHeading}>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <h3 className="t-h2" id={id}>
                        {title}
                    </h3>
                    {help && <p className="t-meta">{help}</p>}
                </div>
                {aside && <span className="t-meta flex-none">{aside}</span>}
            </div>
            {children}
        </section>
    );
}

/** A bordered line: what it is on the left, one action (or a status) on the right. */
export function Line({ title, meta, children, className }: { title: ReactNode; meta?: ReactNode; children?: ReactNode; className?: string }) {
    return (
        <div className={cx(styles.line, className)}>
            <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium text-r1-ink">{title}</span>
                {meta && <span className="t-meta">{meta}</span>}
            </span>
            {children && <span className="flex flex-none items-center">{children}</span>}
        </div>
    );
}

/** Submissions, Earned, Balance: three figures in one hairline strip (board cr-facts). */
export function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
    return (
        <div className={styles.facts}>
            {items.map((f) => (
                <div key={f.label} className={styles.fact}>
                    <span className="t-label">{f.label}</span>
                    <span className={styles.value}>{f.value}</span>
                </div>
            ))}
        </div>
    );
}

/** A phone number an admin can tap to call. */
export function PhoneValue({ phone }: { phone?: string | null }) {
    if (!phone) return <span className="text-r1-ink-3">Not given</span>;
    return (
        <a className="t-link t-num" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
            {formatPhone(phone)}
        </a>
    );
}

/** An email an admin can tap to write to. */
export function EmailValue({ email }: { email?: string | null }) {
    if (!email) return <span className="text-r1-ink-3">Not given</span>;
    return (
        <a className="t-link" href={`mailto:${email}`}>
            {email}
        </a>
    );
}

/**
 * Who referred them. The old detail page printed the referrer's raw id here;
 * now it is their name, and it opens the referrer in this same drawer.
 */
export function ReferrerValue({
    referredBy,
    referredByName,
    referredByCode,
    onOpenCreator,
}: {
    referredBy?: Id<"creators"> | null;
    referredByName?: string | null;
    referredByCode?: string | null;
    onOpenCreator: (id: string) => void;
}) {
    const label = referredByName?.trim() || referredByCode || null;
    if (!label && !referredBy) return <span className="text-r1-ink-3">No one</span>;
    if (!referredBy) return <>{label}</>;
    return (
        <button type="button" className="t-link cursor-pointer text-right" onClick={() => onOpenCreator(referredBy)}>
            {label ?? "Open the referrer"}
        </button>
    );
}
