/**
 * Tendso design v2 — tokens for the Expo app.
 *
 * Source of truth: docs/landing-mock (css/tokens.css, css/app-kit.css "kit v3",
 * css/screens.css, HANDOFF.md, APP-SYSTEM.md v3/v4). Onest only, no serif, no
 * italics, no mono. ONE accent (#E4F222) used as a FILL with ink text on it —
 * never as text or lines on a light background (1.2:1).
 *
 * Rule #1 (never overwhelm): nothing under 16px. The `type` scale below has no
 * entry smaller than 16, and a test (__tests__/v2-tokens.test.ts) enforces it.
 *
 * Keep apps/mobile/tailwind.config.js (`v2` keys) in sync — the same test checks parity.
 */

export const colors = {
  // Accent: fill only. Ink text on it (16:1).
  accent: '#E4F222',
  onAccent: '#0C0A08',
  // accent @ 24% over white (mock: color-mix(in oklab, accent 24%, white)) — selected / success tint.
  accentSoft: '#F6F9C4',

  // Surfaces
  bg: '#F6F6F3', // screen background (flat fallback under the gradient)
  bg2: '#EFEFEA', // tints, icon circles, ghost button fill, progress track
  card: '#FFFFFF',
  dark: '#121210', // the one dark surface (welcome, recording panels)
  camera: '#0C0A08', // dark camera / welcome screen background

  // Ink
  ink: '#0C0A08',
  ink2: '#45443F', // body
  ink3: '#8A8982', // icons, placeholders, disabled. NOT for small text (3.2:1 on bg).
  ink3Text: '#6B6A63', // muted text that must stay readable (≈5:1 on bg / card)

  // Lines
  rule: '#ECECE6',
  ruleStrong: '#C4C3BB',

  // Status (unchanged hues from the mock)
  info: '#1F3654',
  infoBg: '#E7ECF3',
  warn: '#A8650E',
  warnBg: '#FBEED5',
  danger: '#C2341B',
  dangerBg: '#F6DCD5',
  // Record dot on dark camera screens
  rec: '#FF3B30',

  // Overlays on camera / dark panels
  onDark: '#FFFFFF',
  onDarkMuted: 'rgba(255,255,255,0.28)', // inactive progress segment on camera
  scrim: 'rgba(12,10,8,0.5)',
} as const;

/**
 * Tinted screen background ("a faint lime wash at the top fading to warm
 * off-white", mock `--a-grad`: 172deg, 0 / 34 / 64 / 100%). Drawn with
 * react-native-svg in ScreenShell (no expo-linear-gradient dependency).
 */
export const backgroundGradient = {
  colors: ['#EFF6C6', '#F7F8EE', '#F5F5F0', '#EEF0EC'] as const,
  locations: [0, 0.34, 0.64, 1] as const,
  // 172deg ≈ top→bottom with a slight lean to the right; as SVG unit vector.
  start: { x: 0.43, y: 0 },
  end: { x: 0.57, y: 1 },
} as const;

/**
 * Onest, one family file per weight. React Native cannot synthesise weights for
 * custom fonts, so ALWAYS set `fontFamily` from here and never `fontWeight`.
 * Weights match what the mock loads (Google Fonts: Onest 400;500;600;700;800).
 */
export const fonts = {
  regular: 'Onest_400Regular',
  medium: 'Onest_500Medium',
  semibold: 'Onest_600SemiBold',
  bold: 'Onest_700Bold',
  extrabold: 'Onest_800ExtraBold',
} as const;

export type FontWeightKey = keyof typeof fonts;

export interface TypeStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
}

/**
 * Type scale. Sizes follow APP-SYSTEM v4: headline 28–32 bold, body 17–18,
 * everything >= 16. letterSpacing is in px (RN), derived from the mock's
 * −0.04em display tracking (30px → −0.8 … 32px → −0.9).
 */
export const type = {
  hero: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 42, letterSpacing: -1.4 },
  display: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 36, letterSpacing: -0.9 },
  title: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 32, letterSpacing: -0.7 },
  heading: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  bodyLg: { fontFamily: fonts.medium, fontSize: 18, lineHeight: 26, letterSpacing: -0.1 },
  body: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 24, letterSpacing: -0.1 },
  button: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 22, letterSpacing: -0.1 },
  label: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20, letterSpacing: 0 },
  chip: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20, letterSpacing: 0 },
  number: { fontFamily: fonts.extrabold, fontSize: 56, lineHeight: 58, letterSpacing: -2.2 },
  numberLg: { fontFamily: fonts.extrabold, fontSize: 72, lineHeight: 72, letterSpacing: -3 },
} as const satisfies Record<string, TypeStyle>;

export type TypeVariant = keyof typeof type;

/** Hard floor from Rule #1. */
export const MIN_FONT_SIZE = 16;

export const radius = {
  field: 16, // inputs
  card: 20, // default card (mock: 20)
  cardLg: 24,
  tile: 28, // mobile tile radius (mock: 28 under 760px)
  tick: 14,
  pill: 999,
} as const;

/** 4-pt scale. `gutter` is the screen side padding (mock `.app-pad`: 24). */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  huge: 48,
  gutter: 24,
} as const;

/** Hit targets. Primary actions are >= 56pt (Rule #1 / task spec). */
export const hit = {
  min: 48,
  primary: 56,
  large: 60,
  icon: 48,
} as const;

/**
 * Shadows, translated from CSS (blur → RN shadowRadius ≈ blur / 2, 0 spread).
 * soft = `--a-shadow: 0 8px 24px rgba(12,10,8,.06)` (cards, options, back button).
 * object = `--shadow-object` (floating phones / hero objects), the key layer only.
 */
export const shadow = {
  soft: {
    shadowColor: '#0C0A08',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  press: {
    shadowColor: '#0C0A08',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  object: {
    shadowColor: '#0C0A08',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 15,
    elevation: 8,
  },
} as const;

/**
 * Motion. "Physical, calm, ends slow. No bounce, no overshoot."
 * ease* are cubic-bezier control points for `Easing.bezier(...ease.out)`.
 */
export const duration = {
  ui: 220, // hover / press: 160–280
  reveal: 620, // opacity / blur of reveals: 420–620
  settle: 900, // bigger object moves
  progress: 600, // progress bar width (a-progress transition)
  segment: 400, // 10-step segment colour change
} as const;

export const ease = {
  out: [0.22, 1, 0.36, 1],
  expo: [0.16, 1, 0.3, 1],
  inOut: [0.77, 0, 0.175, 1],
} as const;

export const theme = { colors, backgroundGradient, fonts, type, radius, space, hit, shadow, duration, ease };
export type Theme = typeof theme;
