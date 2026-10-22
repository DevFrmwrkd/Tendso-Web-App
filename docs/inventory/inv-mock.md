# Inventory: what the Tendso v2 mock actually specifies

Source: `/Volumes/SSD/New Coding Projects/Tendso-App/docs/landing-mock/` (read-only pass, 2026-10-21).
Method: read the 5 docs, then rendered every page and every app board in headless Chrome to count and read what is really on the page. I also ran the mock's own `tools/simple-lint.mjs` on the three app boards. Anything marked INFERRED is my reading, not stated in the mock.

Totals:
- Web pages: 11 HTML pages (landing + 10 pages in `pages/`), plus `hub.html` (review index only, not a product page). `hub.html` and `HANDOFF.md` §1 list only 5 pages. The other 6 (help, legal, start, pay, giveaway, otr) are not in either.
- App screens rendered on the three boards: 66 (owner 25, creator-core 22, creator-more 19). Every doc says something different (see §6.1).
- Showcase sites: 22.
- Shared screen factories in `js/screens.js`: 12.

---

## 1. Web pages

Proposed routes are mine (INFERRED). The mock has no routing.

| Mock file | Proposed route | Sections on the page | Interactive bits |
|---|---|---|---|
| `index.html` | `/` | Nav (tightens on scroll) · Hero stage ("The thinking ends here.": centre phone with interview, buddy types "Got it. I'll build your website.", then the finished site and 4 homepages slide out; 24 s loop) · Collapse into the grid · Grid: slot tile (3-column gallery of the 22 showcase sites, each opens in a new tab), Words tile ("10 simple questions"), Images tile ("10 guided photos", before/after wipe), Cost tile ("Pay once. Not every month.": agency vs Wix/Webflow vs Tendso), Moment ("See it first. Pay once."), Humans tile ("Someone comes over", vector map with agent pins) · People cloud ("The people behind the sites", 16 photos, parallax) · Steps ("Six steps. One phone.", pinned phone) · Paths (Download with QR and store buttons, Hire an agent short form, Join the team) · Footer (huge wordmark, Help/Contact/Field agents/Privacy/Terms) · Work overlay (case studies) | Hire form (shop name, area, mobile; inline validation and confirmation; sends nothing) · tile hover and click opens a detail sheet · draggable before/after · step buttons scroll the pinned phone · Work overlay (Esc closes) · Lenis smooth scroll · Review-mode switch (mock only). **No chatbot, no search.** |
| `pages/business.html` | `/for-businesses` | Hero ("Your website, finished. Before you pay.", sample Kalan site) · Two ways (20 min on phone / 30 min with an agent, "as low as ₱999 when a Tendso creator signs you up") · What you get (your words, better photos before/after, design for your kind of business, address, mobile-first, "Found on Google" SERP mock) · Price ("₱4,999. Once.", or ₱500 a month for 10 months; no monthly fees; optional .com) · Examples strip (links to `examples.html#id`) · FAQ (6) · Closing band | FAQ accordion · store buttons · before/after · Download / Hire links |
| `pages/examples.html` | `/examples` | "Pick a look. Browse designs. No sign-up." · filter chips · grid of 23 designs · closing band | Filter chips: All and 9 categories (Food, Beauty, Auto, Retail, Services, Fitness, Health, Education, Trades) · preview modal with Desktop/Mobile toggle and scrollable site · "Use this design" |
| `pages/creators.html` | `/field-agents` (production calls them "creators") | Hero ("Build websites for shops near you. Keep half.", "Earn ₱30,000+ a month" pill, app map screen) · How a visit works (4 steps) · How you earn (price slider, shops/week, "Example" labels) · What you get (5-lesson training, team and coach "Kuya Tendo", own page `tendso.com/a/mika`, "Bring a friend / Get ₱1,000") · Trust ("Is this a scam? No.") · FAQ · Start (3 steps) | **Earnings calculator**: price range slider ₱999–₱4,999 (step 500) + shops-per-week stepper · FAQ accordion · Discord links · Download |
| `pages/about.html` | `/about` | Statement · 3 points (app / field agents / the deal) · Team grid (4 cards, "Name TBC", placeholder photos) · Where we work (7 cities) · Careers CTA | none |
| `pages/help.html` | `/help` | "How can we help?" · search · quick chips ("How much?", "How fast?", "When do I pay?", "Change my site") · 5 topics (Getting started, Paying, Your website, Your own .com, Trust and help) · 20 short answers (accordion with topic filter) · "Ask a person" (mailto + Discord) | Search with live "big answer" and ranked results (local keyword match, **not an AI**) · topic filter · full answer in a side sheet · copy buttons · helpful/not-helpful footer |
| `pages/legal.html` | `/legal` (`#privacy`, `#terms`) | Privacy policy (11 sections) and Terms of service, switch between them. Text is the production legal copy verbatim. | Document switch · section jump links |
| `pages/start.html` | `/start` (owner web intake) | 11 one-thing screens: name + kind (6 chips) → contact (owner, phone, email) → location (street, city) → 5 questions, one at a time → photos (6 slots, optional "try with sample photos") → last look → done. Progress in 4 stages. Variants: `?campaign=giveaway` (adds poster step, free) and `?campaign=otr` (₱3,499). | Text inputs · "Say it instead" (voice) buttons · "Skip this one" · 6 file inputs · discount-code field · draft kept in localStorage · "Save and exit" · nothing is sent |
| `pages/pay.html` | `/pay/[code]` | States: ready ("Your site is ready", preview of forge.tendso.site) → pay (₱4,999 once; Wise instructions: email, name, exact amount, reference code TND-7K4M) → waiting → paid receipt → expired link | Copy buttons (4) · "I've sent it" · "Paying from abroad?" note · "Ask for a new link" |
| `pages/giveaway.html` | `/libre` (100 free websites) | Hero ("100 free websites. The giveaway is closed.", counter "37 of 100 left", ₱300K+) · 3 steps (hang poster, snap, get website) · band | Claim CTA → `/start?campaign=giveaway` · poster PDF download (links to `public/100-pages-giveaway-poster.pdf`) |
| `pages/otr.html` | `/otr` (Off the Record viewers) | "Your website. 30% off." (₱3,499, was ₱4,999) · 3 steps · what you get · band | Copy code OTR30 · CTA → `/start?campaign=otr` |
| `hub.html` | (review index, not shipped) | Cards for the 5 documented pages + 3 app boards + brand swatches + doc links + 7 "Decisions for Theo" | links only |

