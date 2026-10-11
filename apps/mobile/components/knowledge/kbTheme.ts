/**
 * Knowledge Base visual mappings — bridges the web KB's `hue` + `icon` string
 * fields onto the mobile editorial-paper design system (Ionicons + warm palette).
 */
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/tokens';

type Hue = { bg: string; ink: string };

// Web hues (clay|sage|indigo|slate|amber|plum) → warm-paper tints.
const HUES: Record<string, Hue> = {
  clay: { bg: '#F0E0D6', ink: '#8A4B2F' },
  sage: { bg: '#E3EADF', ink: '#4A5D42' },
  indigo: { bg: '#E2E4F1', ink: '#3B3E70' },
  slate: { bg: '#E4E7ED', ink: '#3C4654' },
  amber: { bg: colors.accentBg, ink: colors.accentInk },
  plum: { bg: '#ECE0EC', ink: '#6D3A6A' },
};

export function hue(name: string | undefined): Hue {
  return (name && HUES[name]) || HUES.amber;
}

// Web category icon-names → Ionicons glyphs.
const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  rocket: 'rocket-outline',
  card: 'card-outline',
  book: 'book-outline',
  book2: 'book-outline',
  globe: 'globe-outline',
  shield: 'shield-checkmark-outline',
  chart: 'stats-chart-outline',
  wrench: 'construct-outline',
  plug: 'link-outline',
  people: 'people-outline',
  palette: 'color-palette-outline',
  key: 'key-outline',
  star: 'star-outline',
  doc: 'document-text-outline',
  list: 'list-outline',
};

export function categoryIcon(name: string | undefined): keyof typeof Ionicons.glyphMap {
  return (name && ICONS[name]) || 'document-text-outline';
}
