"use client";

import { Component, type ReactNode } from "react";

/**
 * Renders nothing when its children fail. It wraps the Home drawn behind the
 * Notifications drawer: that Home is scenery, and one of its queries failing
 * must not take the notifications down with it (they are the page here).
 */
export class QuietBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    render() {
        return this.state.failed ? null : this.props.children;
    }
}
