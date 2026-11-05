"use client";

import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { cx } from "@/components/v2/cx";

/** One screen of the panel: a back arrow, a title, the work, and one big button at the foot. */
export function ToolScreen({
    title,
    hint,
    onBack,
    children,
    footer,
}: {
    title: string;
    hint?: string;
    onBack?: () => void;
    children: ReactNode;
    footer?: ReactNode;
}) {
    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center gap-3 px-5 pb-3 pt-4">
                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label="Back"
                        className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full bg-v2-stage text-v2-ink transition-colors hover:bg-[#E7E8E4]"
                    >
                        <ArrowLeft size={22} />
                    </button>
                )}
                <div className="min-w-0">
                    <h2 className="truncate text-[24px] font-medium leading-tight tracking-[-0.03em]">{title}</h2>
                    {hint && <p className="text-[16px] leading-snug text-v2-ink-2">{hint}</p>}
                </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
            {footer && <div className="border-t border-v2-line bg-v2-canvas px-5 py-3">{footer}</div>}
        </div>
    );
}

/** A big tappable choice: swatch, font sample or label. */
export function Choice({
    selected,
    onClick,
    children,
    className,
    label,
}: {
    selected: boolean;
    onClick: () => void;
    children: ReactNode;
    className?: string;
    label: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={selected}
            aria-label={label}
            className={cx(
                "flex min-h-[88px] flex-col items-start justify-between gap-2 rounded-v2-card border-2 bg-v2-canvas p-4 text-left transition-colors",
                selected ? "border-v2-ink" : "border-v2-line hover:border-[#CFCFC9]",
                className,
            )}
        >
            {children}
        </button>
    );
}

/** Plain text field used across the editor: 18px, big hit area. */
export const FIELD_CLASS =
    "w-full rounded-[16px] border border-v2-line bg-v2-canvas px-4 py-3 text-[18px] leading-snug text-v2-ink outline-none transition-colors focus:border-v2-ink";
