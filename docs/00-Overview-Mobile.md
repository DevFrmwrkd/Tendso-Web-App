# Mobile App Overview — Tendso

## What Is This App?

Tendso is a React Native mobile app that helps Filipino "creators" (field agents) digitize local businesses. Creators visit a small business, collect information (photos, video/audio interview, business details), and submit it through the app. The platform then generates a website for the business, deploys it, and tracks leads — the creator earns a payout for each successful submission.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| **Framework** | Expo SDK 54 + React Native 0.81 | Managed workflow, new architecture enabled |
| **Router** | Expo Router (file-based) | Typed routes enabled |
| **Styling** | NativeWind 4.x + Tailwind CSS 3.4 | Utility-first styling via className |
| **Backend** | Convex 1.31+ | Real-time database, serverless functions, file storage |
| **Authentication** | Clerk (`@clerk/clerk-expo` 2.x) | Email/password + Google OAuth |
| **Auth Integration** | `ConvexProviderWithClerk` | Clerk provides the auth token to Convex |
| **File Storage** | Cloudflare R2 | Photos uploaded directly via presigned URLs (AWS Sig V4) |
| **Transcription** | Groq Whisper API | Audio/video interview → text transcription |
| **Push Notifications** | Expo Notifications + Expo Push API | FCM on Android, APNs on iOS |
| **AI Content Pipeline** | Airtable (staging) → AI enhancement → Convex | Business content + image generation for websites |
| **Payments** | Wise API | PHP bank transfers for creator payouts |

---

## Authentication Flow

Authentication is handled by **Clerk** with **Convex** as the backend database. There is no Supabase in this project.

### How It Works

1. **Clerk** manages user identity (signup, login, sessions, OAuth, email verification)
2. **Convex** stores the application data (creators, submissions, earnings, etc.)
3. `ConvexProviderWithClerk` in the root layout bridges the two — Clerk's session token is passed to Convex for authenticated queries/mutations

### Providers (Root Layout)

```tsx
// app/_layout.tsx → providers/AppProviders.tsx
<ClerkProvider publishableKey={CLERK_KEY} tokenCache={tokenCache}>
  <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
    <NetworkProvider>
      {/* App routes */}
    </NetworkProvider>
  </ConvexProviderWithClerk>
</ClerkProvider>
```

- `tokenCache` uses `expo-secure-store` for persistent session storage
- Auth state (`isSignedIn`) drives routing: signed in → `/(app)/(tabs)`, signed out → `/(auth)/login`
- Offline fallback: caches `ndm_was_signed_in` in AsyncStorage, bypasses Clerk load wait if offline
- 10-second force-render timeout if Clerk initialization hangs

### Signup Flow

1. User enters first name, last name, email, password, optional phone, optional referral code
2. `signUp.create()` via Clerk creates the user
3. `signUp.prepareEmailAddressVerification()` sends a 6-digit code
4. User enters code → `signUp.attemptEmailAddressVerification()`
5. On success: `creators.create` mutation inserts a new creator record in Convex with:
   - `clerkId` (Clerk user ID)
   - `referralCode` (auto-generated: 2 chars first name + 1 char last name + 6 random alphanumeric)
   - `referredByCode` (if entered — triggers referral record creation)
   - `balance: 0`, `totalEarnings: 0`, `role: "creator"`, `status: "active"`
6. Session is activated → app navigates to dashboard

### Login Flow

1. User enters email + password
2. `signIn.create()` via Clerk authenticates
3. Session activated → navigates to dashboard
4. On first dashboard load, if no creator record exists (e.g., OAuth user), one is auto-created

### Google OAuth

1. `startOAuthFlow()` opens browser-based Google sign-in
2. Redirect URL: `negosyodigital://` (custom scheme)
3. On success, session is set → dashboard loads → creator record auto-created if missing

### Forgot Password

1. User enters email → `signIn.create({ strategy: "reset_password_email_code" })`
2. 6-digit code sent to email
3. User enters code + new password (minimum 8 characters)
4. Password strength indicator (4-level: weak/fair/good/strong)
5. On success → redirects to login

---

## App Structure (Complete File Tree)

```
app/
├── _layout.tsx                    # Root layout (AppProviders wrapper)
├── index.tsx                      # Welcome/landing → routes to auth or app
├── +not-found.tsx                 # Catch-all for unmatched routes (redirects by auth state)
├── (auth)/
│   ├── _layout.tsx                # Auth group layout (Stack, slide animations)
│   ├── login.tsx                  # Email/password + Google OAuth login
│   ├── signup.tsx                 # Email signup with verification + referral code
│   └── forgot-password.tsx        # Password reset via email code
└── (app)/
    ├── _layout.tsx                # App group layout (requires auth, offline sync)
    ├── dashboard.tsx              # Redirect shim → /(app)/(tabs)/ (handles legacy deep-links)
    ├── onboarding.tsx             # First-time profile completion
    ├── training.tsx               # Training intro screen
    ├── training-lessons.tsx       # 5 expandable training lessons
    ├── certification-quiz.tsx     # 5-question certification quiz
    ├── notifications.tsx          # All notifications list
    ├── edit-profile.tsx           # Edit profile form + avatar upload
    ├── change-password.tsx        # Change password with strength indicator
    ├── help-faq.tsx               # Help & FAQ (4 sections, 12 items)
    ├── privacy-policy.tsx         # Privacy Policy (12 sections)
    ├── terms-of-service.tsx       # Terms of Service (12 sections)
    ├── (tabs)/
    │   ├── _layout.tsx            # Bottom tab bar with central FAB
    │   ├── index.tsx              # Home/Dashboard
    │   ├── referrals.tsx          # Referral program
    │   ├── wallet.tsx             # Wallet + withdrawals
    │   └── profile.tsx            # Profile + settings menu
    ├── submissions/
    │   ├── index.tsx              # All submissions list
    │   └── [id].tsx               # Submission detail / continue draft
    └── submit/
        ├── info.tsx               # Step 1: Business info form
        ├── photos.tsx             # Step 2: Upload business photos
        ├── interview.tsx          # Step 3: Record video/audio interview
        ├── review.tsx             # Step 4: Review & submit
        └── success.tsx            # Submission confirmation
```

---

## Bottom Tab Bar — Navigation (`app/(app)/(tabs)/_layout.tsx`)

The app uses a **custom bottom tab bar** with 5 visible slots: 4 standard tabs and a raised center FAB (Floating Action Button) for the primary action.

### Tab Layout (Left to Right)

| Position | Tab | Icon (Inactive / Active) | Route |
|---|---|---|---|
| 1 | **Home** | `home-outline` / `home` | `/(app)/(tabs)/` |
| 2 | **Referral** | `people-outline` / `people` | `/(app)/(tabs)/referrals` |
| 3 (Center) | **Submit** (FAB) | `add` (white, inside green circle) | `/(app)/submit/info` |
| 4 | **Wallet** | `wallet-outline` / `wallet` | `/(app)/(tabs)/wallet` |
| 5 | **Profile** | `person-outline` / `person` | `/(app)/(tabs)/profile` |

### Visual Design

- **Background:** White (`#fff`) with top border (`#e4e4e7`) and subtle drop shadow
- **Active tab color:** Emerald green (`#10b981`) — both icon and label
- **Inactive tab color:** Muted gray (`#a1a1aa`)
- **Tab row height:** 60px with 6px bottom padding
- **Safe area aware:** Bottom padding adapts to device (notch/home indicator)

### Center FAB (Submit Button)

The submit button is a **raised circular button** that visually "floats" above the tab bar:
- **Size:** 56x56px circle with 28px border radius
- **Color:** Emerald green (`#10b981`) background, white `+` icon (30px)
- **Elevation:** Lifted 12px above the tab bar via `translateY: -12`
- **Shadow:** Green-tinted shadow (`#10b981`, opacity 0.45, radius 8) for a glowing effect
- **Label:** "Submit" text below the button in muted gray
- **Action:** Navigates directly to `/(app)/submit/info` (Step 1 of submission flow)

### Implementation Details

- Uses Expo Router's `<Tabs>` component with a fully custom `tabBar` prop (`CustomTabBar`)
- Tab items are defined in a `TAB_ITEMS` array — the FAB is rendered between `leftTabs` (Home, Referral) and `rightTabs` (Wallet, Profile)
- Active state is determined by matching `state.index` to the route index
- All screen headers are hidden (`headerShown: false`) — each tab screen handles its own header

---

## Every Page — Detailed Breakdown

### Welcome Screen (`app/index.tsx`)

**What it shows:** Animated hero landing page with staggered fade-up animations — logo, badge, headline ("Digitize Local Businesses"), subtitle, and two CTA buttons (Sign Up / Log In).

**Logic:**
- Checks if onboarding was already completed
- Checks `AUTH_CACHE_KEY` for cached auth state (offline support)
- Routes to signup or login based on user state
- If already signed in, redirects straight to `/(app)/(tabs)`

---

### Not Found (`app/+not-found.tsx`)

**What it shows:** Full-screen loading spinner (green `ActivityIndicator`) while determining redirect.

**Logic:**
- Catches any unmatched routes (e.g., malformed OAuth callbacks)
- Checks Clerk auth state via `useAuth()`
- If signed in → redirects to `/(app)/dashboard`
- If signed out → redirects to `/(auth)/login`

---

### Dashboard Redirect (`app/(app)/dashboard.tsx`)

**What it shows:** Nothing — immediate redirect.

**Logic:**
- Legacy redirect shim for old deep-links to `/(app)/dashboard`
- Uses `<Redirect href="/(app)/(tabs)/" />` to send to the tab navigator
- Dashboard content now lives in `/(app)/(tabs)/index.tsx`

---

### Login (`app/(auth)/login.tsx`)

**What it shows:** Email + password form, Google OAuth button (custom SVG logo), show/hide password toggle, "Forgot Password" link, "Sign Up" redirect.

**Logic:**
- `signIn.create({ identifier: email, password })` via Clerk
- Google OAuth: `startOAuthFlow()` → browser flow → callback to `negosyodigital://`
- On success: sets active session → navigates to `/(app)/(tabs)`
- Error handling: displays Clerk error messages inline

---

### Signup (`app/(auth)/signup.tsx`)

**What it shows:** Two-step flow — (1) signup form with first name, last name, email, phone (optional), password, referral code (optional), and Google OAuth; (2) 6-digit email verification code input with resend option.

**Logic:**
- `signUp.create()` creates Clerk user
- `prepareEmailAddressVerification({ strategy: "email_code" })` sends code
- `attemptEmailAddressVerification({ code })` verifies
- On success: `creators.create` mutation creates Convex profile with auto-generated referral code
- Referral code format: `[2 chars firstName][1 char lastName][6 random alphanumeric]`
- If `referredByCode` provided, triggers `referrals.createFromSignup()`