Shared shell for sub-pages: nav, footer, store buttons in `pages/business.js` (`window.TendsoSub`); styles in `pages/pages.css`. `pages/agents-screens.js` draws the creator map phone for the creators page.

---

## 2. App screens (every screen on the three boards)

`ts:` = rendered through `TendsoScreens.mount` (function in `js/screens.js`). All other screens are drawn inside the board file. P = marked `data-proposed`. "Words" and lint results come from the render; only the shared `welcome` screen passes `simple-lint` (see §6.1).

### 2a. Owner board (`app/owner.html`, 25 screens, 6 rows)

| # | Row | Screen (function) | Role | What it shows / primary action |
|---|---|---|---|---|
| 01 | Start | Welcome (`ts: welcome`) | Owner | Scrolling wall of shop photos, buddy, "Your shop online. Made from your phone." / **Get started**; link "I already have an account" |
| 02 | Start | Sign up (`signup`) | Owner | Name, +63 mobile, password, terms line / **Create account** |
| 03 | Start | What do you sell? (`q1`) | Owner | One question in a Tendso bubble; 6 photo option rows (Food, Bakery, Beauty, Barbershop, Sari-sari, Repair) / **Continue** |
| 04 | Start | Name and place (`q2`) | Owner | Shop name, address field, quiet vector map with pin, "Use my location" / **Continue** |
| 05 | Start | How to do it (`q3`) P | Owner | "I'll do it on my phone (~20 min)" vs "Send someone to my shop (~30 min, as low as ₱999)" / **Continue** |
| 06 | Talk | 10 questions (`ts: interview-list`) P | Owner | "Now just talk. 10 short questions. About 5 minutes." Stack of question cards cycling / **Start** |
| 07 | Talk | Recording (`ts: interview-cam`) P | Owner | Full-bleed muted interview video, REC timer + mic meter, EN/TL chip, 10-segment bar, level bar + hint chip ("Hold the phone straight" → "Good. Start talking"), question as subtitle / **Next question**, small pause |
| 08 | Talk | Got it (`interviewDone`) | Owner | "Got it, Ben." answers count + length, transcript quote card with audio player / **Next: photos**; link "Redo an answer" |
| 09 | Photos | Photo tasks (`ts: shot-list`) P | Owner | "10 photos", grid of 10 tiles (done ones show photos), next task (ghost + title), "Add your own photos too" / **Start** |
| 10 | Photos | Guided camera (`ts: shot-guide`) P | Owner | Camera view, "Shot 3 of 10", task + hint, level bar, feedback chip ("Step back a little" → "Perfect, hold still"), strip of the 10 shots / shutter, **Skip** |
| 11 | Photos | Photo upgrade (`photoUpgrade`) P | Owner | "Same chair. Shot properly." Draggable before/after, 6 thumbnails with upgrade/original badges / **Use upgrades** or **Keep originals** |
| 12 | Design | Pick a design (`ts: design-picker`) P | Owner | Carousel of 4 barbershop designs (real site captures); tap opens the full scrollable site / **Use this design** |
| 13 | Design | Mixing (`mixing`) P | Owner | "Mixing your picks… just for Forge": two picked looks blend into one; checklist "Big photo + headline from Bold / fonts from Cozy / Writing your pages…" / none (auto) |
| 14 | Design | Building (`building`) P | Owner | "We're building Forge's site", 5 stages (transcribed, photos upgraded, writing now, design and build, review), "What happens next" / **Back to home** |
| 15 | Live | Notification (`notif`) P | Owner | iOS lock-screen push: "Your site is ready to see" / tap opens the site |
| 16 | Live | We build it (`ts: site-building`) P | Owner | Buddy, "Building your site, About 20 minutes", 4 progress rows, phone-photo → pro-photo swap / none (auto) |
| 17 | Live | Ready to check (`ts: site-building`, review) P | Owner | "Ready to check" / **Looks good**, **Ask for a change** |
| 18 | Live | Site ready (`ts: site-ready`) P | Owner | "Your site is ready!" scrolling site preview, free address `forge.tendso.site`, optional .com, ₱4,999 once or ₱500 a month for 10 months, included list / (continue to pay), "Change anything →" |
| 19 | Live | Edit your site (`siteEdit`) P | Owner | Site preview with tappable blocks; bottom sheet to edit the Headline, shows the interview line it came from / **Save**, Cancel |
| 20 | Live | Pay once (`pay`) P | Owner | Summary card ₱4,999, included list, optional forgebarbers.com, GCash / Maya / Card options / **Pay ₱4,999** |
| 21 | Live | Live (`live`) P | Owner | "Forge is online!", URL with Copy + Share, QR for the counter + Save QR / **Go to my home** |
| 22 | After | Home (`home`) P | Owner | "Morning, Ben", live site card with sample stats (214 visits, 18 Messenger taps), "Make it better" checklist (4), Edit your site; **tab bar: Today · My site · Agents · Me** |
| 23 | After | Agents near you (`ts: agents-near`) P | Owner | Vector map, agent pins with faces, "Your shop" ping, selected agent card (rating, sites built, quote) / **Book** |
| 24 | After | Book a visit (`book`) P | Owner | Agent card, day strip (5), time slots (6, one taken), "About 30 minutes", "As low as ₱999" / **Book Mika** |
| 25 | After | Booked (`booked`) P | Owner | "Mika is coming by", date/time, where, how long, "You pay after you see it", WhatsApp note / **Back to home**, Add to calendar |

