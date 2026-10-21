# Simple flows — exact screens and exact words (Theo, 2026-10-21)

RULE #1: never overwhelm. A grandmother must get every screen at a glance. Read APP-SYSTEM.md "v4".
Every word on a screen is listed below. Do NOT add any other text: no eyebrows, step numbers, hints,
captions, tags, sublabels, footnotes. Visuals (photos, map, outline, video) carry the rest.
Type: headline 30px/700, body 18px/500, buttons 18px/700 pills (56px tall). Nothing under 16px.
One accent (#E4F222) = the primary button fill (ink text). Progress = one 4px bar at the very top, only
where noted. English UI (the owner chose English on the language screen). Generous white space.
Language screen exists so a Tagalog speaker gets the whole app in Tagalog.

Every screen must PASS `node tools/simple-lint.mjs <board.html>`.

## Owner (app/owner.html) — 15 screens
| # | Screen | Words on screen (exact) | Controls | Visual |
|---|---|---|---|---|
| O1 | Welcome | "Your shop online." | button "Start" · link "Log in" | 4 big rounded shop photos (food, salon, sari-sari, barber) top half |
| O2 | Language | "Which language?" | options "Tagalog" · "English" (English selected) | none |
| O3 | What you sell | "What do you sell?" | options with photo: "Food" "Beauty" "Repairs" "Store" (Food selected) · button "Next" | photo per option |
| O4 | Shop name | "What's your shop called?" | field showing "Kalan" · button "Next" | progress bar 20% |
| O5 | Who makes it | "Who makes your site?" | options "I will, on my phone" · "Send someone to my shop" (first selected) · button "Next" | small icon per option |
| O6 | Talk start | "Now just talk." / "10 short questions." | button "Start" | the yellow buddy (assets/brand/buddy.png), big |
| O7 | Interview | the question only, e.g. "What's your shop called?" | button "Next" (+ the round pause button) | full-screen video assets/video/interview-1.mp4 (muted), face outline that turns yellow; thin progress bar |
| O8 | Photo | the task only, e.g. "Your best dish" | shutter button | full-screen camera view (kalan photo), dashed outline turning yellow; thin progress bar |
| O9 | Pick a look | "Pick a look." | 4 options = 4 big site thumbnails 2×2 (assets/sites/*-m.jpg) · button "Next" | — |
| O10 | Making | "Making your site…" / "About 30 minutes." | none | buddy + one progress bar |
| O11 | Ready | "Your site is ready." | button "Publish · ₱4,999" · link "Change something" | big phone-shaped preview of the Kalan site (assets/sites/kalan-m.jpg) |
| O12 | Online | "You're online!" / "kalan.tendso.site" | button "Share" | big tick |
| O13 | Home | "Kalan" / "Online" / "214 visits this week" | buttons "Edit" · "Share" | site thumbnail card |
| O14 | Someone comes | "Mika can come today." | button "Book Mika" | map + Mika's photo (assets/people/17-mika.jpg) |
| O15 | Booked | "Mika is coming." / "Today, 3:00 PM" | button "OK" | Mika's photo, big |

## Creator — app/creator-core.html (capture) — 8 screens
| # | Screen | Words | Controls | Visual |
|---|---|---|---|---|
| C1 | Map | "Aling Nena's Store" / "No website yet" | button "I'm visiting" | map with 3–4 pins, one selected; tab bar (3 tabs: Map, Add, Earn) |
| C2 | Shop | "Shop name" (field "Aling Nena's Store") / "Owner" (field "Nena Cruz") | button "Next" | progress bar |
| C3 | Photos start | "Now 10 photos." / "We'll tell you what to take." | button "Start" | buddy |
| C4 | Photo | the task only: "The store front" | shutter | camera view (assets/people/01-sarisari.jpg) + outline |
| C5 | Talk start | "Now ask 10 questions." | button "Start" | buddy |
| C6 | Interview | the question only: "What do you sell?" | button "Next" (+ pause) | video assets/video/interview-3.mp4 + face outline |
| C7 | Price | "Price" / "₱4,999" / "You get ₱2,500" | slider · button "Send" | — |
| C8 | Sent | "Sent!" / "Ready in about 30 minutes." | button "Back to map" | big tick |

## Creator — app/creator-more.html (money & me) — 9 screens
| # | Screen | Words | Controls | Visual |
|---|---|---|---|---|
| M1 | Join | "Work with Tendso" | fields "Name" "Mobile" · button "Join" | one photo of a field agent at a shop |
| M2 | Checking | "We're checking your details." / "We'll text you." | button "OK" | buddy |
| M3 | Learn | "Learn the job" + 4 lesson rows: "Say hello" "Take photos" "Ask questions" "Send it" (2 ticked) | button "Next lesson" | — |
| M4 | Earn | "This month" / "₱12,400" | button "Cash out" | simple bar chart (no labels); tab bar (Map, Add, Earn) |
| M5 | Cash out | "₱3,750" / "to mika@wise" | button "Send" | — |
| M6 | My sites | 4 rows: "Kalan · Live" "Héla · Live" "Vulca · Paid" "Labaná · Waiting" | none | small thumbnail per row |
| M7 | One site | "Kalan" / "Live" | button "Open site" | big site thumbnail |
| M8 | My link | "Your link" / "tendso.com/mika" | button "Share link" | Mika's photo |
| M9 | Me | "Mika Santos" + rows "Payouts" "Help" "Log out" | — | photo |

## Shared screens (js/screens.js) — same rules
welcome = O1 · interview-list → the "Talk start" screen (owner O6 / creator C5) · interview-cam = O7/C6 ·
shot-list → the "Photos start" screen (C3) · shot-guide = O8/C4 · design-picker = O9 · site-ready = O11 ·
agents-near = O14 · photos = a simple version of the photo task. Copy per screen as above; opts.owner picks
owner vs creator wording; opts.lang 'en' default (no second language shown).
