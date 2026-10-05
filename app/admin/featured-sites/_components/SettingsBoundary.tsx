"use client"

import { Component, type ReactNode } from "react"

import { ErrorState } from "@/components/r1"

type State = { failed: boolean; reference: string | null }

/**
 * Keeps a failed settings query inside the admin frame (ComponentKit, "Page
 * failed to load"). A Convex query that fails throws while rendering; without
 * this boundary the page would fall through to the root error screen, sidebar
 * and all. With it, the header and the sidebar stay, the body says it failed
 * and that nothing was changed, and offers Reload.
 */
export class SettingsBoundary extends Component<{ what: string; children: ReactNode }, State> {
    state: State = { failed: false, reference: null }

    static getDerivedStateFromError(error: unknown): State {
        // Convex server errors read "[Request ID: 1a2b3c…] Server Error"; that
        // id is what the team can look up in the logs.
        const message = error instanceof Error ? error.message : ""
        return { failed: true, reference: /\[Request ID: ([^\]]+)\]/.exec(message)?.[1] ?? null }
    }

    render() {
        return this.state.failed ? <ErrorState what={this.props.what} reference={this.state.reference} /> : this.props.children
    }
}