### 2b. Creator core board (`app/creator-core.html`, 22 screens, 5 rows)

| # | Row | Screen (function) | Role | What it shows / primary action |
|---|---|---|---|---|
| 1.1 | Join | Welcome choice (`welcome`) | Both | "Your shop online. Pay once, own it." Two doors: **I have a business** / **I want to earn as a field agent**; Log in. (The only role chooser in the mock.) |
| 1.2 | Join | Where do you work (`qCity`) | Creator | 12 city chips + "Use my location"; decides which shops the map shows / **Continue** |
| 1.3 | Join | How did you hear (`qHeard`) | Creator | 5 source options + optional referral code field / **Continue** |
| 1.4 | Join | Agent profile (`profile`) | Creator | Photo, full name, mobile, Wise email for payouts / **Send for review** |
| 1.5 | Join | Pending review (`pending`) | Creator | "We're checking your details", 3-step timeline (usually within 24 h) / Sign out only |
| 1.6 | Join | Rejected (`rejected`) | Creator | "Almost there" with the specific fix (unclear face), editable fields / resend |
| 2.1 | Learn | Training (`lessons`) | Creator | "Become a certified agent", 3 of 5 lessons done, checklist with minutes / **Continue lesson 4** |
| 2.2 | Learn | One lesson (`lesson`) | Creator | "Get the owner talking": photo, one line, four tips / **End** lesson |
| 2.3 | Learn | Quiz question (`quiz`) | Creator | Tendso asks one question, 4 lettered options (B picked), "Pass with 4 of 5" |
| 3.1 | Find shops | Map home (`mapHome`) | Creator | Vector street map, dashed pins = needs a site, accent = yours, "₱7,500 this month", counts (Needs a site 14 / Yours 6); **tab bar: Map · Finds · Submit · Earn · Me** |
| 3.2 | Find shops | Shop sheet (`shopSheet`) | Creator | Selected pin: Aling Nena's Sari-Sari, 350 m, who spotted it / **I'm visiting**, Route |
| 3.3 | Find shops | Community finds (`finds`) | Creator | "142 shops spotted this week", filter chips, photo cards (Needs a site / Live) |
| 3.4 | Find shops | Spot a shop (`spot`) | Creator | Photo, shop name, kind chips, "Needs a site", location pinned / **Save find** |
| 3.5 | Find shops | One lead (`leadDetail`) | Creator | Owner name + phone, notes, status New → Contacted → Visiting → Live |
| 4.1 | Capture | About the shop (`info`) | Creator | "1 / 4": business name, type chips, owner name, mobile, address / **Next** |
| 4.2 | Capture | Photo tasks (`ts: shot-list`) P | Creator | Same as owner 09 (creator copy, step 2 / 4) / **Start** |
| 4.3 | Capture | Guided camera (`ts: shot-guide`) P | Creator | Same as owner 10 |
| 4.4 | Capture | Ask 10 questions (`ts: interview-list`) P | Creator | "Now ask the owner." step 3 / 4 / **Start** |
| 4.5 | Capture | Recording (`ts: interview-cam`) P | Creator | Same as owner 07 (barber video) |
| 4.6 | Capture | Check, then send (`review`) | Creator | Summary: shop, owner, 5 photos, 4:12 interview + transcript, `kalan.tendso.site`, **price set ₱999–₱4,999 (keep half)** / **Send** |
| 4.7 | Capture | Sent (`sent`) | Creator | "Sent! We'll build Kalan's site. Ready in about 30 minutes." What happens next, ends with the payout |
| 5.1 | Home extras | Notifications (`notifications`) | Creator | List: "Kalan is live", "You earned ₱2,500", "New find 600 m away"; Mark all read |

