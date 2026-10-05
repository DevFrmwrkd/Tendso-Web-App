"use client";

/**
 * Admin "Train AI" (board TrainAI): "What can't the help AI answer yet?"
 * Answer the questions the AI couldn't ground, or paste many at once (your
 * answers verbatim, or questions for the AI to answer from the knowledge
 * base). Each answer is embedded into the knowledge base, so the Help Center
 * chatbot AND the Discord /ask bot can answer it. See
 * docs/changes/ADMIN-KB-TRAINING-PLAN.md.
 *
 * Every function on this page is admin-gated on the server (requireAdmin);
 * useAdminAuth only decides what to draw.
 */

import type { ReactNode } from "react";

import { EmptyState, PageHeader } from "@/components/r1";
import { useAdminAuth } from "@/hooks/useAdmin";

import AdminLayout from "../components/AdminLayout";
import PanelBoundary from "./_components/PanelBoundary";
import TrainAiMenu from "./_components/TrainAiMenu";
import TrainAiScreen, { TrainAiSkeleton } from "./_components/TrainAiScreen";

const TITLE = "Train AI";
const SUB = "What can’t the help AI answer yet?";

export default function AdminTrainAiPage() {
    const { isAdmin, loading } = useAdminAuth();

    if (loading) {
        return (
            <AdminLayout>
                <Column>
                    <PageHeader title={TITLE} sub={SUB} />
                    <TrainAiSkeleton />
                </Column>
            </AdminLayout>
        );
    }

    if (!isAdmin) {
        return (
            <AdminLayout>
                <Column>
                    <PageHeader title={TITLE} sub={SUB} />
                    <div className="t-card">
                        <EmptyState title="Admins only" body="Forbidden: admin access required. Only an admin can train the help AI." />
                    </div>
                </Column>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <Column>
                <PageHeader
                    title={TITLE}
                    sub={SUB}
                    actions={
                        // A failing menu just goes away; the page below still works.
                        <PanelBoundary what="Train AI menu" fallback={null}>
                            <TrainAiMenu />
                        </PanelBoundary>
                    }
                />
                {/* A failing query keeps the frame and the header; only the body says so. */}
                <PanelBoundary what="Train AI">
                    <TrainAiScreen />
                </PanelBoundary>
            </Column>
        </AdminLayout>
    );
}

/** The board's single 880px column, sections 40px apart on a desk. */
function Column({ children }: { children: ReactNode }) {
    return <div className="flex w-full max-w-[880px] flex-col gap-8 lg:gap-10">{children}</div>;
}
