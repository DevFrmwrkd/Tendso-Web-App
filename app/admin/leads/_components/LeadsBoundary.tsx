"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { ErrorState, PageHeader } from "@/components/r1";

import { PAGE_SUB, PAGE_TITLE, requestRef } from "./leadUtils";

type Props = {
    /** What failed, as a name: "Leads", "Customer leads", "Prospects". */
    what: string;
    /** Keep the page title above the error when the whole page body failed. */
    withHeader?: boolean;
    children: ReactNode;
};

type State = { error: Error | null };

/**
 * The last line of defence. A render error inside the leads page lands here
 * instead of on app/error.tsx, so the admin frame and its sidebar stay up and
 * the kit's error state names the part that failed; a failing tab leaves the
 * other tab working. Reload renders the part again rather than the whole app.
 *
 * Failing QUERIES never get this far: the page reads them through useQueries,
 * which returns the error instead of throwing it, and shows the same error
 * state itself.
 */
export class LeadsBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: unknown): State {
        return { error: error instanceof Error ? error : new Error(String(error)) };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error(`[admin/leads] ${this.props.what} failed to render`, error, info.componentStack);
    }

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;
        return (
            <>
                {this.props.withHeader && <PageHeader title={PAGE_TITLE} sub={PAGE_SUB} />}
                <ErrorState what={this.props.what} reference={requestRef(error)} onRetry={() => this.setState({ error: null })} />
            </>
        );
    }
}