### 2c. Creator money and me board (`app/creator-more.html`, 19 screens, 6 rows)

| # | Row | Screen (function) | Role | What it shows / primary action |
|---|---|---|---|---|
| 1 | Sign in | Sign in (`login`) | Both | Email + password, Apple + Google pill pair / **Sign in**; Make an account |
| 2 | Sign in | Sign up (`signup`) | Both | Account type option rows (Creator selected / Affiliate), first/last name, email, mobile (optional), password / **Create account** |
| 3 | Sign in | Forgot password (`forgot`) | Both | Email step then 6-digit code step (faded) / **Send code** |
| 4 | Earn | Earn home (`earnHome`) | Creator | "You earned in October ₱12,400", 6-month bars, price slider ₱999–₱4,999 (you keep ₱1,500, shop saves ₱2,000), latest paid sites / **Cash out** |
| 5 | Earn | Cash out (`cashOut`) | Creator | Amount with quick picks, saved Wise email, confirm / **Send to Wise** |
| 6 | Earn | Payouts (`payouts`) | Creator | Earned ₱41,500 / cashed out ₱37,750 / ready ₱3,750; tabs All/Earned/Cashed out; Wise transfers with status (Processing) mixed with sales |
| 7 | Your link | Link editor (`linkEditor`) | Creator | `tendso.com/a/mika`, toggles for what shows (photo, price with code, sites built, Messenger button), copy + share |
| 8 | Your link | Public page, top (`linkPublic`) | Shop owner view | "Mika saved you ₱2,000", code MIKA applied ₱4,999 → ₱2,999, "Pay once, after your website is live", **Get my website**, Book Mika for a free visit |
| 9 | Your link | Public page, scrolled (`linkPublicScrolled`) | Shop owner view | Sites Mika built, how it works, referrals (code only) |
| 10 | Your link | Invite creators (`referrals`) | Creator | Code MIKA8K2Q, Share/Copy, counts (Invited 3 / Qualified 2 / Rewarded 1), people list. No bonus figure. |
| 11 | Submissions | Submissions (`subsList`) | Creator | "23 shops · 1 needs a fix", filter tabs, rows with status pills (Live, Paid, Website ready, In review, Draft, Rejected) |
| 12 | Submissions | One submission (`subDetail`) | Creator | Kalan Live: site link + Open, owner, status as done checklist (Submitted → Approved → Website ready), photos |
| 13 | Learn | Knowledge home (`learnHome`) | Creator | Help center / Field wiki: search, "Ask Tendso", 5 topic cards |
| 14 | Learn | Article (`article`) | Creator | "Running the 30-minute interview", photo, body with checklist blocks |
| 15 | Learn | Ask Tendso (`ask`) | Creator | Chat: "How much do I keep per site?" answered with sources underneath. This is the only chatbot screen in the mock. |
| 16 | Me | Profile (`profile`) | Creator | Photo, link, 3 stats (23 sites, 4.9, ₱41.5k), shortcuts (Submissions, Your link, Invite creators, Learn & help), settings rows (Edit profile, Notifications, Change password, Terms, Privacy) |
| 17 | Me | Edit profile (`editProfile`) | Creator | Photo, names, mobile, locked email, Wise email / **Save changes**; Delete my account |
| 18 | Me | Help & FAQ (`faq`) | Creator | Tabs Start/Submissions/Money/Account, one answer open (rewritten to the 2026-10-06 price rule) |
| 19 | Me | Terms (`terms`) | Creator | Top of terms, section 1 open ("Last updated February 2026") |

### 2d. Shared screen factories in `js/screens.js` (`TendsoScreens.mount(el, name, opts)`)

