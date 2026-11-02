import { readFileSync } from 'fs';
import path from 'path';
import { transformToAstroData } from '@/lib/astro-builder';
import { businessCtaHref, businessKind, businessText, resolveBusiness } from '../../astro-site-template/src/components/capture-redesign/business';

const productionContent = () => ({
  business_name: 'Sample Legal Studio', business_type: 'Law Office', business_city: 'Quezon City', tagline: 'A clear next step.',
  hero: { kicker: 'Legal conversations', headline: 'Clarity for <em>what comes next.</em>', sub: 'Talk through the next step.', image: '/samples/legal-room.webp', cta1: { text: 'Arrange a conversation', href: '#contact' } },
  about: { headline: 'The people behind the work', lead: 'An introduction to our studio.', paragraphs: ['We listen <strong>first.</strong>', 'Bring your questions.'] },
  services: { headline: 'Ways we can help', items: [{ title: 'Consultation', desc: 'Discuss your situation.', price: 'Ask for a quote', note: 'By appointment' }] },
  gallery: { headline: 'Inside the studio', items: [{ image: '/samples/legal-desk.webp', caption: 'The meeting space', alt: 'Desk and chairs' }] },
  how: { headline: 'Start here', steps: [{ title: 'Get in touch', body: 'Tell us what you need.' }] },
  faq: { headline: 'Before we meet', items: [{ q: 'Can I call first?', a: 'Please call to arrange a conversation.' }] },
  location: { lat: 14.65, lng: 121.04, address: 'Sample Street, Quezon City', phone: '+63 912 345 6789', hours: 'Monday–Friday · 9 am–5 pm' },
  contact: { address: 'Sample Street, Quezon City', phone: '+63 912 345 6789', email: 'hello@example.test' },
  trust: { cells: [{ label: 'Quezon City' }] },
  footer: { brand: 'Sample Legal Studio', blurb: 'A local legal studio.' },
});

