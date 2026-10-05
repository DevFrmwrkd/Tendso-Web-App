"use client";

import { Component, type ReactNode } from "react";

import { ErrorState } from "@/components/r1";

/**
 * Keeps a failure inside the drawer. A Convex query that fails throws while
 * rendering; without this the drawer's own queries (the site, the pay link,
 * the photos, the recording) would take the whole page down to the route's
 * error screen. With it, the drawer says what failed and the list behind it
 * keeps working (ComponentKit, error state: "a page or panel that failed").
 */
export class PanelBoundary extends Component<{ what: string; children: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    render() {
        return this.state.failed ? <ErrorState what={this.props.what} /> : this.props.children;
    }
}