| Name (function) | Status | Used on |
|---|---|---|
| `welcome` (`welcome`) | real, restyled | landing steps, owner 01, creator 1.1 variant |
| `interview-rec` (`interview`) | real, old: 5 long questions, timer, Prev/Next | fallback/`alt` for steps and tiles |
| `photos` (`photos`) | real, old: upload grid, 3–10 photos | fallback/`alt` |
| `design-picker` (`designPicker`) | proposed | owner 12, steps, tile |
| `site-building` (`siteBuilding`) | proposed; has `review` state | owner 16/17, steps |
| `site-ready` (`siteReady`) | proposed | owner 18, Cost tile, steps |
| `agents-near` (`agentsNear`) | proposed | owner 23, Humans tile |
| `site-browser` (`siteBrowser`) | output, not app UI | landing hero phone, tiles |
| `interview-list` (`interviewList`) | proposed | owner 06, creator 4.4 |
| `interview-cam` (`interviewCam`) | proposed | owner 07, creator 4.5, hero, Words tile, steps |
| `shot-list` (`shotList`) | proposed | owner 09, creator 4.2 |
| `shot-guide` (`shotGuide`) | proposed | owner 10, creator 4.3, Images tile |

### 2e. Data (`js/data.js`)
- `TD.interview`: 10 questions, each with `en` and `tl` (Tagalog): shop name; where are you; what do you sell; what do people love most; how did you start; what makes you special; prices; when open; how to reach you; what should people know. Plus `extra` ("Anything else?" / "May iba pa?") and 4 `framing` hints.
- `TD.shots`: 10 photo tasks per type, each `{ t, h, ghost }` (ghost = outline kind: head, half, room, front, sign, object): `barber` (Owner headshot, Profile picture, Haircut in progress, Inside, Chairs and equipment, Finished cut, Outside, Sign, Tools, Price list), `food` (10), `repair` (10), `salon` (10). `default` = barber. `store`, `laundry`, `other` have no list (they fall back to barber).
- `TD.sites`: 7 filled sites (forge, kalan, hela, vulca, domingo, labana, kalasag) with name, kind, city, url, hero photo.
- `TD.pairs`: 4 before/after photo pairs (Forge headshot, Forge outside, Vulca mechanic, Kalan tapsilog).
- `TD.words`: sample transcript and 3-line headline copy. `TD.price`: ₱4,999 once, ₱500 × 10 instalment, compare rows (agency ₱10,000/mo, Wix/Webflow ₱1,500/mo; flagged placeholder). `TD.agents` (3), `TD.people` (16 cloud photos), `TD.businessTypes` (8, from the real info screen), `TD.links` (placeholders).

---

## 3. Showcase sites

- **Count: 22** standalone HTML sites in `showcase/`.
- **Ids:** baker, bike, carpenter, ceramics, dental, dive, domingo, florist, forge, halohalo, hela, labana, petgroom, phonefix, photo, print, sarisari, surf, tailor, tattoo, tutor, vulca.
- **Four visual families** are named only in `docs/IMPLEMENTATION-HANDOFF.md` line 107: warm editorial, bold colour, full-bleed photo, minimal/playful. No file records which site belongs to which family. This grouping is INFERRED from each site's fonts and palette:
  - Warm editorial (7): baker, carpenter, florist, hela, tailor, domingo, forge.
  - Bold colour (5): bike, halohalo, sarisari, phonefix, print.
  - Full-bleed photo (4): dive, surf, photo, vulca.
  - Minimal / playful (6): dental, labana, ceramics, tattoo, petgroom, tutor.
- **Where files live:**
  - Captures: `assets/sites/showcase/<id>-d.jpg`, `-d-long.jpg`, `-m.jpg`, `-m-long.jpg` (22 × 4 = 88 files).
  - Photos used inside the sites: `assets/photos/showcase/` (60 JPGs, about 3 per site, e.g. `baker-case.jpg`, `dive-hero.jpg`). Forge also has `assets/photos/forge/` (phone-* and pro2-* before/after sets).
  - Older v4-template captures: `assets/sites/<id>-*.jpg` (7 sites), `assets/sites/examples/` (48 files, used by the Examples page), `assets/sites/designs/` (15 files `barber-{f,g,h,i,j}-*`, used by the design picker; `h` is not used).
  - `js/screens.js` `SHOWCASE` set redirects 10 ids (forge, hela, vulca, labana, domingo, florist, carpenter, baker, tailor, ceramics) to the showcase captures; the rest use the old paths.
  - Consumers: landing gallery tile (links to `showcase/<id>.html`), owner/creator `site-ready` / `site-browser` screens (forge). The Examples page does **not** use these 22; it uses a separate set of 23 (see §6.12).
- **Other assets:** `assets/people/` 17 photos, `assets/video/interview-1..3.mp4` + posters (Seedance, 9:16, 8 s, muted), `assets/brand/` mark, app icon, buddy.

