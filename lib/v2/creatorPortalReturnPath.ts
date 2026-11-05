import { CREATOR_PORTAL_HREF } from './creatorPortalNavigation';

const DEFAULT_PORTAL = '/affiliates/dashboard';
const REVIEW_PORTAL = '/v2/creators/portal';
const SECTIONS = new Set(['', '/my-page', '/payouts', '/account']);
const SECTION_ANCHORS: Record<string, string> = {
    '/sales': '#pt-shops', '/shops': '#pt-shops', '/referrals': '#pt-agents', '/agents': '#pt-agents', '/links': '#pt-links',
};
const PORTAL_ANCHORS = new Set(['#top', '#pt-links', '#pt-agents', '#pt-shops', '#pt-pay']);

/** A creator sign-in can return only to this account's known portal routes. */
export function creatorPortalReturnPath(value: unknown): string {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return CREATOR_PORTAL_HREF;
    try {
        const target = new URL(value, 'https://portal.invalid');
        if (target.origin !== 'https://portal.invalid') return CREATOR_PORTAL_HREF;
        const path = target.pathname.replace(/\/$/, '');
        const base = path === DEFAULT_PORTAL || path.startsWith(`${DEFAULT_PORTAL}/`) ? DEFAULT_PORTAL
            : path === REVIEW_PORTAL || path.startsWith(`${REVIEW_PORTAL}/`) ? REVIEW_PORTAL : null;
        if (!base) return CREATOR_PORTAL_HREF;
        let section = path.slice(base.length);
        const sectionAnchor = SECTION_ANCHORS[section];
        if (sectionAnchor) section = '';
        if (section === '/wallet') section = '/payouts';
        if (section === '/home') section = '';
        if (!SECTIONS.has(section)) return CREATOR_PORTAL_HREF;
        return `${DEFAULT_PORTAL}${section}${target.search}${sectionAnchor ?? (PORTAL_ANCHORS.has(target.hash) ? target.hash : '')}`;
    } catch { return CREATOR_PORTAL_HREF; }
}
