import {
  mergeMapShops, normalizeCommunityFind, normalizeProspect, shopPrefill, shopStatus,
  type CommunityFind, type MapProspect,
} from '../services/fieldAgentMap';
import type { MapSearchArea } from '../services/workArea';

const NOW = 1_793_000_000_000;
const area: MapSearchArea = { latitude: 14.65, longitude: 121.1, source: 'work', label: 'Marikina' };
const spotter = { creatorId: 'jun', displayName: 'Jun D.', profileImage: 'https://photos.example/jun.jpg' };
const claimant = { creatorId: 'mika', displayName: 'Mika S.', profileImage: null, isMine: true };

function find(patch: Partial<CommunityFind> = {}): CommunityFind {
  return {
    _id: 'find-nena', source: 'community', businessName: 'Aling Nena’s',
    businessAddress: '12 J.P. Rizal St', businessCity: 'Marikina',
    businessLatitude: 14.651, businessLongitude: 121.1, businessType: 'Sari-sari store',
    photoUrl: 'https://photos.example/nena.jpg', needsWebsite: true, hasLiveWebsite: false,
    spottedBy: spotter, spottedAt: NOW - 86_400_000, status: 'new', ...patch,
  };
}

function prospect(patch: Partial<MapProspect> = {}): MapProspect {
  return { _id: 'prospect-ramon', businessName: 'Ramon’s Barber', latitude: 14.652,
    longitude: 121.1, category: 'Barber', ...patch };
}

beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(NOW));
afterEach(() => jest.restoreAllMocks());

describe('field agent shop states', () => {
  it('does not turn a shop live merely because the field agent owns its lead', () => {
    const shop = normalizeCommunityFind(find({ source: 'referral', isMine: true, needsWebsite: null }), area)!;
    expect(shopStatus(shop)).toBe('Yours');
    expect(shop.hasLiveWebsite).toBe(false);
    expect(shop.canVisit).toBe(false);
    expect(shop.canInterview).toBe(false);
  });

  it('keeps a captured community shop in Yours without treating an unclaimed spotted shop as reserved', () => {
    const spotted = normalizeCommunityFind(find({ isMine: true }), area)!;
    expect(spotted.isMine).toBe(false);
    expect(spotted.canVisit).toBe(true);
    const captured = normalizeCommunityFind(find({ isMine: true, status: 'converted', submissionStatus: 'submitted' }), area)!;
    expect(captured.isMine).toBe(true);
    expect(shopStatus(captured)).toBe('Yours');
    expect(captured.canVisit).toBe(false);
    const published = normalizeCommunityFind(find({ isMine: true, status: 'converted', submissionStatus: 'deployed', hasLiveWebsite: true }), area)!;
    expect(published.isMine).toBe(true);
    expect(shopStatus(published)).toBe('Live');
  });

  it('keeps explicit website answers separate from verified live websites and unknown old data', () => {
    const reportedWebsite = normalizeCommunityFind(find({ needsWebsite: false }), area)!;
    const unknown = normalizeCommunityFind(find({ needsWebsite: null }), area)!;
    const needs = normalizeCommunityFind(find(), area)!;
    expect(reportedWebsite.needsWebsite).toBe(false);
    expect(reportedWebsite.hasLiveWebsite).toBe(false);
    expect(shopStatus(reportedWebsite)).toBe('Has a website');
    expect(unknown.needsWebsite).toBeNull();
    expect(shopStatus(unknown)).toBe('Check for a website');
    expect(shopStatus(needs)).toBe('Needs a site');
  });

  it('uses the live response instead of an old needs-site answer and prevents visiting it', () => {
    const shop = normalizeCommunityFind(find({ hasLiveWebsite: true, websiteUrl: 'https://nena.example', needsWebsite: true }), area)!;
    expect(shopStatus(shop)).toBe('Live');
    expect(shop.website).toBe('https://nena.example');
    expect(shop.canVisit).toBe(false);
    expect(shop.canInterview).toBe(false);
  });

  it('does not infer no website from an imported prospect with a missing URL', () => {
    const shop = normalizeProspect(prospect(), area)!;
    expect(shopStatus(shop)).toBe('Check for a website');
    expect(shop.needsWebsite).toBeNull();
    expect(shop.photoUrl).toBeNull();
    expect(shop.spottedBy).toBeNull();
  });

  it('recognizes an actual imported website without offering a duplicate site visit', () => {
    const shop = normalizeProspect(prospect({ website: 'https://ramon.example' }), area)!;
    expect(shop.hasLiveWebsite).toBe(true);
    expect(shopStatus(shop)).toBe('Live');
    expect(shop.canVisit).toBe(false);
  });

  it.each([{ submissionStatus: 'submitted' }, { status: 'converted' }, { status: 'lost' }])(
    'does not offer another interview for a completed or unavailable community find: %p',
    (patch) => {
      const shop = normalizeCommunityFind(find({ ...patch, claimedBy: claimant, claimExpiresAt: NOW + 1000 }), area)!;
      expect(shop.canVisit).toBe(false);
      expect(shop.canInterview).toBe(false);
    },
  );
});

