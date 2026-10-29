"use client";

import type { CreatorCard } from "@/lib/v2/creatorData";

import { CopyButton } from "./CopyButton";
import { StoreRow } from "./Stores";

/** Store buttons and the creator's referral code, with instructions for the destination flow. */
export function GetTheApp({ card, label = "Creator code", instructions = "Enter this code before you pay to use this website price." }: { card: CreatorCard; label?: string; instructions?: string }) {
    return (
        <div className="as-cta">
            <StoreRow />
            {card.code ? (
                <>
                    <div className="cp-yourcode">
                        {label} <b>{card.code}</b>
                        <CopyButton text={card.code}>Copy</CopyButton>
                    </div>
                    <p>{instructions}</p>
                </>
            ) : null}
        </div>
    );
}

/** A big initial for a creator with no photo yet. */
export function PhotoFallback({ name }: { name: string }) {
    return (
        <span className="as-photo-fallback" aria-hidden="true">
            {name.trim().charAt(0).toUpperCase() || "T"}
        </span>
    );
}

/** The creator's photo (an uploaded https URL, so a plain <img>), or an initial. */
export function CreatorPhoto({ card, position = "50% 24%" }: { card: CreatorCard; position?: string }) {
    if (!card.photo) return <PhotoFallback name={card.name} />;
    // Creator photos are uploaded outside Next's image host list, so next/image is not used here.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={card.photo} alt={card.name} style={{ objectPosition: position }} />;
}
