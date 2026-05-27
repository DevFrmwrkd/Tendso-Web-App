# Web-side Lead CRM — Creators platform integration

> **Sister doc to [WEB-SYNC-MOBILE-FEATURES.md](./WEB-SYNC-MOBILE-FEATURES.md).** That doc covers the *admin* surfaces (Pending Approval queue, Lead Content editor). This doc covers the **public-facing web Creators platform** — the page that signed-in creators visit on the web (not admin) to view, search, and manage leads alongside the mobile app.
>
> Single source of truth for the web Creators platform's "Leads" page (URL: `/creators/leads` or `/dashboard/leads`, exact slug owned by web team). Mirrors mobile's `app/(app)/leads/*` 1:1 in behavior, and adopts the Editorial Paper design system (greens + khaki — NOT orange/terracotta) so the web and mobile apps feel like one product.

---

## Why this needs to exist

Today, mobile creators can:
- See the team-wide social feed of leads at `app/(app)/leads/index.tsx`
- Drill into a single lead at `app/(app)/leads/[leadId].tsx`
- See admin-curated social-card content when present
- Filter, search, and "Only mine" the list

Web creators can do **none** of this. The web Creators platform's existing screens (Home, Referrals, Wallet, Profile) have no Leads tab, even though the Convex queries `listForMobileCRM` and `getDetailForMobileCRM` are deployed in prod and would work the same way from the web client.

Goal: ship a `/creators/leads` route on the web that's feature-equivalent to mobile's leads tab, using the same Convex queries (no new backend), styled in the Editorial Paper system to match mobile's redesign.

---

## Out of scope (explicit)

- Admin surfaces — those are covered in [WEB-SYNC-MOBILE-FEATURES.md Step 10](./WEB-SYNC-MOBILE-FEATURES.md). The admin uses `getDetailForAdmin` + `updateAdminContent`. The Creators page uses `listForMobileCRM` + `getDetailForMobileCRM`. Different consumers, different routes.
- Schema changes — none. Everything is already deployed.
- New Convex functions — none. The queries the mobile app already calls are the contract.
- Submissions, Wallet, Referrals web pages — separate redesign work. This doc is leads-only.
- Native push notifications on web — out of scope for v1.

---

## Convex contract (frozen — do not modify)

All four functions below are already deployed to `prod:energetic-panther-693`. The web Creators page must call them with the **exact** argument shapes shown.

### Read: list view

```typescript
api.leads.listForMobileCRM({
  search?: string,
  statusFilter?: "all" | "new" | "contacted" | "qualified" | "converted" | "lost",
  onlyMine?: boolean,
})
```

**Returns** `{ leads: EnrichedLead[], stats: { total, new, contacted, qualified, converted, lost, mine } }`.

Each `EnrichedLead` carries: `_id`, `name`, `phone`, `email`, `source`, `status`, `createdAt`, `businessName`, `businessType`, `businessCity`, `interviewerCount`, `submittedBy: { creatorId, displayName, profileImage }`, `isMine`, `isHot` (interviewerCount ≥ 3), and the admin content fields (`adminDescription`, `previewImageUrl`, `externalPreviewUrl`, `hasEnrichedContent`).

Auth: requires a signed-in Convex identity. Anonymous users get `{ leads: [], stats: { total: 0, ... } }`.

### Read: detail view

```typescript
api.leads.getDetailForMobileCRM({ id: Id<"leads"> })
```

**Returns** `{ lead, submittedBy, isMine, business, adminContent, interviewers, interviewerCount, notes }` or `null` if not found.

### Write: add note

```typescript
api.leadNotes.add({ leadId: Id<"leads">, content: string })
```

Web should mirror mobile's behavior — any signed-in creator can post a note on any lead.

### Write: update status

```typescript
api.leads.updateStatus({ id: Id<"leads">, status: "new" | "contacted" | "qualified" | "converted" | "lost" })
```

Mobile gates this to "only the original submitter or admin can change status" — replicate that gate client-side too (use `isMine` from the detail payload; admin elevation is via Clerk roles, same as everywhere else).

---

## Page architecture (web)

