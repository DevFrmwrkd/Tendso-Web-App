import { directions, messages, renderEmailProposal, type ProposalDirectionId, type ProposalMessageId } from '@/lib/email/proposals';
import { previewDocument } from '@/app/design-review/emails/previewDocument';

const directionIds: ProposalDirectionId[] = ['studio', 'bold', 'letter'];
const messageIds: ProposalMessageId[] = ['preview', 'booking', 'payout', 'payment'];
const officialBrandImages = new Set([
    'https://tendso.com/v2/brand/mark-ink-256.png',
    'https://tendso.com/v2/brand/buddy-email.png',
    '/v2/brand/mark-ink-256.png',
    '/v2/brand/buddy-email.png',
]);

/** Compare layout structure, not particular CSS values or decorative text. */
function structure(html: string): string {
    return (html.match(/<\/?(?:table|tr|td|section|div|h[1-6]|p|a|ul|li|blockquote)\b[^>]*>/gi) ?? [])
        .map(tag => tag.match(/^<\/?[a-z0-9]+/i)?.[0]).join('');
}

it('offers three named directions and four representative messages', () => {
    expect(directions).toHaveLength(3);
    expect(messages).toHaveLength(4);
    expect(new Set(directions.map(direction => direction.id))).toEqual(new Set(directionIds));
    expect(new Set(messages.map(message => message.id))).toEqual(new Set(messageIds));
});

describe.each(messageIds)('%s proposals', (message) => {
    it('renders three complete, structurally different email layouts', () => {
        const html = directionIds.map(direction => renderEmailProposal(direction, message));
        expect(new Set(html).size).toBe(3);
        expect(new Set(html.map(structure)).size).toBe(3);
        for (const document of html) {
            expect(document).toMatch(/<!doctype html>/i);
            expect(document).toMatch(/<meta[^>]+name=["']viewport["']/i);
            expect(document).toMatch(/<h1\b/i);
            expect(document).not.toMatch(/<script\b|<form\b|\son(?:click|load|error)\s*=/i);
        }
    });

    it('uses only fictional destinations and keeps every preview action inert', () => {
        for (const direction of directionIds) {
            const html = renderEmailProposal(direction, message);
            const destinations = [...html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)].map(match => match[1]);
            expect(destinations.length).toBeGreaterThan(0);
            for (const destination of destinations) expect(destination).toMatch(/^(?:https:\/\/example\.com(?:\/|$)|mailto:[^@\s]+@example\.com$)/);
            const images = [...html.matchAll(/\bsrc\s*=\s*["']([^"']+)["']/gi)].map(match => match[1]);
            expect(images).toContain('https://tendso.com/v2/brand/mark-ink-256.png');
            for (const source of images) expect(officialBrandImages.has(source)).toBe(true);
            const addresses = html.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) ?? [];
            expect(addresses.every(address => address.endsWith('@example.com'))).toBe(true);
            const inert = previewDocument(html);
            expect(inert).not.toMatch(/\s(?:href|target|action|formaction)\s*=/i);
            expect(inert).toContain("default-src 'none'");
            expect(inert).toContain("form-action 'none'");
        }
    });
});

it('keeps the same illustrative facts across all directions', () => {
    for (const direction of directionIds) {
        expect(renderEmailProposal(direction, 'preview')).toContain('Luna Corner Store');
        expect(renderEmailProposal(direction, 'payment')).toContain('3,499');
        expect(renderEmailProposal(direction, 'payout')).toContain('3,750');
        expect(renderEmailProposal(direction, 'payout')).toContain('alex@example.com');
        expect(renderEmailProposal(direction, 'booking')).toContain('10:30 AM');
    }
});

describe('opt-in official brand assets in inert previews', () => {
    const logo = 'https://tendso.com/v2/brand/mark-ink-256.png';
    const buddy = 'https://tendso.com/v2/brand/buddy-email.png';
    const font = 'https://tendso.com/fonts/onest-latin-400-normal.woff2';
    const imageData = 'data:image/png;base64,AA==';
    const fontData = 'data:font/woff2;base64,AA==';
    const document = '<!doctype html><html><head><style>@font-face{font-family:Onest;src:url("' + font + '")}</style></head><body><img src="' + logo + '"><img src="' + buddy + '"><a href="https://example.com/pay" target="_blank">Pay</a></body></html>';

    it('keeps default remote image/font access denied without the optional map', () => {
        const result = previewDocument(document);
        expect(result).toContain('src="' + logo + '"');
        expect(result).toContain('url("' + font + '")');
        expect(result).toContain('img-src data:; font-src data:;');
        expect(result).not.toMatch(/\s(?:href|target|action|formaction)\s*=/i);
    });

    it('embeds only exact official PNG and WOFF2 assets while leaving all actions disabled', () => {
        const result = previewDocument(document, { [logo]: imageData, [buddy]: imageData, [font]: fontData });
        expect(result.match(/src="data:image\/png;base64,AA=="/g)).toHaveLength(2);
        expect(result).toContain('url("' + fontData + '")');
        expect(result).not.toContain('src="https://');
        expect(result).not.toMatch(/\s(?:href|target|action|formaction)\s*=/i);
        expect(result).toContain("default-src 'none'");
        expect(result).toContain('img-src data:; font-src data:;');
        expect(result).not.toMatch(/img-src[^;]*https:|font-src[^;]*https:/);
    });

    it.each([
        ['https://attacker.example/logo.png', imageData],
        [logo + '?tracking=1', imageData],
        ['https://tendso.com/v2/brand/private.png', imageData],
        ['https://tendso.com/fonts/onest-latin-300-normal.woff2', fontData],
    ])('ignores a supplied map key outside the exact static allowlist: %s', (url, data) => {
        const html = '<html><head></head><body><img src="' + url + '"></body></html>';
        expect(previewDocument(html, { [url]: data })).not.toContain(data);
    });

    it.each([
        [logo, 'data:image/svg+xml;base64,PHN2Zz4='],
        [logo, fontData],
        [font, imageData],
        [logo, 'https://attacker.example/logo.png'],
        [logo, 'data:image/png;base64,AA==" onerror="alert(1)'],
    ])('rejects an unsafe or mismatched data URL for %s', (url, data) => {
        const html = '<html><head><style>@font-face{src:url("' + url + '")}</style></head><body><img src="' + url + '"></body></html>';
        const result = previewDocument(html, { [url]: data });
        expect(result).not.toContain(data);
        expect(result).not.toContain('onerror=');
    });
});
