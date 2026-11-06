/** Exact public assets that may be embedded by the development proposal board. */
export const EMAIL_PREVIEW_BRAND_ASSETS = {
    'https://tendso.com/v2/brand/mark-ink-256.png': { path: 'v2/brand/mark-ink-256.png', mime: 'image/png' },
    'https://tendso.com/v2/brand/buddy-email.png': { path: 'v2/brand/buddy-email.png', mime: 'image/png' },
    'https://tendso.com/fonts/onest-latin-400-normal.woff2': { path: 'fonts/onest-latin-400-normal.woff2', mime: 'font/woff2' },
    'https://tendso.com/fonts/onest-latin-500-normal.woff2': { path: 'fonts/onest-latin-500-normal.woff2', mime: 'font/woff2' },
    'https://tendso.com/fonts/onest-latin-600-normal.woff2': { path: 'fonts/onest-latin-600-normal.woff2', mime: 'font/woff2' },
    'https://tendso.com/fonts/onest-latin-700-normal.woff2': { path: 'fonts/onest-latin-700-normal.woff2', mime: 'font/woff2' },
} as const;

/** Keep previews inert. Optional brand files are embedded without enabling remote requests. */
export function previewDocument(html: string, assets?: Readonly<Record<string, string>>): string {
    let inert = html.replace(/\s(?:href|target|action|formaction)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    if (assets) {
        const approved = Object.create(null) as Record<string, string>;
        for (const [url, asset] of Object.entries(EMAIL_PREVIEW_BRAND_ASSETS)) {
            const value = assets[url];
            const prefix = `data:${asset.mime};base64,`;
            if (typeof value === 'string' && value.startsWith(prefix) && /^[A-Za-z0-9+/]+={0,2}$/.test(value.slice(prefix.length))) approved[url] = value;
        }
        inert = inert.replace(/\bsrc\s*=\s*(["'])([^"']+)\1/gi, (match, quote: string, url: string) => approved[url] ? `src=${quote}${approved[url]}${quote}` : match);
        inert = inert.replace(/url\(\s*(?:(["'])(.*?)\1|([^\s'"()]+))\s*\)/gi, (match, quote: string | undefined, quoted: string | undefined, bare: string | undefined) => {
            const data = approved[quoted ?? bare ?? ''];
            return data ? `url("${data}")` : match;
        });
    }
    const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'"><meta name="referrer" content="no-referrer">`;
    return inert.replace(/<head(?:\s[^>]*)?>/i, (head) => head + policy);
}
