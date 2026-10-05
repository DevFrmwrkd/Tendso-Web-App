"use client"

import { Component, type ReactNode } from "react"

import { ErrorState } from "@/components/r1"

type Props = {
    /** What failed, as a name: "Today", "Calls", "Call stats". */
    what: string
    children: ReactNode
}

type State = { failed: boolean; reference: string | null }

/**
 * A failing Convex query throws while rendering. Without a boundary that lands
 * on app/error.tsx and takes the whole admin frame with it, sidebar included;
 * this keeps the failure to the page body (or the one tab) and shows the kit's
 * error state there, so the rest of the admin is still one click away.
 */
export default class PanelBoundary extends Component<Props, State> {
    state: State = { failed: false, reference: null }

    static getDerivedStateFromError(error: unknown): State {
        // Convex server errors read "[Request ID: 1a2b3c…] Server Error"; that
        // id is what the team can look up in the logs.
        const message = error instanceof Error ? error.message : ""
        const reference = /\[Request ID: ([^\]]+)\]/.exec(message)?.[1] ?? null
        return { failed: true, reference }
    }

    render() {
        if (!this.state.failed) return this.props.children
        return <ErrorState what={this.props.what} reference={this.state.reference} />
    }
}
