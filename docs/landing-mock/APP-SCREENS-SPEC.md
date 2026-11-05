# App screens spec (from apps/mobile source, 2026-10-20)

Source of truth: `apps/mobile/theme/tokens.ts`, `components/ui/primitives.tsx`, and the screen files named
below. Redraw these EXACTLY (copy, colours, sizes) at 390×844 px. Ionicons are the app's icon set: draw
them as inline SVG in the Ionicons outline style (stroke 32 on a 512 grid, round caps).
Screens marked PROPOSED do not exist in the app yet: draw them strictly in this design system and put
`data-proposed="true"` on the screen root.

## Design system "Editorial Paper"
Colours: paper #F8F5EE (screen bg) · paper2 #EFEBE0 (tints, icon circles) · paper3 #FCFAF5 (cards, inputs,
tab bar) · ink #1B1C24 · ink2 #3C3F4A (body) · ink3 #7A7E8A (muted, labels) · accent #C89548 (italic
headline words, links, progress) · accentInk #5C3A0F · accentBg #F5E4C0 · accentSolid #E4B05E ·
business #1F3654 / businessBg #E4E9F0 · live #D9A84E · rule #E0D8C9 · ruleStrong #B7AC95 ·
warn #C68A12 / warnBg #FBE9C4 · danger #B43A1F / dangerBg #F3D7CF.
Shadow soft: 0 2px 8px rgba(0,0,0,.06). Lifted: 0 12px 24px rgba(0,0,0,.12).

Fonts: Instrument Serif 400 + italic (display) · Onest 400/500/700 (body) · JetBrains Mono 500 (labels,
UPPERCASE) · wordmark "TENDSO" in Google Sans Flex 500 (use Onest 500 as stand-in), letter-spacing 2.4.
Display sizes (size/line-height/letter-spacing): sm 28/30/-0.4 · md 40/42/-0.6 · lg 56/56/-0.8. The italic
second line is accent #C89548.
Body: xs 11/16 · sm 13/19 · md 15/22 · lg 17/25 (ink2).
Label: JetBrains Mono 500, 11px, letter-spacing 1.4–1.8, uppercase, ink3.
Radii: 8, 12, 18 (card default), 24 (large card), 32, pill.

Components:
- Door button: row, padding 16/22, radius 18, 1px border. Optional caption above label (mono 10,
  tracking 1.4, uppercase); label Onest 500 16, tracking -0.2; right icon arrow-forward 18.
  solid = ink bg, paper3 text, caption rgba(255,255,255,.6). ghost = transparent, ink border, ink text.
- Card: paper3, 1px rule border, radius 18 (24 large), padding 16.
- Back button: 40×40 circle, paper3, 1px rule border, arrow-back 18 ink.
- LiveDot: solid dot + ring pulsing to 2.4× and fading over 1.4 s.
- Sticky footer: paper bg, 1px rule top border, padding 14 24 34.
- Progress bar under header: 2–3 px, rule track, fill.

## 1. `welcome` (REAL — app/index.tsx, first launch)
NOT the paper theme. Background #0a0a0a, light status bar, system font (use Onest).
Decorative circles: 260px #E4B05E at 8% alpha top-right (offset −80/−80); 180px at 3% alpha (top 60, left −60).
Padding 24 top/bottom (+ status bar), 28 sides. Layout top / middle / bottom.
- Top: white "Tendso" wordmark image `assets/brand/` is not available as white; draw the word "Tendso"
  in Onest 600 26px white, letter-spacing -0.5.
- Middle (gap 20): pill badge #E4B05E, radius 20, padding 6/14, white 11px 700, tracking 1: "HANDS FULL".
  Headline 42px weight 900 lh 48 tracking -1 white: "Some hands / don't get to / " + "sit still." in #E4B05E.
  Subtitle 15px #a1a1aa lh 22: "The Thinking Ends Here. So the work doesn't."
- Bottom (gap 16): button height 56, radius 28, #E4B05E fill, glow shadow (rgba(228,176,94,.35) 0 8 16),
  white 17px 800 "Get Started". Link 14px #71717a "Already have an account? " + white bold "Log In".
- Motion: elements fade up one after another, 600 ms each, 150 ms apart.

## 2. `interview-rec` (REAL — app/(app)/submit/interview.tsx, audio recording in progress)
Do NOT show the intro paragraph (it contains pay wording). Show the screen scrolled to the recording area:
- Header: back button left; right side "·" (mono 11 ink3) + 6px LiveDot danger + Label "REC" in danger.
  Below: progress bar 2px, rule track, ink fill 75%, 24px side margins.
- Label "INTERVIEW" (tracking 1.8), Display lg "Talk to" / italic accent "the owner."
- Dark panel: ink bg, radius 24, padding 26, centred:
  status pill padding 6/12, border 1px rgba(180,58,31,.6), bg rgba(180,58,31,.15): 7px LiveDot danger +
  mono 10 uppercase "Recording" danger. Timer JetBrains Mono 500 56/60 paper3 "0:00" (counts up).
  Label "ELAPSED" rgba(255,255,255,.5).
- Question card (large paper card, padding 18, margin-top 16): row Label "ASK THE OWNER" accent + right
  mono 11 ink3 "1 / 5". Question Instrument Serif italic 22/28 ink centred in curly quotes.
  Pills: "PREV" (1px ink outline, chevron-back 13, mono 10; disabled at 1: rule border, .45 opacity) and
  "NEXT" (ink fill, paper3 text, chevron-forward 13).
- Controls row gap 18: pause 60px circle 1px ink outline (pause icon 24); stop 72px ink circle with 22×22
  paper3 square radius 3. Label "TAP STOP WHEN DONE" centred.
