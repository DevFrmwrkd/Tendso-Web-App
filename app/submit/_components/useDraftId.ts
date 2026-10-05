"use client"

import { useRouter } from "next/navigation"
import { useEffect, useSyncExternalStore } from "react"

import { DRAFT_ID_KEY } from "./flow"

function subscribe(onChange: () => void) {
    // sessionStorage only announces writes made in OTHER tabs. This tab's own
    // writes are read again on its next render, which every write here causes.
    window.addEventListener("storage", onChange)
    return () => window.removeEventListener("storage", onChange)
}

/**
 * The id of the draft the steps are working on (sessionStorage, DRAFT_ID_KEY).
 * Null on the server and while hydrating, so the first paint matches the
 * server's HTML; the real value arrives on the next render.
 */
export function useDraftId(): string | null {
    return useSyncExternalStore(
        subscribe,
        () => sessionStorage.getItem(DRAFT_ID_KEY),
        () => null,
    )
}

/**
 * Steps 2–4: the draft id, and back to step 1 when there is none (a fresh
 * tab, or the success page already cleared it). Same check, same moment
 * (on mount) as each step did before the redesign.
 */
export function useRequiredDraftId(): string | null {
    const router = useRouter()
    const id = useDraftId()
    useEffect(() => {
        if (!sessionStorage.getItem(DRAFT_ID_KEY)) router.push("/submit/info")
    }, [router])
    return id
}
