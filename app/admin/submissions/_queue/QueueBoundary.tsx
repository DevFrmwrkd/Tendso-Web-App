"use client"

import { Component, type ReactNode } from "react"

import { ErrorState } from "@/components/r1"

/**
 * Keeps a failed list inside the admin frame (ComponentKit, "Page failed to
 * load"). A Convex query that fails throws while rendering; without this the
 * queue would fall through to the root error screen, sidebar and all. With
 * it, the page header and the sidebar stay, and the list says it failed,
 * that nothing was changed, and offers Reload (a full reload re-subscribes).
 */
export class QueueBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false }

    static getDerivedStateFromError() {
        return { failed: true }
    }

    render() {
        return this.state.failed ? <ErrorState what="Submissions" /> : this.props.children
    }
}
