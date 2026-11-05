import { GENERIC_CONTENT_SCHEMA, type ListSpec } from '../../components/editor/genericContentSchema';
import { ownerGroups, plainLabel, readWithFallbacks, textFillMessages } from '../../lib/ownerEditorFields';

const groups = ownerGroups(GENERIC_CONTENT_SCHEMA);
const paths = groups.flatMap((g) => g.fields.map((f) => f.path));

describe('ownerGroups', () => {
    it('hides the shop facts, plumbing, quotes and the marquee', () => {
        for (const p of ['business_name', 'tagline', 'contact.phone', 'contact.email', 'contact.address', 'navbar_links', 'hero.scrim', 'hero.headline']) {
            expect(paths).not.toContain(p);
        }
        const ids = groups.map((g) => g.id);
        expect(ids).not.toContain('testimonials');
        expect(ids).not.toContain('marquee');
    });

    it('keeps the words an owner would change, in plain labels', () => {
        expect(paths).toContain('hero.sub');
        expect(paths).toContain('about.lead');
        expect(paths).toContain('services.items');
        const hero = groups.find((g) => g.id === 'hero')!;
        expect(hero.fields.find((f) => f.path === 'hero.sub')!.label).toBe('Short introduction');
        expect(groups.find((g) => g.id === 'header')!.title).toBe('Top of the page');
    });

    it('leaves photos to the Photos screen', () => {
        for (const g of groups) {
            for (const f of g.fields) {
                if ((f as ListSpec).kind === 'list') {
                    for (const i of (f as ListSpec).itemFields) expect(i.kind).not.toBe('image');
                } else {
                    expect((f as { kind: string }).kind).not.toBe('image');
                }
            }
        }
    });

    it('does not mutate the editor\'s own schema', () => {
        expect(GENERIC_CONTENT_SCHEMA.find((g) => g.id === 'header')!.title).toBe('Header / Nav');
        expect(GENERIC_CONTENT_SCHEMA.find((g) => g.id === 'marquee')).toBeDefined();
    });
});

describe('plainLabel', () => {
    it('maps admin words and passes anything else through', () => {
        expect(plainLabel('Primary CTA')).toBe('Main button');
        expect(plainLabel('Headline')).toBe('Headline');
    });
});

describe('readWithFallbacks / textFillMessages', () => {
    const data: Record<string, unknown> = { 'hero.sub': 'Hello', 'about.lead': '', legacy: 'From legacy', 'services.items': [{ title: 'Cut', desc: 'Sharp' }, { title: 'Shave', desc: 'Hot towel' }] };
    const get = (p: string) => data[p];

    it('reads the primary path, else the first fallback that holds something', () => {
        expect(readWithFallbacks(get, 'hero.sub', ['legacy'])).toBe('Hello');
        expect(readWithFallbacks(get, 'about.lead', ['legacy'])).toBe('From legacy');
        expect(readWithFallbacks(get, 'nothing', ['nope'])).toBeUndefined();
    });

    it('turns the draft into bridge updates for scalars and list rows', () => {
        const get2 = (p: string): unknown => {
            const direct = data[p];
            if (direct !== undefined) return direct;
            const m = /^services\.items\.(\d+)\.(\w+)$/.exec(p);
            if (m) return (data['services.items'] as Array<Record<string, string>>)[Number(m[1])]?.[m[2]!];
            return undefined;
        };
        const msgs = textFillMessages(groups, get2);
        expect(msgs).toContainEqual({ type: 'ed:update', field: 'hero.sub', value: 'Hello' });
        expect(msgs).toContainEqual({ type: 'ed:update', field: 'services.items.1.title', value: 'Shave' });
    });
});
