import type { Metadata } from "next"
import type { ReactNode } from "react"

import { CreatorShell } from "@/components/shells/CreatorShell"

/**
 * New submission lives inside the creator's frame (board: NewSubmission): the
 * sidebar stays put while the creator moves between the four steps, and its
 * New submission button shows as current anywhere under /submit.
 *
 * A layout rather than a wrapper in each page so the shell is not torn down
 * and rebuilt on every step. Each page keeps its own sign-in and draft checks,
 * exactly as before.
 *
 * The title gives the tab a name the creator can find again: this is a long
 * job on a phone, and they switch away from it while standing in the shop.
 */
export const metadata: Metadata = {
    title: "New submission — Tendso",
}

export default function SubmitLayout({ children }: { children: ReactNode }) {
    return <CreatorShell>{children}</CreatorShell>
}
