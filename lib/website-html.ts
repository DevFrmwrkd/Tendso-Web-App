/**
 * resolveWebsiteHtml — get a generatedWebsites row's HTML, from either the
 * legacy inline `htmlContent` field OR Convex file storage (`htmlUrl`, resolved
 * by the getBySubmission* queries from `htmlStorageId`).
 *
 * The built HTML can exceed Convex's 1 MiB document limit, so new saves store it
 * as a file and keep only a reference on the row. Existing rows still have inline
 * `htmlContent` — this helper prefers that, so nothing breaks during the
 * transition; rows convert to storage on their next save. Server-side only
 * (does a fetch); Convex functions read the blob directly via ctx.storage.
 *
 * The returned HTML carries the current CARTO map key (lib/carto.ts), so a
 * republish fixes a site that was built before the key existed.
 */
import { withCartoKey } from './carto';

export async function resolveWebsiteHtml(
    website: { htmlContent?: string | null; htmlUrl?: string | null } | null | undefined,
): Promise<string> {
    if (!website) return '';
    if (website.htmlContent) return withCartoKey(website.htmlContent);
    if (website.htmlUrl) {
        try {
            const res = await fetch(website.htmlUrl);
            return res.ok ? withCartoKey(await res.text()) : '';
        } catch {
            return '';
        }
    }
    return '';
}
