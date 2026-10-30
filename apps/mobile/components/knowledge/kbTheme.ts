/**
 * Knowledge Base visual mappings — bridges the web KB's `hue` + `icon` string
 * fields onto the design v2 neutral palette (Ionicons, soft tints, ink glyphs).
 */
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/v2';

type Hue = { bg: string; ink: string };

// Web hues (clay|sage|indigo|slate|amber|plum) -> soft v2 tints with an ink glyph.
// Hue names stay as the backend sends them; only the colours are neutral now.
const HUES: Record<string, Hue> = {
  clay: { bg: colors.warnBg, ink: colors.ink },
  sage: { bg: colors.accentSoft, ink: colors.ink },
  indigo: { bg: colors.infoBg, ink: colors.ink },
  slate: { bg: colors.bg2, ink: colors.ink },
  amber: { bg: colors.accentSoft, ink: colors.ink },
  plum: { bg: colors.bg2, ink: colors.ink },
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