---

### Forgot Password (`app/(auth)/forgot-password.tsx`)

**What it shows:** Two-step — (1) email entry; (2) reset code + new password with strength indicator (4-level visual bar: weak/fair/good/strong).

**Logic:**
- `signIn.create({ strategy: "reset_password_email_code", identifier: email })`
- `attemptFirstFactor({ strategy: "reset_password_email_code", code, password })`
- Minimum 8 characters enforced
- Resend code functionality included

---

### Home / Dashboard (`app/(app)/(tabs)/index.tsx`)

**What it shows:**
- Welcome header with profile avatar + notification bell (unread badge)
- Dark-themed available balance card
- Quick stats row: Total Submissions, In Review, Verified (3 cards)
- Recent submissions list (3 items, "View All" link)
- Recent activity/notifications (5 items, "See All" link)

**Logic:**
- Queries: `creators.getByClerkId`, `submissions.getByCreatorId`, `notifications.getByCreator`, `notifications.getUnreadCount`
- Auto-creates creator profile on first load if missing (handles OAuth users)
- Redirects to `training.tsx` if creator is not certified (`certifiedAt` is null)
- Shows pending transcription status for in-progress submissions
- Notification metadata drives type-specific icons and colors

---

### Wallet (`app/(app)/(tabs)/wallet.tsx`)

**What it shows:**

**Header:**
- Title "Wallet" (22px, weight 800) with subtitle "Manage your earnings and withdrawals." on white background with bottom border

**Balance Card (dark theme):**
- Dark card (`#18181b`, 24px border radius, strong shadow with elevation 6)
- Top row: "AVAILABLE BALANCE" label (muted gray, 12px, letter-spacing 0.5) with large balance amount (white, 34px, weight 800, formatted as `₱X,XXX.XX`) on the left, green wallet icon in a dark circular badge on the right
- Two stat sub-cards side by side in darker background (`#27272a`, 12px radius):
  - **TOTAL EARNED** — shows `creator.totalEarnings` formatted as PHP
  - **WITHDRAWN** — shows `creator.totalWithdrawn` formatted as PHP
- **Withdraw Funds button:**
  - Green (`#10b981`) when balance >= 100, dark gray (`#3f3f46`) when disabled
  - Disabled when balance < PHP 100 or offline
  - Shows "Minimum withdrawal is ₱100" hint when balance is too low
  - Shows "You're offline — reconnect to withdraw" in amber when offline with sufficient balance
  - Opens withdrawal bottom sheet modal on tap

**Withdrawal Bottom Sheet Modal:**
- Slides up from bottom, transparent backdrop (tap to dismiss)
- White container with rounded top corners (28px), drag handle bar at top
- **Title section:** "Withdraw Funds" header with available balance subtitle, bank transfer icon
- **Wise badge:** Green info banner — "Processed securely via Wise · Bank Transfer only"
- **Form fields:**
  1. **Amount (₱)** — numeric input, shows available balance hint below
  2. **Account Holder Name** — text input, letters and spaces only (regex filtered), placeholder "Full name as on bank account"
  3. **Bank** — tap opens a secondary bank picker modal (scrollable list of 15 banks, selected bank highlighted in green with checkmark)
  4. **Account Number + City** — side by side; account number is numeric with bank-specific max length, city is free text
- **Validation rules:**
  - Minimum ₱100, cannot exceed available balance
  - Full name required (first and last name — at least 2 words)
  - Bank must be selected
  - Account number must match the exact digit count for the selected bank
  - City is required
- **Submit:** "Confirm Withdrawal" button (green), shows spinner while submitting
- **Success:** Alert dialog confirming withdrawal amount and Wise processing notification

**Bank Picker Modal (nested):**
- Slides up over the withdrawal modal with dark overlay
- Scrollable list of all 15 Wise-validated Philippine banks
- Selected bank row highlighted with green background (`#ecfdf5`) and checkmark icon
- Tapping a bank auto-fills both `bankName` and `bankCode` in the form

**Supported Banks (via Wise API):**
| Bank | Code | Digits |
|---|---|---|
| BDO Unibank | BDO | 10 |
| BPI (Bank of the Philippine Islands) | BPI | 10 |
| Metropolitan Bank and Trust Company | MBTC | 13 |
| Union Bank of the Philippines | UB | 12 |
| Security Bank Corporation | SB | 13 |
| Land Bank of the Philippines | LBP | 10 |
| Philippine National Bank | PNB | 12 |
| Rizal Commercial Banking Corp. | RCBC | 10 |
| Asia United Bank | AUB | 12 |
| East West Bank | EWB | 12 |
| China Banking Corporation | CB | 14 |
| CIMB Bank Philippines | CIMB | 14 |
| Development Bank of the Philippines | DBP | 14 |
| Philippine Savings Bank | PSB | 14 |
| United Coconut Planters Bank | UCPB | 14 |

**Recent Earnings (last 5):**
- Empty state: gray cash icon, "No earnings yet", "Complete your first submission to start earning."
- Populated: white card with rows showing green trending-up icon, "Submission Payout" label, relative timestamp, and green `+₱X,XXX.XX` amount

**Withdrawal History (last 5):**
- Empty state: gray swap icon, "No withdrawals yet", "Your withdrawal history will show up here."
- Populated: white card with rows showing bank icon, bank name, relative timestamp, Wise transfer ID (if available), red `-₱X,XXX.XX` amount, and status badge:

| Status | Badge Label | Color |
|---|---|---|
| `pending` | Pending | Amber (`#f59e0b`) |
| `processing` | Processing | Blue (`#3b82f6`) |
| `completed` | Completed | Green (`#10b981`) |
| `failed` | Failed | Red (`#ef4444`) |

**Logic:**
- Queries: `creators.getByClerkId`, `earnings.getByCreator`, `withdrawals.getByCreator`
- Mutation: `withdrawals.create(creatorId, amount, accountHolderName, bankName, bankCode, accountNumber, city)`
- Balance is deducted immediately (optimistic) — Wise transfer initiated asynchronously via `wise.initiateTransfer`
- On failure: balance is restored, status set to "failed"
- On completion: `totalWithdrawn` incremented, creator notified via push notification
- Offline banner shown via `<OfflineBanner />`

---

### Profile (`app/(app)/(tabs)/profile.tsx`)

**What it shows:**

**Header + Avatar Section:**
- Title "Profile" (22px, weight 800) on white background
- Avatar row: 64x64px circular avatar — shows profile image from R2 if available, otherwise shows the first letter of the display name in white on a dark circle (`#18181b`)
- **Name** (18px, weight 800) and **email** (13px, gray) displayed next to the avatar
- **Referral code badge:** Small gray pill (`#f4f4f5`) below the email showing a gift icon + referral code in uppercase with letter spacing (only shown if referral code exists)

**Stats Strip (3 columns):**
- Full-width white bar below the header, divided into 3 equal columns separated by vertical borders:
  - **SUBMISSIONS** — `creator.submissionCount` (integer)
  - **BALANCE** — `₱{creator.balance}` (formatted as PHP)
  - **TOTAL EARNED** — `₱{creator.totalEarnings}` (formatted as PHP)
- Each stat: large number (18px, weight 800) on top, uppercase label (10px, gray) below

**Menu Sections (3 groups):**

Each section has an uppercase gray title label and a white rounded card (20px radius, shadow) containing menu items with icons, labels, sublabels, and chevron arrows.

**1. ACCOUNT**
| Icon | Label | Sublabel | Navigates to |
|---|---|---|---|
| `person-outline` | Edit Profile | Update your name and details | `/(app)/edit-profile` |
| `notifications-outline` | Notifications | Manage your notification settings | `/(app)/notifications` |
| `shield-checkmark-outline` | Change Password | Update your account password | `/(app)/change-password` |
| `gift-outline` (indigo) | Enter Referral Code | Apply a code from another creator | Opens referral code modal |
| `ribbon-outline` (green) | Show My Certificate | View and share your certification | Opens certificate modal |

- The "Enter Referral Code" item only appears if the creator has **not** already applied a referral code (`creator.referredByCode` is empty). The icon is tinted indigo (`#6366f1`). This allows Google OAuth users and users who skipped the referral code during regular signup to apply one later.
- The "Show My Certificate" item only appears if `creator.certifiedAt` is set (i.e., the creator has passed the certification quiz). The icon is tinted green (`#10b981`).

**2. MY ACTIVITY**
| Icon | Label | Sublabel | Navigates to |
|---|---|---|---|
| `layers-outline` | My Submissions | `{count} total submissions` | `/(app)/submissions` |
| `people-outline` | Referrals | View your referral stats | `/(app)/(tabs)/referrals` |
| `wallet-outline` | Earnings | `₱{totalEarnings} total earned` | `/(app)/(tabs)/wallet` |

**3. SUPPORT**
| Icon | Label | Navigates to |
|---|---|---|
| `help-circle-outline` | Help & FAQ | `/(app)/help-faq` |
| `document-text-outline` | Terms of Service | `/(app)/terms-of-service` |
| `lock-closed-outline` | Privacy Policy | `/(app)/privacy-policy` |

**Sign Out Button:**
- Standalone card with red border (`#fee2e2`), red logout icon, "Sign Out" text in red
- Tap triggers a native `Alert.alert` confirmation dialog with "Cancel" and "Sign Out" (destructive style) options
- On confirm: calls `signOut()` via Clerk, then redirects to `/(auth)/login`
- Shows spinner and "Signing out..." text while processing

**App Version:**
- "Tendso Mobile v1.0.0" text centered at the bottom in light gray

**Referral Code Modal (bottom sheet):**
- Triggered by tapping "Enter Referral Code" in the Account menu
- Slides up from bottom with dark overlay, white container with rounded top corners (28px), drag handle
- **Header:** Indigo gift icon in a light indigo circle, "Enter Referral Code" title, "Got a code from a fellow creator?" subtitle
- **Input field:** Text input with gift icon, auto-capitalizes to uppercase, letter-spacing 2, placeholder "e.g. JUD8A3BK"
- **Error display:** Red error text shown inline for invalid codes, self-referral, or already-applied codes
- **"Apply Code" button:** Indigo (`#6366f1`) when valid input, gray when empty or loading, shows spinner while processing
- **Cancel button:** Text-only, dismisses the modal
- **Validation (server-side via `creators.applyReferralCode`):**
  - Rejects if creator already has a `referredByCode` set
  - Rejects if a referral record already exists for this creator
  - Rejects if the code doesn't match any creator's `referralCode`
  - Rejects if the code belongs to the creator themselves (self-referral)
