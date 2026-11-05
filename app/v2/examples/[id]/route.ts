import { readFile } from "node:fs/promises";
import path from "node:path";

import { SHOWCASE_SITES } from "@/components/v2/pages-a/data";

/**
 * /v2/examples/<id> serves one showcase site as its own full-screen page: the
 * static HTML shipped in public/v2/showcase/<id>/index.html (its photos sit in
 * the same folder, referenced by absolute path). Generated at build time for the
 * 22 known ids; anything else is a 404.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
    return SHOWCASE_SITES.map((s) => ({ id: s.id }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!SHOWCASE_SITES.some((s) => s.id === id)) return new Response("Not found", { status: 404 });
    const file = await readFile(path.join(process.cwd(), "public", "v2", "showcase", id, "index.html"), "utf8");
    // The static pages carry no icon link; without one the browser asks for /favicon.ico (a 404).
    const html = /rel=["']?icon/i.test(file) ? file : file.replace(/<\/head>/i, '<link rel="icon" href="/tendso-icon.png"></head>');
    return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400", "x-robots-tag": "noindex" },
    });
}
