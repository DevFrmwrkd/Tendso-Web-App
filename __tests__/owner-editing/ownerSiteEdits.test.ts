/* eslint-disable @typescript-eslint/no-explicit-any */
import { ALL_BLOCKS } from '../../components/editor/editorConstants';
import {
    cleanOwnerContent,
    cleanOwnerCustomizations,
    cleanOwnerDraft,
    cleanSectionOrder,
    cleanText,
    isAllowedImageUrl,
    isBrandedTemplate,
    isKnownTemplate,
    isUnsafeUrl,
    OwnerDraftError,
    sameJson,
    templateBlocks,
} from '../../lib/ownerSiteEdits';

describe('cleanText', () => {
    it('strips tags and keeps the bare inline tags the generators emit', () => {
        expect(cleanText('Fresh <script>alert(1)</script>cuts')).toBe('Fresh alert(1)cuts');
        expect(cleanText('<img src=x onerror=alert(1)>Hi')).toBe('Hi');
        expect(cleanText('Cuts <em>and</em> shaves<br>daily')).toBe('Cuts <em>and</em> shaves<br>daily');
        expect(cleanText('<em onclick="x()">no</em>')).toBe('no');
        expect(cleanText('5 < 6 > 4')).toBe('5  6  4');
        expect(cleanText('Under 5 <3 people')).toBe('Under 5 3 people');
    });
    it('drops control characters and caps length', () => {
        expect(cleanText('a\u0000b\u0007c')).toBe('abc');
        expect(cleanText('x'.repeat(10_000)).length).toBe(6_000);
    });
});

describe('isUnsafeUrl', () => {
    it.each(['javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'java\nscript:alert(1)', 'data:text/html;base64,AAAA', 'vbscript:x', 'file:///etc/passwd'])('flags %s', (u) => {
        expect(isUnsafeUrl(u)).toBe(true);
    });
    it.each(['https://example.com/a.jpg', 'tel:+639170000000', 'mailto:a@b.co', '#about', '/menu'])('allows %s', (u) => {
        expect(isUnsafeUrl(u)).toBe(false);
    });
    it('only lets https addresses into an image slot', () => {
        expect(isAllowedImageUrl('https://cdn.example.com/a.jpg')).toBe(true);
        expect(isAllowedImageUrl('http://cdn.example.com/a.jpg')).toBe(false);
        expect(isAllowedImageUrl('javascript:alert(1)')).toBe(false);
        expect(isAllowedImageUrl('https://x.com/a b')).toBe(false);
    });
});

const BASE = {
    business_name: 'Forge Barbers',
    business_type: 'Barber',
    contact: { email: 'real@shop.ph', phone: '0917 000 0000', address: '12 Rizal St' },
    testimonials: { items: [{ quote: 'Real quote', who: 'A customer' }] },
    googleMapsUrl: 'https://maps.google.com/?q=forge',
    location: { lat: 14.5, lng: 121, address: '12 Rizal St' },
    hero: { headlineLines: ['We cook <em>slow</em>', 'the way', 'lola did'] },
    visibility: { faq_block: true },
};

