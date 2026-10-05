"use client"

import { Component, type ReactNode } from "react"

import { ErrorState } from "@/components/r1"

type Props = {
    /** What failed, as a name: "Payouts", "Money summary". */
    what: string
    children: ReactNode
    /** Shown above the error state (the page header, so the page keeps its title). */
    before?: ReactNode
    /** Shown INSTEAD of the error state: a quieter version of the same panel. */
    fallback?: ReactNode
}

type State = { failed: boolean; reference: string | null }

/**
 * A failing Convex query throws while rendering. Without a boundary that lands
 * on app/error.tsx and takes the whole admin frame with it, sidebar included.
 * This keeps a failure to the panel that failed: the page body shows the
 * kit's error state, a failing money summary stays inside its fold, and a
 * timeline whose audit log will not load falls back to the row's own dates.
 */
export class Boundary extends Component<Props, State> {
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
        if (this.props.fallback !== undefined) return this.props.fallback
        return (
            <>
                {this.props.before}
                <ErrorState what={this.props.what} reference={this.state.reference} />
            </>
        )
    }
}
