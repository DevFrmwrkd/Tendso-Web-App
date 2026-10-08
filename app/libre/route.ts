import { NextRequest, NextResponse } from "next/server";

/** Spanish/Tagalog short address retained for the printed poster. */
export function GET(request: NextRequest) {
    const destination = new URL("/100-pages-giveaway", request.url);
    destination.search = request.nextUrl.search;
    const response = NextResponse.redirect(destination, 307);
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
}
