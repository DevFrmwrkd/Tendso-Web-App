import { isInViewport, mergeMapShops, viewportBounds, type MapProspect } from '../services/fieldAgentMap';

const origin = { latitude: 14.65, longitude: 121.1, source: 'device' as const, label: 'you' };
const region = { ...origin, latitudeDelta: 0.04, longitudeDelta: 0.06 };

it('derives visible bounds independently of the saved distance origin and includes every edge', () => {
  const bounds = viewportBounds(region)!;
  expect(bounds.south).toBeCloseTo(14.63);
  expect(bounds.north).toBeCloseTo(14.67);
  expect(bounds.west).toBeCloseTo(121.07);
  expect(bounds.east).toBeCloseTo(121.13);
  for (const coordinate of [
    { latitude: bounds.south, longitude: 121.1 }, { latitude: bounds.north, longitude: 121.1 },
    { latitude: 14.65, longitude: bounds.west }, { latitude: 14.65, longitude: bounds.east },
  ]) expect(isInViewport(coordinate, bounds)).toBe(true);
  expect(isInViewport({ latitude: 14.670001, longitude: 121.1 }, bounds)).toBe(false);
  expect(isInViewport({ latitude: 14.65, longitude: 121.130001 }, bounds)).toBe(false);
});

it('handles a viewport crossing the dateline and both representations of its boundary', () => {
  const crossing = viewportBounds({ latitude: 10, longitude: 179, latitudeDelta: 2, longitudeDelta: 4 })!;
  expect(crossing.west).toBe(177);
  expect(crossing.east).toBe(-179);
  expect(isInViewport({ latitude: 10, longitude: 179.9 }, crossing)).toBe(true);
  expect(isInViewport({ latitude: 10, longitude: -179.9 }, crossing)).toBe(true);
  expect(isInViewport({ latitude: 10, longitude: 0 }, crossing)).toBe(false);
  const edge = viewportBounds({ latitude: 0, longitude: -170, latitudeDelta: 2, longitudeDelta: 20 })!;
  expect(isInViewport({ latitude: 0, longitude: 180 }, edge)).toBe(true);
  expect(isInViewport({ latitude: 0, longitude: -180 }, edge)).toBe(true);
});

it('clamps polar bounds and represents whole-world longitude without a zero-width search', () => {
  const world = viewportBounds({ latitude: 0, longitude: 100, latitudeDelta: 180, longitudeDelta: 720 })!;
  expect(world).toEqual({ south: -90, north: 90, west: -180, east: 180 });
  expect(isInViewport({ latitude: 89.9, longitude: -179.9 }, world)).toBe(true);
  expect(isInViewport({ latitude: -89.9, longitude: 180 }, world)).toBe(true);
  const polar = viewportBounds({ latitude: 89, longitude: 0, latitudeDelta: 10, longitudeDelta: 20 })!;
  expect(polar.north).toBe(90);
  expect(polar.south).toBe(84);
});

it.each([
  { latitude: NaN }, { latitude: 91 }, { longitude: -181 }, { latitudeDelta: 0 },
  { latitudeDelta: -1 }, { longitudeDelta: Infinity }, { longitudeDelta: -1 },
])('rejects a transient invalid region %s instead of issuing a search', (patch) => {
  expect(viewportBounds({ ...region, ...patch })).toBeNull();
});

it('shows farther known shops when zoomed out while keeping distances measured from the user', () => {
  const pool: MapProspect[] = [
    { _id: 'near', businessName: 'Near shop', latitude: 14.651, longitude: 121.1 },
    { _id: 'far', businessName: 'Far shop', latitude: 14.85, longitude: 121.1 },
  ];
  expect(mergeMapShops(pool, [], [], origin).map(shop => shop.id)).toEqual(['near']);
  const all = mergeMapShops(pool, [], [], origin, null);
  expect(all.map(shop => shop.id)).toEqual(['near', 'far']);
  expect(all[1].distanceKm).toBeGreaterThan(20);
  expect(all[1].distanceLabel).toMatch(/km away$/);
  const close = viewportBounds(region)!;
  const wide = viewportBounds({ ...region, latitudeDelta: 0.6, longitudeDelta: 0.6 })!;
  expect(all.filter(shop => isInViewport(shop, close)).map(shop => shop.id)).toEqual(['near']);
  expect(all.filter(shop => isInViewport(shop, wide)).map(shop => shop.id)).toEqual(['near', 'far']);
  expect(mergeMapShops(pool, [], [], null, null)[1].distanceLabel).toBe('Distance unavailable');
});
