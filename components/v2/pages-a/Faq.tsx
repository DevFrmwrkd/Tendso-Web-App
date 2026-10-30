"use client";

import { Plus } from "lucide-react";
import { useRef } from "react";

export interface FaqItem {
    q: string;
    a: string;
}

/**
 * Details/summary list with the mock's calm open and close (height + blur). The
 * classes differ per page (`qa` on business, `ag-qa` on field agents), so they are props.
 */
export function FaqList({ items, base = "qa", className, ...rest }: { items: readonly FaqItem[]; base?: string; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
    const busy = useRef(new WeakSet<HTMLDetailsElement>());

    function toggle(e: React.MouseEvent<HTMLElement>) {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const sum = e.currentTarget;
        const d = sum.parentElement as HTMLDetailsElement;
        const body = d.querySelector<HTMLElement>(`.${base}-a`);
        if (!body || !body.animate) return;
        e.preventDefault();
        if (busy.current.has(d)) return;
        busy.current.add(d);
        const opening = !d.open;
        if (opening) d.open = true;
        const h = body.scrollHeight;
        const anim = body.animate(
            opening
                ? [{ height: "0px", opacity: 0, filter: "blur(6px)" }, { height: h + "px", opacity: 1, filter: "blur(0)" }]
                : [{ height: h + "px", opacity: 1, filter: "blur(0)" }, { height: "0px", opacity: 0, filter: "blur(6px)" }],
            { duration: opening ? 520 : 360, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        );
        anim.onfinish = () => {
            if (!opening) d.open = false;
            busy.current.delete(d);
        };
    }

    return (
        <div className={className} {...rest}>
            {items.map((it) => (
                <details className={base} key={it.q}>
                    <summary onClick={toggle}>
                        {it.q}
                        <span className={`${base}-plus`}>
                            <Plus size={14} strokeWidth={1.8} aria-hidden="true" />
                        </span>
                    </summary>
                    <div className={`${base}-a`}>
                        <p>{it.a}</p>
                    </div>
                </details>
            ))}
        </div>
    );
}
