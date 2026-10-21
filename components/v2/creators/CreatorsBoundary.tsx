"use client";

import { Component, type ReactNode } from "react";

/**
 * Convex queries throw when a function is missing or the server is down. Show one calm message
 * instead of a blank page, with a way to try again.
 */
export class CreatorsBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    render() {
        if (!this.state.failed) return this.props.children;
        return (
            <div className="wrap" style={{ paddingTop: 96, paddingBottom: 96 }}>
                <div className="pt-state" role="alert">
                    <h1>We could not load this.</h1>
                    <p>Check your connection and try again.</p>
                    <button type="button" className="btn btn--accent" onClick={() => this.setState({ failed: false })}>
                        Try again
                    </button>
                </div>
            </div>
        );
    }
}
