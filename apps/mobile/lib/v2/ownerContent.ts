/**
 * Owner app content: what a shop can sell (one question with photo rows) and the
 * real designs offered for each kind of shop.
 *
 * `businessType` values are the backend allowlist (convex/lib/prospectPrefill
 * BUSINESS_TYPES). `shots` picks the guided photo list (lib/v2/captureContent).
 * Design codes + preview paths mirror components/editor/templateCatalog.ts on the
 * web (a test keeps them in sync).
 */
import type { ImageSourcePropType } from 'react-native';
import type { ShotListKey } from './captureContent';
import { formatPeso } from '../../components/v2/format';

export type SellKindId = 'barber' | 'salon' | 'repair' | 'craft' | 'food' | 'other';

export interface SellKind {
  id: SellKindId;
  label: string;
  businessType: 'Barber/Salon' | 'Auto Shop' | 'Spa/Massage' | 'Restaurant' | 'Clinic' | 'Law Office' | 'Craft/Producer' | 'Other';
  shots: ShotListKey;
  photo: ImageSourcePropType;
}

/** Crafts first (Theo's rule); food is offered but never the lead example. */
export const SELL_KINDS: readonly SellKind[] = [
  { id: 'barber', label: 'Barbershop', businessType: 'Barber/Salon', shots: 'barber', photo: require('../../assets/v2/owner/kind-barber.jpg') },
  { id: 'salon', label: 'Salon & spa', businessType: 'Barber/Salon', shots: 'salon', photo: require('../../assets/v2/owner/kind-salon.jpg') },
  { id: 'repair', label: 'Repair shop', businessType: 'Auto Shop', shots: 'repair', photo: require('../../assets/v2/owner/kind-repair.jpg') },
  { id: 'craft', label: 'Crafts & flowers', businessType: 'Craft/Producer', shots: 'craft', photo: require('../../assets/v2/owner/kind-craft.jpg') },
  { id: 'food', label: 'Food', businessType: 'Restaurant', shots: 'food', photo: require('../../assets/v2/owner/kind-food.jpg') },
  { id: 'other', label: 'Something else', businessType: 'Other', shots: 'shop', photo: require('../../assets/v2/owner/kind-shop.jpg') },
];

export function sellKind(id: string | null | undefined): SellKind | undefined {
  return SELL_KINDS.find((k) => k.id === id);
}

/** Best guess back from what the server stored (resuming a draft). */
export function sellKindFromServer(businessType: string | null | undefined, shotListKey: string | null | undefined): SellKind {
  const byShots = SELL_KINDS.find((k) => k.shots === shotListKey);
  if (byShots) return byShots;
  return SELL_KINDS.find((k) => k.businessType === businessType) ?? SELL_KINDS[SELL_KINDS.length - 1];
}

export interface Design {
  /** Template code, e.g. 'barbershop:F' — what owners.chooseDesign stores. */
  code: string;
  /** The design's name, shown under the card. */
  name: string;
  /** Path on the web origin, e.g. /template-previews/f.html */
  preview: string;
}

const d = (code: string, name: string, file: string): Design => ({ code, name, preview: `/template-previews/${file}.html` });

/** A handful of real designs per kind, the strongest first. */
export const DESIGNS: Record<SellKindId, readonly Design[]> = {
  barber: [
    d('barbershop:F', 'Forge', 'f'),
    d('barbershop:G', 'Cinematic', 'g'),
    d('barbershop:I', 'Minimal', 'i'),
    d('barbershop:J', 'Stacked', 'j'),
    d('barbershop:BP', 'Glacier', 'bp'),
  ],
  salon: [
    d('salonspa:AN', 'Héla', 'an'),
    d('salonspa:K', 'Atelier', 'k'),
    d('salonspa:L', 'Botanica', 'l'),
    d('salonspa:N', 'Vogue', 'n'),
    d('salonspa:O', 'Bloom', 'o'),
  ],
  repair: [
    d('autoshop:AP', 'Vulca Garage', 'ap'),
    d('filipino:BG', 'Vulca Bay', 'bg'),
    d('autoshop:AF', 'Job Sheet', 'af'),
    d('autoshop:P', 'Foundry', 'p'),
    d('autoshop:T', 'Maple Street', 't'),
  ],
  craft: [
    d('woodworks:BV', 'Narra & Co.', 'bv'),
    d('florist:BR', 'Bloom', 'br'),
    d('woodworks:BW', 'Molave', 'bw'),
    d('florist:BS', 'Kalachuchi', 'bs'),
    d('shirtstore:AB', 'Artisan', 'ab'),
  ],
  food: [
    d('filipino:BC', 'Lutong Bahay', 'bc'),
    d('restaurant:AM', 'Kalan', 'am'),
    d('filipino:BD', 'Panaderia', 'bd'),
    d('foodcraft:AL', 'Pastel Deco', 'al'),
    d('restaurant:U', 'Harvest', 'u'),
  ],
  other: [
    d('filipino:BB', 'Tindahan', 'bb'),
    d('retail:AO', 'Domingo', 'ao'),
    d('services:AS', 'Labaná', 'as'),
    d('generic:A', 'Ironwood', 'a'),
    d('generic:C', 'Cedar & Stone', 'c'),
  ],
};

export function designsFor(kind: SellKindId | null | undefined): readonly Design[] {
  return DESIGNS[kind ?? 'other'] ?? DESIGNS.other;
}

/** Price facts (packages/shared/pricing.ts). Display only; the server bills. */
export const PRICE_ONCE = 4999;
export const MIN_DOWN_PAYMENT = 500;
export const DOWN_PAYMENT_STEP = 500;

/** "₱4,999" — the app kit's formatter (components/v2/format.ts). */
export const peso = (n: number): string => formatPeso(n);

/** `<slug>.sites.tendso.com` — the free address (Theo, round 3). */
export function freeAddress(slug: string): string {
  return `${slug}.sites.tendso.com`;
}

/** A readable slug guess for display before the server assigns one. */
export function slugGuess(businessName: string): string {
  return (businessName || 'myshop')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 30) || 'myshop';
}

/** "https://forge.sites.tendso.com/" → "forge.sites.tendso.com" */
export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
