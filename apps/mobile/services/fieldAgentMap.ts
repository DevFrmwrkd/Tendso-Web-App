import { mapDistanceLabel, validMapCoordinate, type MapSearchArea } from './workArea';

export type FindKind = 'food' | 'sari_sari' | 'beauty' | 'repair' | 'other';
export type FindPerson = { creatorId: string; displayName: string; profileImage: string | null };
export type MapViewportBounds = { south: number; north: number; west: number; east: number };
type MapRegion = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

const wrapLongitude = (value: number) => ((value + 180) % 360 + 360) % 360 - 180;

/** Native map bounds are search geometry, independent from the distance origin. */
export function viewportBounds(region: MapRegion): MapViewportBounds | null {
  if (!validMapCoordinate(region) || !Number.isFinite(region.latitudeDelta) || !Number.isFinite(region.longitudeDelta)
    || region.latitudeDelta <= 0 || region.longitudeDelta <= 0) return null;
  const halfLat = Math.min(region.latitudeDelta, 180) / 2;
  const halfLng = Math.min(region.longitudeDelta, 360) / 2;
  return {
    south: Math.max(-90, region.latitude - halfLat), north: Math.min(90, region.latitude + halfLat),
    west: halfLng === 180 ? -180 : wrapLongitude(region.longitude - halfLng),
    east: halfLng === 180 ? 180 : wrapLongitude(region.longitude + halfLng),
  };
}

/** Inclusive edges; west > east represents a viewport across the dateline. */
export function isInViewport(coordinate: { latitude: number; longitude: number }, bounds: MapViewportBounds): boolean {
  if (!validMapCoordinate(coordinate) || coordinate.latitude < bounds.south || coordinate.latitude > bounds.north) return false;
  if (bounds.west === -180 && bounds.east === 180) return true;
  const lng = wrapLongitude(coordinate.longitude);
  return bounds.west <= bounds.east ? lng >= bounds.west && lng <= bounds.east : lng >= bounds.west || lng <= bounds.east;
}

/** The mobile CRM response, including the optional community-find additions. */
export interface CommunityFind {
  _id: string;
  businessName?: string | null;
  businessAddress?: string | null;
  businessCity?: string | null;
  businessType?: string | null;
  businessLatitude?: number | null;
  businessLongitude?: number | null;
  businessGooglePlaceId?: string | null;
  businessWebsite?: string | null;
  ownerPhone?: string | null;
  phone?: string | null;
  source?: string;
  status?: string;
  submissionStatus?: string | null;
  photoUrl?: string | null;
  previewImageUrl?: string | null;
  hasLiveWebsite?: boolean;
  needsWebsite?: boolean | null;
  communityKind?: FindKind | null;
  websiteUrl?: string | null;
  isMine?: boolean;
  spottedBy?: FindPerson | null;
  submittedBy?: FindPerson | null;
  spottedAt?: number | null;
  createdAt?: number;
  claimedBy?: (FindPerson & { isMine: boolean }) | null;
  claimExpiresAt?: number | null;
}

export interface MapProspect {
  _id: string;
  businessName: string;
  address?: string;
  city?: string;
  category?: string;
  categoryBucket?: string;
  phone?: string;
  website?: string;
  googlePlaceId?: string;
  latitude: number;
  longitude: number;
  reservationExpiresAt?: number;
}

export interface FieldAgentShop {
  id: string;
  source: 'community' | 'crm' | 'pool';
  name: string;
  address: string | null;
  city: string | null;
  category: string | null;
  kind: FindKind;
  phone: string | null;
  website: string | null;
  photoUrl: string | null;
  googlePlaceId: string | null;
  latitude: number;
  longitude: number;
  distanceKm: number | null;
  distanceLabel: string;
  hasLiveWebsite: boolean;
  needsWebsite: boolean | null;
  isMine: boolean;
  spottedBy: FindPerson | null;
  spottedAt: number | null;
  claimedBy: (FindPerson & { isMine: boolean }) | null;
  claimExpiresAt: number | null;
  canVisit: boolean;
  canInterview: boolean;
}

export function findKind(category?: string | null): FindKind {
  const value = (category ?? '').toLowerCase();
  if (/food|restaurant|cafe|coffee|bakery|eatery|carinderia/.test(value)) return 'food';
  if (/sari.?sari|grocery|convenience|store|mart/.test(value)) return 'sari_sari';
  if (/beauty|salon|barber|hair|nail/.test(value)) return 'beauty';
  if (/repair|auto|mechanic|car.?wash|vulcaniz|tire/.test(value)) return 'repair';
  return 'other';
}

export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLng = (b.longitude - a.longitude) * Math.PI / 180;
  const term = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * Math.PI / 180)
    * Math.cos(b.latitude * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(term)));
}

export function publicImage(value?: string | null): string | null {
  return value && /^https?:\/\//i.test(value) ? value : null;
}

