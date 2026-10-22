/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Editorial Paper palette (NEO LAB inspired) — see theme/tokens.ts
        paper: {
          DEFAULT: '#F8F5EE',
          2: '#EFEBE0',
          3: '#FCFAF5',
        },
        ink: {
          DEFAULT: '#1B1C24',
          2: '#3C3F4A',
          3: '#7A7E8A',
        },
        accent: {
          DEFAULT: '#C89548',
          ink: '#5C3A0F',
          bg: '#F5E4C0',
          solid: '#E4B05E',
        },
        business: {
          DEFAULT: '#1F3654',
          ink: '#11203A',
          bg: '#E4E9F0',
        },
        live: {
          DEFAULT: '#D9A84E',
          soft: '#F5E8CC',
        },
        rule: {
          DEFAULT: '#E0D8C9',
          strong: '#B7AC95',
        },
        warn: {
          DEFAULT: '#C68A12',
          bg: '#FBE9C4',
        },
        danger: {
          DEFAULT: '#B43A1F',
          bg: '#F3D7CF',
        },
        // Tendso rebrand (2026-06): emerald-N class names KEPT for backwards
        // compat (so existing `bg-emerald-500` doesn't break), but the values
        // resolve to the warm gold / burnt amber palette. Per the rebrand spec,
        // emerald-N usages can be renamed to amber-N as a cosmetic cleanup
        // follow-up — zero visual impact since values already match.
        emerald: {
          50:  '#FBF3E0',
          100: '#F5E4C0',
          200: '#EFD4A0',
          300: '#F2D8A0',
          400: '#E8C078',
          500: '#E4B05E',
          600: '#C89548',
          700: '#C89548',
          800: '#6B4A12',
          900: '#5C3A0F',
        },
        // ── Tendso design v2 (see theme/v2.ts — keep in sync; __tests__/v2-tokens.test.ts checks parity).
        // Namespaced under `v2` so the legacy Editorial Paper keys above keep working.
        // Accent = FILL only (`bg-v2-accent text-v2-on-accent`); never `text-v2-accent` on a light surface.
        v2: {
          accent: '#E4F222',
          'on-accent': '#0C0A08',
          'accent-soft': '#F6F9C4',
          bg: '#F6F6F3',
          bg2: '#EFEFEA',
          card: '#FFFFFF',
          dark: '#121210',
          camera: '#0C0A08',
          ink: '#0C0A08',
          ink2: '#45443F',
          ink3: '#8A8982',
          'ink3-text': '#6B6A63',
          rule: '#ECECE6',
          'rule-strong': '#C4C3BB',
          info: '#1F3654',
          'info-bg': '#E7ECF3',
          warn: '#A8650E',
          'warn-bg': '#FBEED5',
          danger: '#C2341B',
          'danger-bg': '#F6DCD5',
          rec: '#FF3B30',
        },
        zinc: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
        },
      },
      fontFamily: {
        serif:      ['InstrumentSerif_400Regular'],
        serifIt:    ['InstrumentSerif_400Regular_Italic'],
        sans:       ['Onest_400Regular'],
        sansMed:    ['Onest_500Medium'],
        sansBold:   ['Onest_700Bold'],
        mono:       ['JetBrainsMono_400Regular'],
        monoMed:    ['JetBrainsMono_500Medium'],
        // Tendso v2: Onest, one family per weight (RN can't synthesise weights — never use font-bold with these).
        'onest-regular':   ['Onest_400Regular'],
        'onest-medium':    ['Onest_500Medium'],
        'onest-semibold':  ['Onest_600SemiBold'],
        'onest-bold':      ['Onest_700Bold'],
        'onest-extrabold': ['Onest_800ExtraBold'],
      },
      // Tendso v2 type scale — nothing under 16px (Rule #1). Mirrors theme/v2.ts `type`.
      fontSize: {
        'v2-hero':     ['40px', { lineHeight: '42px', letterSpacing: '-1.4px' }],
        'v2-display':  ['32px', { lineHeight: '36px', letterSpacing: '-0.9px' }],
        'v2-title':    ['28px', { lineHeight: '32px', letterSpacing: '-0.7px' }],
        'v2-heading':  ['22px', { lineHeight: '28px', letterSpacing: '-0.4px' }],
        'v2-body-lg':  ['18px', { lineHeight: '26px', letterSpacing: '-0.1px' }],
        'v2-body':     ['17px', { lineHeight: '24px', letterSpacing: '-0.1px' }],
        'v2-button':   ['18px', { lineHeight: '22px', letterSpacing: '-0.1px' }],
        'v2-label':    ['16px', { lineHeight: '20px' }],
        'v2-number':   ['56px', { lineHeight: '58px', letterSpacing: '-2.2px' }],
        'v2-number-lg': ['72px', { lineHeight: '72px', letterSpacing: '-3px' }],
      },
      spacing: {
        'v2-gutter': '24px',
        'v2-hit': '56px',
      },
      minHeight: {
        'v2-hit': '56px',
      },
      boxShadow: {
        'v2-soft': '0 8px 24px rgba(12,10,8,0.06)',
        'v2-object': '0 12px 30px -8px rgba(12,10,8,0.18)',
      },
      transitionDuration: {
        'v2-ui': '220ms',
        'v2-reveal': '620ms',
        'v2-settle': '900ms',
      },
      transitionTimingFunction: {
        'v2-out': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'v2-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'v2-in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
      },
      borderRadius: {
        // Tendso v2 radii (theme/v2.ts `radius`)
        'v2-field':   '16px',
        'v2-card':    '20px',
        'v2-card-lg': '24px',
        'v2-tile':    '28px',
        xs:   '8px',
        sm:   '12px',
        md:   '18px',
        lg:   '24px',
        xl:   '32px',
        pill: '999px',
      },
    },
  },
  plugins: [],
};
