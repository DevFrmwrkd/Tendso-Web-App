/** Shared content adapter for the three actual, data-driven review templates. */
export type BusinessKind = 'barber' | 'repair' | 'spa' | 'food' | 'clinic' | 'law' | 'craft' | 'other';
const kindByType: Record<string, BusinessKind> = {
  'Barber/Salon': 'barber', 'Auto Shop': 'repair', 'Spa/Massage': 'spa', Restaurant: 'food',
  Clinic: 'clinic', 'Law Office': 'law', 'Craft/Producer': 'craft', Other: 'other',
};
const themes: Record<BusinessKind, { paper: string; ink: string; accent: string; muted: string }> = {
  barber: { paper: '#f3eee5', ink: '#22251f', accent: '#8b3d29', muted: '#63675c' },
  repair: { paper: '#f0f0ea', ink: '#1d2527', accent: '#ba491d', muted: '#59666a' },
  spa: { paper: '#f4f0e8', ink: '#283d36', accent: '#647e64', muted: '#58685e' },
  food: { paper: '#fff6e8', ink: '#3d2920', accent: '#b54329', muted: '#756052' },
  clinic: { paper: '#f1f6f3', ink: '#153b3a', accent: '#227b73', muted: '#526d68' },
  law: { paper: '#f4f0e8', ink: '#25352f', accent: '#8c673c', muted: '#626b60' },
  craft: { paper: '#f3ede2', ink: '#3c3327', accent: '#7a5339', muted: '#6d5e4d' },
  other: { paper: '#f8f5e9', ink: '#244332', accent: '#537e37', muted: '#5d6f5d' },
};
const string = (value: unknown, fallback = '') => typeof value === 'string' ? value.trim() : fallback;
const array = (value: unknown): any[] => Array.isArray(value) ? value : [];
const image = (value: unknown) => {
  const url = string(value);
  return /^(https?:\/\/|\/(?!\/))/.test(url) ? url : '';
};

export function resolveBusiness(siteData: any = {}) {
  const layout = siteData.layout ?? {}, content = siteData.content ?? {};
  const kind: BusinessKind = kindByType[string(content.business_type)] ?? 'other';
  const contact = layout.contact ?? {}, hero = content.hero ?? {}, location = content.location ?? {};
  const name = string(layout.businessName, 'Your business');
  const heroImage = image(hero.image) || image(array(content.photos)[0]);
  const phone = string(contact.phone), email = string(contact.email);
  const address = string(contact.address), city = string(content.city, string(location.city));
  const hours = array(location.hours).map(row => ({ days: string(row.days), time: string(row.time) }))
    .filter(row => row.days && row.time);
  return {
    id: string(content.id, kind), kind, name,
    eyebrow: string(hero.kicker, string(content.business_type)),
    headline: string(hero.headline, array(hero.headlineLines).map(line => string(line)).join(' ') || name),
    description: string(hero.sub, string(layout.tagline)),
    story: array(content.about?.paras).map(item => string(item)).filter(Boolean),
    heroImage,
    gallery: array(content.gallery?.items).map(item => ({
      src: image(item.src ?? item.image), alt: string(item.alt, name), caption: string(item.caption),
    })).filter(item => item.src),
    services: array(content.services?.items).map(item => ({
      title: string(item.title), description: string(item.description ?? item.desc),
      price: string(item.price), meta: string(item.meta),
    })).filter(item => item.title),
    highlights: array(content.highlights).map(item => string(item)).filter(Boolean),
    process: array(content.how?.items).map(item => ({ title: string(item.title), description: string(item.description ?? item.desc) }))
      .filter(item => item.title),
    faq: array(content.faq?.items).map(item => ({ question: string(item.question ?? item.q), answer: string(item.answer ?? item.a) }))
      .filter(item => item.question && item.answer),
    address, city, phone, email, hours,
    phoneHref: /^\+?[\d\s()-]{7,}$/.test(phone) ? `tel:${phone.replace(/[^\d+]/g, '')}` : '',
    emailHref: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `mailto:${email}` : '',
    mapHref: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, address].filter(Boolean).join(', '))}`,
    cta: string(hero.cta1?.text, 'Plan your visit'),
    serviceLabel: string(content.services?.title, 'What we offer'),
    galleryLabel: string(content.gallery?.title, 'A closer look'),
    theme: themes[kind], sample: siteData.sample === true,
  };
}
