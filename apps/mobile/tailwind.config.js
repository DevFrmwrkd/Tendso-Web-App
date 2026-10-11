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
      },
      borderRadius: {
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
