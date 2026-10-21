import { buildCopyPrompt, cleanLine, validateCopy, EMPTY_COPY } from '@/lib/aiPipeline/copy';
import { buildTemplateContent, factFaq, headlineLines, readPath, telHref, templateCoverage } from '@/lib/aiPipeline/fieldMapping';
import { GENERIC_CONTENT_SCHEMA } from '@/components/editor/genericContentSchema';
import { TEMPLATE_FIELD_PATHS } from '@/components/editor/templateFieldPaths.generated';
import { makeFacts, makeInput } from './fixtures';

describe('validateCopy', () => {
    const facts = makeFacts();

    it('blanks lines with invented numbers or clichés and trims long ones', () => {
        const { copy, report } = validateCopy({
            tagline: 'Barbershop in Lipa since 2014',
            heroHeadline: 'Serving 500 happy customers a week',
            heroSub: 'Your one-stop shop for great cuts',
            aboutLead: 'word '.repeat(60),
            ctaHeading: 'Drop by today!!! 💈',
        }, facts);
        expect(copy.tagline).toBe('Barbershop in Lipa since 2014');
        expect(copy.heroHeadline).toBe('');
        expect(copy.heroSub).toBe('');
        expect(copy.aboutLead.split(' ')).toHaveLength(35);
        expect(copy.ctaHeading).toBe('Drop by today.');
        expect(report.blanked).toEqual(expect.arrayContaining(['heroHeadline', 'heroSub']));
        expect(report.trimmed).toContain('aboutLead');
    });

    it('only describes services the facts have, and only when the owner said something about them', () => {
        const { copy } = validateCopy({
            serviceDescriptions: [
                { name: 'Haircut', desc: 'Precision fades with a free hair wash' },
                { name: 'shave', desc: 'Hot towel shave' },
                { name: 'Massage', desc: 'Relaxing' },
            ],
        }, facts);
        expect(copy.serviceDescriptions).toEqual([
            { name: 'Haircut', desc: '' },
            { name: 'Shave', desc: 'Hot towel shave' },
        ]);
    });

    it('cleanLine removes emoji, exclamation marks and wrapping quotes', () => {
        expect(cleanLine('"Fresh cuts! 💈✂️"')).toBe('Fresh cuts.');
    });

    it('the copy prompt carries only facts, never the transcript', () => {
        const p = buildCopyPrompt(facts);
        expect(p).toContain('"Haircut"');
        expect(p).toContain('FACTS (the only source you may use)');
        expect(p).toContain('Tagalog phrase');
    });
});

describe('buildTemplateContent', () => {
    const facts = makeFacts();
    const input = makeInput({ coordinates: { lat: 13.9, lng: 121.1 } });
    const { copy } = validateCopy({ heroHeadline: 'Clean fades in Lipa since 2014', aboutLead: 'I started in the market.', footerBlurb: 'Barbershop in Lipa.' }, facts);
    const content = buildTemplateContent(facts, copy, input);

    it('writes the template field paths from the schema', () => {
        expect(readPath(content, 'hero.headline')).toBe('Clean fades in Lipa since 2014');
        expect(content.hero.headlineLines.join(' ')).toBe('Clean fades in Lipa since 2014');
        expect(readPath(content, 'services.items.N.title')).toBe('Haircut');
        expect(content.services.items[1]).toEqual({ title: 'Shave', desc: 'with hot towel', price: '₱100', note: '' });
        expect(readPath(content, 'location.hours')).toBe('Mon-Sat 8am-7pm');
        expect(content.location).toMatchObject({ lat: 13.9, lng: 121.1 });
        expect(readPath(content, 'footer.hours.N.day')).toBe('Mon-Sat');
        expect(content.about.stampYear).toBe('2014');

        // Every object-valued path written is one the schema declares.
        const declared = new Set<string>();
        for (const g of GENERIC_CONTENT_SCHEMA) for (const f of g.fields) declared.add(f.path.split('.')[0]);
        for (const root of ['hero', 'about', 'services', 'location', 'footer', 'contact', 'marquee']) {
            expect(declared.has(root)).toBe(true);
        }
    });

    it('never invents: empty conversion blocks, FAQ from facts, non-empty featured list', () => {
        expect(content.why).toEqual([]);
        expect(content.how).toEqual([]);
        expect(content.credentials).toEqual([]);
        expect(content.testimonials).toEqual([]);
        expect(content.faq.map((f: { q: string }) => f.q)).toEqual(['When are you open?', 'Where are you?', 'How can I pay?']);
        expect(content.faq[2].a).toBe('cash and GCash.');
        expect(content.featured_products.length).toBeGreaterThan(0);
        expect(content.unique_selling_points).toEqual(['the clean fades']);
    });

    it('falls back to facts, not stock phrases, when the copy is empty', () => {
        const bare = buildTemplateContent(makeFacts({ services: [], story: '', hours: [] }), EMPTY_COPY, makeInput({ ownerPhone: '' }));
        expect(bare.tagline).toBe('Barbershop in Lipa');
        expect(bare.hero.headline).toBe("Mang Ariel's Barbershop");
        expect(bare.hero.cta1).toEqual({ text: 'Visit us', href: '#visit' });
        expect(bare.featured_products).toEqual([{ title: "Mang Ariel's Barbershop", description: 'Barbershop in Lipa', tags: [] }]);
        expect(bare.marquee).toBeUndefined();
    });

    it('helpers', () => {
        expect(telHref('0917 123 4567')).toBe('tel:+639171234567');
        expect(telHref('+63 917 123 4567')).toBe('tel:+639171234567');
        expect(telHref('12')).toBe('');
        expect(headlineLines('one two three four five six seven')).toEqual(['one two three', 'four five six', 'seven']);
        expect(factFaq(makeFacts({ hours: [], paymentMethods: [], areasServed: ['Lipa', 'Tanauan'] }), { address: '', city: '' }))
            .toEqual([{ q: 'Where are you?', a: 'Lipa.' }, { q: 'Which areas do you serve?', a: 'Lipa and Tanauan.' }]);
    });

    it('reports which text fields a real template binds and leaves empty', () => {
        const code = Object.keys(TEMPLATE_FIELD_PATHS)[0];
        const coverage = templateCoverage(content, TEMPLATE_FIELD_PATHS[code]);
        expect(coverage.filled.length).toBeGreaterThan(0);
        expect([...coverage.filled, ...coverage.empty].some((p) => /(^|\.)(image\d*|images|href)(\.|$)/.test(p))).toBe(false);
        expect(templateCoverage({ a: { b: '' }, c: ['x'] }, ['a.b', 'c.N', 'hero.image'])).toEqual({ filled: ['c.N'], empty: ['a.b'] });
    });
});