Two routes under the existing authenticated Creators platform shell:

| Route | Purpose | Convex calls |
|---|---|---|
| `/creators/leads` | List view — filters, search, social-card cards | `listForMobileCRM` |
| `/creators/leads/[leadId]` | Detail view — full lead, interviewers, notes | `getDetailForMobileCRM`, `leadNotes.add`, `leads.updateStatus` |

Both routes should be **server-rendered shell + client-rendered data** (Next.js App Router pattern) so the page paints fast and Convex hydrates the live data.

---

## List page UX spec (`/creators/leads`)

Visual reference: mobile's `app/(app)/leads/index.tsx`. The web should be the desktop expansion of that pattern, NOT a separate design language.

### Above-the-fold

```
┌──────────────────────────────────────────────────────────────────┐
│  STEP 03 / TEAM LEADS                          ● LIVE             │
│                                                                    │
│  All leads,                                                        │
│  every interview.                ← Display: Instrument Serif       │
│                                                                    │
│  The whole team's hunt — including yours.                         │
│  Last sync: 12s ago · 38 leads · 6 hot                            │
└──────────────────────────────────────────────────────────────────┘
```

- Eyebrow: mono `STEP 03 / TEAM LEADS` (matches the auth page eyebrow pattern)
- Live dot pulses next to "LIVE" if Convex socket connected
- Display headline: Instrument Serif, two-line. The italic word (here: "every") is `colors.accent` emerald
- Sub-copy: Onest 15px, ink-2

### Filters row (sticky on scroll)

| Filter | Token | Notes |
|---|---|---|
| Search input | `EditorialInputFrame` | Search across business name, owner name, phone, lead name, submitter display name. Debounce 300ms. |
| Status pill row | `Pill` × 6 | `All / New / Contacted / Qualified / Converted / Lost`. Stat counts in parens (`New · 12`). |
| "Only mine" toggle | `Pill` (active state) | When active, sets `onlyMine: true`. Counts in pill labels update to filtered counts. |

### Lead cards (grid)

- Desktop: 2–3 column grid (CSS `repeat(auto-fill, minmax(360px, 1fr))`)
- Tablet: 2 cards per row
- Mobile (web responsive): 1 card per row — should match mobile native screen closely

Each card has **two render modes** depending on `hasEnrichedContent`:

**Standard mode** (no admin content):
```
┌────────────────────────────────────────┐
│  ●  BUSINESS NAME              ★ HOT   │  ← header: avatar of submittedBy, mono label, optional hot star (red-orange, NOT brand orange)
│     City, Type                          │
│  ┌──────────────────────────────────┐  │
│  │ Owner: Maria Cruz                 │  │
│  │ Phone: 0917 234 1234              │  │
│  │ NEW · Submitted by Maria S. · 2d │  │  ← status pill + submitter chip + time
│  └──────────────────────────────────┘  │
│  [View detail →]                       │
└────────────────────────────────────────┘
```

**Social-card mode** (when `hasEnrichedContent === true` — FB-style):
```
┌────────────────────────────────────────┐
│  Maria S. · 2d ago               ⋯     │  ← submitter strip (avatar + display name)
│                                          │
│  Lorenzo's Sari-Sari Store              │  ← serif headline
│  in italics for accent word              │
│                                          │
│  [hero image — previewImageUrl]         │  ← 16:9 max-h-280 cover
│                                          │
│  Admin description text (max 500 ch)... │  ← Body, ink-2
│                                          │
│  ┌──────────────────────────────────┐  │
│  │ EXTERNAL LINK ↗                   │  │  ← externalPreviewUrl as link card
│  └──────────────────────────────────┘  │
│                                          │
│  NEW · 3 interviewers                  │
└────────────────────────────────────────┘
```

Both card modes are clickable (full card → detail route). Use semantic `<article>` and an inner `<Link>` for keyboard nav.

### Empty + loading + error

