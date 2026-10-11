/**
 * Editorial Paper — design tokens for the mobile UI redesign (NEO LAB inspired).
 *
 * Voice: editorial / cinematic / paper-magazine. Not SaaS.
 * Typography: Instrument Serif (display) + Onest (sans) + JetBrains Mono (labels).
 * Palette:    warm paper · ink near-black · burnt amber accent · ink-blue · gold live.
 *
 * Tendso rebrand (2026-06): full-gold model. Emerald accents fully retired —
 * including status "converted/paid/approved" pills and the live dot. Web's
 * --ed-* design tokens map 1:1 to these; see TENDSO-REBRANDING.md §2 for the
 * source-of-truth hex mapping.
 */

export const colors = {
  // Paper (backgrounds) — unchanged by the rebrand
  paper:    '#F8F5EE',   // warm off-white — default screen bg
  paper2:   '#EFEBE0',   // slightly cooler card bg
  paper3:   '#FCFAF5',   // near-pure for popouts / inputs

  // Ink (text + dark surfaces) — unchanged by the rebrand
  ink:      '#1B1C24',   // near-black, cool — headings, primary actions
  ink2:     '#3C3F4A',   // body emphasis
  ink3:     '#7A7E8A',   // muted secondary text

  // Accent — warm gold / burnt amber (Tendso rebrand)
  accent:       '#C89548', // burnt amber — italic display emphasis (was emerald-700)
  accentInk:    '#5C3A0F', // dark amber ink — accessible text on accentBg (was emerald-900)
  accentBg:     '#F5E4C0', // pale gold-cream — soft tints, badges (was emerald-100)
  accentSolid:  '#E4B05E', // warm gold — primary "door" fills (was emerald-500)

  // Business (system / CRM accent) — unchanged blue family
  business:    '#1F3654',
  businessBg:  '#E4E9F0',
  businessInk: '#11203A',

  // Live (real-time markers) — now gold per the full-gold rebrand
  live:        '#D9A84E', // pulsing live dot — deep gold (was emerald)
  liveSoft:    '#F5E8CC', // live soft bg — pale gold-cream

  // Rules / dividers — unchanged
  rule:        '#E0D8C9',  // soft warm divider
  ruleStrong:  '#B7AC95',  // emphasized divider

  // Status colors (CRM lead pipeline + submission states)
  warn:        '#C68A12',  // muted amber for "in review" — unchanged (was never green)
  warnBg:      '#FBE9C4',
  danger:      '#B43A1F',  // earthy red — destructive — unchanged
  dangerBg:    '#F3D7CF',
} as const;

export const fonts = {
  serif:      'InstrumentSerif_400Regular',
  serifIt:    'InstrumentSerif_400Regular_Italic',
  sans:       'Onest_400Regular',
  sansMed:    'Onest_500Medium',
  sansBold:   'Onest_700Bold',
  mono:       'JetBrainsMono_400Regular',
  monoMed:    'JetBrainsMono_500Medium',
  // Tendso brand wordmark (Google Sans Flex). Use ONLY on the literal "Tendso"
  // brand mark in certificate banners, footer brand lines, etc. Body copy and
  // editorial display remain Onest / Instrument Serif respectively.
  wordmark:    'GoogleSansFlex_700Bold',
  wordmarkMed: 'GoogleSansFlex_500Medium',
} as const;

export const space = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  40,
  '2xl': 64,
} as const;

export const radius = {
  xs:   8,
  sm:   12,
  md:   18,   // default card radius
  lg:   24,
  xl:   32,   // hero blocks
  pill: 999,
} as const;

export const shadow = {
  // Subtle, warm — not material drop-shadow
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  lifted: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
} as const;

// Common letter-spacing values for mono labels (in pixels at typical font sizes)
export const tracking = {
  label: 1.4,      // mono uppercase labels
  eyebrow: 2.0,    // emphatic eyebrow text
  tight: -0.6,     // serif display tightening
} as const;

export type Colors = typeof colors;
export type Fonts = typeof fonts;
export type Space = typeof space;
export type Radius = typeof radius;