export function normalizeCommunityFind(lead: CommunityFind, area: MapSearchArea | null): FieldAgentShop | null {
  const coordinate = { latitude: lead.businessLatitude as number, longitude: lead.businessLongitude as number };
  if (!validMapCoordinate(coordinate)) return null;
  const distance = area ? distanceKm(area, coordinate) : null;
  const hasLiveWebsite = lead.hasLiveWebsite === true;
  const claimedBy = lead.claimedBy && (lead.claimExpiresAt == null || lead.claimExpiresAt > Date.now())
    ? lead.claimedBy : null;
  const community = lead.source === 'community';
  const interviewable = community && !lead.submissionStatus && !hasLiveWebsite
    && lead.status !== 'converted' && lead.status !== 'lost';
  return {
    id: String(lead._id), source: community ? 'community' : 'crm',
    name: lead.businessName?.trim() || 'Unnamed shop', address: lead.businessAddress ?? null,
    city: lead.businessCity ?? null, category: lead.businessType ?? null,
    kind: lead.communityKind ?? findKind(lead.businessType), phone: lead.ownerPhone || lead.phone || null,
    website: publicImage(lead.websiteUrl || lead.businessWebsite),
    photoUrl: publicImage(lead.photoUrl || lead.previewImageUrl),
    googlePlaceId: lead.businessGooglePlaceId ?? null, ...coordinate,
    distanceKm: distance, distanceLabel: mapDistanceLabel(distance, area),
    hasLiveWebsite, needsWebsite: lead.needsWebsite ?? null,
    isMine: claimedBy ? claimedBy.isMine
      : !!lead.isMine && (!community || !!lead.submissionStatus || hasLiveWebsite),
    spottedBy: lead.spottedBy ?? lead.submittedBy ?? null,
    spottedAt: lead.spottedAt ?? lead.createdAt ?? null,
    claimedBy, claimExpiresAt: lead.claimExpiresAt ?? null,
    canVisit: interviewable && !claimedBy,
    canInterview: interviewable && claimedBy?.isMine === true,
  };
}

export function normalizeProspect(prospect: MapProspect, area: MapSearchArea | null, mine = false): FieldAgentShop | null {
  if (!validMapCoordinate(prospect)) return null;
  mine = mine && (prospect.reservationExpiresAt == null || prospect.reservationExpiresAt > Date.now());
  const distance = area ? distanceKm(area, prospect) : null;
  const website = publicImage(prospect.website);
  return {
    id: String(prospect._id), source: 'pool', name: prospect.businessName,
    address: prospect.address ?? null, city: prospect.city ?? null, category: prospect.category ?? null,
    kind: findKind(prospect.categoryBucket || prospect.category), phone: prospect.phone ?? null,
    website, photoUrl: null, googlePlaceId: prospect.googlePlaceId ?? null,
    latitude: prospect.latitude, longitude: prospect.longitude,
    distanceKm: distance, distanceLabel: mapDistanceLabel(distance, area),
    hasLiveWebsite: website != null,
    // A scraper's missing URL is not proof that a shop has no website.
    needsWebsite: website ? false : null, isMine: mine, spottedBy: null, spottedAt: null,
    claimedBy: null, claimExpiresAt: mine ? prospect.reservationExpiresAt ?? null : null,
    canVisit: !mine && !website, canInterview: mine && !website,
  };
}

/** A community photo and its original spotter win over an imported duplicate. */
export function mergeMapShops(
  pool: readonly MapProspect[], reservations: readonly MapProspect[],
  leads: readonly CommunityFind[], area: MapSearchArea | null, radiusKm: number | null = 5,
): FieldAgentShop[] {
  const result = new Map<string, FieldAgentShop>();
  const add = (shop: FieldAgentShop | null) => {
    if (!shop || (radiusKm != null && shop.distanceKm != null && shop.distanceKm > radiusKm)) return;
    const key = shop.googlePlaceId ? `place:${shop.googlePlaceId}` : `${shop.source}:${shop.id}`;
    result.set(key, shop);
  };
  pool.forEach((prospect) => add(normalizeProspect(prospect, area)));
  reservations.forEach((prospect) => add(normalizeProspect(prospect, area, true)));
  leads.forEach((lead) => add(normalizeCommunityFind(lead, area)));
  return [...result.values()].sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
}

export function shopStatus(shop: FieldAgentShop): string {
  if (shop.hasLiveWebsite) return 'Live';
  if (shop.isMine) return 'Yours';
  if (shop.claimedBy) return 'Agent visiting';
  return shop.needsWebsite === true ? 'Needs a site' : shop.needsWebsite === false ? 'Has a website' : 'Check for a website';
}

export function shopPrefill(shop: FieldAgentShop) {
  return {
    // A prospects id must never be passed as the legacy v.id('leads') field.
    ...(shop.source !== 'pool' ? { prospectLeadId: shop.id } : {}),
    businessName: shop.name, phone: shop.phone ?? '', address: shop.address ?? '',
    city: shop.city ?? '', category: shop.category ?? '',
    ...(validMapCoordinate(shop) ? { latitude: String(shop.latitude), longitude: String(shop.longitude) } : {}),
  };
}