describe('cleanOwnerContent', () => {
    it('keeps a string the owner did not touch byte for byte, even with markup the generator wrote', () => {
        const out = cleanOwnerContent(structuredClone(BASE), BASE);
        expect(out.hero).toEqual(BASE.hero);
    });

    it('cleans what the owner changed', () => {
        const next = structuredClone(BASE) as Record<string, any>;
        next.hero.headlineLines[1] = 'the <b onmouseover=x>way</b><script>x</script>';
        next.about = { lead: 'javascript:alert(1)' };
        const out = cleanOwnerContent(next, BASE) as Record<string, any>;
        expect(out.hero.headlineLines[1]).toBe('the wayx');
        expect(out.about.lead).toBe('');
    });

    it('puts the shop facts, quotes and map pin back to what the site had', () => {
        const next = structuredClone(BASE) as Record<string, any>;
        next.business_name = 'Hacked';
        next.contact = { email: 'evil@x.com', phone: '1', address: 'x' };
        next.testimonials = { items: [{ quote: 'Invented', who: 'Nobody' }] };
        next.location = { lat: 0, lng: 0, address: '99 New Road' };
        next.googleMapsUrl = 'https://evil.test';
        next.favicon = 'https://evil.test/f.png';
        next.enhancedImages = { x: 1 };
        const out = cleanOwnerContent(next, BASE) as Record<string, any>;
        expect(out.business_name).toBe('Forge Barbers');
        expect(out.contact).toEqual(BASE.contact);
        expect(out.testimonials).toEqual(BASE.testimonials);
        expect(out.googleMapsUrl).toBe(BASE.googleMapsUrl);
        expect(out.location).toEqual({ lat: 14.5, lng: 121, address: '99 New Road' });
        expect(out.favicon).toBeUndefined();
        expect(out.enhancedImages).toBeUndefined();
    });

    it('keeps visibility to known keys; the essential sections can never be hidden', () => {
        const next = { ...structuredClone(BASE), visibility: { faq_block: false, hero_section: false, services_section: false, location_block: false, footer_section: false, bogus: false, trust_block: 'no' } } as Record<string, any>;
        const out = cleanOwnerContent(next, BASE) as Record<string, any>;
        expect(out.visibility).toEqual({ faq_block: false });
    });

    it('drops prototype keys and non-JSON values, refuses absurd shapes', () => {
        const evil = JSON.parse('{"__proto__":{"polluted":true},"constructor":1,"ok":"fine","fn":null}');
        const out = cleanOwnerContent({ ...BASE, evil } as unknown, BASE) as Record<string, any>;
        expect(({} as any).polluted).toBeUndefined();
        expect(Object.keys(out.evil)).toEqual(['ok']);
        let deep: any = 'x';
        for (let i = 0; i < 30; i++) deep = { d: deep };
        expect(() => cleanOwnerContent({ ...BASE, deep }, BASE)).toThrow(OwnerDraftError);
        expect(() => cleanOwnerContent({ ...BASE, rows: Array.from({ length: 500 }, () => 'x') }, BASE)).toThrow(OwnerDraftError);
        expect(() => cleanOwnerContent('nope', BASE)).toThrow(OwnerDraftError);
    });

    it('refuses a draft too big to store', () => {
        const big = { ...BASE, rows: Array.from({ length: 150 }, () => 'y'.repeat(5_000)) };
        expect(() => cleanOwnerContent(big, BASE)).toThrow(/too much/);
    });
});

describe('cleanOwnerCustomizations', () => {
    const base = { heroStyle: 'barbershop:F', colorScheme: 'brown', colorSchemeId: 'brown', fontPairing: 'auto', fontPairingId: 'auto', roleColors: { 'primaryCta:bg': '#111111' }, navbarStyle: 'F' };

    it('accepts a real template and stamps it like the editor picker does', () => {
        const out = cleanOwnerCustomizations({ heroStyle: 'salonspa:N' }, base);
        expect(out.heroStyle).toBe('salonspa:N');
        expect(out.servicesStyle).toBe('salonspa:N');
        expect(out.navbarStyle).toBe('N');
        // a branded design keeps its own palette and fonts until the owner picks
        expect(out.colorScheme).toBe('auto');
        expect(out.fontPairing).toBe('auto');
        expect(out.roleColors).toEqual(base.roleColors);
    });

    it('ignores a template that does not exist and every key an owner cannot change', () => {
        const out = cleanOwnerCustomizations({ heroStyle: '../../etc', roleColors: { x: 'y' }, evil: 1, galleryStyle: 'x' }, base);
        expect(out).toEqual(base);
    });

    it('takes a scheme and font from the editor list only', () => {
        expect(cleanOwnerCustomizations({ colorScheme: 'green', fontPairing: 'classic' }, base)).toMatchObject({ colorScheme: 'green', colorSchemeId: 'green', fontPairing: 'classic', fontPairingId: 'classic' });
        expect(cleanOwnerCustomizations({ colorScheme: 'hot-pink', fontPairing: 'comic' }, base)).toMatchObject({ colorScheme: 'brown', fontPairing: 'auto' });
    });

    it('a colour chosen in the same save as a design switch wins over the new design default', () => {
        const out = cleanOwnerCustomizations({ heroStyle: 'generic:B', colorScheme: 'green' }, { heroStyle: 'generic:A', colorScheme: 'brown' });
        expect(out.heroStyle).toBe('generic:B');
        expect(out.colorScheme).toBe('green');
    });

    it('knows which templates are branded', () => {
        expect(isBrandedTemplate('generic:A')).toBe(false);
        expect(isBrandedTemplate('hospitality:BJ')).toBe(true);
        expect(isKnownTemplate('hospitality:BJ')).toBe(true);
        expect(isKnownTemplate('hospitality:ZZ')).toBe(false);
        expect(isKnownTemplate(undefined)).toBe(false);
    });
});

