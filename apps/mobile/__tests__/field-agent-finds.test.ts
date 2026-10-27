import {
  currentMonthEarnings,
  fieldAgentWorkspaceRedirect,
  filterCommunityFinds,
  findWebsiteLabel,
} from '../services/fieldAgentFinds';
import type { CommunityFind } from '../services/fieldAgentMap';
import type { MapSearchArea } from '../services/workArea';

const area: MapSearchArea = { latitude: 14.65, longitude: 121.10, source: 'device', label: 'you' };
const agent = { role: 'creator', firstName: 'Pablo', lastName: 'Santos' };
const date = (value: string) => new Date(value).getTime();
const find = (_id: string, fields: Partial<CommunityFind> = {}): CommunityFind => ({ _id, businessName: _id, ...fields });

describe('fieldAgentWorkspaceRedirect', () => {
  it.each([
    ['affiliate', '/(app)/(affiliate-tabs)/'], ['admin', '/(app)/admin'],
    ['staff', '/(app)/account-unavailable'], ['business_owner', '/(app)/account-unavailable'], ['', '/(app)/account-unavailable'],
  ])('keeps the %s role outside the field-agent workspace', (role, destination) => {
    expect(fieldAgentWorkspaceRedirect({ ...agent, role, certifiedAt: 100 })).toBe(destination);
  });

  it('requires a usable name even when other progress exists', () => {
    expect(fieldAgentWorkspaceRedirect({ ...agent, firstName: '  ', lastName: '', certifiedAt: 100 })).toBe('/(app)/complete-profile');
  });

  it('returns a rejected profile to corrections without forgetting the saved quiz pass', () => {
    expect(fieldAgentWorkspaceRedirect({ ...agent, rejectedAt: 200, quizPassedAt: 100 })).toBe('/(app)/verification-rejected');
    // Existing approval screens also honor certification first; stale legacy
    // rejection metadata must not create a Map/rejection redirect loop.
    expect(fieldAgentWorkspaceRedirect({ ...agent, rejectedAt: 200, certifiedAt: 100 })).toBeNull();
  });

  it('distinguishes training, pending review and an approved field agent', () => {
    expect(fieldAgentWorkspaceRedirect(agent)).toBe('/(app)/training');
    expect(fieldAgentWorkspaceRedirect({ ...agent, quizPassedAt: 100 })).toBe('/(app)/pending-review');
    expect(fieldAgentWorkspaceRedirect({ ...agent, certifiedAt: 200 })).toBeNull();
  });

  it('keeps approved legacy field-agent rows without an explicit role working', () => {
    expect(fieldAgentWorkspaceRedirect({ lastName: 'Santos', certifiedAt: 100 })).toBeNull();
  });
});

describe('currentMonthEarnings', () => {
  const now = date('2026-10-15T04:00:00Z');

  it('counts available and withdrawn earnings while excluding pending, unknown and other-month rows', () => {
    expect(currentMonthEarnings([
      { amount: 150, status: 'available', createdAt: now },
      { amount: 75, status: 'withdrawn', createdAt: now },
      { amount: 9_000, status: 'pending', createdAt: now },
      { amount: 8_000, status: 'cancelled', createdAt: now },
      { amount: 7_000, createdAt: now },
      { amount: 6_000, status: 'available', createdAt: date('2026-09-15T04:00:00Z') },
      { amount: 5_000, status: 'withdrawn', createdAt: date('2025-10-15T04:00:00Z') },
    ], now)).toBe(225);
  });

  it('uses the Philippine calendar at both ends of a month rather than the UTC date', () => {
    const octoberStart = date('2026-09-30T16:05:00Z'); // 00:05 on October 1 in Manila.
    expect(currentMonthEarnings([
      { amount: 10, status: 'available', createdAt: date('2026-09-30T15:59:59.999Z') },
      { amount: 20, status: 'available', createdAt: date('2026-09-30T16:00:00Z') },
      { amount: 30, status: 'withdrawn', createdAt: date('2026-10-31T15:59:59.999Z') },
      { amount: 40, status: 'available', createdAt: date('2026-10-31T16:00:00Z') },
    ], octoberStart)).toBe(50);
  });

  it('falls back to creation time only when createdAt is absent and ignores malformed amounts or dates', () => {
    expect(currentMonthEarnings([
      { amount: 25, status: 'available', _creationTime: now },
      { amount: 100, status: 'available', createdAt: date('2026-09-10T00:00:00Z'), _creationTime: now },
      { amount: NaN, status: 'available', createdAt: now },
      { amount: Infinity, status: 'available', createdAt: now },
      { amount: 1_000, status: 'available', createdAt: NaN },
      { amount: 1_000, status: 'withdrawn', createdAt: Infinity },
      { amount: 1_000, status: 'available' },
    ], now)).toBe(25);
    expect(currentMonthEarnings([], now)).toBe(0);
  });
});

