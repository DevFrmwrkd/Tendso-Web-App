# Tendso landing mock — build brief (house rules)

Every agent working on this mock reads this file first. It is also the starting point for the
build agent that will turn the mock into production code later.

## What we are making
A high-fidelity, motion-prototyped DESIGN MOCK of the new Tendso landing page, desktop and mobile.
Plain HTML/CSS/JS, opened as `docs/landing-mock/index.html`. Not production code.

Tendso is a MOBILE APP FIRST. Local businesses anywhere (barbers, cafés, salons, mechanics, florists,
bakeries…) get a finished website: the owner talks into the app (voice → transcript → site copy),
adds photos (made professional), and the site is designed and hosted. A local field agent can also
visit and do it for them in about 30 minutes, with the same app. The owner sees the site live before
paying, pays once (Philippines ₱4,999; local currency elsewhere), free subdomain, custom domain extra.
Goal of the page: UNDERSTANDING, then pick a path (Download the app · Hire someone · Join our team).

Reference: ramp.design (study memo: https://claude.ai/artifact/CVgk9ZHx7iGxZbJcvZPw59).

## Non-negotiables
- Phones with REAL Tendso app screens are the dominant visual. Never invent app UI. Screens that do
  not exist in `apps/mobile` yet are drawn in the app's own design system and marked
  `data-proposed="true"` (see APP-SCREENS-SPEC.md).
- Never show creator-pay wording (earnings, "you earn", "pays more", wallet, price slider).
- Almost no paragraphs. One accent: `var(--accent)` only. Never yellow text on white.
- Nothing AI-looking: no sparkles, emoji, gradients-as-decoration, glows, glassmorphism, template SaaS.
- Filipino people first in photography; worldwide as a light touch.
- Motion: physical, calm, expensive. Ends slow. No bounce, no overshoot. Blur-in reveals.
- Respect `prefers-reduced-motion` (no scroll-scrubbed transforms, no loops; show end states).

## Files and ownership (one owner per file; never edit a file you don't own)
```
index.html            lead     page shell; each section is a mount point
css/tokens.css        lead     ALL design tokens. Read-only for everyone else.
css/base.css          lead     reset, type, nav, buttons, tiles, reveal classes
css/phone.css         lead     phone frame
js/core.js            lead     motion helpers (window.T) — read-only for others
js/hero.js            lead     hero stage + collapse into the grid
js/tiles.js, css/tiles.css   lead   the four tiles
js/steps.js, css/steps.css   lead   pinned 5-step slider
css/screens.css, js/screens.js     agent A   app screens (window.TendsoScreens)
css/people.css, js/people.js       agent B   people cloud
css/work.css, js/work.js           agent B   case-study overlay (Work)
css/paths.css, js/paths.js         agent B   the three paths incl. hire form
assets/                lead     add files only in your own subfolder if needed
```
Each section JS renders itself into its mount point in index.html (`<section id="people" data-mount>`),
so nobody needs to edit index.html.

## Tokens (css/tokens.css)
Use the custom properties. Do not hard-code colours, radii, easings or durations except inside app
screens (which use the APP's tokens, see APP-SCREENS-SPEC.md).
Fonts loaded in index.html: Onest (400/500/600), JetBrains Mono (400/500), Instrument Serif (400, 400 italic).

## window.T (js/core.js)
```
T.reduced                    boolean, prefers-reduced-motion
T.clamp(v,a,b) T.lerp(a,b,t) T.prog(v,a,b) → 0..1   T.mapRange(v,a,b,c,d)
T.ease.out(t) T.ease.expo(t) T.ease.inout(t)        same curves as the CSS tokens
T.onFrame(fn(time, dt))      one shared rAF loop (time in ms)
T.onScroll(fn(scrollY))      fires on every smooth-scroll update
T.scrollY                    current smoothed scroll position
T.progress(el, a=1, b=0)     scroll-linked 0..1: 0 when el's top is at a×viewport height,
                             1 when it is at b×viewport height
T.inView(el, fn(isIn))       IntersectionObserver helper
T.fitPhones(root)            sizes every .phone's screen to its frame (call after creating phones)
T.phone({ size:'md', theme:'light'|'dark' }) → { el, screen }   creates a phone; mount a screen into .screen
T.scrollTo(target)           smooth scroll (Lenis)
T.icon(name, size)           Ionicons-style outline SVG string for the app screens (see core.js list)
```
Reveal: add `data-reveal` to any element → it blurs/fades in once when it enters the viewport.
Stagger with `style="--i:2"` (each step 70 ms).

## App screens (window.TendsoScreens, js/screens.js, agent A)
```
TendsoScreens.mount(screenEl, name, opts) → { play(), pause(), reset(), set(key, value), el }
```
Screens are authored at 390×844 CSS px (iPhone logical size) inside `.screen-root`; the phone scales them.
Names: welcome · interview-rec · photos · design-picker* · site-ready* · agents-near* · site-browser
(* = proposed). Each screen has an idle state and a `play()` loop for its micro-animation.

## Quality bar and verification
- Look at your work rendered before reporting: run
  `node docs/landing-mock/tools/shot.mjs <url-or-file> <out.png> [width] [height] [scrollY]`
  at 1440×900 and 390×844, open the PNGs, fix what you see (2 rounds max).
- No console errors. No horizontal scroll at 390 px.
- Report: files written, what you verified, anything you could not do.