- **On success:** Shows success alert, closes modal, saves `referredByCode` on creator, creates referral record via `referrals.createFromSignup`

**Certificate Modal (full-screen overlay):**
- Triggered by tapping "Show My Certificate" in the Account menu
- Semi-transparent dark overlay (`rgba(0,0,0,0.5)`) with centered white card (24px radius, max 85% height)
- **Modal header:** Close button (X icon, gray circle) on left, "My Certificate" title centered, Share button on right
- **Certificate content:** Scrollable area containing the `CertificateCard` component (see [CertificateCard Component](#certificatecard-component--componentscertificatecardtsx) below for full details)
- **Action buttons:**
  - **"Save to Gallery"** — green button, captures certificate as PNG via `captureRef` (react-native-view-shot), saves to device gallery via `expo-media-library` (requests `WRITE_EXTERNAL_STORAGE` permission on Android < 13)
  - **"Share Certificate"** — text-only green button, captures as PNG and opens native share sheet via `expo-sharing`

**Logic:**
- Queries: `creators.getByClerkId`
- Mutations: `creators.applyReferralCode` (for referral code modal)
- Display name: built from `creator.firstName + creator.lastName`, falls back to Clerk `user.fullName`, then "Creator"
- Sign out: `signOut()` via Clerk + redirects to login
- Certificate capture: uses `captureRef` from `react-native-view-shot` on the `CertificateCard` ref
- Offline banner shown via `<OfflineBanner />`

---

### Referrals (`app/(app)/(tabs)/referrals.tsx`)

**What it shows:**

**Header:**
- Title "Referrals" (22px, weight 800) with subtitle "Invite businesses and earn rewards together." on a white background with bottom border

**Referral Code Card (dark theme):**
- Dark card (`#18181b` background, 24px border radius, shadow with elevation 6)
- Gift icon in a dark circular badge (`#27272a`) with green icon (`#34d399`)
- "Your Referral Code" label in white
- Referral code displayed in large green text (`#34d399`, 28px, weight 800, letter-spacing 4) on a dark inner card (`#27272a`)
- Two action buttons side by side:
  - **Copy Code** — dark button (`#27272a`), toggles to dark green (`#065f46`) with checkmark icon and "Copied!" text for 2.5 seconds after tap. Uses `expo-clipboard` (`Clipboard.setStringAsync`)
  - **Share** — green button (`#10b981`), opens native share sheet via `Share.share()` with message: "Join Tendso and digitalize your business! Use my referral code: {CODE}"

**Stats Row (3 cards):**
- Three equal-width white cards with colored circular icons:
  - **Referred** — indigo people icon (`#6366f1`), shows total referral count from `stats.total`
  - **Qualified** — green checkmark icon (`#10b981`), shows `stats.qualified + stats.paid` combined count
  - **Rewards** — amber cash icon (`#f59e0b`), shows `₱{stats.totalEarned}` formatted amount
- Each card has rounded corners (16px), shadow, and centered layout with uppercase label

**People You Referred (list):**
- Empty state: circular gray people icon, "No referrals yet" title, "Share your code above to start earning referral rewards!" subtitle
- Populated state: white card with divider-separated rows, each showing:
  - **Avatar initial** — gray circle (`#f4f4f5`, 42x42px) with first letter of referred creator's name
  - **Name + join date** — creator name (14px, bold) with relative timestamp ("Today", "Yesterday", "Xd ago")
  - **Status badge** — colored pill with icon:
    | Status | Badge Label | Color | Icon |
    |---|---|---|---|
    | `pending` | Signed Up | Amber (`#f59e0b`) | `time-outline` |
    | `qualified` | Qualified | Green (`#10b981`) | `checkmark-circle` |
    | `paid` | Rewarded | Indigo (`#6366f1`) | `gift` |

**How it Works (3 steps):**
- White card with 3 vertically stacked items, each with a colored circular icon and description:
  1. **Share your code** (indigo `share-social-outline`) — "Send your referral code to fellow business owners."
  2. **They sign up** (amber `person-add-outline`) — "They create an account and enter your referral code."
  3. **You both earn** (green `cash-outline`) — "Earn a bonus when their first submission is approved."

**Logic:**
- Queries: `referrals.getByReferrer(referrerId)`, `referrals.getStats(referrerId)`
- Loading state: green ActivityIndicator while waiting for Convex data (skipped when offline)
- Offline banner shown via `<OfflineBanner />` when disconnected
- Share message includes referral code and download instructions

---

### Submission Flow — Step 1: Business Info (`app/(app)/submit/info.tsx`)

**What it shows:** Form with business name, business type (dropdown), owner name, owner phone, owner email (optional), address, city.

**Business Type Options:** Barber/Salon, Auto Shop, Spa/Massage, Restaurant, Clinic, Law Office, Craft/Producer, Other

**Logic:**
- Loads existing Convex draft via `submissions.getDraftByCreatorId` OR local cache (priority: server → local)
- Draft auto-save to AsyncStorage with 500ms debounce via `useFormDraftCache` hook
- 7-day expiration on local drafts
- Offline support: saves to AsyncStorage and continues to next step
- Creates/updates Convex submission via `submissions.create` or `submissions.update`
- Navigates to `photos.tsx` on continue

---

### Submission Flow — Step 2: Photos (`app/(app)/submit/photos.tsx`)

**What it shows:** Multi-photo picker from device library, thumbnail grid of selected/existing photos, upload progress indicator, remove button per photo.

**Logic:**
- Uses `expo-image-picker` for multi-select from library
- Uploads to R2 via presigned URLs (AWS Sig V4)
- Shows existing photos if continuing a draft
- Updates submission via `submissions.update({ photos: [...urls] })`
- Offline: queues photos in AsyncStorage for later upload via `useOfflineSync`
- Navigates to `interview.tsx` on continue

---

### Submission Flow — Step 3: Interview (`app/(app)/submit/interview.tsx`)

**What it shows:** Choice between Video or Audio interview mode.

**Video path:**
- Front-facing camera with recording controls
- Parallel audio capture for transcription
- Question carousel with 5 suggested interview questions
- Lighting tip overlay
- Video preview with playback controls

**Audio path:**
- Microphone recording with timer
- Waveform visualization
- Play/pause controls after recording
- Audio preview

**Logic:**
- Uses `expo-camera` for video, `expo-av` for audio recording/playback
- Uploads media to R2 via presigned URLs with progress tracking
- Updates submission via `submissions.update({ videoStorageId / audioStorageId })`
- Triggers `transcribeMedia` action asynchronously (Groq Whisper API, max 25MB)
- Offline: saves file locally, queues for upload via `useOfflineSync`
- Navigates to `review.tsx` on continue

---

### Submission Flow — Step 4: Review & Submit (`app/(app)/submit/review.tsx`)

**What it shows:** Summary of all entered data — business info, photo carousel preview, video/audio preview with playback, transcription status.

**Logic:**
- Reads full submission data via `submissions.getById`
- Submit button calls `submissions.submit(id)` which triggers the following chain:

#### What `submissions.submit()` Does

1. **Validates** the submission has at least 3 photos
2. **Updates status** from `draft` → `submitted`
3. **Sets amount** to 1000 (PHP 1,000)
4. **Sets `airtableSyncStatus`** to `"pending_push"`
5. **Creates a lead record** from the business owner info (name, phone, email) with `status: "new"` and `source: "direct"`
6. **Increments analytics** — schedules `incrementStat` for both daily and monthly `submissionsCount`
7. **Triggers Airtable AI pipeline** — schedules `pushToAirtableInternal()` (see Airtable AI Pipeline section below)

- Offline: shows queue state with auto-sync info
- Navigates to `success.tsx` on submit

---

### Submission Flow — Success (`app/(app)/submit/success.tsx`)

**What it shows:** Green checkmark animation, transcription status (complete/processing/failed), "What happens next?" 3-step timeline, buttons for "View My Submissions" or "Back to Dashboard".

**Logic:**
- Displays different messaging based on transcription status
- Offline queued state: shows cloud icon, explains auto-sync behavior
- Clears local draft cache

---

### Submissions List (`app/(app)/submissions/index.tsx`)

**What it shows:** All submissions as cards with status badges and expandable progress indicators (photos, interview, submitted). FAB button to create new submission.

**Status colors:**
| Status | Color |
|---|---|
| Draft | Gray |
| In Review / Submitted | Blue |
| Verified / Approved | Emerald |
| Rejected | Red |
| Website Ready | Blue |
| Deployed | Purple |
| Paid | Green |

**Logic:**
- Query: `submissions.getByCreatorId(creatorId)`
- Cards show: business type icon, business name, type, city, date, status badge
- Tap navigates to `submissions/[id].tsx`
- Back button redirects to dashboard (prevents going back through submit flow)

---

### Submission Detail (`app/(app)/submissions/[id].tsx`)

**What it shows:** Full submission detail with status-specific info cards:

| Status | Info Card Message |
|---|---|
| Draft | "Complete your submission" |
| Submitted | "Under Review (24-48 hours)" |
| Approved | "Website in progress" |
| Website Generated / Deployed | "Website ready" + URL link |
| Pending Payment | "Awaiting business owner payment" |
| Paid / Completed | "Congratulations! You earned PHP X" |

Also shows: business info section, photos carousel (horizontal scroll), interview section (video player with fullscreen modal OR audio player with progress bar), transcription (expandable), expected earnings.

**Logic:**
- Query: `submissions.getByIdWithCreator(id)` — includes creator info and deployed URL
- "Continue Submission" button for drafts → navigates back to submit flow at the right step
- Video: inline preview + fullscreen modal via `expo-av`
- Audio: custom player with seek bar

---

### Training Intro (`app/(app)/training.tsx`)

**What it shows:** Hero section with camera illustration, "Become a Certified Creator" headline, 5 training tips with colored icons (Lighting/yellow, Audio/blue, Portrait/teal, Interview/purple, Requirements/pink), "Start Training" button.

**Logic:**
- Simple navigational page → routes to `training-lessons.tsx`
- Shown when creator is not yet certified (`certifiedAt === null`)

---

### Training Lessons (`app/(app)/training-lessons.tsx`)

**What it shows:** 5 expandable lesson cards (first one open by default):

1. **Lighting** — Face the light, avoid backlighting, golden hour tips
2. **Audio** — Test first, kill noise, keep phone close
3. **Portrait** — Chest up, eye level, no obstructions
4. **Interview** — Warm up, origin story, speak slowly
5. **Requirements** — 3 required photo types: portrait, location, craft/product

**Logic:**
- Accordion-style expand/collapse with smooth animations
- Each lesson has tips with icons and an action box
- "Start Certification Quiz" button at bottom → navigates to `certification-quiz.tsx`

---

### Certification Quiz (`app/(app)/certification-quiz.tsx`)

**Quiz Screen (5 questions):**

**Header:**
- Back button (chevron, gray circle) — goes to previous question or exits quiz
- "Certification Quiz" title with question counter (`1/5`, `2/5`, etc.)
- **Progress bar:** green (`#10b981`) animated bar showing completion percentage

**Question Card:**
- **Category badge:** colored pill with icon at the top (e.g., yellow "Lighting" badge with sun icon)
- **Question label:** "QUESTION X OF 5" in uppercase muted gray
- **Question text:** large bold text (20px, weight 800)

**Answer Options:**
- 3-4 options per question, each in a white card with:
  - **Letter circle** (A/B/C/D) — gray when unselected, green with white text when selected
  - **Option text** — turns dark green when selected
  - **Green checkmark icon** appears on the selected option
  - **Border:** changes from gray (`#f4f4f5`) to green (`#10b981`, 2px) when selected
  - **Background:** changes from white to light green (`#f0fdf4`) when selected

**Animations:**
- **Between questions:** slide + fade transition (150ms exit → 200ms enter)
- Questions slide horizontally in the direction of navigation (left for next, right for back)

**Bottom CTA:**
- "Next Question" button (green, 56px height, 28px radius) — disabled (gray) until an answer is selected
- Last question shows "Finish Quiz" with checkmark icon instead of arrow
- Green shadow glow effect when enabled

**Quiz Questions (hardcoded):**

| # | Category | Question | Correct |
|---|---|---|---|
| 1 | Lighting (yellow) | Which photo has better lighting for a business owner portrait? | B — Subject facing the window |
| 2 | Audio (blue) | Before starting the real interview, what should you always do first? | B — Do a 10-second test clip |
| 3 | Portrait (teal) | What is the correct way to frame the business owner in a portrait photo? | B — Head and shoulders, phone at eye level |
| 4 | Interview (purple) | What is the best way to help the owner feel comfortable before recording? | C — Chat for 2 minutes before pressing record |
| 5 | Requirements (pink) | How many required photos must you submit to get paid? | C — 3 photos: portrait, location, craft |

**Pass threshold:** 4 out of 5 correct (80%)

---

#### Pass Screen (score >= 4/5)

**Header:** Close button (X, navigates to dashboard), "Success" title, share button on right

**Content (animated spring + fade-in):**
1. **Green checkmark circle** — large (72x72px) with `checkmark-circle` icon (44px, green)
2. **"Congratulations!"** — 26px, weight 900, centered
3. **"You passed the Certification Quiz!"** — 14px, gray subtitle
4. **Score badge:** `{score}/5 Score · {accuracy}% Accuracy` in green text
5. **Certificate Card** — full `CertificateCard` component rendered inline (capturable via ref)

**Bottom CTAs (fixed at bottom):**
- **"Go to Dashboard"** — primary green button (56px height, green shadow glow), calls `creators.certify(id)` to set `certifiedAt` timestamp, saves `ndm_just_certified` flag to AsyncStorage (prevents dashboard redirect loop), then navigates to `/(app)/(tabs)/`
- **"Download Certificate"** — secondary text button with download icon, captures certificate as PNG via `captureRef`, saves to gallery via `expo-media-library`

---

#### Fail Screen (score < 4/5)

**Header:** Close button (X, navigates to training), "Certification Quiz" title

**Content (animated spring + fade-in):**
1. **Graduation cap icon** — green circle (72x72px) with `school` icon (36px)
2. **"Not quite there yet!"** — 24px, weight 900, centered
3. **Encouragement text:** "You're on your way to helping local businesses. A little more study and you'll be a pro!"
4. **Score display:** "YOUR SCORE" label, then large `{score} / 5` text (56px number)
5. **Progress bar:** green bar showing score percentage on gray track

**Bottom CTA:**
- **"Try Again"** — dark button (`#18181b`), navigates back to `/(app)/training`

---

### CertificateCard Component (`components/CertificateCard.tsx`)

A `forwardRef`-wrapped component designed to be visually captured as an image for sharing and downloading. It renders a professional certification certificate.

**Props:**
- `creatorName` (string) — displayed in uppercase on the certificate
- `certMonth` (string) — month name (e.g., "March")
- `certYear` (number) — year (e.g., 2026)

**Visual Layout (top to bottom):**

1. **Green Top Banner** (`#15803d` background):
   - App icon (44x44px, rounded 10px, loaded from `assets/icon.png`)
   - "NEGOSYO DIGITAL" text in white (13px, weight 700, letter-spacing 1)

2. **Certificate Body** (white background, centered content):
   - **Ribbon icon** — green ribbon (`#10b981`) inside a light green circle (`#f0fdf4`, 48x48px)
   - **"CERTIFICATE OF COMPLETION"** — uppercase gray label (11px, letter-spacing 2)
   - **"Certified Creator"** — large title (22px, weight 900, near-black)
   - **Green divider line** — 40x3px emerald bar
   - **"This certifies that"** — gray description text
   - **Creator name badge** — dark navy blue card (`#1e3a5f`, 10px radius) with the creator's name in white uppercase (16px, weight 900, letter-spacing 1). Falls back to "CERTIFIED CREATOR" if name is empty. Minimum width 180px.
   - **Body text:** "has demonstrated proficiency in **Local Business Digitization** and is authorized to provide verified digital services to MSMEs in the Philippines."
   - **Date section:** "DATE ISSUED" uppercase label with `{month} {year}` below (15px, weight 700)

3. **Green Bottom Banner** (`#15803d` background):
   - **"You can now start earning!"** — white bold text (14px, weight 800)

**Design details:**
- Outer container: white background, 16px border radius, 1px gray border (`#e5e7eb`), overflow hidden
- `collapsable={false}` set on the root View to ensure `captureRef` works on Android
- The component is purely visual — all interactivity (share, download) is handled by the parent screen

**Used in:**
- `certification-quiz.tsx` — rendered on the pass screen, captured for download/share
- `profile.tsx` — rendered inside the certificate modal, captured for download/share

---

### Edit Profile (`app/(app)/edit-profile.tsx`)

**What it shows:** Large clickable avatar with camera badge overlay, form fields (first name, last name, phone number), success/error banners.

**Logic:**
- Image picker → uploads new avatar to R2 via `generateR2UploadUrl` action
- Mutation: `creators.update(id, { firstName, lastName, phone, profileImage })`
- Creates `profile_updated` notification on success
- Offline support: queues update

---

### Change Password (`app/(app)/change-password.tsx`)

**What it shows:** Three password fields (current, new, confirm) with show/hide toggles, password strength indicator (4-level bar), real-time confirmation match check (check/cross icon).

**Logic:**
- Validation: minimum 8 characters, must differ from current, confirmation must match
- Uses Clerk's `user.updatePassword({ currentPassword, newPassword })`
- Creates `password_changed` notification via `notifications.createForClient`
- Success banner indicates session re-authentication

---

### Notifications (`app/(app)/notifications.tsx`)

**What it shows:** List of all notifications with read/unread state (green dot for unread), "Mark all read" link.

**Notification Types & Icons:**
| Type | Icon | Color |
|---|---|---|
| `submission_approved` | Checkmark | Green |
| `submission_rejected` | X | Red |
| `new_lead` | Person+ | Blue |
| `payout_sent` | Cash | Green |
| `website_live` | Globe | Purple |
| `submission_created` | Plus | Indigo |
| `profile_updated` | Person | Amber |
| `password_changed` | Lock | Gray |
| `system` | Info | Gray |

**Logic:**
- Query: `notifications.getByCreator(creatorId)`
- Tap → `notifications.markAsRead(id)` + navigate to related submission if `data.submissionId` exists
- "Mark all read" → `notifications.markAllAsRead(creatorId)`
- Unread count badge displayed on home tab notification bell

---

### Onboarding (`app/(app)/onboarding.tsx`)

**What it shows:** First-time profile completion form — first name, middle name, last name, phone number (optional, Philippine validation).

**Logic:**
- Shown when signup didn't fully create a creator profile (e.g., OAuth flow)
- Pre-fills from Clerk user data if available
- Creates creator profile via `creators.create` with auto-generated referral code
- Redirects to dashboard on completion

---

### Help & FAQ (`app/(app)/help-faq.tsx`)

**What it shows:** 4 expandable accordion sections (first item expanded by default):

1. **Getting Started** (2 items) — What is the app, how to get certified
2. **Submissions** (4 items) — Steps to submit, what happens after, photo requirements, editing drafts
3. **Earnings & Payments** (3 items) — Payout amounts, referral bonuses, payment timing
4. **Account & Support** (3 items) — Password reset, profile updates, technical issues

**Logic:** Static content with smooth collapse/expand animations. Contact email referenced in support items.

---

### Privacy Policy (`app/(app)/privacy-policy.tsx`)

**What it shows:** 12 expandable sections with icons covering data collection, usage, storage, third-party services (Clerk, Convex, R2, Groq, Expo, Google), business owner data, push notifications, data retention, Philippine DPA compliance, children's privacy, and contact info.

**Last updated:** February 2026

---

### Terms of Service (`app/(app)/terms-of-service.tsx`)

**What it shows:** 12 expandable sections covering acceptance, registration, certification, submissions, payments (PHP 500 video / PHP 300 audio / PHP 1,000 referral), referral program, prohibited conduct, IP, termination, liability, Philippine governing law, and contact.

**Last updated:** February 2026

---

## Airtable AI Content Pipeline — Complete Flow

This is the end-to-end process that transforms a creator's raw submission into AI-enhanced website content.

### Trigger: Creator Submits

When a creator taps "Submit" in the review screen, `submissions.submit()` runs a chain of operations. The final step schedules `pushToAirtableInternal()` — the internal action variant that wraps `pushToAirtable` with error handling.

### Step-by-Step Flow

```
1. Creator taps Submit → submissions.submit()
   ├── status = "submitted"
   ├── airtableSyncStatus = "pending_push"
   ├── amount = 1000
   ├── Creates lead record
   ├── Increments daily + monthly analytics
   └── Schedules pushToAirtableInternal()
        │
2. pushToAirtable() runs
   ├── Checks if submission already has an Airtable record (skips if duplicate)
   ├── Sanitizes all text inputs (prevents formula injection)
   ├── Maps photos by index to Airtable fields:
   │   [0] → original_headshot
   │   [1] → original_interior_1
   │   [2] → original_interior_2
   │   [3] → original_exterior
   │   [4] → original_product_1  (only if hasProducts=true)
   │   [5] → original_product_2  (only if hasProducts=true)
   ├── POSTs record to Airtable API with fields:
   │   convex_record_id, client_name, business_name, business_type,
   │   transcript, has_products, Status="pending", original_* photo attachments
   ├── Stores returned airtableRecordId in submission
   └── Schedules fetchEnhancedContentWithRetry() after 30 seconds
        │
3. fetchEnhancedContentWithRetry() polls Airtable
   ├── GETs the Airtable record by airtableRecordId
   ├── Checks for enhanced images (enhanced_headshot, enhanced_interior_1, etc.)
   ├── Checks for AI text fields:
   │   hero_headline, hero_subheadline, about_content,
   │   services_description, contact_cta
   ├── Handles Airtable AI field format: { state: "generated", value: "..." }
   │
   ├── If NOT all content ready:
   │   └── Schedules retry with exponential backoff:
   │       Retry 1: 30 seconds
   │       Retry 2: 60 seconds (1 min)
   │       Retry 3: 120 seconds (2 min)
   │       Retry 4: 300 seconds (5 min)
   │       Retry 5: 600 seconds (10 min)
   │       After 5 retries: marks airtableSyncStatus = "error"
   │
   └── If ALL content ready:
       ├── Downloads each enhanced image from Airtable URL
       ├── Stores images in Convex file storage (ctx.storage.store)
       ├── Calls saveEnhancedContent() mutation
       ├── Updates airtableSyncStatus = "synced"
       └── PATCHes Airtable record Status = "done"
            │
4. saveEnhancedContent() persists to database
   ├── Creates or updates generatedWebsites record for the submission
   ├── Stores enhancedImages object:
   │   { headshot: {url, storageId}, interior_1: {url, storageId}, ... }
   ├── Stores AI text fields:
   │   heroHeadline, heroSubHeadline, aboutDescription,
   │   servicesDescription, contactCta
   └── Sets airtableSyncedAt timestamp
```

### Airtable Sync Status Values

| Status | Meaning |
|---|---|
| `pending_push` | Submission submitted, Airtable push scheduled |
| `pushed` | Record created in Airtable, polling started |
| `content_received` | Enhanced content received from Airtable |
| `synced` | All images downloaded and stored in Convex |
| `error` | Max retries reached or processing failed |

### Webhook Alternative (`/airtable-webhook`)

An HTTP POST endpoint also exists for Airtable to call back when AI generation completes. It:
- Validates `convexRecordId` is present
- Extracts enhanced image URL (handles both string and Airtable attachment array format)
- Schedules `downloadAndStoreEnhancedImage` action if status is "done" or "complete"
- This webhook supplements the polling mechanism — both paths can trigger content storage

---

## Shared Components

### `CertificateCard` (`components/CertificateCard.tsx`)
ForwardRef-wrapped component rendering a professional certification certificate. Green top/bottom banners, ribbon badge, dynamic creator name, "Certificate of Completion" title, month/year date. Designed for screenshot capture and export.

### `OfflineBanner` (`components/OfflineBanner.tsx`)
Lightweight banner that appears when network is disconnected. Uses `useNetwork()` hook. Warning icon + "You're offline" message. Only renders when `isConnected === false` (null = still determining, avoids flash).

---

## Providers

### `AppProviders` (`providers/AppProviders.tsx`)
Root provider wrapping the entire app. Order: ClerkProvider → ConvexProviderWithClerk → NetworkProvider. Handles loading states, offline fallback (bypasses Clerk if cached auth exists), 10-second force-render timeout.

### `NetworkProvider` (`providers/NetworkProvider.tsx`)
Context provider for network connectivity. Uses `@react-native-community/netinfo`. Exposes `useNetwork()` hook returning `{ isConnected: boolean | null }`. Defaults to online if NetInfo unavailable.

---

## Custom Hooks

### `useFormDraftCache` (`hooks/useFormDraftCache.ts`)
Manages form draft persistence with 500ms debounce to AsyncStorage. 7-day expiration. Methods: `saveDraft()`, `loadDraft()`, `clearDraft()`. Auto-cleanup on unmount. Stores: businessName, businessType, ownerName, ownerPhone, ownerEmail, address, city.

### `useOfflineSync` (`hooks/useOfflineSync.ts`)
Syncs offline-queued data when reconnected. Monitors network via NetworkProvider. Syncs 4 types: pending business info, pending photos (R2 upload), pending interview (R2 upload, 20-min timeout for large videos), pending final submit. Shows alert on successful sync. Auto-triggers on reconnection (2s delay).

### `usePushNotifications` (`hooks/usePushNotifications.ts`)
Registers device for push notifications. Checks physical device requirement, requests permissions, creates Android notification channel (vibration, green color #10b981), registers with Expo Push API (project ID: `2adbda2f-fecd-4fdd-91b8-56db76e0c780`), stores token in backend via `notifications.registerPushToken`.

---

## Database Schema (Complete — from `convex/schema.ts`)

### `creators` — User profiles

| Field | Type | Required | Notes |
|---|---|---|---|
| `clerkId` | string | Yes | Clerk auth ID |
| `email` | string | Yes | Email address |
| `firstName` | string | No | |
| `middleName` | string | No | |
| `lastName` | string | No | |
| `phone` | string | No | |
| `balance` | number | No | Current available balance (PHP) |
| `totalEarnings` | number | No | Lifetime earnings (PHP) |
| `totalWithdrawn` | number | No | Total withdrawn (PHP) |
| `submissionCount` | number | No | Number of submissions created |
| `createdAt` | number | No | |
| `updatedAt` | number | No | |
| `lastActiveAt` | number | No | |
| `referralCode` | string | No | Unique code for referrals |
| `referredByCode` | string | No | Code used during signup |
| `role` | string | No | Typically `"creator"` |
| `status` | string | No | Typically `"active"` |
| `profileImage` | string | No | R2 public URL |
| `certifiedAt` | number | No | Timestamp of certification |

**Indexes:** `by_clerk_id` (clerkId), `by_email` (email), `by_referral_code` (referralCode), `by_status` (status)

---

### `submissions` — Business submissions

| Field | Type | Required | Notes |
|---|---|---|---|
| `creatorId` | Id\<"creators"\> | Yes | Foreign key |
| `businessName` | string | Yes | |
| `businessType` | string | Yes | |
| `ownerName` | string | Yes | |
| `ownerPhone` | string | Yes | |
| `ownerEmail` | string | No | |
| `address` | string | Yes | |
| `city` | string | Yes | |
| `photos` | string[] | No | Array of R2 URLs |
| `videoStorageId` | string | No | R2 video reference |
| `videoUrl` | string | No | |
| `audioStorageId` | string | No | R2 audio reference |
| `audioUrl` | string | No | |
| `transcript` | string | No | Transcribed text from Groq Whisper |
| `transcriptionStatus` | string | No | `"processing"` / `"complete"` / `"failed"` / `"skipped"` |
| `transcriptionError` | string | No | Error message if transcription failed |
| `transcriptionUpdatedAt` | number | No | **NEW** — Timestamp when transcription was last generated/updated (milliseconds since epoch). Used for UI display: "Generated 3 hours ago" |
| `aiGeneratedContent` | any | No | AI-extracted content from transcript (services, USPs) |
| `status` | string | Yes | `"draft"` → `"submitted"` → `"approved"` / `"rejected"` → `"website_generated"` → `"deployed"` → `"paid"` |
| `rejectionReason` | string | No | Admin feedback |
| `reviewedBy` | string | No | Admin Clerk ID who reviewed |
| `reviewedAt` | number | No | When the review happened |
| `websiteUrl` | string | No | Deployed website URL |
| `amount` | number | No | Submission value (set to 1000 on submit) |
| `creatorPayout` | number | No | Amount paid to creator |
| `creatorPaidAt` | number | No | |
| `airtableRecordId` | string | No | Airtable record ID (starts with "rec") |
| `airtableSyncStatus` | string | No | `"pending_push"` / `"pushed"` / `"content_received"` / `"synced"` / `"error"` |
| `sentEmailAt` | number | No | When the business owner email was sent |

**Indexes:** `by_creator_id` (creatorId), `by_status` (status), `by_airtable_sync` (airtableSyncStatus), `by_creator_status` (creatorId, status), `by_city` (city)

---

### `generatedWebsites` — Website data from submissions

| Field | Type | Required | Notes |
|---|---|---|---|
| `submissionId` | Id\<"submissions"\> | Yes | Foreign key |
| `html` | string | No | Generated HTML |
| `htmlContent` | string | No | Alternative HTML content field |
| `css` | string | No | Generated CSS |
| `cssContent` | string | No | Alternative CSS content field |
| `deployedUrl` | string | No | Live URL |
| `publishedUrl` | string | No | |
| `status` | string | No | `"generated"` / `"deployed"` / `"live"` |
| `templateName` | string | No | Website template used |
| `netlifySiteId` | string | No | |
| `htmlStorageId` | string | No | Convex storage ID for HTML file |
| `publishedAt` | number | No | |
| `extractedContent` | any | No | |
| `cfPagesProjectName` | string | No | Cloudflare Pages project name |
| `heroTitle` | string | No | Hero section title |
| `heroSubtitle` | string | No | |
| `heroHeadline` | string | No | AI-generated from Airtable |
| `heroSubHeadline` | string | No | AI-generated from Airtable |
| `heroBadgeText` | string | No | |
| `heroCtaLabel` | string | No | |
| `heroCtaLink` | string | No | |
| `heroTestimonial` | any | No | |
| `aboutText` | string | No | |
| `aboutDescription` | string | No | AI-generated from Airtable |
| `aboutHeadline` | string | No | |
| `aboutTagline` | string | No | |
| `aboutTags` | any | No | |
| `aboutContent` | string | No | |
| `featuredHeadline` | string | No | |
| `featuredSubHeadline` | string | No | |
| `featuredSubheadline` | string | No | |
| `featuredImages` | any | No | |
| `featuredProducts` | any | No | |
| `footerDescription` | string | No | |
| `navbarHeadline` | string | No | |
| `navbarCtaLabel` | string | No | |
| `navbarCtaLink` | string | No | |
| `navbarCtaText` | string | No | |
| `navbarLinks` | any | No | |
| `servicesHeadline` | string | No | |
| `servicesSubheadline` | string | No | |
| `servicesDescription` | string | No | AI-generated from Airtable |
| `contactCta` | string | No | AI-generated from Airtable |
| `businessName` | string | No | |
| `tagline` | string | No | |
| `tone` | string | No | |
| `services` | any | No | |
| `images` | any | No | |
| `contact` | any | No | |
| `contactInfo` | any | No | |
| `customizations` | any | No | |
| `uniqueSellingPoints` | any | No | |
| `visibility` | any | No | |
| `socialLinks` | any | No | |
| `updatedAt` | number | No | |
| `enhancedImages` | object | No | AI-enhanced images from Airtable (see below) |
| `subdomain` | string | No | e.g., "juans-bakery" → juans-bakery.negosyo.digital |
| `customDomain` | string | No | e.g., "www.juansbakery.com" |
| `airtableSyncedAt` | number | No | When content was synced from Airtable |

**`enhancedImages` structure:**
```typescript
{
  headshot?:    { url?: string, storageId?: Id<"_storage"> },
  interior_1?:  { url?: string, storageId?: Id<"_storage"> },
  interior_2?:  { url?: string, storageId?: Id<"_storage"> },
  exterior?:    { url?: string, storageId?: Id<"_storage"> },
  product_1?:   { url?: string, storageId?: Id<"_storage"> },
  product_2?:   { url?: string, storageId?: Id<"_storage"> },
}
```

**Indexes:** `by_submission_id` (submissionId), `by_status` (status)

---

### `websiteContent` — DEPRECATED

Consolidated into `generatedWebsites`. Kept for backwards compatibility with existing data. Do not write new data here. Has the same content fields as `generatedWebsites` plus `websiteId` reference.

**Indexes:** `by_submission_id` (submissionId)

---

### `earnings` — Income transaction records

| Field | Type | Required | Notes |
|---|---|---|---|
| `creatorId` | Id\<"creators"\> | Yes | |
| `submissionId` | Id\<"submissions"\> | Yes | |
| `amount` | number | Yes | Amount in PHP |
| `type` | union | Yes | `"submission_approved"` / `"referral_bonus"` / `"lead_bonus"` |
| `status` | union | Yes | `"pending"` / `"available"` / `"withdrawn"` |
| `createdAt` | number | Yes | |

**Indexes:** `by_creator` (creatorId), `by_submission` (submissionId)

---

### `withdrawals` — Payout requests via Wise

| Field | Type | Required | Notes |
|---|---|---|---|
| `creatorId` | Id\<"creators"\> | Yes | |
| `amount` | number | Yes | Amount in PHP |
| `payoutMethod` | literal | Yes | `"bank_transfer"` |
| `accountDetails` | string | Yes | Legacy display string (required for backwards compat) |
| `accountHolderName` | string | No | |
| `bankName` | string | No | Display name (e.g., "BDO Unibank") |
| `bankCode` | string | No | Wise bank code (e.g., "BDO") |
| `accountNumber` | string | No | |
| `status` | union | Yes | `"pending"` → `"processing"` → `"completed"` / `"failed"` |
| `processedAt` | number | No | |
| `transactionRef` | string | No | |
| `wiseTransferId` | string | No | Wise API transfer ID |
| `wiseRecipientId` | string | No | Wise API recipient ID |
| `failureReason` | string | No | |
| `createdAt` | number | Yes | |

**Indexes:** `by_creator` (creatorId), `by_status` (status)

---

### `payoutMethods` — Saved payment methods

| Field | Type | Required | Notes |
|---|---|---|---|
| `creatorId` | Id\<"creators"\> | Yes | |
| `type` | literal | Yes | `"bank_transfer"` |
| `accountName` | string | Yes | |
| `accountNumber` | string | Yes | |
| `bankName` | string | No | |
| `bankCode` | string | No | |
| `isDefault` | boolean | Yes | |

**Indexes:** `by_creator` (creatorId)

---

### `leads` — Contact inquiries from websites

| Field | Type | Required | Notes |
|---|---|---|---|
| `submissionId` | Id\<"submissions"\> | Yes | |
| `creatorId` | Id\<"creators"\> | Yes | |
| `source` | union | Yes | `"website"` / `"qr_code"` / `"direct"` |
| `name` | string | Yes | |
| `phone` | string | Yes | |
| `email` | string | No | |
| `status` | union | Yes | `"new"` → `"contacted"` → `"qualified"` → `"converted"` / `"lost"` |
| `createdAt` | number | Yes | |

**Indexes:** `by_submission` (submissionId), `by_creator` (creatorId), `by_status` (status)

---

### `leadNotes` — Notes on leads

| Field | Type | Required | Notes |
|---|---|---|---|
| `leadId` | Id\<"leads"\> | Yes | |
| `creatorId` | Id\<"creators"\> | Yes | |
| `content` | string | Yes | |
| `createdAt` | number | Yes | |

**Indexes:** `by_lead` (leadId)

---

### `notifications` — In-app notifications

| Field | Type | Required | Notes |
|---|---|---|---|
| `creatorId` | Id\<"creators"\> | Yes | |
| `type` | union | Yes | 9 types (see Notifications page section) |
| `title` | string | Yes | |
| `body` | string | Yes | |
| `data` | any | No | Flexible payload: `{ submissionId?, leadId?, ... }` |
| `read` | boolean | Yes | |
| `sentAt` | number | Yes | |

**Indexes:** `by_creator` (creatorId), `by_creator_unread` (creatorId, read)

---

### `pushTokens` — Device push notification tokens

| Field | Type | Required | Notes |
|---|---|---|---|
| `creatorId` | Id\<"creators"\> | Yes | |
| `token` | string | Yes | Expo push token |
| `platform` | union | Yes | `"ios"` / `"android"` / `"web"` |
| `active` | boolean | Yes | |

**Indexes:** `by_creator` (creatorId), `by_token` (token)

---

### `referrals` — Referral tracking

| Field | Type | Required | Notes |
|---|---|---|---|
| `referrerId` | Id\<"creators"\> | Yes | Creator who shared the code |
| `referredId` | Id\<"creators"\> | Yes | Creator who signed up with code |
| `referralCode` | string | Yes | Code that was used |
| `status` | union | Yes | `"pending"` → `"qualified"` → `"paid"` |
| `bonusAmount` | number | No | PHP 1,000 when qualified |
| `qualifiedAt` | number | No | |
| `paidAt` | number | No | |
| `createdAt` | number | Yes | |

**Indexes:** `by_referrer` (referrerId), `by_referred` (referredId), `by_status` (status)

---

### `analytics` — Creator/platform statistics

| Field | Type | Required | Notes |
|---|---|---|---|
| `creatorId` | Id\<"creators"\> | Yes | |
| `period` | string | Yes | `"2026-02"` (monthly) or `"2026-02-17"` (daily) |
| `periodType` | union | Yes | `"daily"` / `"monthly"` |
| `submissionsCount` | number | Yes | |
| `approvedCount` | number | Yes | |
| `rejectedCount` | number | Yes | |
| `leadsGenerated` | number | Yes | |
| `earningsTotal` | number | Yes | |
| `websitesLive` | number | Yes | |
| `referralsCount` | number | Yes | |
| `updatedAt` | number | Yes | |

**Indexes:** `by_creator_period` (creatorId, periodType, period), `by_period` (periodType, period)

---

### `websiteAnalytics` — Per-website traffic

| Field | Type | Required | Notes |
|---|---|---|---|
| `submissionId` | Id\<"submissions"\> | Yes | |
| `date` | string | Yes | `"2026-02-17"` |
| `pageViews` | number | Yes | |
| `uniqueVisitors` | number | Yes | |
| `contactClicks` | number | Yes | |
| `whatsappClicks` | number | Yes | |
| `phoneClicks` | number | Yes | |
| `formSubmissions` | number | Yes | |
| `updatedAt` | number | Yes | |

**Indexes:** `by_submission_date` (submissionId, date), `by_date` (date)

---

### `auditLogs` — Admin action tracking

**Enhanced with Media Operation Tracking (Updated)**

Now includes audit logging for transcription regeneration and image enhancement:

| Field | Type | Required | Notes |
|---|---|---|---|
| `adminId` | string | Yes | Clerk ID of admin |
| `action` | union | Yes | `"submission_approved"` / `"submission_rejected"` / `"website_generated"` / `"website_deployed"` / `"payment_sent"` / `"submission_deleted"` / `"creator_updated"` / `"manual_override"` / `"payment_confirmed"` / `"transcription_regenerated"` / `"images_enhanced"` |
| `targetType` | union | Yes | `"submission"` / `"creator"` / `"website"` / `"withdrawal"` |
| `targetId` | string | Yes | |
| `metadata` | any | No | Context (old/new values, reasons, business name for media operations) |
| `timestamp` | number | Yes | |

**Indexes:** `by_admin` (adminId), `by_target` (targetType, targetId), `by_action` (action), `by_timestamp` (timestamp)

**New Action Types:**
- `transcription_regenerated`: Admin manually regenerated transcription (non-blocking, logged via scheduler)
- `images_enhanced`: Admin re-triggered Airtable image enhancement (non-blocking, logged via scheduler)

---

### `settings` — Platform configuration

| Field | Type | Required | Notes |
|---|---|---|---|
| `key` | string | Yes | e.g., `"referral_bonus_amount"`, `"min_withdrawal"` |
| `value` | any | Yes | Number, string, boolean, or object |
| `description` | string | No | |
| `updatedAt` | number | Yes | |
| `updatedBy` | string | No | Admin Clerk ID |

**Indexes:** `by_key` (key)

---

## Convex Backend — All Functions

### `creators.ts` — Creator CRUD

| Function | Type | Purpose |
|---|---|---|
| `getByClerkId(clerkId)` | Query | Fetch creator by Clerk ID |
| `create(clerkId, email, ...)` | Mutation | Create creator or update lastActiveAt; initializes referral if code provided |
| `update(id, firstName?, lastName?, phone?, profileImage?)` | Mutation | Update profile, sends `profile_updated` notification |
| `applyReferralCode(id, referredByCode)` | Mutation | Apply referral code post-signup; validates code, prevents duplicates/self-referral, creates referral record |
| `updateLastActive(clerkId)` | Mutation | Updates `lastActiveAt` timestamp |
| `certify(id)` | Mutation | Sets `certifiedAt`, sends notification |

### `submissions.ts` — Submission lifecycle

**Enhanced Transcription Support (Updated)**

Now supports transcription re-triggering from admin UI with timestamp tracking:
- **`transcriptionUpdatedAt`**: Timestamp when transcription was last generated (shows "Generated 3 hours ago" in UI)
- **Re-trigger capability**: Admin can manually regenerate transcription if needed
- **Large file support**: Automatically chunks files >25MB for processing
- **Audit logging**: All transcription regenerations logged to audit trail

| Function | Type | Purpose |
|---|---|---|
| `create(creatorId, businessName, ...)` | Mutation | Creates draft, increments `submissionCount` |
| `update(id, ...)` | Mutation | Updates fields; triggers transcription if media uploaded. Now supports `transcriptionUpdatedAt` field |
| `submit(id)` | Mutation | Status → `"submitted"`, sets amount=1000, creates lead, triggers Airtable push, increments analytics |
| `getById(id)` | Query | Fetch single submission |
| `getByIdWithCreator(id)` | Query | Submission + creator info + deployed URL |
| `getByCreatorId(creatorId)` | Query | All submissions for creator |
| `getDraftByCreatorId(creatorId)` | Query | Most recent draft |
| `getAll()` | Query | All submissions (admin) |
| `getAllWithCreator()` | Query | All with creator info (admin) |
| `getByStatus(status)` | Query | Filter by status (admin) |
| `updateTranscription(submissionId, transcription)` | Internal Mutation | Save transcript |
| `updateTranscriptionStatus(submissionId, status, error?)` | Internal Mutation | Update transcription status |
| `transcribeMedia(submissionId, storageId, mediaType)` | Internal Action | Calls Groq Whisper API with intelligent chunking for files >25MB |

### `admin.ts` — Admin operations

**Enhanced with Audit Logging for Media Operations (Updated)**

New non-blocking audit logging for transcription and image regeneration actions:

| Function | Type | Purpose |
|---|---|---|
| `approveSubmission(id, adminId)` | Mutation | Approve → notify + audit log + analytics |
| `rejectSubmission(id, reason, adminId)` | Mutation | Reject with reason → notify + audit + analytics |
| `markWebsiteGenerated(id, websiteUrl, adminId)` | Mutation | Status → `"website_generated"` |
| `markDeployed(id, websiteUrl, adminId)` | Mutation | Status → `"deployed"`, increments `websitesLive` |
| `markPaid(id, adminId)` | Mutation | Status → `"paid"`, adds payout to balance, creates earning, checks referral qualification |
| `getAllSubmissionsWithCreators()` | Query | All submissions with creator details |
| `logTranscriptionRegenerated(submissionId, adminId, businessName)` | Internal Mutation | **NEW** — Create non-blocking audit log when admin manually regenerates transcription. Scheduled via `ctx.scheduler.runAfter(0, ...)` |
| `logImagesEnhanced(submissionId, adminId, businessName)` | Internal Mutation | **NEW** — Create non-blocking audit log when admin re-triggers Airtable image enhancement. Scheduled via `ctx.scheduler.runAfter(0, ...)` |

### `withdrawals.ts` — Payout management

| Function | Type | Purpose |
|---|---|---|
| `create(creatorId, amount, accountHolderName, bankName, bankCode, accountNumber, city)` | Mutation | Creates withdrawal, deducts balance immediately, initiates Wise transfer async |
| `updateStatus(id, status, transactionRef?, adminId)` | Mutation | Admin override; restores balance if failed, increments `totalWithdrawn` if completed |
| `getByCreator(creatorId)` | Query | All withdrawals for creator |
| `getByStatus(status)` | Query | Filter by status with creator enrichment |
| `getAll()` | Query | All withdrawals with creator details |
| `setWiseTransferIds(withdrawalId, wiseTransferId, wiseRecipientId)` | Internal Mutation | Store Wise IDs |
| `markFailed(withdrawalId, reason?)` | Internal Mutation | Mark failed + restore balance |
| `updateByTransactionRef(transactionRef, status)` | Internal Mutation | Called by Wise webhook |

### `wise.ts` (Convex) — Wise integration

| Function | Type | Purpose |
|---|---|---|
| `initiateTransfer(withdrawalId, ...)` | Internal Action | Full Wise flow: create recipient → quote → transfer → fund. On failure: marks failed + restores balance |

### `airtable.ts` — AI content pipeline

**Multi-Version Image Support (Updated)**

Airtable stores AI-enhanced images as arrays of attachments per field (e.g., `enhanced_headshot` can have multiple versions). The system now extracts **all image variations** with automatic versioning:

- **Single image**: Stored as original field name (e.g., `enhanced_headshot`)
- **Multiple images**: Stored with version suffix (e.g., `enhanced_headshot_v1`, `enhanced_headshot_v2`)
- **Extraction**: `getAllAttachmentUrls()` function iterates all attachment arrays and builds versioned keys
- **Re-triggering**: Removed duplicate prevention — admins can re-enhance images, and new versions are added

| Function | Type | Purpose |
|---|---|---|
| `pushToAirtable(submissionId)` | Action | Push submission data + photos to Airtable, schedule polling. Supports re-triggering: attempts to PATCH existing record to reset status, creates new record as fallback |
| `pushToAirtableInternal(submissionId)` | Internal Action | Internal wrapper with error handling |
| `fetchEnhancedContentWithRetry(submissionId, airtableRecordId, retryCount, hasProducts)` | Internal Action | Poll Airtable for AI-generated content with exponential backoff. Extracts all image variations from attachment arrays and creates versioned keys |
| `getAllAttachmentUrls(field: unknown)` | Internal Function | **NEW** — Extracts all URLs from Airtable attachment arrays (not just first). Handles empty fields, single attachments, and multi-item arrays |
| `triggerAirtablePush(submissionId)` | Public Mutation | **NEW** — Manually re-trigger Airtable enhancement from admin UI. Resets sync status to `pending_push` and schedules push immediately |
| `saveEnhancedContent(submissionId, enhancedImages, aiTextFields)` | Internal Mutation | Create/update `generatedWebsites` record with all AI content (including all versioned images) |
| `downloadAndStoreEnhancedImage(submissionId, sourceImageUrl)` | Internal Action | Download image from URL and store in Convex storage |
| `updateAirtableRecordId(submissionId, airtableRecordId)` | Internal Mutation | Store Airtable record ID in submission |
| `updateSyncStatus(submissionId, status)` | Internal Mutation | Update `airtableSyncStatus` field |
| `getSubmissionById(submissionId)` | Internal Query | Fetch submission for internal use |
| `getSyncStatus(submissionId)` | Query | Get current Airtable sync status |
| `getEnhancedContent(submissionId)` | Query | Get enhanced images + AI text from generatedWebsites |

### `notifications.ts` — Notification system

| Function | Type | Purpose |
|---|---|---|
| `createAndSend(creatorId, type, title, body, data?)` | Internal Mutation | Creates notification + schedules push |
| `createForClient(creatorId, type, title, body, data?)` | Mutation | Client-created notification (password changes, etc.) |
| `sendPushNotification(creatorId, title, body, data?)` | Internal Action | Sends via Expo Push API; handles invalid tokens |
| `registerPushToken(creatorId, token, platform)` | Mutation | Register device token |
| `removePushToken(token)` | Mutation | Deactivate token |
| `markAsRead(id)` | Mutation | Mark single notification read |
| `markAllAsRead(creatorId)` | Mutation | Mark all notifications read |
| `getByCreator(creatorId)` | Query | All notifications |
| `getUnreadCount(creatorId)` | Query | Unread count |

### `earnings.ts` — Income tracking

| Function | Type | Purpose |
|---|---|---|
| `create(creatorId, submissionId, amount, type)` | Internal Mutation | Create earning record |
| `getByCreator(creatorId)` | Query | All earnings with business names |
| `getBySubmission(submissionId)` | Query | Earnings for submission |
| `getSummary(creatorId)` | Query | Aggregated: total, available, pending, withdrawn, by type |

### `referrals.ts` — Referral program

| Function | Type | Purpose |
|---|---|---|
| `createFromSignup(referrerId, referredId, referralCode)` | Internal Mutation | Create pending referral (prevents duplicates) |
| `qualifyByCreator(referredCreatorId, submissionId, bonusAmount)` | Internal Mutation | Status → `"qualified"`, creates earning for referrer, adds bonus to balance, notifies |
| `getByReferrer(referrerId)` | Query | Referrals with referred creator info |
| `getStats(referrerId)` | Query | Total, pending, qualified, paid, totalEarned |

### `leads.ts` — Lead management

| Function | Type | Purpose |
|---|---|---|
| `create(submissionId, creatorId, source, name, phone, ...)` | Mutation | Create lead, increment analytics, notify creator |
| `updateStatus(id, status)` | Mutation | Move through pipeline |
| `remove(id)` | Mutation | Delete lead + associated notes |
| `getBySubmission(submissionId)` | Query | Leads for business |
| `getByCreator(creatorId)` | Query | All leads across businesses |
| `getCountBySubmission(submissionId)` | Query | Count breakdown by status |

### `analytics.ts` — Statistics

| Function | Type | Purpose |
|---|---|---|
| `incrementStat(creatorId, period, periodType, field, delta)` | Internal Mutation | Real-time stat increment |
| `upsertCreatorStats(creatorId, period, periodType, stats)` | Internal Mutation | Create/update period stats |
| `getCreatorStats(creatorId, periodType, from?, to?)` | Query | Stats for period range |
| `getPlatformStats(periodType, period)` | Query | Platform-wide aggregated stats |

---

## HTTP Endpoints (`convex/http.ts`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/airtable-webhook` | Receives AI image generation completion from Airtable. Validates `convexRecordId`, processes enhanced image URLs (handles string or Airtable attachment array format), triggers download + storage. |
| POST | `/wise-webhook` | Receives transfer state changes from Wise. Maps states: `outgoing_payment_sent` → completed, `processing` → processing, `cancelled`/`refunded`/`bounced` → failed. Updates withdrawal + notifies creator. |
| GET | `/health` | Health check. Returns `{ status: "ok", timestamp }`. |

---

## Next.js API Routes (`app/api/`)

**Enhanced Media Handling (Updated)**

New endpoints for media operations with large file support and admin-triggered regeneration:

| Method | Path | Purpose |
|---|---|---|
| POST | `/transcribe` | **UPDATED** — Transcribe audio/video to text. Now supports files up to ~150MB via intelligent chunking. Accepts `videoUrl` or `audioUrl` (R2 or Convex storage ID). Returns transcribed text + `transcriptionUpdatedAt` timestamp. Max duration: 120s (2 minutes). Large files split into ≤24MB chunks at format-specific boundaries |
| GET | `/download-media` | **NEW** — Download recording audio/video. Query params: `url` (media URL), `filename`. Requires Clerk authentication. Streams file with proper `Content-Type` and `Content-Disposition` headers |

**Media Chunking Strategy** (for `/transcribe`):
- **≤25MB**: Sent directly to Groq Whisper API
- **>25MB**: Automatically split using `chunkMediaFile()` with format-specific logic:
  - **WebM**: Split at Cluster boundaries (0x1F43B675), duplicate EBML header
  - **MP3**: Split at frame sync markers (0xFFE0 mask), preserve ID3v2 header
  - **WAV**: Split at PCM block boundaries, reconstruct WAV header with updated sizes
  - **MP4**: Extract audio stream, create valid audio-only MP4 with ADTS headers
- Each chunk transcribed independently, results concatenated with space separator
- Progress logging shows "Transcribing chunk 1/5 (3.2MB)"

---

## Services (`services/wise.ts` / `services/groq.service.ts` / `services/media-chunker.ts`)

**Enhanced Transcription Service (Updated)**

### `groq.service.ts` — Groq Whisper integration

Pure transcription service with large file chunking support:

| Function | Purpose |
|---|---|
| `transcribeAudioFromUrl(audioUrl)` | Download media from URL, auto-detect size/format, chunk if necessary, transcribe with 3 retries. Intelligently chunks files >25MB |
| `transcribeBuffer(buffer, filename, retries=3)` | Transcribe buffer with exponential backoff retry logic (3 attempts, 3s-9s delays). Uses temp file + stream for reliability |
| `writeTempFile(buffer, filename)` | Create temp file in OS temp directory for Groq SDK |
| `cleanupTempFile(filePath)` | Remove temp file after transcription |

### `media-chunker.ts` — Intelligent media splitting (NEW FILE - 1084 lines)

Format-specific media file splitter for files >25MB:

| Function | Purpose |
|---|---|
| `getFileExtension(contentType)` | Detect media format from Content-Type |
| `chunkMediaFile(buffer, contentType, maxSize)` | Main API: returns array of valid media buffers, each <maxSize. Automatically routes to format-specific chunker |
| `chunkWebM(buffer, maxSize)` | Split WebM at cluster boundaries, preserve EBML header |
| `chunkMP3(buffer, maxSize)` | Split MP3 at frame sync markers, preserve ID3v2 header |
| `chunkWAV(buffer, maxSize)` | Split PCM data at block boundaries, duplicate WAV header with adjusted sizes |
| `chunkMP4(buffer, maxSize)` | Extract audio from video, create audio-only MP4 chunks with ADTS headers, reconstruct atom structure |

**Default chunk size:** 24MB (with 1MB headroom for headers/metadata)

### `wise.ts` — Wise API client

Pure Wise API client (no Convex dependencies). Used by `convex/wise.ts` internal action.

| Function | Purpose |
|---|---|
| `createRecipient(config, details)` | Create PHP bank account in Wise |
| `createQuote(config, amountPHP)` | Create PHP→PHP transfer quote |
| `createTransfer(config, recipientId, quoteId, reference)` | Create transfer with UUID |
| `fundTransfer(config, transferId)` | Fund transfer (sandbox uses simulation endpoint) |
| `getTransfer(config, transferId)` | Fetch transfer state |
| `getAccountRequirements(config, amountPHP)` | Fetch account requirements |

Endpoints: Sandbox `api.sandbox.transferwise.tech` / Production `api.wise.com`

---

## Key System Workflows

### Submission Lifecycle

```
draft → submitted → approved → website_generated → deployed → paid
                  ↘ rejected (with reason — creator can resubmit)
```

1. **Create draft** — `submissions.create()`, saved locally + server
2. **Add media** — Photos → R2, Video/Audio → R2 + Groq transcription
3. **Submit** — Status → `"submitted"`, amount set, lead auto-created, Airtable push triggered
4. **Airtable AI pipeline** — Photos sent to Airtable → AI generates enhanced images + text → polling with exponential backoff → images stored in Convex → `generatedWebsites` record created
5. **Admin review** — Approve (→ notify + analytics) or Reject (→ notify with reason)
6. **Website deployment** — Admin marks deployed, websitesLive incremented
7. **Payment** — Admin marks paid → payout added to balance → earning record created → referral check triggered

### Withdrawal Workflow

1. Creator requests withdrawal (min PHP 100) — balance deducted immediately
2. `wise.initiateTransfer()`: create recipient → quote → transfer → fund
3. Wise processes transfer → sends webhook to `/wise-webhook`
4. On completion: status → `"completed"`, `totalWithdrawn` incremented, creator notified
5. On failure: status → `"failed"`, balance restored

### Referral Workflow

1. Creator A gets `referralCode` during signup
2. Creator B signs up with Creator A's code → pending referral created
3. Creator B's first submission gets approved and paid
4. `referrals.qualifyByCreator()` → status `"qualified"`, PHP 1,000 bonus → Creator A's balance + earning + notification

### Push Notification Workflow

1. Device registers token via `notifications.registerPushToken()`
2. System events call `notifications.createAndSend()` → saves to DB + schedules push
3. `sendPushNotification()` → fetches active tokens → POST to `https://exp.host/--/api/v2/push/send`
4. Invalid tokens auto-deactivated

### Transcription Regeneration Workflow (Admin)

**New Feature (Updated)**

Admins can manually regenerate transcriptions if they contain errors or need updating:

1. **Initiate regeneration** — Admin clicks "Regenerate Transcription" button in submission detail page
2. **API request** — POST `/api/transcribe` with `videoUrl` or `audioUrl`
3. **Media detection** — System fetches file, detects format and size
4. **Smart chunking** — If >25MB, uses `chunkMediaFile()` to split at format-specific boundaries:
   - WebM: Cluster boundaries (preserves EBML header)
   - MP3: Frame sync markers (preserves ID3v2)
   - WAV: PCM block boundaries (reconstructs WAV header)
   - MP4: Extracts audio, creates ADTS-wrapped audio chunks
5. **Transcription** — Each chunk sent to Groq Whisper with 3 retries (exponential backoff)
6. **Concatenation** — Chunk transcripts combined with spaces into final transcript
7. **Storage** — Transcript saved, `transcriptionUpdatedAt` timestamp recorded
8. **Audit logging** — Non-blocking audit record created via scheduler (doesn't delay response)
9. **Display** — UI shows timestamp: "Generated 2 hours ago" (via `transcriptionUpdatedAt`)

### Image Enhancement Re-trigger Workflow (Admin)

**New Feature (Updated)**

Admins can re-trigger Airtable image enhancement if initial batch had issues:

1. **Initiate re-trigger** — Admin clicks "Enhance Images" button in submission detail page
2. **Airtable interaction** — `triggerAirtablePush(submissionId)` mutation:
   - Resets `airtableSyncStatus` to `pending_push`
   - Schedules `pushToAirtableInternal()` immediately
3. **PATCH vs new record** — Attempts to PATCH existing Airtable record to reset status
   - If PATCH succeeds (200): Record re-processes enhancement
   - If PATCH fails (403/404): Creates new Airtable record as fallback
4. **Polling** — `fetchEnhancedContentWithRetry()` polls for updated images
5. **Multi-version extraction** — `getAllAttachmentUrls()` extracts ALL image variations:
   - Single image: Stores with original key (e.g., `enhanced_headshot`)
   - Multiple images: Stores with version suffixes (e.g., `enhanced_headshot_v1`, `enhanced_headshot_v2`)
6. **Storage** — Images downloaded and stored in Convex storage
7. **Categorization** — Website generation auto-categorizes all versions:
   - Strips version suffix with regex: `field_name_vN → field_name`
   - Case-insensitive matching to appropriate UI sections
   - All image variations available for website builder
8. **Audit logging** — Non-blocking audit record created via scheduler
9. **UI feedback** — Admin sees "Airtable enhancement triggered! Enhanced images will be available shortly."

---

## Creator Earnings

| Source | Amount | Trigger |
|---|---|---|
| Approved video submission | PHP 500 | Admin marks paid |
| Approved audio submission | PHP 300 | Admin marks paid |
| Referral bonus | PHP 1,000 | Referred creator's first submission paid |
| Lead bonus | Planned | Website generates a lead |

---

## Admin UI Features (Updated)

**Enhanced Submission Management Dashboard**

The submission detail page (`app/admin/submissions/[id]/page.tsx`) now includes new features for managing media and content:

### Media Regeneration Controls

- **Transcription Regenerate Button**: 
  - Icon button with spinner animation
  - Available when audio/video media exists
  - Tooltip: "Regenerate transcription from audio/video"
  - Triggers POST `/api/transcribe` with media URL
  - Shows loading spinner during processing
  - Displays timestamp: "Generated 3 hours ago" (via `transcriptionUpdatedAt`)
  - Logs audit trail: `transcription_regenerated` action

- **Enhance Images Button** (Amber color):
  - Available for statuses: submitted, in_review, website_generated, approved, deployed
  - Text: "Enhance Images" or "Re-enhance Images"
  - Shows spinner during enhancement
  - Triggers `triggerAirtablePushMutation(submissionId)`
  - Feedback message: "Airtable enhancement triggered! Enhanced images will be available shortly."
  - Logs audit trail: `images_enhanced` action

### Image Categorization Improvements

- **Multi-version support**: Images with version suffixes (`_v1`, `_v2`, etc.) automatically categorized
- **Base name extraction**: Regex strips version suffix: `enhanced_headshot_v1` → `headshot`
- **Case-insensitive matching**: Handles various field naming conventions
- **All variants available**: Every image version flows through to website builder (no loss)

### Photo Handling

- **Mixed URL sources**: Properly resolves both HTTP URLs (R2) and Convex storage IDs
- **Lazy resolution**: Storage IDs resolved only when needed
- **Consolidated display**: All photo sources merged into single array for preview

---

## Environment Variables

### Convex (set via `npx convex env set`)

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | Groq Whisper API for audio/video transcription |
| `R2_PUBLIC_URL` | Cloudflare R2 public URL for photo access |
| `R2_ACCOUNT_ID` | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | R2 access key for uploads |
| `R2_SECRET_ACCESS_KEY` | R2 secret key for uploads |
| `R2_BUCKET_NAME` | R2 bucket name (default: `tendso`) |
| `AIRTABLE_API_KEY` | Airtable API key for AI content pipeline |
| `AIRTABLE_BASE_ID` | Airtable base ID |
| `AIRTABLE_TABLE_ID` | Airtable table ID |
| `WISE_SANDBOX` | `"true"` / `"false"` for environment selection |
| `WISE_SANDBOX_TOKEN` | Sandbox Wise API token |
| `WISE_SANDBOX_PROFILE_ID` | Sandbox Wise profile ID |
| `WISE_API_TOKEN` | Production Wise API token |
| `WISE_PROFILE_ID` | Production Wise profile ID |

### App (`.env` or EAS secrets)

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `EXPO_PUBLIC_CONVEX_URL` | Convex deployment URL |

---

## App Configuration

- **Bundle ID / Package:** `com.negosyodigital.app`
- **Custom Scheme:** `negosyodigital://`
- **Orientation:** Portrait only
- **EAS Project ID:** `2adbda2f-fecd-4fdd-91b8-56db76e0c780`
- **New Architecture:** Enabled
- **Permissions:** Camera, Microphone, Photo Library, Storage, Audio Settings
