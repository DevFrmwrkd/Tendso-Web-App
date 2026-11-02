import { buildFontHref, buildOverrideCss, resolveTheme } from '../../lib/genericThemeOverrides';

export type BusinessKind = 'barber' | 'repair' | 'spa' | 'food' | 'clinic' | 'law' | 'craft' | 'other';
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
const object = (value: any): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const array = (value: unknown): any[] => Array.isArray(value) ? value : [];
const own = (value: any, key: string) => Object.prototype.hasOwnProperty.call(value, key);

/** Generated copy may contain inline emphasis. Render it as text, never arbitrary HTML. */
export function businessText(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—' };
  return String(value).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/?[a-z][a-z0-9]*(?:\s[^>]*|\s*\/?)>/gi, '')
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
      if (entity[0] !== '#') return entities[entity.toLowerCase()] ?? match;
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
    }).trim();
}
const firstText = (...values: unknown[]) => values.map(businessText).find(Boolean) ?? '';
const rows = (value: any, ...keys: string[]) => {
  if (Array.isArray(value)) return value;
  const wrapper = object(value);
  for (const key of keys) if (Array.isArray(wrapper[key])) return wrapper[key];
  return [];
};
const image = (value: unknown) => {
  const url = typeof value === 'string' ? value.trim() : '';
  if (/^\/(?![\/\\])/.test(url) && !/[\u0000-\u001f]/.test(url)) return url;
  try { const parsed = new URL(url); return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? url : ''; } catch { return ''; }
};
const safeHref = (value: unknown) => {
  const url = typeof value === 'string' ? value.trim() : '';
  return /^#[\w-]+$/.test(url) || /^tel:\+?[\d()-]+$/.test(url) || /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url) ? url : image(url);
};
export function businessKind(value: unknown): BusinessKind {
  const type = businessText(value).toLowerCase();
  if (/\blaw\b|legal|attorney|notar/.test(type)) return 'law';
  if (/clinic|dental|medical|doctor|health/.test(type)) return 'clinic';
  if (/spa|massage|wellness/.test(type)) return 'spa';
  if (/barber|salon|hair|beauty/.test(type)) return 'barber';
  if (/auto|repair|garage|mechanic|vulcan|motor/.test(type)) return 'repair';
  if (/food|restaurant|cafe|café|bakery|eatery|carinderia|milk.?tea/.test(type)) return 'food';
  if (/craft|producer|artisan|furniture|wood|pottery|maker/.test(type)) return 'craft';
  return 'other';
}

/** Keep generated CTA anchors inside visible sections of the selected layout. */
export function businessCtaHref(b: ReturnType<typeof resolveBusiness>, ids: { services: string; story: string; gallery: string; visit: string }) {
  if (b.ctaHref && !b.ctaHref.startsWith('#')) return b.ctaHref;
  const anchors: Record<string, string> = { '#top': '#top' };
  if (b.visible.services) for (const key of ['#services', '#offerings', ids.services]) anchors[key] = ids.services;
  if (b.visible.story) for (const key of ['#about', '#story', ids.story]) anchors[key] = ids.story;
  if (b.visible.gallery) anchors['#gallery'] = ids.gallery;
  if (b.visible.visit) for (const key of ['#contact', '#location', '#visit', ids.visit]) anchors[key] = ids.visit;
  return anchors[b.ctaHref] || (b.visible.visit ? ids.visit : b.phoneHref || b.emailHref || b.mapHref);
}

