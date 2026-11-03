export type AdminPreviewRole = 'affiliate' | 'creator' | 'owner';

const READONLY_PAGES = new Set(['/v2/help', '/v2/privacy', '/v2/creators#rules']);

/** Samples can navigate locally, never into a signed-in account's live workspace. */
export function isAdminPreviewHref(href: string | null | undefined, role: AdminPreviewRole): boolean {
    if (!href || /[\s\\\u0000-\u001f\u007f]/.test(href)) return false;
    if (href.startsWith('#')) return true;
    if (READONLY_PAGES.has(href)) return true;
    if (!href.startsWith('/') || href.startsWith('//')) return false;
    try {
        const target = new URL(href, 'https://preview.tendso.invalid');
        const base = `/admin/preview/${role}`;
        return target.origin === 'https://preview.tendso.invalid'
            && (target.pathname === base || target.pathname === `${base}/`)
            && !href.split(/[?#]/)[0].split('/').some(part => /^\.{1,2}$/.test(decodeURIComponent(part)));
    } catch {
        return false;
    }
}