---

## 4. Design tokens and motion headlines

Tokens (`css/tokens.css`, `css/app-kit.css`):
- Accent `#E4F222` (one token, fills only; ink text `#0C0A08`; derives `accent-hover`, `accent-soft` with `color-mix`). Never yellow text or lines on light.
- Web neutrals: canvas `#FFF`, stage `#F2F3F1`, quiet tile `#F7F7F5`, line `#ECECE8`, ink `#0C0A08`, ink-2 `#4A4943`, muted `#8C8B84`, dark `#121210`. App: bg `#F6F6F3`, card `#FFF`, ink2 `#45443F`, ink3 `#8A8982`, info `#1F3654`, warn `#A8650E`, danger `#C2341B`.
- Fonts: Onest 400/500/600/700 everywhere, web and app. JetBrains Mono 500 only for tiny uppercase labels on the web (not in app per v3). Display tracking −0.045 to −0.065em.
- Sizes: hero `clamp(44px, 6.4vw, 104px)`, moment `clamp(64px, 12vw, 210px)`, h2 `clamp(36px, 5vw, 72px)`, body 17/16. App: headline 26–30 bold (SIMPLE-FLOWS: 30/700), buttons 56 px pills, body 17–18, nothing under 16.
- Radii: tile 40 (28 under 760), card 20, app card 18–24, pill 999. Page padding `clamp(16px, 3.3vw, 48px)`, max 1440, grid 12 col, gap `clamp(12px, 1.7vw, 24px)`.
- Easing: out `(.22,1,.36,1)`, expo `(.16,1,.3,1)`, in-out `(.77,0,.175,1)`. Durations: ui 220, reveal 620, settle 900 ms. Blur-in 14 px.
Motion:
- Physical, calm, ends slow; no bounce/overshoot. Reveal = opacity + 14 px blur + 18 px rise, at 12% visible, 70 ms stagger.
- Lenis smooth scroll (lerp .085, wheel ×.9), one shared rAF loop; reduced-motion = no smooth scroll, loops show end state.
- Nav 84→60 px at scrollY>30. Hero: 24 s loop, buddy pops at 5.2 s, site reveals at 9.9 s, 4 homepages slide out 10.1–11.6 s.
- Collapse: scroll 0→0.9·vh shrinks the stage into the first grid tile (radius 0→40), then re-parents into the slot.
- Tiles play at 25% visible; hover blurs in a one-line explanation; click opens a detail sheet (blur 12→0, scale .98→1).
- Steps: pinned phone, each screen slides up over the last (previous scales to .9, dims to 55%).
- Cost tile: 12 ticks at 160 ms, agency/Wix running totals vs Tendso once. Work overlay slides up 700 ms.
- People cloud: 220vh sticky, two depth layers (sharp / blurred 3–6 px, opacity .7), parallax by scroll.

---

## 5. Not in the mock (features the docs mention, or the product needs, with no screen)

App, owner side:
- Language screen (SIMPLE-FLOWS O2, Tagalog vs English once for the whole app). Not on the board; only a small EN/TL chip inside the recording screen.
- "Ask for a change" form (button exists on 17, nothing behind it), change-request status, and a "Looks good" confirmation step.
- Owner editing beyond one headline: switch whole design, change font, colours, edit other text, replace photos, reorder/hide sections (IMPLEMENTATION-HANDOFF §4D). Only screen 19 (single headline) exists.
- Instalment mechanics (₱500 × 10): schedule, reminders, missed month, receipt. Pay screen shows only one payment. No payment-failed, pending, or refund state.
- Custom .com flow (search, price, confirm, DNS state) and the "Get forgebarbers.com" checklist target.
- "My site" tab and "Me" tab (owner settings, profile, logout, delete account), owner Help, inbox/notifications list for owners (only the single lock-screen push).
- Owner sign-in, forgot password, OTP code step for owners (creator-more has sign-in/forgot; the owner board only has sign-up). Clerk behaviour for owners is an open question in IMPLEMENTATION-HANDOFF §10.
- Owner-side Help / AI chat (the only AI chat screen is creator "Ask Tendso"). Per-site "Ask the shop" chat and Messenger bot (roadmap items E v1.1 and F) are not drawn.
- Site take-down / unpublish, analytics beyond sample numbers, "Share on Facebook", QR print flow.
- Agent booking, owner side only: reschedule, cancel, rate the agent, agent-no-show. Agent side of a booked visit (incoming request, accept/decline, calendar) is not drawn at all.
App, creator side:
- Certification: only one quiz question (2.3). No result (pass/fail/retake), certificate/badge, or the other 4 questions. Lessons 1–5 show only lesson 4.
- Payouts: no Wise setup/verification, failed/returned payout, minimum cash-out, fees/FX, tax/KYC, empty states.
- Submission lifecycle: edit or resubmit a rejected submission, resume a draft, upload progress/failure/retry, offline.
- Leads: edit lead, change status, route/navigation, share a lead, duplicate detection.
- Notification settings and push-permission prompts; camera/mic/location permission prompts; low-light/low-storage warnings.
- Admin (mobile and web): submission review/approval queue, creator approval (screen 1.5 implies a person reviews), payouts approval, template manager, campaign and giveaway management, discount codes, email templates. Nothing is drawn. IMPLEMENTATION-HANDOFF Phase 0 lists these as existing features that must not be lost.
- Referrals: the app board shows no bonus figure but the creators web page advertises ₱1,000 (see §6.7). No screen for how a bonus is earned or paid.
- Empty, loading and error states for almost every screen; dark mode; tablet/landscape; accessibility variants (large text).
Web:
- Owner dashboard / "my business" and sign-in on the web, hosted site preview and editor on web (`components/editor/`), `/preview` and hosted-site pages.
- Public affiliate page `/a/[handle]` as a web page (only drawn as phone screens 8–9 in creator-more).
- Contact form (Help uses mailto and Discord only), cookie/consent banner, 404 and error pages, careers page (About has only a CTA), blog or knowledge-article pages (Help has an in-page sheet), sitemap, schema, GEO pages.
- Chatbot on the landing or Help (IMPLEMENTATION-HANDOFF §4E asks for it; Help search is a local keyword match, no AI).
- Non-Philippine pricing ("local currency elsewhere" is written but no pricing for it), Tagalog version of the website.
- Mobile-width page layouts exist in CSS but there is no separate mobile mock of pages other than the landing.

