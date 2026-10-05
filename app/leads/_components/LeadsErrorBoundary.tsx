"use client";

import { Component, type ReactNode } from "react";

type Props = {
    children: ReactNode;
    /** What to show instead. Gets a reference to quote when reporting it (Convex's request id), if there is one. */
    fallback: (reference: string | null) => ReactNode;
    /** When this changes (another lead is opened), the boundary tries its children again. */
    resetKey?: string | null;
};

type State = { failed: boolean; reference: string | null; resetKey: string | null };

/**
 * A failing Convex query throws while rendering. Without a boundary that lands
 * on app/error.tsx and takes the whole page with it, sidebar included; this
 * keeps it to the panel that failed (the list, or one lead's drawer) and shows
 * the kit's error state there.
 */
export class LeadsErrorBoundary extends Component<Props, State> {
    state: State = { failed: false, reference: null, resetKey: this.props.resetKey ?? null };

    static getDerivedStateFromError(error: unknown): Partial<State> {
        // Convex server errors read "[Request ID: 1a2b3c…] Server Error"; that id
        // is what the team can look up in the logs.
        const message = error instanceof Error ? error.message : "";
        const requestId = /\[Request ID: ([^\]]+)\]/.exec(message)?.[1] ?? null;
        return { failed: true, reference: requestId };
    }

    static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
        const key = props.resetKey ?? null;
        if (key !== state.resetKey) return { failed: false, reference: null, resetKey: key };
        return null;
    }

    render() {
        return this.state.failed ? this.props.fallback(this.state.reference) : this.props.children;
    }
}