- Loading: skeleton cards (paper-2 background, animated shimmer using `colors.rule` → `colors.ruleStrong`)
- Empty (no leads at all): editorial empty state — large serif "Nothing yet." + Onest sub-copy "The team's leads will appear here as soon as someone submits a business." + Door button "Submit a business" linking to `/creators/submit`
- Empty (filters applied): "No leads match these filters." + ghost Door "Clear filters"
- Error: `colors.danger` banner, no retry button (Convex auto-retries)

---

## Detail page UX spec (`/creators/leads/[leadId]`)

Two-column on desktop, single-column on tablet/mobile.

### Left column (60% width)

1. **Breadcrumb** — `STEP 03 / TEAM LEADS / Lorenzo's Sari-Sari Store`. Last segment serif italic if admin-curated.
2. **Submitter strip** — Avatar + display name + relative time ("Submitted by Maria S. · 2d ago"). If `isMine`, append a small `MINE` mono pill.
3. **Status row** — current status as a large pill. If `isMine` or admin, click to open status update dropdown. Status changes write via `leads.updateStatus`.
4. **Admin social card** (if `hasEnrichedContent`) — exact same FB-style render as the list card, full-width.
5. **Business details** — paper-3 Card with `business.businessName`, `businessType`, address, city, owner name + phone, etc. Click-to-call on the phone.
6. **Other interviewers** — paper-3 Card. List of interviewers from `detail.interviewers`. Each row: avatar + display name + time + submission status pill. Used to surface "this business has been interviewed 3 times — it's hot."
7. **Notes feed** — paper-3 Card. List of notes (latest first). Below the list, an `EditorialField` for posting a new note. POST goes to `leadNotes.add`. Optimistic update; show toast on failure.

### Right column (40% width — sticky on desktop)

1. **Quick contact card** — phone (click-to-call), email (click-to-mailto), copy buttons next to each.
2. **Lead metadata** — created date, source, lead ID (small mono).
3. **Submission link** — link to the underlying submission detail in the admin / public submission page, if visible to creators.

### Mobile (web responsive)

Collapse to single column. Sticky right column becomes a "Quick actions" bottom sheet triggered by a Door button.

---

## Design system — Editorial Paper (web port)

> **Quoted from the mobile theme** (`ndm/theme/tokens.ts`). Use these tokens verbatim — no custom palette extensions, no terracotta/orange anywhere.

### Typography stack

Load all three Google Fonts in the layout:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Onest:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
  rel="stylesheet"