---

## 6. Contradictions and open questions inside the mock docs

1. **The app boards do not match SIMPLE-FLOWS, and the lint claim is false.** SIMPLE-FLOWS (11:57) specifies owner 15 / creator-core 8 / creator-more 9 = 32 screens with exact words. `hub.html` repeats 15/8/9. `HANDOFF.md` §1 says 19/24/23. The boards actually render 25/22/19 = 66. `HANDOFF.md` says "all pages pass today" for `simple-lint.mjs`; running it on the boards: owner 1/25 pass (only `welcome`), creator-core 0/22, creator-more 0/19 (e.g. 48–105 words, text at 10–15 px, up to 7 controls). The boards are still the older Round-2 build; SIMPLE-FLOWS has not been applied to them. The shared screens `interview-list`, `shot-list`, `interview-cam`, `shot-guide`, `design-picker`, `site-building`, `site-ready` also fail (step text "3 / 4", 13 px counters, etc.).
2. **Recording screen has three different specs.** `HANDOFF.md` §5: language chip, level bar, hint chip, REC timer + mic meter, 10-step bar, "4 / 10". `APP-SYSTEM.md` v4 and the lint: no level lines, no hint pills, no language pill, no "1 / 4" text, ≤12 words, "only the outline turning yellow". `SIMPLE-FLOWS` O7/C6: "face outline that turns yellow". `IMPLEMENTATION-HANDOFF` §4B: "no outline of any kind". The built `interview-cam` follows `HANDOFF.md` (chip, level, hint, counters).
3. **Owner flow order differs everywhere.**
   - SIMPLE-FLOWS: Welcome → Language → What you sell → Shop name → Who makes it → Talk → Interview → Photo → Pick a look → Making → Ready → Publish → Online → Home → Someone comes → Booked.
   - Owner board: Welcome → Sign up → Sell → Name+place → How → Talk → Photos → Design → Mix → Build → notification → site-building → review → ready → edit → pay → live → home → agents → book → booked. (No language screen; sign-up added; photo upgrade, mixing, edit and notification added.)
   - Landing Steps: Download → **Choose a design** → Interview → Photos → We build it → Ready. Design comes second there but fourth on the board.
   - Only creator-core 1.1 offers the "I have a business / I want to earn" role choice; the owner welcome skips it.