describe('filterCommunityFinds', () => {
  it('preserves address-only legacy finds in All and sorts by the actual spotting or creation time', () => {
    const rows = [
      find('old', { createdAt: 10 }),
      find('address-only', { businessAddress: '12 Rizal Street', businessCity: 'Marikina', createdAt: 50 }),
      find('spotted-later', { createdAt: 1, spottedAt: 100 }),
      find('undated'),
    ];
    expect(filterCommunityFinds(rows, 'all', '', null).map((row) => row._id)).toEqual(['spotted-later', 'address-only', 'old', 'undated']);
    expect(rows.map((row) => row._id)).toEqual(['old', 'address-only', 'spotted-later', 'undated']);
  });

  it('requires real coordinates for Near me, limits the radius and orders by distance', () => {
    const rows = [
      find('one-km', { businessLatitude: 14.66, businessLongitude: 121.10 }),
      find('address-only', { businessAddress: 'Next door' }),
      find('outside-radius', { businessLatitude: 14.75, businessLongitude: 121.10 }),
      find('invalid', { businessLatitude: 91, businessLongitude: 121.10 }),
      find('partial', { businessLatitude: 14.65, businessLongitude: null }),
      find('not-finite', { businessLatitude: NaN, businessLongitude: 121.10 }),
      find('hundred-metres', { businessLatitude: 14.651, businessLongitude: 121.10 }),
    ];
    expect(filterCommunityFinds(rows, 'near', '', area).map((row) => row._id)).toEqual(['hundred-metres', 'one-km']);
    expect(filterCommunityFinds(rows, 'near', '', null)).toEqual([]);
  });

  it('includes only a confirmed need for a website and lets a verified live website override that need', () => {
    const rows = [
      find('confirmed-need', { needsWebsite: true }),
      find('already-has-site', { needsWebsite: false }),
      find('unknown', { needsWebsite: null }),
      find('legacy-unknown'),
      find('now-live', { needsWebsite: true, hasLiveWebsite: true }),
    ];
    expect(filterCommunityFinds(rows, 'needs', '', null).map((row) => row._id)).toEqual(['confirmed-need']);
  });

  it('uses the saved community category and falls back to legacy business-type categories', () => {
    const rows = [
      find('saved-food', { communityKind: 'food', businessType: 'Auto Shop' }),
      find('legacy-food', { businessType: 'Bakery' }),
      find('saved-repair', { communityKind: 'repair', businessType: 'Restaurant' }),
      find('legacy-repair', { businessType: 'Vulcanizing Shop' }),
      find('unknown'),
    ];
    expect(filterCommunityFinds(rows, 'food', '', null).map((row) => row._id)).toEqual(['saved-food', 'legacy-food']);
    expect(filterCommunityFinds(rows, 'repair', '', null).map((row) => row._id)).toEqual(['saved-repair', 'legacy-repair']);
    expect(filterCommunityFinds(rows, 'other', '', null).map((row) => row._id)).toEqual(['unknown']);
  });

  it.each([
    ['nena', 'name'], ['RIZAL', 'address'], [' marikina ', 'city'], ['ana s.', 'spotter'], ['ben t.', 'legacy-submitter'],
  ])('searches %s across real shop and attribution fields', (search, expected) => {
    const rows = [
      find('name', { businessName: 'Nena Store' }),
      find('address', { businessAddress: '12 Rizal Street' }),
      find('city', { businessCity: 'Marikina' }),
      find('spotter', { spottedBy: { creatorId: 'ana', displayName: 'Ana S.', profileImage: null } }),
      find('legacy-submitter', { submittedBy: { creatorId: 'ben', displayName: 'Ben T.', profileImage: null } }),
      find('unrelated', { businessName: null, businessAddress: null, businessCity: null }),
    ];
    expect(filterCommunityFinds(rows, 'all', search, null).map((row) => row._id)).toEqual([expected]);
  });

  it('combines search with the selected category instead of searching outside its results', () => {
    const rows = [
      find('matching', { businessName: 'Nena Cafe', communityKind: 'food' }),
      find('wrong-category', { businessName: 'Nena Salon', communityKind: 'beauty' }),
      find('wrong-name', { businessName: 'Ramon Cafe', communityKind: 'food' }),
    ];
    expect(filterCommunityFinds(rows, 'food', 'nena', null).map((row) => row._id)).toEqual(['matching']);
  });
});

describe('findWebsiteLabel', () => {
  it('describes confirmed need, an existing website and unknown data distinctly', () => {
    expect(findWebsiteLabel(find('needs', { needsWebsite: true }))).toBe('Needs a site');
    expect(findWebsiteLabel(find('existing', { needsWebsite: false }))).toBe('Has a website');
    expect(findWebsiteLabel(find('unknown', { needsWebsite: null }))).toBe('Check for a website');
    expect(findWebsiteLabel(find('legacy'))).toBe('Check for a website');
    expect(findWebsiteLabel(find('live', { needsWebsite: true, hasLiveWebsite: true }))).toBe('Live');
  });
});
