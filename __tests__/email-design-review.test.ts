import { createElement, type ReactNode } from 'react';
import { EmailDesignGallery } from '@/app/design-review/emails/EmailDesignGallery';
import { getEmailPreviewSamples } from '@/lib/email/previewSamples';
import { previewDocument } from '@/app/design-review/emails/previewDocument';
import { ownerPreviewReadyEmail } from '@/lib/email/ownerV2Templates';
import { getPaymentLinkEmailHtml } from '@/lib/email/templates';
import { EMAIL_PREVIEW_BRAND_ASSETS } from '@/app/design-review/emails/previewDocument';

jest.mock('react', () => jest.requireActual('../apps/mobile/node_modules/react'));
jest.mock('react/jsx-runtime', () => jest.requireActual('../apps/mobile/node_modules/react/jsx-runtime'));
jest.mock('react/jsx-dev-runtime', () => jest.requireActual('../apps/mobile/node_modules/react/jsx-dev-runtime'));
jest.mock('next/link', () => function MockLink({ children, ...props }: { children?: ReactNode }) {
    return jest.requireActual('../apps/mobile/node_modules/react').createElement('a', props, children);
});

it('covers all25 real email families in the four review categories', () => {
    const samples = getEmailPreviewSamples();
    expect(samples).toHaveLength(25);
    expect(new Set(samples.map(sample => sample.id)).size).toBe(25);
    expect(Object.fromEntries([...new Set(samples.map(sample => sample.category))].map(category =>
        [category, samples.filter(sample => sample.category === category).length]))).toEqual({
        'Owner journey': 4, 'Payments & websites': 12, 'Calls & bookings': 5, 'Off the Record': 4,
    });
    for (const sample of samples) {
        expect(sample.variants.length).toBeGreaterThan(0);
        for (const variant of sample.variants) expect(variant.html).toMatch(/<!doctype html>/i);
    }
});

it('renders actual template output rather than maintaining a separate mockup', () => {
    const samples = getEmailPreviewSamples();
    expect(samples.find(sample => sample.id === 'owner-preview')?.variants[0].html).toBe(ownerPreviewReadyEmail({
        businessName: 'Luna Corner Store', ownerName: 'Alex Rivera', appUrl: 'https://example.com/my-business/sample-business', priceText: '₱3,499',
    }).html);
    expect(samples.find(sample => sample.id === 'payment-link')?.variants[0].html).toBe(getPaymentLinkEmailHtml({
        businessName: 'Luna Corner Store', businessOwnerName: 'Alex Rivera', amount: 3499, websiteListPrice: 4999,
        websiteUrl: 'https://luna.example.com', referenceCode: 'SAMPLE-ONLY', platformEmail: 'support@example.com',
        paymentDetails: { accountName: 'Example Business — sample only', accountNumber: '0000000000', bankName: 'Example Bank — sample only', wiseEmail: 'payments@example.com' },
    }));
});

it('uses fictional addresses and provides important review states', () => {
    const samples = getEmailPreviewSamples();
    const html = samples.flatMap(sample => sample.variants.map(variant => variant.html)).join('\n');
    const addresses = html.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) ?? [];
    expect(addresses.length).toBeGreaterThan(0);
    expect(addresses.every(address => address.endsWith('@example.com'))).toBe(true);
    expect(html).not.toMatch(/Negosyo Digital|frmwrkd|petalversion|poru\.fetaruvero/i);
    expect(samples.find(sample => sample.id === 'cashout-status')?.variants.map(variant => variant.id)).toEqual(['default', 'completed', 'failed']);
    expect(samples.find(sample => sample.id === 'owner-live')?.variants.find(variant => variant.id === 'balance')?.html).toContain('₱2,999');
    expect(samples.find(sample => sample.id === 'otr-rejected')?.variants[0].html).toContain('poster photo is too dark');
});

it('keeps preview links and forms inert and forbids scripts or remote requests', () => {
    const document = previewDocument('<!doctype html><html><head></head><body><a href="https://example.com" target="_blank">Open</a><form action="/send"><button formaction=/pay>Pay</button></form></body></html>');
    expect(document).not.toMatch(/\s(?:href|target|action|formaction)\s*=/i);
    expect(document).toContain("default-src 'none'");
    expect(document).toContain("form-action 'none'");
    expect(document).toContain('no-referrer');
    expect(document).toContain('>Open</a>');
});

it('uses the approved official brand shell in all25 actual email families', () => {
    for (const sample of getEmailPreviewSamples()) {
        for (const variant of sample.variants) {
            expect(variant.html).toContain('https://tendso.com/v2/brand/mark-ink-256.png');
            expect(variant.html).toContain('Onest');
            expect(variant.html).toMatch(/tendso/i);
            expect(variant.html).toContain('https://tendso.com/fonts/onest-latin-400-normal.woff2');
        }
    }
});

it('embeds the fixed brand assets for actual templates without enabling remote resources or actions', () => {
    const assets = Object.fromEntries(Object.entries(EMAIL_PREVIEW_BRAND_ASSETS).map(([url, asset]) => [url, `data:${asset.mime};base64,AA==`]));
    for (const sample of getEmailPreviewSamples()) {
        const document = previewDocument(sample.variants[0].html, assets);
        expect(document).toContain('src="data:image/png;base64,AA=="');
        expect(document).toContain('data:font/woff2;base64,AA==');
        expect(document).not.toMatch(/\bsrc\s*=\s*["']https?:/i);
        expect(document).not.toMatch(/\s(?:href|target|action|formaction)\s*=/i);
        expect(document).toContain('img-src data:; font-src data:;');
    }
});

it('opens the actual owner preview by default and passes embedded assets into a sandboxed frame', async () => {
    interface Node { props: Record<string, unknown>; findAllByType(type: string): Node[] }
    interface Renderer { root: Node; unmount(): void }
    const { create, act } = jest.requireActual('../apps/mobile/node_modules/react-test-renderer') as {
        create(element: ReactNode): Renderer;
        act(callback: () => void): Promise<void>;
    };
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const previousAct = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
    const media = { matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() };
    const assets = Object.fromEntries(Object.entries(EMAIL_PREVIEW_BRAND_ASSETS).map(([url, asset]) => [url, `data:${asset.mime};base64,AA==`]));
    let renderer: Renderer | undefined;
    try {
        Object.defineProperty(globalThis, 'window', { configurable: true, value: { matchMedia: () => media } });
        Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
        await act(() => { renderer = create(createElement(EmailDesignGallery, { samples: getEmailPreviewSamples(), brandAssets: assets })); });
        const select = renderer!.root.findAllByType('select').find(node => node.props.id === 'email-template-select');
        expect(select?.props.value).toBe('owner-preview');
        const frame = renderer!.root.findAllByType('iframe')[0];
        expect(frame.props.title).toContain('Private preview ready');
        expect(frame.props.sandbox).toBe('');
        expect(frame.props.srcDoc).toContain('src="data:image/png;base64,AA=="');
        expect(frame.props.srcDoc).not.toMatch(/\s(?:href|target|action|formaction)\s*=/i);
    } finally {
        await act(() => { renderer?.unmount(); });
        if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
        else Reflect.deleteProperty(globalThis, 'window');
        if (previousAct) Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', previousAct);
        else Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
    }
});
