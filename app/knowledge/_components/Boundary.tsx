"use client";

import { Component, type ReactNode } from "react";

/**
 * Keeps a failing piece of chrome (the header's account lookup, the search
 * palette) from taking the Help Center down with it: a Convex query that
 * errors throws during render, and without this it would replace the whole
 * page with the error screen. Page content has app/knowledge/error.tsx.
 */
export class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError(): { failed: boolean } {
        return { failed: true };
    }

    componentDidCatch(error: unknown): void {
        console.error("[help-center]", error);
    }

    render(): ReactNode {
        return this.state.failed ? this.props.fallback : this.props.children;
    }
}
