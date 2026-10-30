"use client";

import { useEffect } from "react";

import { rememberAffiliate } from "@/lib/campaign";
import { useCreatorCard, useRecordClick } from "@/lib/v2/creatorData";

import { SoloBar } from "./Chrome";
import { CreatorsBoundary } from "./CreatorsBoundary";
import { StoreRow } from "./Stores";
import { ShopLinkFooter, ShopLinkView } from "./ShopLinkContent";

/** /v2/a/<handle>: what a shop owner sees from a creator's link. Records the click when it loads. */
export function ShopLinkPage({ handle }: { handle: string }) {
    return (
        <CreatorsBoundary>
            <ShopLinkInner handle={handle} />
        </CreatorsBoundary>
    );
}

function ShopLinkInner({ handle }: { handle: string }) {
    const state = useCreatorCard(handle);
    useRecordClick(handle, "shop");
    // The owner intake (/start?affiliate=<handle>) reads this, exactly as the original /a/<handle> page does.
    useEffect(() => rememberAffiliate(handle), [handle]);

    if (state.status === "found") return <ShopLinkView card={state.card} />;

    return (
        <>
            <SoloBar brandHref="/v2" right={<a className="btn btn--accent btn--sm" href="#get">Get the app</a>} />
            <main className="wrap">
                {state.status === "loading" && <Loading />}
                {state.status === "missing" && <Missing />}
                <ShopLinkFooter />
            </main>
        </>
    );
}

function Loading() {
    return (
        <section className="as-state" aria-busy="true" aria-label="Loading">
            <span className="as-skel" style={{ width: 220, height: 24 }} />
            <span className="as-skel" style={{ width: "min(560px, 100%)", height: 96 }} />
            <span className="as-skel" style={{ width: 320, height: 64 }} />
        </section>
    );
}

function Missing() {
    return (
        <section className="as-state">
            <h1>This link is not active.</h1>
            <p>It may be old, or the creator is not on Tendso yet. You can still get the app and build your shop&apos;s website.</p>
            <StoreRow />
        </section>
    );
}