describe('map coordinates and origin', () => {
  it.each([
    { businessLatitude: null }, { businessLongitude: undefined }, { businessLatitude: NaN },
    { businessLatitude: 91 }, { businessLongitude: 181 },
  ])('rejects an incomplete or invalid coordinate pair: %p', (patch) => {
    expect(normalizeCommunityFind(find(patch), area)).toBeNull();
  });

  it('describes a saved city-center distance without claiming it is the phone location', () => {
    const shop = normalizeCommunityFind(find(), area)!;
    expect(shop.distanceKm).toBeCloseTo(0.111, 2);
    expect(shop.distanceLabel).toBe('111 m from Marikina');
    const current = normalizeCommunityFind(find(), { ...area, source: 'device', label: 'you' })!;
    expect(current.distanceLabel).toBe('111 m away');
    const unavailable = normalizeCommunityFind(find(), null)!;
    expect(unavailable.distanceKm).toBeNull();
    expect(unavailable.distanceLabel).toBe('Distance unavailable');
  });

  it('applies a real distance limit and sorts by the selected work area', () => {
    const shops = mergeMapShops([prospect()], [], [
      find({ _id: 'cebu', businessLatitude: 10.3, businessLongitude: 123.9 }), find(),
    ], area);
    expect(shops.map((shop) => shop.id)).toEqual(['find-nena', 'prospect-ramon']);
  });
});

describe('claims, provenance, and capture', () => {
  it('retains the original spotter while another agent owns the current visit', () => {
    const shop = normalizeCommunityFind(find({ claimedBy: claimant, claimExpiresAt: NOW + 3600_000,
      submittedBy: { ...claimant, creatorId: 'mika' } }), area)!;
    expect(shop.spottedBy).toEqual(spotter);
    expect(shop.isMine).toBe(true);
    expect(shop.canInterview).toBe(true);
    expect(shop.canVisit).toBe(false);
    expect(shopStatus(shop)).toBe('Yours');
  });

  it('does not let another agent interview an active claim', () => {
    const shop = normalizeCommunityFind(find({ claimedBy: { ...claimant, isMine: false }, claimExpiresAt: NOW + 1000 }), area)!;
    expect(shop.isMine).toBe(false);
    expect(shopStatus(shop)).toBe('Agent visiting');
    expect(shop.canVisit).toBe(false);
    expect(shop.canInterview).toBe(false);
  });

  it('makes an expired community claim available even before a new query response arrives', () => {
    const shop = normalizeCommunityFind(find({ claimedBy: claimant, claimExpiresAt: NOW - 1 }), area)!;
    expect(shop.claimedBy).toBeNull();
    expect(shop.isMine).toBe(false);
    expect(shop.canVisit).toBe(true);
    expect(shop.canInterview).toBe(false);
  });

  it('retains a current prospect reservation and stops treating an expired one as mine', () => {
    const active = normalizeProspect(prospect({ reservationExpiresAt: NOW + 1000 }), area, true)!;
    expect(shopStatus(active)).toBe('Yours');
    expect(active.canInterview).toBe(true);
    const expired = normalizeProspect(prospect({ reservationExpiresAt: NOW - 1 }), area, true)!;
    expect(expired.isMine).toBe(false);
    expect(expired.canInterview).toBe(false);
    expect(expired.canVisit).toBe(true);
  });

  it('deduplicates an available imported pin against the richer community photo and original spotter', () => {
    const shops = mergeMapShops([prospect({ googlePlaceId: 'google-nena' })], [],
      [find({ businessGooglePlaceId: 'google-nena' })], area);
    expect(shops).toHaveLength(1);
    expect(shops[0]).toMatchObject({ id: 'find-nena', source: 'community', photoUrl: 'https://photos.example/nena.jpg', spottedBy: spotter });
  });

  it('deduplicates available and reserved versions of the same prospect in favor of the reservation', () => {
    const row = prospect({ googlePlaceId: 'google-ramon', reservationExpiresAt: NOW + 1000 });
    const shops = mergeMapShops([row], [row], [], area);
    expect(shops).toHaveLength(1);
    expect(shops[0].isMine).toBe(true);
    expect(shops[0].canInterview).toBe(true);
  });

  it('passes only lead-table ids to the capture field that validates v.id(leads)', () => {
    const community = normalizeCommunityFind(find(), area)!;
    const imported = normalizeProspect(prospect(), area, true)!;
    expect(shopPrefill(community)).toEqual({ prospectLeadId: 'find-nena', businessName: 'Aling Nena’s',
      phone: '', address: '12 J.P. Rizal St', city: 'Marikina', category: 'Sari-sari store',
      latitude: '14.651', longitude: '121.1' });
    expect(shopPrefill(imported)).not.toHaveProperty('prospectLeadId');
    expect(shopPrefill(imported)).toMatchObject({ latitude: '14.652', longitude: '121.1' });
    expect(shopPrefill(imported).businessName).toBe('Ramon’s Barber');
  });

  it.each([
    { latitude: NaN, longitude: 121.1 },
    { latitude: 14.65, longitude: Infinity },
    { latitude: 91, longitude: 121.1 },
    { latitude: 14.65, longitude: -181 },
  ])('does not prefill an invalid shop point (%j)', (coordinate) => {
    const shop = { ...normalizeCommunityFind(find(), area)!, ...coordinate };
    expect(shopPrefill(shop)).not.toHaveProperty('latitude');
    expect(shopPrefill(shop)).not.toHaveProperty('longitude');
  });

  it('retains a valid zero coordinate pair when opening capture', () => {
    const shop = { ...normalizeCommunityFind(find(), area)!, latitude: 0, longitude: 0 };
    expect(shopPrefill(shop)).toMatchObject({ latitude: '0', longitude: '0' });
  });
});