4. **Sample business is inconsistent.** SIMPLE-FLOWS and `HANDOFF.md` use Kalan (sari-sari/carinderia, "Kalan", `kalan.tendso.site`); the owner board uses Forge Barbers (variable still named `kalan` in `owner.js`); creator-core uses Kalan; the business page uses Kalan; tiles use the Forge capture. `IMPLEMENTATION-HANDOFF` says "no food as main example" (so Kalan as the lead sample conflicts with it).
5. **Turnaround time.** `HANDOFF.md` §10.0 corrects it to same day, about 20 minutes, but `HANDOFF.md` §8 still says "Sites are live in 48–72 hours" and "Pay only when it's live". In the screens: owner 14 and creator "Sent" say "about 30 minutes"; `site-building` and Steps say "About 20 minutes"; SIMPLE-FLOWS O10/C8 say "About 30 minutes". Agent visit is 30 minutes at the shop, a different thing.
6. **Payment model.**
   - Instalment ₱500 × 10 appears in `data.js`, `site-ready`, business page and Cost tile copy, while the same business page says "No monthly fees. No contracts" and owner Pay screen says "No monthly fees". Both are stated on the same pages.
   - Pay methods: owner board pay screen = GCash / Maya / Card (not saved); web `/pay` = Wise bank transfer only (to "VONAS, OPC", `support@negosyo.digital`) with a manual code; creator payouts = Wise. No doc says which is real for owners.
   - Timing: "See it first. Pay once to publish" (HANDOFF) vs creator-more public page "Pay once, after your website is live. Nothing to pay today" vs owner "Booked: You pay After you see it" vs `HANDOFF.md` §10.0 "Still to confirm whether the owner pays before publishing or after".
   - Cost tile comparison: HANDOFF §5 says monthly chips ₱500/₱900/₱1,500 with ₱900 placeholder; the code and hub use agency ₱10,000 + Wix/Webflow ₱1,500 as placeholders over one year.
7. **Creator-earnings policy.** `HANDOFF.md` §8 (and the "done, follows production money policy" line in §1) say recruiting pages never quote peso earnings, a per-site amount, a referral figure or a calculator. The current `creators.html` (modified 14:15, after HANDOFF at 13:52) has "Earn ₱30,000+ a month", "you keep ₱1,500 each", a slider calculator and "Get ₱1,000 when their first site is paid". `IMPLEMENTATION-HANDOFF` §6 now allows exactly this. The in-app referrals board says "No bonus figure" and APP-SYSTEM lists a ₱1,000 referral bonus. `BRIEF.md` still says "Never show creator-pay wording" on the landing. HANDOFF.md was not updated; the newer file wins but you should confirm.
8. **Font spec has layers.** `BRIEF.md` and `index.html` still load Instrument Serif; `APP-SYSTEM.md` top says keep serif display + italic + mono labels; v3 (same file, lower) overrides with Onest only; the base `.a-label` is still 11 px mono and is only overridden by a later kit block. `APP-SCREENS-SPEC.md` still describes the old Editorial Paper colours and welcome in gold; `HANDOFF.md` calls it "data fields only" but it still contains full pixel specs that now conflict (5 long interview questions vs 10 short; "Pay wording").
9. **Stale rules in `APP-SYSTEM.md`:** "unlock after 5 approved" and "referral bonus ₱1,000" in the price list, contradicting the 2026-10-06 removal of the unlock.
10. **Tab bars.** SIMPLE-FLOWS creator: 3 tabs (Map, Add, Earn). Boards: 5 tabs (Map, Finds, Submit, Earn, Me). Owner: board has 4 (Today, My site, Agents, Me); HANDOFF §10.5 and hub ask whether it should be 5 (Home, Site, Help, Inbox, Account) or 4.
11. **Steps count and landing order.** `HANDOFF.md` §5 describes five steps and puts Paths/Steps before People; the page has six steps and the order Hero → Grid → People → Steps → Paths (this matches `IMPLEMENTATION-HANDOFF`). Grid in HANDOFF is "four tiles + moment"; the page has slot gallery, Words, Images, Cost, Moment, Humans.
12. **Examples source.** `IMPLEMENTATION-HANDOFF` §4A says the Examples page should use the 22 showcase sites; `pages/examples.js` still uses a different set of 23 designs from `assets/sites/examples/` + `TD.sites`. Landing gallery uses the 22 showcase sites. Two example sets coexist, and the examples include non-Filipino shops (Brooklyn, Portland, Edinburgh…) while the brief says Filipino first.
13. **Naming.** "Field agent" (landing, creators page) vs "Tendso creator" (owner board, app, business page, production); "Affiliate" is a third account type in creator-more sign-up. Pages say "field agent (a Tendso creator)" once then "agent". Decision still open.
14. **Placeholders that look final.** Team "Name TBC", generated people photos, drawn QR codes, store links `#app-store`, sample numbers (214 visits), `support@negosyo.digital` / "VONAS, OPC" on the pay page, monthly comparison prices. Giveaway page shows both "The giveaway is closed" and a live "37 of 100 left / Open" counter.
15. **Help page vs docs.** `IMPLEMENTATION-HANDOFF` calls it "search + Tendso AI answer"; the mock's search is a local keyword match over 20 hard-coded answers. The AI behaviour (Gemini RAG in `convex/knowledgeAI.ts`) is only a note, not designed.
16. **Doc coverage.** `HANDOFF.md` deliverables list 5 pages and 3 boards; the actual mock also has start, pay, help, legal, giveaway, otr (only described in `IMPLEMENTATION-HANDOFF`). The mock's `HANDOFF.md` open decisions (7) and hub decisions (7) are two different lists.
