import { getShopPlaceholder, shopPlaceholderKind } from '../services/shopPlaceholder';

jest.mock('../assets/placeholders/barber.png', () => ({ uri: 'placeholder:barber' }));
jest.mock('../assets/placeholders/food.png', () => ({ uri: 'placeholder:food' }));
jest.mock('../assets/placeholders/sari-sari.png', () => ({ uri: 'placeholder:sari_sari' }));
jest.mock('../assets/placeholders/beauty.png', () => ({ uri: 'placeholder:beauty' }));
jest.mock('../assets/placeholders/repair.png', () => ({ uri: 'placeholder:repair' }));
jest.mock('../assets/placeholders/shop.png', () => ({ uri: 'placeholder:other' }));

it.each([
  ['Barbershop', 'beauty', 'barber'],
  ['BARBER SHOP', 'other', 'barber'],
  ['Barber/Salon', undefined, 'barber'],
  ['Hair salon', undefined, 'beauty'],
  ['Nail Salon', 'other', 'beauty'],
  ['Spa/Massage', undefined, 'beauty'],
  ['Food shop', 'other', 'food'],
  ['Restaurant', 'beauty', 'food'],
  ['Café', undefined, 'food'],
  ['Coffee shop', undefined, 'food'],
  ['Bakery', undefined, 'food'],
  ['Bakeshop', undefined, 'food'],
  ['Carinderia', undefined, 'food'],
  ['Sari-sari store', undefined, 'sari_sari'],
  ['sari_sari', undefined, 'sari_sari'],
  ['Grocery', undefined, 'sari_sari'],
  ['Convenience store', undefined, 'sari_sari'],
  ['Mini mart', undefined, 'sari_sari'],
  ['Auto Shop', undefined, 'repair'],
  ['Auto repair', undefined, 'repair'],
  ['Car wash', undefined, 'repair'],
  ['Vulcanizing shop', undefined, 'repair'],
  ['Other', 'beauty', 'other'],
  ['Unclassified', 'food', 'food'],
  [null, 'sari_sari', 'sari_sari'],
  ['', 'beauty', 'beauty'],
  [undefined, 'repair', 'repair'],
  ['Unknown category', undefined, 'other'],
  [undefined, undefined, 'other'],
])('selects %s with fallback %s as %s', (category, kind, expected) => {
  expect(shopPlaceholderKind(category, kind)).toBe(expected);
  expect(getShopPlaceholder(category, kind)).toEqual({ uri: `placeholder:${expected}` });
});