/>
```

| Token | Family | Used for |
|---|---|---|
| `--font-serif` | `"Instrument Serif", Georgia, serif` | Display headlines, large numbers |
| `--font-serif-italic` | `"Instrument Serif"` italic | Accent word in headline (set `font-style: italic` + `color: var(--color-accent)`) |
| `--font-sans` | `"Onest", system-ui, sans-serif` | Body, buttons, form labels |
| `--font-mono` | `"JetBrains Mono", Menlo, monospace` | Eyebrows, mono labels, timestamps |

### Color palette (greens + khaki — final, no orange)

```css
:root {
  /* Paper — warm khaki off-whites (page bg, card bg) */
  --color-paper:    #F8F5EE;
  --color-paper-2:  #EFEBE0;
  --color-paper-3:  #FCFAF5;

  /* Ink — near-black, cool (text + primary surfaces) */
  --color-ink:   #1B1C24;
  --color-ink-2: #3C3F4A;
  --color-ink-3: #7A7E8A;

  /* Emerald accent (replaces NEO LAB's terracotta — brand consistency) */
  --color-accent:        #047857;  /* italic display emphasis */
  --color-accent-ink:    #064E3B;
  --color-accent-bg:     #D1FAE5;
  --color-accent-solid:  #10B981;  /* primary "door" fills */

  /* Live (real-time markers) */
  --color-live:      #3FA86A;
  --color-live-soft: #D4EFDE;

  /* Rules / dividers (warm khaki) */
  --color-rule:        #E0D8C9;
  --color-rule-strong: #B7AC95;

  /* Status (CRM lead pipeline) */
  --color-status-new-bg:        #E4E9F0;  --color-status-new-ink:        #1F3654;
  --color-status-contacted-bg:  #FBE9C4;  --color-status-contacted-ink:  #C68A12;
  --color-status-qualified-bg:  #EDE9FE;  --color-status-qualified-ink:  #6D28D9;  /* muted purple, not bright */
  --color-status-converted-bg:  #D1FAE5;  --color-status-converted-ink:  #064E3B;
  --color-status-lost-bg:       #F3D7CF;  --color-status-lost-ink:       #B43A1F;

  /* Critical */
  --color-warn:   #C68A12;
  --color-danger: #B43A1F;
}
```

**The "Hot" badge** (interviewerCount ≥ 3): use `--color-danger-bg` + `--color-danger` text, NOT brand orange. Reads as urgency, not as a brand color.

### Component patterns (mirror mobile primitives)

| Mobile primitive | Web equivalent |
|---|---|
| `<Display size="lg">` | `<h1 className="serif text-6xl tracking-tight">` |
| `<Body size="md">` | `<p className="sans text-base text-ink-2">` |
| `<Label tracking={1.4}>` | `<span className="mono text-[11px] tracking-[0.12em] uppercase text-ink-3">` |
| `<Door variant="solid">` | Black-ink button with mono caption above sans label, right arrow icon |
| `<Pill active>` | Ink-filled chip with paper text |
| `<Card>` | `bg-paper-3 border border-rule rounded-[18px] p-4` |
| `<LiveDot>` | Pulsing 7px green dot (CSS keyframe animation) |
| `<Avatar name="Maria">` | Round; if no image, render Instrument Serif initial centered on ink-3 bg |
| `<Rule>` | `h-px bg-rule` |
| `<EditorialField>` | Paper-3 input frame, mono label under, focused border ink |

Build these as web React components and reuse across the redesign — same pattern as mobile's `components/ui/primitives.tsx`.

### Spacing scale

```css
--space-xs: 4px;   --space-sm: 8px;   --space-md: 16px;
--space-lg: 24px;  --space-xl: 40px;  --space-2xl: 64px;
```

### Radius scale

```css
--r-xs: 8px;   --r-sm: 12px;   --r-md: 18px;
--r-lg: 24px;  --r-xl: 32px;   --r-pill: 999px;
```

### Shadows (subtle, warm — not material)

```css
--shadow-soft:   0 2px 8px rgba(0,0,0,0.06);
--shadow-lifted: 0 12px 24px rgba(0,0,0,0.12);
```

### Critical "do not" rules

- ❌ No orange. No terracotta. No `#f59e0b`. No `#ea580c`. If you see those, replace with `--color-warn` or `--color-accent` depending on context.
- ❌ No SaaS-y purple gradients on cards.
- ❌ No Inter, no Roboto, no Geist. Onest is the only sans. Instrument Serif is the only display.
- ❌ No `border-radius: 4px` — too sharp. Minimum radius is 8px (`--r-xs`).
- ❌ Don't put emerald on every button. Reserve `--color-accent-solid` for "the win" — Approve a status change, Submit a note successfully. Default primary button is ink-solid.

---

## State management

- **Convex hooks**: `useQuery(api.leads.listForMobileCRM, args)` and `useQuery(api.leads.getDetailForMobileCRM, { id })`. Reactive — no manual refresh.
- **Mutations**: `useMutation(api.leadNotes.add)` and `useMutation(api.leads.updateStatus)`. Optimistic UI for note posting (append immediately, roll back on error).
- **URL state**: filters (`status`, `search`, `onlyMine`) live in the URL search params so creators can share/bookmark filtered views.
- **Auth gate**: route protected by the existing Clerk session middleware. Unauthenticated users redirect to `/sign-in?next=/creators/leads`.

---

## Performance budget

| Metric | Budget |
|---|---|
| LCP | ≤ 1.8s on Fast 4G |
| Card grid render with 200 leads | < 16ms paint |
| Search debounce | 300ms |
| Lead detail server response | < 250ms p95 (Convex hosted) |

**Pagination:** the existing `listForMobileCRM` loads ALL leads in one shot (mobile expects this for the social feed). If the prod lead count grows past ~500, the web should add cursor pagination — propose a backend change in a follow-up PR, do not patch around it client-side.

---

## Accessibility

