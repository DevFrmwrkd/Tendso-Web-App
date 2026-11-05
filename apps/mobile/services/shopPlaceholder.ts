import type { ImageSourcePropType } from 'react-native';

export type ShopPlaceholderKind = 'barber' | 'food' | 'sari_sari' | 'beauty' | 'repair' | 'other';

function recognizedCategory(value?: string | null): ShopPlaceholderKind | null {
  const category = (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!category) return null;
  // Keep specific trades ahead of broader buckets such as "beauty".
  if (/\b(barber\w*|barbero)\b/.test(category)) return 'barber';
  if (/\b(food|restaurant|cafe|coffee|bakery|bakeshop|eatery|carinderia|karinderya|canteen|fast food)\b/.test(category)) return 'food';
  if (/\b(sari\s*sari|grocery|convenience|mini\s*mart|supermarket|general store)\b/.test(category) || category === 'store') return 'sari_sari';
  if (/\b(beauty|salon|hair\w*|nail\w*|spa)\b/.test(category)) return 'beauty';
  if (/\b(repair|auto\w*|mechanic\w*|car\s*wash|vulcaniz\w*|tire\w*|tyre\w*)\b/.test(category)) return 'repair';
  return category === 'other' ? 'other' : null;
}

/** Stored category wins over the broader kind; business names never determine the art. */
export function shopPlaceholderKind(category?: string | null, kind?: string | null): ShopPlaceholderKind {
  return recognizedCategory(category) ?? recognizedCategory(kind) ?? 'other';
}

const SOURCES: Record<ShopPlaceholderKind, ImageSourcePropType> = {
  barber: require('../assets/placeholders/barber.png'),
  food: require('../assets/placeholders/food.png'),
  sari_sari: require('../assets/placeholders/sari-sari.png'),
  beauty: require('../assets/placeholders/beauty.png'),
  repair: require('../assets/placeholders/repair.png'),
  other: require('../assets/placeholders/shop.png'),
};

export function getShopPlaceholder(category?: string | null, kind?: string | null): ImageSourcePropType {
  return SOURCES[shopPlaceholderKind(category, kind)];
}
