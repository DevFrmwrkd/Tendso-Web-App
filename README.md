# Tendso

A platform that digitalizes Filipino micro, small, and medium enterprises (MSMEs) by generating AI-powered business websites from creator-submitted interviews, photos, and business information.

## How It Works

1. **Creators** sign up, complete training modules, and pass a certification quiz
2. Certified creators visit local businesses, record an interview, and upload photos
3. **AI pipeline** transcribes the audio (Groq Whisper), extracts business content (Llama LLM), and generates a full website using the Astro template system
4. **Admins** review, approve, and publish the website to Cloudflare Pages
5. **Business owners** receive a live website with lead tracking, and creators earn payouts

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, Framer Motion |
| Backend | Convex (serverless DB + functions) |
| Auth | Clerk |
| AI/ML | Groq (Whisper transcription, Llama 3.3 70B content extraction) |
| Website Generation | Astro 5 static site builder with Tailwind v4 |
| File Storage | Cloudflare R2 |
| Website Hosting | Cloudflare Pages |
| App Hosting | Vercel |
| CMS Sync | Airtable (bidirectional) |
| Email | Nodemailer + Gmail |
| Analytics | Chart.js, Vercel Analytics |

## Project Structure

```
app/
  admin/              # Admin dashboard, submissions, creators, payouts, audit
  submit/             # Multi-step submission flow (info → interview → photos → review → success)
  dashboard/          # Creator dashboard
  wallet/             # Earnings & withdrawals (GCash, Maya, bank transfer, Wise)
  referrals/          # Referral code sharing & tracking
  training/           # Training modules & certification quiz
  api/
    generate-website/ # AI content extraction + Astro build pipeline
    publish-website/  # Deploy to Cloudflare Pages
    transcribe/       # Groq Whisper with chunked large-file support
    upload-image/     # R2 file uploads
    send-*-email/     # Transactional emails

astro-site-template/  # Astro SSG template with 10 style variants per section
  src/
    components/       # Hero, About, Services, Gallery, Contact (A-J variants)
    layouts/          # BaseLayout with Navbar & Footer
    data/             # site-data.json (generated at build time)

convex/               # Backend schema, mutations, queries, actions
lib/
  astro-builder.ts    # Writes site-data.json, runs astro build, returns HTML
  services/
    groq.service.ts   # Transcription + LLM content extraction
    media-chunker.ts  # Format-aware chunking for large audio/video files
  email/              # Email templates & sender
  template-fields.ts  # Template field definitions & style mappings

components/
  editor/             # Visual website editor (ContentEditor, VisualEditor)
  landing/            # Marketing site components
  ui/                 # Shared UI primitives
  providers/          # ConvexClerkProvider
```

## Key Features

- **AI Website Generation** -- Audio transcription, content extraction, and Astro-based static site generation with 10 style variants per section
- **Multi-format Media Chunking** -- Splits large files (WebM, MP3, WAV, MP4) at format-specific boundaries for Groq's 25MB limit
- **Creator Earnings System** -- Wallet with GCash, Maya, bank transfer, and Wise withdrawals
- **Referral Program** -- Unique referral codes with bonus tracking
- **Lead Tracking** -- Website visitors generate leads linked back to creators
- **Admin Dashboard** -- Submission review, approval workflow, payout management, and audit logging
- **Airtable Sync** -- Bidirectional sync for CMS and AI image enhancement
- **Visual Website Editor** -- Inline content editing with live preview