Questions (exact):
1 "What's the full name of your business, what city or area do you serve, and what do you do? Try to mention all three in one sentence."
2 "What products or services do you offer, and what are your most popular ones? Use the words customers would type into Google."
3 "Why do customers choose your business over the alternatives nearby? What makes you the best in your area?"
4 "Tell us about a recent customer who loved what you did — what did they buy, and where were they from?"
5 "Where exactly are you located, what are your opening hours, and how can people reach you? Mention nearby landmarks if it helps people find you."
play(): timer counts up in real seconds from 0:07; every ~4.5 s the question advances (1→5, wraps) with a
soft cross-fade; LiveDot pulses.

## 3. `photos` (REAL — app/(app)/submit/photos.tsx)
- Header: back button; progress 3px, accent fill 50%, pill radius.
- Row: Label "PHOTOS" left, Label "{n} / 10" right. Display lg "Show us" / italic accent "the storefront."
- Body md ink2: "Upload three to ten photos — storefront, interior, products, signage. The more honest the frame, the better the story."
- Upload tile: paper3, 1.5px DASHED ruleStrong border, radius 18, padding 36 vertical; 52px paper2 circle
  with rule border + camera-outline 24 ink3; Body md 500 ink "Tap to add photos"; Label "JPG · PNG · UP TO 5MB".
- Grid 3 columns, 4px gutters, square tiles radius 12, paper2 bg. Empty placeholders until 3: dashed
  ruleStrong 1.5px, paper3, camera-outline 22 ink3. New photo: 1px rule border, 24px ink remove circle
  top-right with close 14 white. Upload state: 3px bar along tile bottom (rgba(255,255,255,.4) track, accent fill).
- Rule, then row: Label "{n} OF 10" left; right Label "NEED {3−n} MORE" in warn or "READY" in accent.
  2px progress bar accent fill n/10.
- Footer: solid Door caption "CONTINUE" label "Continue to interview"; ghost Door "Back to business info".
Fill with TD photos (kalan-hero, kalan-cook, kalan-pandesal, before-kalan…).
play(): photos drop into the grid one by one (each: blur→sharp + upload bar filling 0→100 in 900 ms), counter
and READY state update, then hold and reset.

## 4. `design-picker` (PROPOSED — step 2 "Choose a design")
Paper theme. Header: back button + progress (accent, 15%). Label "DESIGN", Display lg "Pick a" / italic
accent "look." Body md ink2 "Every design fits your kind of business. You can change it later."
Chip row (pills, paper3, 1px rule; selected = ink bg, paper3 text, mono 11 uppercase): "FOOD" (selected),
"BEAUTY", "AUTO", "RETAIL", "SERVICES".
Two-column masonry of design cards (radius 18, 1px rule, paper3, padding 8): thumbnail = top crop of a
real site screenshot (`assets/sites/<id>-m.jpg`), below it Body sm 700 ink design name + Label kind.
Names: "Mercado" (kalan), "Atelier" (hela), "Garage" (vulca), "Counter" (domingo), "Press" (labana), "Iron" (kalasag).
Selected card: 2px ink border + 24px ink check circle top-right.
Footer: solid Door caption "CONTINUE" label "Use this design".
play(): the selection moves from card to card every 1.6 s, then settles on Mercado.

## 5. `site-ready` (PROPOSED — owner sees the site live before paying; cost tile)
Paper theme. Label "● LIVE PREVIEW" in live #D9A84E. Display lg "Your site" / italic accent "is ready."
A browser card (radius 18, 1px rule, overflow hidden): top bar paper2 with 3 dots + mono 11 "kalan.tendso.site";
body = `assets/sites/kalan-m-long.jpg` slowly auto-scrolling.
Card rows (Card): "Website" … "₱4,999" (Body md, value Onest 700); "Subdomain kalan.tendso.site" … "Included";
"Custom domain" … "Optional". Rule. Row Label "PAY ONCE" + Display sm "₱4,999".
Footer: solid Door caption "PAY ONCE" label "Keep my site live". No monthly wording, no creator wording.
play(): browser body scrolls the long screenshot top→bottom over 14 s, eased, then returns.

## 6. `agents-near` (PROPOSED — owner's view of nearby field agents; humans tile)
Pattern from leads/nearby.tsx. Header row: 36px back circle + Label "FIELD AGENTS". Display md
"Someone can " / italic accent "come by." Body sm ink2 "3 agents near you · about 30 minutes at your shop".
Strong rule. Map: full width, height 320, drawn as a quiet vector street map (paper2 base, white streets,
rule-coloured blocks, a pale river) — not Google tiles. User location: blue dot #1F3654 with pulsing ring.
Agent pins: 30px ink circles with paper3 serif initial + small accentSolid ring; one pin selected.
List (padding 20, gap 10): Label "NEAREST FIRST" + mono 10 "3 nearby". Row card (large card, padding 14):
44px avatar circle (accentBg, accentInk serif initial), Body md 700 ink name, Body xs ink3 note
("Available today"); right: distance Instrument Serif 18 ink ("350 m"). Selected row: ink border + 3px accent
left border, and two Doors: solid caption "BOOK" label "Ask Mika to visit"; ghost caption "MESSAGE" label "Chat first".
Use TD.agents.
play(): pins drop in one by one (scale .6→1, fade, ease-out 500 ms, 140 ms apart), the user dot ring pulses,
the selected row highlights.

## 7. `site-browser` (output, not app UI — the finished website on the phone)
iOS Safari-like: status bar, the site screenshot `assets/sites/<id>-m-long.jpg` filling the screen, bottom
address bar (rounded 14, rgba(242,242,242,.9), mono-ish 13 "kalan.tendso.site" with lock icon).
opts.site = site id. play(): slow scroll of the page.
