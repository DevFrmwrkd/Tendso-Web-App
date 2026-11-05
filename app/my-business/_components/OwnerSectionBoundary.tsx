"use client";

import { Component, type ReactNode } from 'react';
import { Button } from '@/components/r1';

/** Keep owner navigation available when a feature subscription fails. */
export class OwnerSectionBoundary extends Component<{ children: ReactNode; label: string }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() {
        return this.state.failed ? <section className="t-card t-card-pad flex flex-col items-start gap-4" role="alert">
            <h2 className="t-h2">{this.props.label} could not load</h2>
            <p className="t-body">Check your connection and try again. You can still use the other owner tools above.</p>
            <Button onClick={() => this.setState({ failed: false })}>Try again</Button>
        </section> : this.props.children;
    }
}
