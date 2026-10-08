import { fetchQuery } from "convex/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { posterTarget, POSTER_TARGET_SETTING } from "@/lib/poster";

export const dynamic = "force-dynamic";

/** Temporary and uncached: the same printed QR can point to a new offer later. */
export async function GET(request: NextRequest) {
    let configured: unknown;
    try {
        configured = await fetchQuery(api.settings.get, { key: POSTER_TARGET_SETTING });
    } catch (error) {
        console.error("[poster] Could not read QR destination; using the default.", error);
    }
    const response = NextResponse.redirect(new URL(posterTarget(configured), request.url), 307);
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
}