- Color contrast: ink on paper = 14.8:1 (AAA). Accent-ink on accent-bg = 7.1:1 (AAA).
- All interactive elements keyboard focusable; visible focus ring (2px ink, 2px offset).
- Lead cards: full card is the link target; nested buttons (status change, copy phone) use `event.stopPropagation()` and have their own `aria-label`.
- "Live" badge announces "live data" to screen readers via `aria-live="polite"` on the stats strip.
- Hot badge: don't rely on color alone — include the word "HOT" in the visual + an `aria-label` of "Hot lead — 3 or more interviewers".

---

## Implementation order (suggested)

1. **Day 1** — Create the web design-system primitives (Display, Body, Label, Door, Pill, Card, LiveDot, Avatar, EditorialField, Rule). Drop them in a new `components/editorial/` folder. Add Google Fonts to the root layout. Write a Storybook (or equivalent) page that renders every primitive in both light and dark theme (web supports a dark mode toggle by swapping the `--color-*` vars on `[data-theme="ink"]`).
2. **Day 2** — Build the list page route. Hook `listForMobileCRM`. Render the filter row + standard-mode card. Skip social-card mode and detail page.
3. **Day 3** — Add social-card render mode. Add empty/loading/error states. Add URL state syncing.
4. **Day 4** — Build the detail page. Hook `getDetailForMobileCRM`. Render submitter strip, business card, interviewers, notes feed.
5. **Day 5** — Wire `leadNotes.add` (optimistic) and `leads.updateStatus` (with the `isMine`/admin gate). QA pass.
6. **Day 6** — Mobile-responsive pass. Sticky filter bar, single-column collapse, mobile-optimized note input.
7. **Day 7** — Performance pass, a11y audit, ship behind a feature flag for internal review before rolling out.

---

## Open questions for the web team

- [ ] **Route slug**: `/creators/leads` or `/dashboard/leads`? Mobile uses `/(app)/leads/` — propose matching the structure.
- [ ] **Dark mode**: mobile is paper-only today. Should the web do paper-only too, or ship `[data-theme="ink"]` from day one? (Mobile follows web's lead here — if web ships dark, mobile will too.)
- [ ] **Feature flag**: which flag system are we using? Should this hide behind a `FF_WEB_LEADS_CRM` or roll out to all signed-in creators at once?
- [ ] **Empty state CTA**: the "Submit a business" Door — does the web Creators platform already have a `/creators/submit` route, or does this need to be a deep-link into the mobile app?

---

## What MUST NOT change

- ❌ Do not modify the Convex queries listed above. They are deployed in prod and consumed by mobile — any breaking change reverses the mobile launch.
- ❌ Do not add new Convex fields without a sister PR to mobile. All shared schema changes go through [WEB-SYNC-MOBILE-FEATURES.md](./WEB-SYNC-MOBILE-FEATURES.md).
- ❌ Do not introduce a second design system. If a primitive is missing, extend `components/editorial/` — don't fall back to the existing zinc/emerald admin styles. The user has been explicit: greens + khaki, no orange, no SaaS look.
- ❌ Do not call admin-only queries (`getDetailForAdmin`, `updateAdminContent`, `generatePreviewImageUploadUrl`, `listPendingApproval`, `approveCreator`) from this page. They are admin-gated and will throw for regular creators.

---

## Related docs

- [WEB-SYNC-MOBILE-FEATURES.md](./WEB-SYNC-MOBILE-FEATURES.md) — admin web surfaces, Convex schema sync, Editorial Paper tokens (Step 10.5)
- [MOBILE-CRM-LEADS.md](./MOBILE-CRM-LEADS.md) — mobile-side leads implementation that this web page mirrors
- [UI-REDESIGN-EDITORIAL-PAPER.md](./UI-REDESIGN-EDITORIAL-PAPER.md) — design system origin doc
- `ndm/theme/tokens.ts` — canonical token source
- `ndm/components/ui/primitives.tsx` — mobile primitive reference (mirror these on web)
- `NEO LAB/For Creators.html` — original design inspiration (note: this uses terracotta — we replace it with emerald)