/** Normalizes the production schema and older review fixtures without inventing owner details. */
export function resolveBusiness(siteData: any = {}) {
  const layout = object(siteData.layout), content = object(siteData.content), visibility = object(siteData.visibility);
  const kind = businessKind(content.business_type), contact = object(layout.contact), contentContact = object(content.contact ?? siteData.contact);
  const hero = object(content.hero ?? siteData.hero), about = object(content.about ?? siteData.about);
  const location = object(content.location), footer = object(content.footer), servicesBlock = content.services ?? siteData.services;
  const galleryBlock = object(content.gallery), how = content.how ?? siteData.how, faqBlock = content.faq ?? siteData.faq;
  const name = firstText(layout.businessName, content.business_name);
  const photos = array(content.photos).map(image).filter(Boolean);
  const heroImage = image(hero.image) || photos[0] || '';
  const phone = firstText(location.phone, contentContact.phone, contact.phone), email = firstText(contentContact.email, location.email, contact.email);
  const address = firstText(location.address, contentContact.address, contact.address), city = firstText(content.business_city, content.city, location.city);
  const phoneHref = /^\+?[\d\s()-]{7,}$/.test(phone) ? `tel:${phone.replace(/[^\d+]/g, '')}` : '';
  const emailHref = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `mailto:${email}` : '';
  const explicitParagraphs = own(about, 'paragraphs') || own(about, 'paras');
  const paragraphs = array(own(about, 'paragraphs') ? about.paragraphs : about.paras).map(businessText);
  const storyLead = businessText(about.lead);
  const story = paragraphs.length || explicitParagraphs ? paragraphs : [firstText(about.description, about.body, typeof content.about === 'string' ? content.about : '')].filter(Boolean);
  const gallery = (own(galleryBlock, 'items') ? array(galleryBlock.items) : photos.map(src => ({ image: src })))
    .map((raw, index) => { const item = object(raw); return { src: image(item.image ?? item.src), alt: firstText(item.alt, item.caption, name), caption: businessText(item.caption), fieldIndex: index }; })
    .filter(item => item.src);
  const services = rows(servicesBlock, 'items').map((raw, index) => { const item = object(raw); return { title: firstText(item.title, item.name), description: firstText(item.desc, item.description, item.body), price: businessText(item.price), meta: firstText(item.note, item.meta), fieldIndex: index }; }).filter(item => item.title);
  const process = rows(how, 'steps', 'items').map((raw, index) => { const item = object(raw); return { title: businessText(item.title), description: firstText(item.body, item.description, item.desc), fieldIndex: index }; }).filter(item => item.title);
  const faq = rows(faqBlock, 'items').map((raw, index) => { const item = object(raw); return { question: firstText(item.q, item.question), answer: firstText(item.a, item.answer), fieldIndex: index }; }).filter(item => item.question && item.answer);
  const hourRows = Array.isArray(location.hours) ? location.hours : typeof location.hours === 'string' ? [] : array(footer.hours);
  const hours = hourRows.map((raw, index) => { const row = object(raw); return { days: firstText(row.day, row.days), time: businessText(row.time), fieldIndex: index }; }).filter(row => row.days || row.time);
  const hoursText = businessText(location.hours);
  if (!hours.length && hoursText) hours.push({ days: '', time: hoursText, fieldIndex: 0 });
  const trustItems = (own(content, 'highlights')
    ? array(content.highlights).map((label, fieldIndex) => ({ label: businessText(label), num: '', fieldIndex }))
    : rows(content.trust, 'cells').map((raw, fieldIndex) => { const item = object(raw); return { label: firstText(item.label, item.text), num: businessText(item.num), fieldIndex }; }))
    .filter(item => item.label || item.num);
  const highlights = trustItems.map(item => item.label);
  const chosen = resolveTheme(layout, content.business_type, { lockVariant: true });
  const overrideCss = buildOverrideCss(chosen.scheme, chosen.pairing);
  return {
    id: firstText(content.id, kind), code: businessText(siteData.customizations?.heroStyle), kind, name, eyebrow: firstText(hero.kicker, content.business_type),
    headline: firstText(hero.headline, array(hero.headlineLines).map(businessText).join(' '), name),
    description: firstText(hero.sub, layout.tagline), story, storyLead, heroImage, gallery, services, highlights, trustItems, process, faq,
    favicon: image(layout.favicon), ogImage: image(layout.ogImage) || heroImage,
    address, city, phone, email, hours, phoneHref, emailHref,
    mapHref: address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, address].filter(Boolean).join(', '))}` : '',
    cta: firstText(hero.cta1?.text, content.navCtaText, 'Get in touch'), ctaHref: safeHref(hero.cta1?.href),
    serviceLabel: firstText(object(servicesBlock).tag, object(servicesBlock).title, 'What we offer'),
    galleryLabel: firstText(galleryBlock.tag, galleryBlock.title, 'A closer look'),
    storyTitle: businessText(about.headline), serviceHeading: businessText(object(servicesBlock).headline),
    galleryHeading: businessText(galleryBlock.headline), processHeading: businessText(object(how).headline),
    faqHeading: businessText(object(faqBlock).headline), visitHeading: businessText(location.headline),
    footerBrand: firstText(footer.brand, name), footerBlurb: firstText(footer.blurb, footer.brand_blurb),
    theme: themes[kind], sample: siteData.sample === true, overrideCss, overrideFontHref: buildFontHref(chosen.pairing),
    hasColorOverride: /--paper:/.test(overrideCss), hasFontOverride: /--sans:/.test(overrideCss),
    visible: {
      hero: visibility.heroSection !== false, heroHeadline: visibility.heroHeadline !== false,
      heroDescription: visibility.heroDescription !== false && visibility.heroTagline !== false,
      heroButton: visibility.heroButton !== false, heroImage: visibility.heroImage !== false,
      highlights: visibility.trustBlock !== false && highlights.length > 0,
      services: visibility.servicesSection !== false && services.length > 0,
      serviceHeading: visibility.servicesHeadline !== false, serviceList: visibility.servicesList !== false,
      story: visibility.aboutSection !== false && !!(story.some(Boolean) || storyLead),
      storyHeading: visibility.aboutHeadline !== false, storyDescription: visibility.aboutDescription !== false, storyImage: visibility.aboutImages !== false,
      gallery: visibility.gallerySection !== false && gallery.length > 0,
      galleryHeading: visibility.galleryHeadline !== false, galleryItems: visibility.galleryItems !== false && visibility.galleryImages !== false,
      process: visibility.howItWorksBlock !== false && process.length > 0,
      faq: visibility.faqBlock !== false && faq.length > 0,
      visit: visibility.locationBlock !== false && visibility.contactInfo !== false && !!(address || phoneHref || emailHref || hours.length),
      footer: visibility.contactSection !== false && visibility.footerBlock !== false,
      footerBlurb: visibility.contactDescription !== false,
    },
  };
}
