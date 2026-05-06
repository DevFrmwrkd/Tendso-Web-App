# UX Revision Spec — Mobile + Web Coordinated Implementation — 2026-04-23

> **Different from the MOBILE-PARITY-FIX-* series.** Those plans triage shared-deployment regressions or align deliberate behavior changes across `convex/` folders. This plan is a **product-driven UX/UI revision** spanning frontend code in both the mobile and web repos. It does not touch Convex schema or shared backend logic.
>
> Scope: **14 distinct UX issues** captured from a recent product/design review. Treat each as a separately-shippable change, not as one monolithic PR. The priority and recommended phasing are in §3.

## For the implementing agent

You are working in the **web platform's** repo unless explicitly told otherwise. The mobile repo (this one, `c:\dev\ndm`) is the reference for shared design decisions; mirror its patterns where they make sense for web.

This file lives in `ndm/docs/plans/` so the human can hand it to you alongside the mobile codebase as a reference. All paths starting with `app/`, `components/`, `services/`, `convex/` below mean the **web repo's** equivalents unless explicitly prefixed `ndm/`.

**Two starter items have already been shipped on the mobile side.** The web equivalents need to land in your repo too — see §4.10 (green borders) and §4.14 (numeric phone inputs).

---

## 1. Reading order

1. §2 establishes the scope boundary (what is and isn't in scope across these 14 items)
2. §3 is the recommended phasing — read this before picking what to implement first
3. §4 walks each of the 14 items in numbered order with web-side guidance, files to touch, and known mobile reference points
4. §5 captures cross-cutting concerns (theming, accessibility, i18n, RTL) that affect more than one item
5. §6 is the per-PR acceptance checklist template
6. §7 lists explicit non-goals so the agent doesn't accidentally scope-creep

---

## 2. Scope boundary

### In scope

- Frontend UI/UX changes in the **web repo** (Next.js / React)
- Component-level styling, validation, accessibility behavior
- Form structure (replacing free-text fields with structured inputs)
- Theme infrastructure (light/dark/system) for the web side
- Skeleton-loading components and their integration into existing screens

### Out of scope (do not bundle)

- `convex/schema.ts` changes — none of these 14 items require schema modifications. If implementation reveals a real schema gap, file it as a separate ticket per the convention from [`MOBILE-PARITY-FIX-R2.md §5`](./MOBILE-PARITY-FIX-R2.md).
- Shared backend mutations (`convex/withdrawals.ts`, `convex/creators.ts`, etc.) — those have their own parity-fix plans in this directory. Do not edit them as part of UX work.
- Native mobile (the `ndm/` repo) — this plan is for the **web** side. Mobile equivalents are tracked separately and the two starters (§4.10 and §4.14) have already shipped on mobile.
- Brand redesign — the green-border removal in §4.10 is a "remove visual noise" decision, not a permission to change brand colors elsewhere (the brand green `#10b981` is still the primary action color).
- Marketing/landing pages outside the authenticated app surface, unless explicitly named in an item below.

---

## 3. Recommended phasing

The 14 items vary widely in size. Shipping them in priority order rather than list order avoids rework and lets you ship visible improvements quickly while planning the larger features.

### Phase 1 — Quick visual + input fixes (1–2 days, low risk)

These can ship as one PR or four small PRs, your call. All are localized changes with no infrastructure dependencies.

- **#10** Remove green card borders → §4.10 (already shipped on mobile, mirror on web)
- **#14** Phone numbers reject letters → §4.14 (already shipped on mobile, mirror on web)
- **#3** Password visibility toggle on all 3 password fields → §4.3
- **#5** Phone number leading "0" preservation → §4.5

### Phase 2 — Form usability + accessibility (2–3 days)

Touches every form in the app. Coordinate with §5 cross-cutting concerns.

- **#7** Required-field asterisks + scrollable forms when keyboard appears → §4.7
- **#11** Notification icon visible on all pages → §4.11
- **#12** Editable email field on edit profile → §4.12
- **#4** Status bar visibility (web equivalent: ensure browser chrome/PWA status bar is consistent) → §4.4

### Phase 3 — Account page restructure + nav (2–3 days)

Affects information architecture; do these together so the redesign is cohesive.

- **#8** Account page UX — move Edit Profile / Change Password into Profile section, name clickable → §4.8
- **#9** Modern navigation icons → §4.9

### Phase 4 — Skeleton loading (3–5 days)

A real feature requiring a Skeleton component primitive plus integration into many screens.

- **#1** Skeleton loaders → §4.1

### Phase 5 — Profile photo editor (3–5 days)

Requires picking and integrating an image editor library; design decisions about UX flow.

- **#2** Rotate / Mirror / Crop controls in profile picture editor → §4.2

### Phase 6 — Address dropdowns (5–7 days)

Requires sourcing PSGC (Philippine Standard Geographic Code) data and building cascading dropdowns.

- **#6** Province / City / Barangay dropdowns replacing free-text address → §4.6

### Phase 7 — Dark mode (5–10 days)

Requires building a theme system if one doesn't exist. Touches every component.

- **#13** Light / Dark / Follow System theme support → §4.13

**Phases are independent.** You can pick them up in any order, but doing Phase 1 first delivers visible polish quickly while you plan the larger phases.

---

## 4. Per-item guidance

### 4.1 Skeleton Loading

**Problem:** Screens show blank states / spinners while data loads, creating perceived sluggishness.

**Scope:** Add skeleton loaders to all screens that fetch data from Convex on mount, so the user sees a structured placeholder of the eventual content rather than nothing.

**Implementation guidance:**

1. **Build a `Skeleton` primitive component** in `components/ui/Skeleton.tsx` (web) or wherever your design-system primitives live. Should accept `width`, `height`, `borderRadius`, `className` (or `style`) props. Implementation: a `<div>` with a shimmer animation (CSS `@keyframes` doing background-position translation on a gradient).
2. **Build a small library of skeleton variants** that mirror the eventual content's shape — e.g., `SkeletonCard`, `SkeletonAvatar`, `SkeletonTextLine`, `SkeletonStat`. These compose `Skeleton` with the right dimensions.
3. **Wire them into every Convex-querying screen.** For each screen, identify the loading state (where `useQuery` returns `undefined`) and render the matching skeleton there. Common spots:
   - Wallet / earnings dashboard
   - Submissions list
   - Creator profile
   - Referrals
   - Notifications inbox
4. **Skeleton durations should match real-world load.** If a query consistently returns in 100ms, skipping the skeleton entirely is fine. If it's 500ms+, the skeleton is the difference between "feels broken" and "feels responsive". Don't fake delays to "show off" the skeleton.

**Web-specific notes:**

- Use Tailwind's `animate-pulse` utility as a starting point if your repo uses Tailwind. It's good enough; no library needed. Only build a custom shimmer if `animate-pulse` doesn't fit the design.
- For SSR pages, prefer server-rendered placeholder content over client-side skeletons when possible. Skeletons are for client-fetched data.

**Mobile reference:** None yet. When mobile ships skeletons, the implementations should align on shape and timing.

**Files in scope (web):** every page or component that uses Convex `useQuery` in a loading-sensitive context.

### 4.2 Profile Picture Editing Controls

**Problem:** Rotate, Mirror, and Crop buttons in the profile picture editor are not visible. The editor likely renders the image but hides or omits the control buttons.

**Scope:** Make the three controls (Rotate 90°, Mirror horizontal, Crop) visible and functional across all screen sizes — both mobile-web and desktop-web layouts.

**Implementation guidance:**

1. **Locate the existing profile-picture editor component.** Likely in `components/profile/` or `app/(authenticated)/profile/edit-photo/`. Check if it's using a third-party library (`react-image-crop`, `react-easy-crop`, etc.) or a hand-rolled canvas implementation.
2. **Audit the controls:**
   - Are they rendered in the DOM? Inspect with browser devtools.
   - If rendered, are they hidden by CSS (`overflow: hidden`, parent with `display: none`, or off-screen positioning)?
   - If absent, the editor library likely supports them but they were never wired up.
3. **Render three explicit buttons** under the image preview: `Rotate 90°`, `Mirror`, `Crop`. Use clear labels or icons + tooltips. Don't bury them behind a "more" menu — the report says they're not visible, so put them in the primary action row.
4. **Test across viewports.** Render on a 320px-wide viewport (smallest mobile) and a 1920px-wide viewport (desktop). Buttons must be reachable at both. If they overflow on mobile, stack them vertically or use a sticky bottom bar.

**Web-specific notes:**

- If the editor uses `react-easy-crop`, the rotate/mirror/crop controls are not built in — you have to wire them yourself by passing `rotation` and `flipHorizontal` props from your own button handlers.
- Save the edited image as a Blob → upload to R2 via the existing `generateUploadUrl` action (see [`MOBILE-PARITY-FIX-R2.md`](./MOBILE-PARITY-FIX-R2.md) for current signature).

**Mobile reference:** Mobile uses `expo-image-manipulator` for transforms. The web equivalent is browser-native canvas operations.

**Files in scope (web):** profile-photo edit component(s); upload integration.

### 4.3 Password Visibility Toggle

**Problem:** The eye icon toggles visibility for only one password field. On screens with **Current Password**, **New Password**, and **Confirm Password**, only one field's eye works.

**Scope:** Each password field gets its own independent visibility toggle.

**Implementation guidance:**

1. **Find every page with multiple password fields.** Definitely the change-password page; possibly also signup if there's a confirm-password field.
2. **Each `<PasswordInput>` (or `<input type="password">`) needs its own state** — `useState<boolean>` for "is this field visible". One shared state across all fields is the bug.
3. **Pattern:**

```tsx
function PasswordField({ label, value, onChange }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="..."
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2"
      >
        {visible ? <EyeSlashIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
```

4. Use this component for **all three** password fields independently. Each one renders its own toggle, owns its own state.
5. Add `aria-label` for screen-reader accessibility (the icon-only button is invisible to assistive tech otherwise).

**Web-specific notes:**

- Heroicons or Lucide both have `Eye` and `EyeSlash` (or `EyeOff`) icons that match what the mobile app uses (Ionicons `eye-outline` / `eye-off-outline`).
- `autoComplete="current-password"`, `"new-password"`, `"new-password"` for the three fields respectively, so password managers behave correctly.

**Mobile reference:** Mobile already does this correctly per-field. Verify and mirror the per-field state pattern.

**Files in scope (web):** change-password page, signup page (if confirm-password exists).

### 4.4 Status Bar Visibility

**Problem on mobile:** Device status bar (battery, signal, time) is hidden behind app content on certain screens.

**Web equivalent:** On the web, this manifests as:
- PWA installed to mobile homescreen → status bar overlap with `<body>` content
- Browser address bar collapse causing content jumps when scrolling
- Custom full-bleed pages where the page background extends under the status bar in a way that hurts contrast

**Scope:** Ensure web app respects the device safe area on every page when accessed as an installed PWA or via mobile Safari/Chrome where the address bar collapses.

**Implementation guidance:**

1. In the root layout, add to the page CSS:
   ```css
   :root {
     --safe-area-top: env(safe-area-inset-top, 0);
     --safe-area-bottom: env(safe-area-inset-bottom, 0);
   }
   body {
     padding-top: var(--safe-area-top);
     padding-bottom: var(--safe-area-bottom);
   }
   ```
2. Add to the `<head>` (or Next.js `viewport` config):
   ```tsx
   export const viewport = {
     viewportFit: "cover",
     themeColor: "#10b981",
   };
   ```
3. Ensure the `<meta name="theme-color">` matches your top-of-page background. Mismatched theme color is the most common cause of "ugly status bar overlap" on installed PWAs.

**Web-specific notes:** This is irrelevant for desktop browsers but critical for PWA installs and mobile Safari. Test by adding the site to homescreen on iOS and verifying.

**Mobile reference:** Mobile's `expo-status-bar` provides the equivalent. The web has no mobile-app equivalent of the status bar; this is purely about safe-area layout.

**Files in scope (web):** root layout, global CSS.

### 4.5 Phone Number Input — Leading "0" Preservation

**Problem:** When the user selects a suggested phone number from autofill, the leading `0` is stripped, turning `09171234567` into `9171234567`.

**Root cause:** A `parseInt` somewhere in the input handler, or a `keyboardType="number-pad"` plus a value that's coerced to a number type at any point in the React state. Numbers can't have leading zeros.

**Scope:** Phone numbers stay as **strings** end-to-end. No `parseInt`, no `Number()`, no integer typing in the form state.

**Implementation guidance:**

1. **Audit every phone input handler in the web repo.** Look for any of these anti-patterns:
   - `value={Number(phone)}`
   - `setPhone(parseInt(value))`
   - `setPhone(+value)`
   - State typed as `useState<number>` for phone
2. **Replace with string handling end-to-end.** State should be `useState<string>("")`. Validation happens via regex on the string, not via numeric coercion.
3. **For the digit-only filter** (also fixes #14), use:
   ```ts
   onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
   ```
   This keeps the leading zero because `"09171234567".replace(/\D/g, "")` returns `"09171234567"` unchanged.
4. **Confirm the value preserved when persisted to Convex.** Convex `v.string()` schema preserves leading zeros; `v.number()` does not. The current schema uses `phone: v.optional(v.string())` per [`ndm/convex/schema.ts:21`](../../convex/schema.ts#L21) — keep it that way.

**Web-specific notes:**

- Browser autofill: set `autoComplete="tel"` so browsers offer phone-number suggestions correctly.
- Type the input as `<input type="tel">` (HTML), not `type="number"`. `type="number"` is the most common cause of leading-zero loss because the browser silently coerces to a numeric value.

**Mobile reference:** Mobile uses `keyboardType="number-pad"` and stores the value as a string (no `parseInt`). The leading-zero bug doesn't exist on mobile because there's no autofill suggestion path that does the coercion — but the same protective regex was added to mobile in this turn for belt-and-suspenders (see §4.14 commit).

**Files in scope (web):** every phone-input component; verify no number-typed phone state anywhere.

### 4.6 Full Address Input — Province / City / Barangay Dropdowns

**Problem:** The "Full Address" field is currently free-text. This produces inconsistent data ("Manila" vs "Metro Manila" vs "NCR" vs "Maynila") and breaks any downstream geographic analytics.

**Scope:** Replace the single free-text address field with three cascading dropdowns:

1. **Province** (or NCR / Metro Manila as a province-level entry)
2. **City / Municipality** (filtered by selected Province)
3. **Barangay** (filtered by selected City)

Plus a free-text "Street and house number" field for the actual delivery line.

**Implementation guidance:**

1. **Source the PSGC dataset.** PSGC = Philippine Standard Geographic Code, maintained by the PSA (Philippine Statistics Authority). Two pre-packaged options:
   - npm: `psgc-locations` or `philippine-locations` — small, JSON-based, suitable for a web bundle
   - PSGC official CSV: https://psa.gov.ph/classification/psgc — needs ETL into a JSON the frontend can consume (~5–15 MB depending on level)
2. **Decide where the data lives:**
   - **Bundled in the JS** (simpler, +~3MB to the bundle if you ship full barangay-level data)
   - **Convex query** (`api.locations.getProvinces`, `api.locations.getCitiesByProvince`, `api.locations.getBarangaysByCity`) — slower first interaction but no bundle bloat
   - **Static JSON files served from `public/`** with on-demand fetch — middle ground, recommended
3. **Build cascading dropdown component.** When Province changes, City list filters and selection clears. When City changes, Barangay list filters and selection clears.
4. **Schema decision:** the current `submissions` table at [`ndm/convex/schema.ts:36-102`](../../convex/schema.ts#L36-L102) has both `address` (string, required) and granular fields (`city`, `province`, `barangay`, `postalCode`). Map the new dropdowns directly into those granular fields; keep `address` as the street-line free-text. **No schema change needed** — those fields already exist.
5. **Backwards compatibility:** existing submissions only have `address` populated. Don't try to retroactively parse them into province/city/barangay — too lossy. Just use the new fields going forward; the old free-text remains in `address`.

**Web-specific notes:**

- Use a searchable dropdown (combobox) — there are 81 provinces, 1,634+ cities/municipalities, and 42,000+ barangays. A plain `<select>` is unusable at barangay level.
- Recommended libraries: `cmdk` (shadcn-style command menu), `@headlessui/react` Combobox, or `react-select`.

**Mobile reference:** Mobile currently has the same free-text problem. When this lands on web, mirror the dropdown component on mobile in a follow-up PR using `react-native-element-dropdown` or the equivalent.

**Files in scope (web):** business-submission form, edit-business-info form, anywhere else address is collected. Possibly: a new `components/address/PhilippineAddressDropdowns.tsx`.

### 4.7 Form Usability — Required Asterisks + Scrollable Forms

**Problem (a):** Required fields don't show a red asterisk to indicate required.

**Problem (b):** When the keyboard opens on mobile-web, it covers the active input and the form doesn't scroll to keep it visible.

**Scope:**

- (a) Every `<label>` for a required field renders a red `*` after the label text.
- (b) Forms are wrapped so they scroll into view above the soft keyboard.

**Implementation guidance for (a) — Required asterisks:**

1. Audit every form in the web repo. Identify which fields are required (React Hook Form `required: true`, server-side mutation that throws on missing field, etc.).
2. Build a tiny wrapper:
   ```tsx
   export function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
     return (
       <label className="text-sm font-medium text-zinc-700">
         {children}
         {required && <span className="text-red-500 ml-0.5" aria-label="required">*</span>}
       </label>
     );
   }
   ```
3. Replace plain `<label>` usage with `<FieldLabel required={...}>` everywhere.
4. The `aria-label="required"` on the asterisk ensures screen readers announce "required" — without it, the asterisk is a visual-only signal that fails accessibility audits.

**Implementation guidance for (b) — Scrollable forms:**

1. Wrap forms in a scrollable container that grows when the viewport shrinks (which happens when mobile soft keyboards open).
2. Set the page's HTML to use `viewport-fit=cover` and `interactive-widget=resizes-content` (newer Chrome/Safari) so the visual viewport shrinks when the keyboard opens.
3. Or use a `useEffect` that listens for `visualViewport.resize` and scrolls the focused input into view:
   ```ts
   useEffect(() => {
     const handler = () => {
       const active = document.activeElement;
       if (active instanceof HTMLElement && active.tagName === "INPUT") {
         active.scrollIntoView({ behavior: "smooth", block: "center" });
       }
     };
     window.visualViewport?.addEventListener("resize", handler);
     return () => window.visualViewport?.removeEventListener("resize", handler);
   }, []);
   ```

**Mobile reference:** Mobile uses `KeyboardAvoidingView` for (b) and inline `*` text for (a). Same UX intent on web.

**Files in scope (web):** every form; possibly a shared `FieldLabel` component and a `KeyboardAware` wrapper hook.

### 4.8 Account Page UX Improvement

**Problem:** Edit Profile and Change Password are top-level menu items separate from the user's profile. The user's name is displayed but is not clickable.

**Scope:**

1. Move **Edit Profile** and **Change Password** into the Profile section (so all profile-related actions are grouped).
2. Make the user's display name clickable — clicking it routes directly to Edit Profile.

**Implementation guidance:**

1. **Information architecture:** account/settings page should have these sections:
   - **Profile** — avatar, name (clickable → Edit Profile), email, phone. Inside this section: Edit Profile, Change Password.
   - **Payments** — Wise email, payout method, withdrawal history
   - **Notifications** — preferences
   - **Legal & Support** — privacy policy, terms, contact, sign out
2. **Make the name clickable:**
   ```tsx
   <Link href="/account/edit-profile" className="hover:underline">
     {creator.firstName} {creator.lastName}
   </Link>
   ```
3. **Keep accessibility:** the clickable name should have a visible focus state on keyboard navigation. Don't just rely on `cursor: pointer`.
4. **Don't break existing routes.** If the URL `/account/change-password` is bookmarked, keep it working; just change where the entry point lives in the menu.

**Mobile reference:** Mobile has the same issue. When this lands on web, mirror the IA decision on mobile in a follow-up PR.

**Files in scope (web):** account / settings page, profile section components.

### 4.9 Navigation Icon Design

**Problem:** Current navigation icons feel dated. Want a more modern, consistent design style.

**Scope:** Replace the current icon set with a modern, consistent one across all navigation surfaces (bottom tab bar on mobile-web, top nav / sidebar on desktop-web).

**Implementation guidance:**

1. **Pick one icon library and use it everywhere.** Mixing Heroicons + Lucide + custom SVGs is the most common cause of "inconsistent icons". Recommended: **Lucide React** (`lucide-react`) — large, modern, consistent stroke widths, MIT-licensed, ~14kb gzipped.
2. **Map old → new:** create a one-time spreadsheet of every icon currently in use and its Lucide equivalent. Examples:
   - `home-outline` (Ionicons) → `Home` (Lucide)
   - `wallet-outline` → `Wallet`
   - `people-outline` → `Users`
   - `person-outline` → `User`
   - `settings-outline` → `Settings`
3. **Match stroke width consistently** (Lucide defaults to 2px; use `strokeWidth={1.5}` if you want a lighter feel).
4. **Don't redesign all icons one-by-one.** Pick the library, swap the import, accept Lucide's design opinions for the whole app. Trying to handpick "just a few" icons reintroduces the inconsistency.

**Mobile reference:** Mobile uses Ionicons. Web should NOT necessarily use Ionicons too — pick what fits web's design language. Cross-platform "icon parity" is not a requirement; cross-platform "feel parity" (clean, modern, consistent) is.

**Files in scope (web):** every component that imports an icon. Likely a shared icon barrel file.

### 4.10 Card UI Styling — Remove Green Borders ✅ STARTER

**Problem:** Cards across the dashboard have a `borderWidth: 1, borderColor: '#10b981'` (brand green), creating visual noise.

**Scope:** Replace the green border with a subtle neutral border (`#e4e4e7` — zinc-200) for a cleaner, more minimal look. Brand green stays as the primary action color (buttons, links, active states); just remove it from card chrome.

**✅ Already shipped on mobile:**

The mobile repo replaced `borderColor: '#10b981'` with `borderColor: '#e4e4e7'` in:

- [`ndm/app/(app)/(tabs)/wallet.tsx`](../../app/(app)/(tabs)/wallet.tsx) (5 occurrences)
- [`ndm/app/(app)/(tabs)/referrals.tsx`](../../app/(app)/(tabs)/referrals.tsx) (4 occurrences)
- [`ndm/app/(app)/(tabs)/index.tsx`](../../app/(app)/(tabs)/index.tsx) (7 occurrences)
- [`ndm/app/(app)/(tabs)/profile.tsx`](../../app/(app)/(tabs)/profile.tsx) (2 occurrences)

**Explicitly NOT changed:** [`ndm/components/CertificateCard.tsx:23`](../../components/CertificateCard.tsx#L23) — the green border there is intentional decoration for the certificate visual. Apply the same exception on web if a similar specialty component exists.

**Implementation guidance for web:**

1. Grep the web repo for `border-emerald-500`, `border-green-500`, `border: 1px solid #10b981`, or whichever Tailwind / CSS variant the web uses.
2. Replace with `border-zinc-200` (Tailwind) or `#e4e4e7` (raw).
3. Verify the brand green is still used for **primary buttons**, **active tab indicators**, **success states**, and **focus rings** — those should remain green.

**Files in scope (web):** any component with green borders on cards. Grep is fast.

### 4.11 Notification Icon Accessibility

**Problem:** Notification icon (bell) is missing on some pages, breaking the user's ability to check notifications without navigating to the home screen.

**Scope:** Bell icon + unread badge present on every authenticated page's top bar (or persistent header).

**Implementation guidance:**

1. Move the notification icon out of any single page and into the **shared layout** — Next.js `app/(authenticated)/layout.tsx` or equivalent.
2. Compose it as a `<NotificationBell />` component that:
   - Renders the bell icon
   - Subscribes to `api.notifications.getUnreadCount` for the badge count
   - Renders a small red dot or numeric badge if `count > 0`
   - On click, opens the notifications panel or routes to `/notifications`
3. Ensure the click target is at least 44×44px (accessibility minimum).
4. Add `aria-label="Notifications"` and, if there's an unread count, `aria-label={`${count} unread notifications`}` for screen readers.

**Mobile reference:** Mobile has the same issue. After web ships, mirror on mobile by promoting the bell into the tab-bar header rather than per-screen.

**Files in scope (web):** authenticated layout(s); a new `NotificationBell` component if one doesn't exist.

### 4.12 Edit Profile — Email Field Editable

**Problem:** Email field on Edit Profile is read-only, but it's not clear why. Users want to change their email but can't.

**Scope:** Email field becomes editable. If there's a real reason it can't be (e.g., Clerk requires email verification before swap), the UI surfaces that reason clearly.

**Implementation guidance:**

1. **Investigate why it's currently disabled.** Likely options:
   - Email is the Clerk identity (changing it requires re-verification)
   - Email is the Convex `creators` row's primary key (it isn't — Clerk ID is the index)
   - Just leftover from when accounts were email-anchored
2. **If editable:** allow inline editing. Save calls `clerk.user.update({ primaryEmailAddress: ... })` then on success calls the Convex `creators.update` mutation to mirror the change.
3. **If editing requires verification:** disable the field but render a small "Change" link next to it that opens a verification modal. Don't leave the user staring at a grayed-out field with no explanation.
4. **Edge case:** if a user signed up via Google or TikTok OAuth, the email is owned by the OAuth provider and changing it via the app may not propagate. Surface that limitation: "Your email is managed by Google. Change it at google.com to update your account."

**Mobile reference:** Mobile has the same restriction. Coordinate the design decision (fully editable vs. verification-gated) and mirror it.

**Files in scope (web):** edit-profile page; possibly a verification-modal component.

### 4.13 Dark Mode Support

**Problem:** App is light-mode only. Many users prefer dark mode, especially for evening use.

**Scope:** Three-way theme toggle:

1. **Light** — current appearance
2. **Dark** — inverted color palette
3. **Follow System** — respects OS preference (`prefers-color-scheme`)

**Implementation guidance:**

1. **Pick a theme system:**
   - Tailwind's built-in `dark:` variant + `class="dark"` on `<html>` — simplest, native to Tailwind
   - `next-themes` package — handles SSR-safe theme detection, system preference, localStorage persistence — recommended
2. **Define a dark color palette.** Don't just invert white→black; use semantic tokens:
   - `bg-background` → `#ffffff` light, `#0a0a0a` dark
   - `text-foreground` → `#18181b` light, `#fafafa` dark
   - `border-border` → `#e4e4e7` light, `#27272a` dark
   - Brand green stays the same (`#10b981`) — it works on both backgrounds
3. **Audit every hardcoded color in the app.** Replace `bg-white` with `bg-background` (or whatever your token name is). Same for borders, text colors. This is the bulk of the work.
4. **Theme toggle UI:** in account/settings, three-radio choice. Persist to localStorage. On hydration, set `<html class="dark">` (or not) before render to avoid flash-of-wrong-theme.
5. **Test both themes for accessibility** — dark mode contrast ratios are a common failure point. Run a tool like Lighthouse or `axe` against both light and dark.

**Mobile reference:** Mobile is light-only. Coordinate token names so when mobile adds dark mode later, the design tokens match.

**Files in scope (web):** every component (color audit), root layout, settings page, a new `ThemeProvider` and `ThemeToggle`.

### 4.14 Phone Number Input — Numbers Only ✅ STARTER

**Problem:** Phone input fields accept letters even though they should only accept digits. On some Android keyboards or via paste, non-digit characters get into the field.

**Scope:** Phone inputs strictly numeric — letters and symbols stripped on input.

**✅ Already shipped on mobile:**

Each phone-input `onChangeText` was wrapped with a digit-stripping regex:

```ts
onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, ''))}
```

Plus `keyboardType` was tightened from `phone-pad` to `number-pad` where applicable (number-pad is strictly numeric on iOS; phone-pad allows `+`, `*`, `#`).

Files updated on mobile:

- [`ndm/app/(auth)/signup.tsx:618-628`](../../app/(auth)/signup.tsx#L618-L628) — primary phone field
- [`ndm/app/(auth)/signup.tsx:902-903`](../../app/(auth)/signup.tsx#L902-L903) — TikTok OAuth profile completion phone field
- [`ndm/app/(app)/edit-profile.tsx:360-370`](../../app/(app)/edit-profile.tsx#L360-L370) — edit-profile phone
- [`ndm/app/(app)/submit/info.tsx:326-335`](../../app/(app)/submit/info.tsx#L326-L335) — owner phone on business submission

**Implementation guidance for web:**

1. Find every phone input. Search for `type="tel"`, `name="phone"`, `placeholder="...phone..."`, etc.
2. Apply two protections together:
   - **HTML attribute:** `type="tel"` and `inputMode="numeric"` and `pattern="[0-9]*"`
   - **JavaScript filter:** wrap onChange to strip non-digits:
     ```tsx
     onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
     ```
3. The combination handles: user typing letters (filtered out), paste of formatted text like "(917) 123-4567" (filtered to "9171234567"), and autofill suggestions (preserved including leading zero — also fixes #4.5).

**Files in scope (web):** every form with a phone input.

---

## 5. Cross-cutting concerns

These touch more than one item above. Address them once and reuse.

### 5.1 Design tokens

If the web repo uses raw hex values across components, the dark mode work in §4.13 will be painful. Before starting Phase 7, audit the codebase for hardcoded colors and migrate to semantic tokens (`bg-background`, `text-foreground`, etc.). This is preparatory work, not a separate phase, but should happen before §4.13 is touched.

### 5.2 Accessibility (a11y)

Every item above has accessibility implications. Apply consistently:

- All interactive elements have a visible focus state for keyboard navigation
- All icon-only buttons have `aria-label`
- All forms have associated `<label>` elements (not just placeholder text)
- Color contrast meets WCAG AA in both light and dark mode (4.5:1 for normal text, 3:1 for large)
- Form errors are announced to screen readers via `aria-live="polite"` regions

Run `axe` browser extension or Lighthouse a11y audit against the deployed app at the end of each phase.

### 5.3 Mobile-web responsiveness

Several items (#2 photo editor controls, #7 scrollable forms, #11 notification icon) explicitly call out small-screen behavior. Test every change at:

- 320px width (iPhone SE)
- 768px width (iPad portrait)
- 1024px width (small desktop)
- 1920px width (full desktop)

The web repo is presumably already responsive. The trap is regressions — a fix on desktop that breaks on mobile-web.

### 5.4 i18n / RTL

Currently the app is English + Filipino. None of the 14 items add language requirements. But: when adding the asterisk in §4.7, make sure RTL-language-future-readiness uses logical CSS properties (`margin-inline-start`, etc.) where appropriate. Cheap to do now, expensive to retrofit.

---

## 6. Per-PR acceptance checklist (template)

Copy this into the description of every PR that lands one of the 14 items:

```markdown
### Acceptance criteria

- [ ] Item number(s) addressed: #X (link to §4.X of UX-REVISION-2026-04-23.md)
- [ ] Visual verification: screenshots attached for both desktop and mobile-web viewports
- [ ] Accessibility: keyboard-navigable, screen-reader-tested for new interactive elements
- [ ] Dark mode (if applicable): looks correct in both light and dark themes
- [ ] No regressions in adjacent features (manually tested the flows the change touches)
- [ ] No `convex/schema.ts` changes (per §2 scope boundary)
- [ ] No `convex/*.ts` mutation/query changes unless explicitly required and documented in the PR
- [ ] Mobile-referenced — if the mobile repo has an equivalent implementation, the web matches the design intent (not necessarily the code)
```

---

## 7. Explicit non-goals

Things to NOT do as part of this revision, even if they seem related:

- **Don't redesign the brand.** The green `#10b981` stays as the primary action color. §4.10 only removes it from card chrome.
- **Don't change the schema.** Per §2 scope boundary, every item above can be done without schema modifications. The `address` / `province` / `city` / `barangay` fields already exist in `submissions` for §4.6.
- **Don't bundle items across phases.** Each phase is shippable independently. Bundling makes rollback hard and reviews painful.
- **Don't add new third-party dependencies without justification.** Skeleton (§4.1) does not need a library. Dark mode (§4.13) reasonably uses `next-themes`. Address dropdowns (§4.6) reasonably need a PSGC dataset. But "we should add Framer Motion" or "let's swap the form library" are scope-creep.
- **Don't ship the dark mode work without first migrating to design tokens.** §5.1 is a hard prerequisite for §4.13. If you skip it, you'll touch every component twice.
- **Don't refactor unrelated code.** Touched a file to add an asterisk? Don't also clean up its imports or rename a prop. Mixing refactors into UX PRs is the most common cause of unreviewable diffs.

---

## 8. Captured diagnostics — fill in before each PR

Before opening a PR for any of the 14 items, document the current state and the planned approach:

> **Item being addressed (one of #1–#14):**
> _(none recorded yet — fill in per PR)_
>
> **Files touched:**
> _(list the web repo files modified)_
>
> **Phase from §3:**
> _(Phase 1–7)_
>
> **Dependencies on other items:**
> _(e.g., #13 depends on §5.1 design-token migration)_
>
> **Mobile reference status:**
> _(shipped / in progress / not started — link to commit if shipped)_

---

## 9. References

- Mobile starter implementations (in this repo, this turn):
  - Green-border removal commit (mirror in §4.10): four files, see grep for `borderColor: '#e4e4e7'` in `ndm/app/(app)/(tabs)/`
  - Phone-numeric filter commit (mirror in §4.14): three files, see grep for `replace(/[^0-9]/g, '')` in `ndm/app/`
- Companion plans in this directory:
  - [`MOBILE-PARITY.md`](./MOBILE-PARITY.md) — index of shared-deployment parity work
  - [`MOBILE-PARITY-FIX-R2.md`](./MOBILE-PARITY-FIX-R2.md) — current `generateUploadUrl` signature (relevant for §4.2 photo upload)
  - [`MOBILE-PARITY-FIX-WISE-FEE-AND-MIN.md`](./MOBILE-PARITY-FIX-WISE-FEE-AND-MIN.md) — most recent intentional behavior change (similar non-regression pattern as this plan)
- Mobile codebase areas referenced for design intent:
  - Wallet UI: [`ndm/app/(app)/(tabs)/wallet.tsx`](../../app/(app)/(tabs)/wallet.tsx)
  - Profile: [`ndm/app/(app)/(tabs)/profile.tsx`](../../app/(app)/(tabs)/profile.tsx)
  - Edit profile: [`ndm/app/(app)/edit-profile.tsx`](../../app/(app)/edit-profile.tsx)
  - Sign up form: [`ndm/app/(auth)/signup.tsx`](../../app/(auth)/signup.tsx)
- External references:
  - PSGC (Philippine Standard Geographic Code): https://psa.gov.ph/classification/psgc
  - Lucide React icons: https://lucide.dev/
  - next-themes: https://github.com/pacocoursey/next-themes
  - Tailwind dark mode: https://tailwindcss.com/docs/dark-mode
  - WCAG 2.1 contrast requirements: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