describe('cleanSectionOrder', () => {
    const code = 'barbershop:F';
    const blocks = templateBlocks(code);

    it('is empty for the template\'s own order, and for junk', () => {
        expect(cleanSectionOrder(blocks, code)).toEqual([]);
        expect(cleanSectionOrder('x', code)).toEqual([]);
        expect(cleanSectionOrder(['NOPE'], code)).toEqual([]);
        expect(cleanSectionOrder(['ABOUT'], 'no:such')).toEqual([]);
    });

    it('never moves the hero or the footer, drops unknown and repeated blocks, and fills in the rest', () => {
        const out = cleanSectionOrder(['FOOTER', 'FAQ', 'HERO', 'FAQ', 'ABOUT', 'MADE-UP'], code);
        expect(out.slice(0, 2)).toEqual(['FAQ', 'ABOUT']);
        expect(out).not.toContain('HERO');
        expect(out).not.toContain('FOOTER');
        expect(new Set(out).size).toBe(out.length);
        expect(out.length).toBe(blocks.filter((b) => b !== 'HERO' && b !== 'FOOTER').length);
    });
});

describe('cleanOwnerDraft', () => {
    it('drops a hidden flag for a block the new design does not render, keeps the others', () => {
        const barber = templateBlocks('barbershop:F');
        const generic = templateBlocks('generic:A');
        const onlyBarber = barber.find((b) => !generic.includes(b) && !['HERO', 'SERVICES', 'LOCATION', 'FOOTER'].includes(b))!;
        const both = barber.find((b) => generic.includes(b) && !['HERO', 'SERVICES', 'LOCATION', 'FOOTER'].includes(b))!;
        expect(onlyBarber).toBeDefined();
        expect(both).toBeDefined();
        const key = (block: string) => ALL_BLOCKS.find((x) => x.name === block)!.visKey;
        const base = { content: { ...BASE, visibility: {} }, customizations: { heroStyle: 'barbershop:F' } };
        const out = cleanOwnerDraft({
            content: { ...BASE, visibility: { [key(onlyBarber)]: false, [key(both)]: false } },
            customizations: { heroStyle: 'generic:A' },
        }, base);
        expect(out.customizations.heroStyle).toBe('generic:A');
        expect(out.content.visibility).toEqual({ [key(both)]: false });
    });

    it('sameJson ignores key order', () => {
        expect(sameJson({ a: 1, b: { c: 2, d: [1, 2] } }, { b: { d: [1, 2], c: 2 }, a: 1 })).toBe(true);
        expect(sameJson({ a: 1 }, { a: 2 })).toBe(false);
        expect(sameJson({ a: undefined, b: 1 }, { b: 1 })).toBe(true);
    });
});
