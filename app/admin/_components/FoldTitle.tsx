import type { ReactNode } from "react"

/**
 * A fold's button text: the name on the left, a quiet summary on the right
 * ("Mon–Fri · 2 windows", "143"), then the fold's own chevron. Boards Today
 * and Calls draw every fold this way.
 */
export default function FoldTitle({ label, meta }: { label: ReactNode; meta?: ReactNode }) {
    return (
        <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <span className="min-w-0">{label}</span>
            {meta != null && meta !== "" && <span className="t-meta flex-none font-normal">{meta}</span>}
        </span>
    )
}
