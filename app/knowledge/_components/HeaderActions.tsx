"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Avatar, ButtonLink, Icon, Skeleton, useDelayed } from "@/components/r1";

import { useViewer } from "./viewer";

/*
 * The header for a signed-in reader (the board's creator variant): "Back to
 * my home" and who they are, in place of Sign in / Get a website. The shell
 * only renders this once Clerk says the reader is signed in; until their
 * profile loads it holds the space with a skeleton.
 */

function BackHome({ href }: { href: string }) {
    return (
        <ButtonLink variant="ghost" href={href} className="max-sm:w-10 max-sm:px-0">
            <Icon icon={ArrowLeft} />
            <span className="max-sm:sr-only">Back to my home</span>
        </ButtonLink>
    );
}

export function SignedInActions() {
    const viewer = useViewer();
    const show = useDelayed();

    if (viewer.status !== "signedIn") {
        if (!show) return <span className="h-10" aria-hidden="true" />;
        return (
            <span className="flex items-center gap-3" aria-hidden="true">
                <Skeleton width={128} height={14} className="max-sm:hidden" />
                <Skeleton width={32} height={32} round />
            </span>
        );
    }

    const person = (
        <>
            <Avatar name={viewer.name} />
            <span className="t-me-name max-w-[160px] max-sm:sr-only">{viewer.name}</span>
        </>
    );
    return (
        <>
            <BackHome href={viewer.home} />
            {viewer.accountHref ? (
                <Link href={viewer.accountHref} className="t-me max-sm:p-1" aria-label={`${viewer.name}, your account`}>
                    {person}
                </Link>
            ) : (
                <span className="t-me max-sm:p-1">{person}</span>
            )}
        </>
    );
}

/** If looking the reader up fails, still give them a way home: /dashboard routes every role onward. */
export function FallbackActions() {
    return <BackHome href="/dashboard" />;
}
