"use client";

import { useConvexAuth, usePaginatedQuery } from "convex/react";
import { Component, type ReactNode } from "react";

import { Button, EmptyState, ErrorState, Loading, SkeletonRows, Status, submissionStatus } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import { formatPHP } from "@/lib/pricing";

const PAGE_SIZE = 5;
const DATE = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });

class SalesBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() {
        return this.state.failed ? <ErrorState what="Sales" onRetry={() => this.setState({ failed: false })} /> : this.props.children;
    }
}

export function Sales() {
    return (
        <section id="affiliate-sales" className="flex min-w-0 flex-col gap-4" aria-labelledby="affiliate-sales-title">
            <div className="flex flex-col gap-1">
                <h2 id="affiliate-sales-title" className="t-h2">Your sales</h2>
                <p className="t-meta">Each order keeps the price and commission agreed at the time of sale.</p>
            </div>
            <SalesBoundary><SalesFeed /></SalesBoundary>
        </section>
    );
}

function SalesFeed() {
    const { isAuthenticated } = useConvexAuth();
    const { results, status, loadMore } = usePaginatedQuery(api.affiliates.sales, isAuthenticated ? {} : "skip", { initialNumItems: PAGE_SIZE });
    if (status === "LoadingFirstPage") return <Loading label="Loading your sales"><SkeletonRows count={3} /></Loading>;
    if (results.length === 0) return <div className="t-card"><EmptyState title="No sales yet" body="Orders from your affiliate page will appear here." /></div>;

    return (
        <>
            <ul className="t-card divide-y divide-r1-line">
                {results.map((sale) => (
                    <li key={sale._id} className="flex flex-wrap gap-x-5 gap-y-3 p-4 sm:p-5">
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <p className="font-medium text-r1-ink break-words">{sale.businessName}</p>
                            <p className="t-meta"><time dateTime={new Date(sale.createdAt).toISOString()}>{DATE.format(sale.createdAt)}</time></p>
                            <Status {...submissionStatus(sale.status, "creator")} />
                        </div>
                        <dl className="flex min-w-0 flex-col gap-2 text-right">
                            <div><dt className="t-label">Sale price</dt><dd className="t-body t-num whitespace-nowrap">{formatPHP(sale.price)}</dd></div>
                            <div><dt className="t-label">Commission</dt><dd className="font-medium text-r1-ink t-num whitespace-nowrap">{formatPHP(sale.commission)}</dd></div>
                        </dl>
                    </li>
                ))}
            </ul>
            {(status === "CanLoadMore" || status === "LoadingMore") && (
                <Button className="self-start" onClick={() => loadMore(PAGE_SIZE)} disabled={status === "LoadingMore"} aria-busy={status === "LoadingMore"}>{status === "LoadingMore" ? "Loading more…" : "Show more sales"}</Button>
            )}
        </>
    );
}