describe('approved business templates with production content', () => {
  it('preserves actual normalized owner copy through the real build transform', async () => {
    const data = await transformToAstroData(productionContent() as any, { heroStyle: 'business:CP', aboutStyle: 'business:CP', servicesStyle: 'business:CP', colorScheme: 'auto', fontPairing: 'auto' } as any, ['/samples/legal-room.webp']);
    const b = resolveBusiness(data);
    expect(b.code).toBe('business:CP');
    expect(b.kind).toBe('law');
    expect(b.city).toBe('Quezon City');
    expect(b.headline).toBe('Clarity for what comes next.');
    expect(b.storyLead).toBe('An introduction to our studio.');
    expect(b.story).toEqual(['We listen first.', 'Bring your questions.']);
    expect(b.services[0]).toMatchObject({ title: 'Consultation', description: 'Discuss your situation.', meta: 'By appointment', price: 'Ask for a quote' });
    expect(b.gallery[0]).toMatchObject({ src: '/samples/legal-desk.webp', caption: 'The meeting space' });
    expect(b.process[0].description).toBe('Tell us what you need.');
    expect(b.faq[0]).toMatchObject({ question: 'Can I call first?', answer: 'Please call to arrange a conversation.' });
    expect(b.hours).toEqual([{ days: '', time: 'Monday–Friday · 9 am–5 pm', fieldIndex: 0 }]);
    expect(b.emailHref).toBe('mailto:hello@example.test');
    expect(b.overrideCss).toBe('');
    expect(b.visible).toMatchObject({ hero: true, services: true, story: true, gallery: true, process: true, faq: true, visit: true, footer: true });
  });

  it.each([
    ['Barber Shop', 'barber'], ['Auto Repair', 'repair'], ['Spa/Massage', 'spa'], ['Restaurant / Cafe', 'food'],
    ['Dental Clinic', 'clinic'], ['Legal Services', 'law'], ['Craft/Producer', 'craft'], ['Sari-sari Store', 'other'],
  ])('maps %s to its business category', (input, expected) => expect(businessKind(input)).toBe(expected));

  it('keeps reviewed fixture aliases while canonical keys take priority', () => {
    const b = resolveBusiness({ layout: { businessName: 'Sample' }, content: { business_type: 'Barber/Salon', city: 'Sample City',
      about: { paras: ['Fixture story'] }, services: { items: [{ title: 'Trim', description: 'Fixture description', meta: '30 min' }] },
      gallery: { items: [{ src: '/sample.webp', alt: 'Sample photo' }] }, how: { items: [{ title: 'Visit', description: 'Walk in.' }] },
      faq: { items: [{ question: 'Open?', answer: 'Contact us.' }] }, location: { hours: [{ days: 'Mon–Sat', time: '9–5' }] },
    } });
    expect(b.story).toEqual(['Fixture story']);
    expect(b.services[0]).toMatchObject({ description: 'Fixture description', meta: '30 min' });
    expect(b.process[0].description).toBe('Walk in.');
    expect(b.faq[0].question).toBe('Open?');
    expect(b.gallery[0].src).toBe('/sample.webp');
    expect(b.hours[0]).toMatchObject({ days: 'Mon–Sat', time: '9–5' });
  });

  it('keeps owner-cleared lists empty rather than refilling them with photos or sample content', () => {
    const b = resolveBusiness({ content: { photos: ['/sample.webp'], about: { paragraphs: [] }, services: { items: [] }, gallery: { items: [] }, how: { steps: [] }, faq: { items: [] }, highlights: [] } });
    expect(b.name).toBe('');
    for (const field of ['story', 'services', 'gallery', 'process', 'faq', 'highlights', 'hours'] as const) expect(b[field]).toEqual([]);
    expect(b.mapHref).toBe('');
    expect(b.visible).toMatchObject({ services: false, story: false, gallery: false, process: false, faq: false, visit: false });
  });

  it('honors production visibility and only links to visible anchors', async () => {
    const content: any = productionContent();
    content.visibility = { hero_section: false, hero_image: false, services_section: false, about_section: false, featured_section: false, how_it_works_block: false, faq_block: false, location_block: false, footer_section: false, trust_block: false };
    const b = resolveBusiness(await transformToAstroData(content, { heroStyle: 'business:CP' } as any, []));
    expect(b.visible).toMatchObject({ hero: false, heroImage: false, services: false, story: false, gallery: false, process: false, faq: false, visit: false, footer: false, highlights: false });
    expect(businessCtaHref(b, { services: '#services', story: '#about', gallery: '#gallery', visit: '#visit' })).toBe(b.phoneHref);
    const shown = resolveBusiness({ layout: { contact: { email: 'hello@example.test' } }, content: { hero: { cta1: { href: '#services' } }, services: { items: [{ title: 'One' }] } } });
    expect(businessCtaHref(shown, { services: '#offerings', story: '#story', gallery: '#gallery', visit: '#visit' })).toBe('#offerings');
  });

  it('preserves source indices for editor hooks when malformed records are omitted', () => {
    const b = resolveBusiness({ content: { services: { items: [null, { title: 'Actual service' }] }, gallery: { items: [{ image: 'javascript:alert(1)' }, { image: '/valid.webp' }] }, how: { steps: [null, { title: 'First step' }] }, faq: { items: [null, { q: 'Question', a: 'Answer' }] } } });
    for (const list of [b.services, b.gallery, b.process, b.faq]) expect(list[0].fieldIndex).toBe(1);
  });

  it('applies granular editor toggles without hiding their entire section', () => {
    const b = resolveBusiness({ content: productionContent(), visibility: {
      servicesHeadline: false, servicesList: false, aboutHeadline: false, aboutDescription: false,
      aboutImages: false, galleryHeadline: false, galleryItems: false, contactDescription: false,
    } });
    expect(b.visible).toMatchObject({ services: true, story: true, gallery: true, serviceHeading: false, serviceList: false,
      storyHeading: false, storyDescription: false, storyImage: false, galleryHeading: false, galleryItems: false, footerBlurb: false });
  });

  it('keeps all supplied trust numbers and labels, including number-only cells', () => {
    const b = resolveBusiness({ content: { trust: { cells: [{ num: '2014', label: 'Established' }, null, { num: '4', label: 'Team members' }, { num: '2' }, { label: 'Local studio' }] } } });
    expect(b.trustItems).toEqual([{ num: '2014', label: 'Established', fieldIndex: 0 }, { num: '4', label: 'Team members', fieldIndex: 2 }, { num: '2', label: '', fieldIndex: 3 }, { num: '', label: 'Local studio', fieldIndex: 4 }]);
    expect(b.visible.highlights).toBe(true);
  });

  it('uses the existing whitelist for explicit color and font selections', () => {
    const b = resolveBusiness({ layout: { colorScheme: 'blue', fontPairing: 'modern' } });
    expect(b.hasColorOverride).toBe(true);
    expect(b.hasFontOverride).toBe(true);
    expect(b.overrideCss).toContain('--paper: #F5F8FC');
    expect(b.overrideFontHref).toMatch(/^https:\/\/fonts\.googleapis\.com\//);
    expect(resolveBusiness({ layout: { colorScheme: 'auto', fontPairing: 'auto' } }).overrideCss).toBe('');
    expect(resolveBusiness({ layout: { colorScheme: 'red;bad:evil', fontPairing: 'bad' } }).overrideCss).toBe('');
  });

  it('flattens inline emphasis safely without destroying comparison text or email notation', () => {
    expect(businessText('Use <em>soft light</em> &amp; check &#39;details&#39;.<script>alert(1)</script>')).toBe("Use soft light & check 'details'.");
    expect(businessText('5 < 6 > 4. Ask <hello@example.test>.')).toBe('5 < 6 > 4. Ask <hello@example.test>.');
    expect(resolveBusiness({ content: { hero: { image: 'javascript:alert(1)', cta1: { href: 'javascript:alert(1)' } } } }).heroImage).toBe('');
  });

  it.each(['Editorial', 'Immersive', 'Studio'])('%s exposes truthful block order, canonical identity and editor fields', name => {
    const source = readFileSync(path.join(process.cwd(), 'astro-site-template/src/components/capture-redesign', `${name}.astro`), 'utf8');
    expect([...source.matchAll(/data-template-block="([A-Z-]+)"/g)].map(match => match[1])).toEqual(['HERO', 'TRUST', 'SERVICES', 'ABOUT', 'GALLERY', 'HOW-IT-WORKS', 'FAQ', 'LOCATION', 'FOOTER']);
    for (const field of ['business_name', 'hero.headline', 'hero.sub', 'hero.image', 'hero.cta1.text', 'hero.cta1.href', 'location.address', 'location.phone', 'contact.email', 'location.hours']) expect(source).toContain(`"${field}"`);
    expect(source).toContain('data-template-code=');
    for (const field of ['services.items.${service.fieldIndex}.desc', 'services.items.${service.fieldIndex}.note', 'about.paragraphs.${index}', 'gallery.items.${', 'how.steps.${step.fieldIndex}.body', 'faq.items.${item.fieldIndex}.q', 'faq.items.${item.fieldIndex}.a']) expect(source).toContain(field);
  });
});
