# Transcript Processing Flow

This document provides a comprehensive overview of how transcripts are processed in the Tendso application, including data sources, field names, extracted values, and the complete processing pipeline.

## Table of Contents

- [Overview](#overview)
- [Data Flow Diagram](#data-flow-diagram)
- [Input Sources](#input-sources)
- [Field Names Reference](#field-names-reference)
- [Extracted Values](#extracted-values)
- [Processing Pipeline](#processing-pipeline)
- [API Endpoints](#api-endpoints)
- [Key Files](#key-files)
- [Models & Services](#models--services)

---

## Overview

The transcript processing system converts audio/video submissions into structured business content and generates complete websites automatically. The pipeline uses AI services (Groq) for transcription and content extraction.

**Main Flow:**
```
Audio/Video → Transcription → Storage → Content Extraction → Website Generation
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRANSCRIPT PROCESSING FLOW                    │
└─────────────────────────────────────────────────────────────────┘

1. INPUT SOURCES
   ├─ Audio File URL (submission.audio_url)
   └─ Video File URL (submission.video_url)
                    ↓
2. TRANSCRIPTION (Groq Whisper-large-v3)
   ├─ API Endpoint: POST /api/transcribe
   ├─ Input Fields: audioUrl, submissionId
   ├─ Service: groqService.transcribeAudioFromUrl()
   └─ Output: transcript (plain text string)
                    ↓
3. DATABASE STORAGE
   ├─ Table: submissions
   ├─ Field: transcript (TEXT, nullable)
   └─ Initially NULL, filled after transcription completes
                    ↓
4. CONTENT EXTRACTION (Groq LLaMA 3.3-70b)
   ├─ API Endpoint: POST /api/extract-content
   ├─ Input Fields: transcript, submissionId (optional)
   ├─ Service: groqService.extractBusinessContent()
   └─ Output: businessContent (structured JSON object)
                    ↓
5. EXTRACTED BUSINESS CONTENT
   ├─ tagline: string (max 10 words, creative)
   ├─ about: string (2-3 sentences)
   ├─ services: string[] (3+ service items)
   ├─ contact: object
   │  ├─ phone: string
   │  ├─ email: string
   │  └─ address: string
   └─ highlights: string[] (3+ unique selling points)
                    ↓
6. WEBSITE GENERATION (Groq LLaMA 3.3-70b)
   ├─ API Endpoint: POST /api/generate-website
   ├─ Input: businessContent + submission metadata
   ├─ Service: groqService.generateWebsite()
   └─ Output: Complete HTML page (with Tailwind CSS)
                    ↓
7. FINAL STORAGE LOCATIONS
   ├─ submissions.transcript → Raw transcript text
   ├─ submissions.website_code → Generated HTML string
   ├─ submissions.website_content → Extracted JSON content
   ├─ generated_websites.extracted_content → Backup copy
   ├─ generated_websites.html_content → Public HTML version
   └─ Supabase Storage → Public HTML file (accessible URL)
```

---

## Input Sources

### Audio/Video Files

| Source | Field Name | Type | Description |
|--------|------------|------|-------------|
| User Upload | `submission.audio_url` | TEXT | Primary audio file stored in Supabase Storage |
| User Upload | `submission.video_url` | TEXT | Alternative video file (can extract audio) |

### Fetching Mechanism

The system fetches audio files from Supabase Storage URLs:

```typescript
// From groq.service.ts
async transcribeAudioFromUrl(audioUrl: string): Promise<string> {
  // 1. Fetch audio file from URL
  const response = await fetch(audioUrl)
  const audioBlob = await response.blob()

  // 2. Create File object with proper MIME type
  const audioFile = new File([audioBlob], 'audio.mp3', { type: mimeType })

  // 3. Send to Groq Whisper API
  const transcription = await groq.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-large-v3',
    language: 'en',
    response_format: 'json',
  })

  return transcription.text
}
```

---

## Field Names Reference

### Database Schema (Supabase PostgreSQL)

**Table: `submissions`**

| Field Name | Data Type | Nullable | Description |
|------------|-----------|----------|-------------|
| `transcript` | TEXT | Yes | Raw transcribed text from audio/video |
| `audio_url` | TEXT | Yes | URL to uploaded audio file |
| `video_url` | TEXT | Yes | URL to uploaded video file |
| `website_code` | TEXT | Yes | Generated HTML website code |
| `website_content` | JSONB | Yes | Extracted business content (JSON) |

**Table: `generated_websites`**

| Field Name | Data Type | Nullable | Description |
|------------|-----------|----------|-------------|
| `extracted_content` | JSONB | Yes | Extracted business content |
| `html_content` | TEXT | Yes | Generated HTML website |
| `public_url` | TEXT | Yes | URL to publicly accessible website |

### TypeScript Interfaces

**File: `/types/database.ts`**

```typescript
interface Submission {
  id: string
  transcript?: string  // Optional, filled after transcription
  audio_url?: string
  video_url?: string
  website_code?: string
  website_content?: any  // JSON object
  // ... other fields
}
```

### API Request/Response Fields

**Transcription API (`/api/transcribe`)**

Request:
```json
{
  "audioUrl": "https://...",
  "submissionId": "uuid-here" // optional
}
```

Response:
```json
{
  "success": true,
  "transcript": "This is the transcribed text..."
}
```

**Content Extraction API (`/api/extract-content`)**

Request:
```json
{
  "transcript": "This is the transcribed text...",
  "submissionId": "uuid-here" // optional
}
```

Response:
```json
{
  "success": true,
  "businessContent": {
    "tagline": "...",
    "about": "...",
    "services": ["..."],
    "contact": {...},
    "highlights": ["..."]
  },
  "websiteHtml": "<!DOCTYPE html>..." // optional
}
```

---

## Extracted Values

### BusinessContent Structure

The AI extracts the following structured data from transcripts:

```typescript
interface BusinessContent {
  tagline: string           // Max 10 words, creative and memorable
  about: string            // 2-3 sentences describing the business
  services: string[]       // Array of 3+ service names/descriptions
  contact: {
    phone?: string         // Phone number if mentioned
    email?: string         // Email address if mentioned
    address?: string       // Physical address if mentioned
  }
  highlights: string[]     // Array of 3+ unique selling points
}
```

### Example Extracted Content

```json
{
  "tagline": "Fresh Food Delivered to Your Doorstep Daily",
  "about": "We are a local food delivery service committed to bringing fresh, locally-sourced meals to your home. Our mission is to support local farmers while providing convenience to busy families.",
  "services": [
    "Daily Meal Delivery",
    "Custom Meal Planning",
    "Catering Services",
    "Subscription Boxes"
  ],
  "contact": {
    "phone": "+63 912 345 6789",
    "email": "hello@freshfood.ph",
    "address": "123 Main St, Manila"
  },
  "highlights": [
    "100% locally-sourced ingredients",
    "Same-day delivery available",
    "Customizable meal plans",
    "No minimum order required"
  ]
}
```

### Extended Content (for Website Generation)

When generating websites, the system combines extracted content with submission metadata:

```typescript
interface ExtendedBusinessContent {
  business_name: string              // From submission
  tagline: string                    // From extraction
  about: string                      // From extraction
  services: Array<{
    name: string
    description: string
  }>                                 // Enhanced services
  unique_selling_points: string[]    // From highlights
  tone: string                       // e.g., "professional-friendly"
  // Additional submission data:
  owner_name: string
  owner_phone: string
  owner_email: string
  city: string
  address: string
}
```

---

## Processing Pipeline

### Complete Step-by-Step Flow

#### Step 1: Submission Created
- Creator submits business info + audio/video file
- Submission stored in Supabase with `audio_url` or `video_url`
- `submission.transcript` is initially `NULL`
- Status: `draft` or `submitted`

#### Step 2: Transcription Triggered

**Path A: Manual Transcription**
```
Client → POST /api/transcribe → Groq Service → Database
```

**Path B: Automatic Transcription**
```
Submit Success Page → Auto-trigger → POST /api/transcribe
```

**Path C: Full Processing**
```
Admin → POST /api/process-submission → Transcribe + Extract + Generate
```

#### Step 3: Groq Whisper Transcription

Service: `groqService.transcribeAudioFromUrl(audioUrl)`

Process:
1. Fetch audio file from provided URL
2. Convert to Blob, then to File object
3. Detect MIME type (audio/mpeg, audio/wav, etc.)
4. Call Groq Audio API with Whisper-large-v3 model
5. Return `transcription.text`

Configuration:
```typescript
{
  model: "whisper-large-v3",
  language: "en",
  response_format: "json"
}
```

#### Step 4: Store Transcript in Database

API Route: `POST /api/transcribe`

Process:
1. Receive transcript text from Groq
2. Validate user owns the submission (security check)
3. Update `submissions.transcript` field
4. Return success response with transcript

Security:
- Requires authentication
- Validates `creator_id` matches current user
- Row-level security (RLS) enforced

#### Step 5: Content Extraction

Service: `groqService.extractBusinessContent(transcript)`

Process:
1. Send transcript to LLaMA 3.3-70b model
2. Use structured prompt requesting JSON output
3. Parse response as `BusinessContent` object
4. Validate structure matches interface
5. Return extracted content

Prompt Structure:
```
"Extract business information from this transcript.
Return JSON with: tagline, about, services, contact, highlights.
Be concise and professional..."
```

#### Step 6: Website Generation

Service: `groqService.generateWebsite(businessContent, businessInfo)`

Process:
1. Combine extracted content with submission metadata
2. Select template based on business type
3. Call LLaMA 3.3-70b with web design prompt
4. Generate complete HTML page with Tailwind CSS
5. Return HTML string

Output:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Business Name</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <!-- Generated content -->
</body>
</html>
```

#### Step 7: Store Generated Content

Storage Locations:
1. `submissions.transcript` ← Raw transcript
2. `submissions.website_code` ← Generated HTML
3. `submissions.website_content` ← Extracted JSON
4. `generated_websites.extracted_content` ← Backup
5. `generated_websites.html_content` ← Public version
6. Supabase Storage ← Public HTML file

#### Step 8: Admin Review

Admin Interface: `/app/admin/submissions/[id]`

Features:
- View transcript in read-only textarea
- Edit transcript manually if needed
- Regenerate website from transcript
- Quality checklist shows `hasTranscript: true/false`
- Track processing status

#### Step 9: Status Updates

Status Progression:
```
draft → submitted → in_review → website_generated → paid → completed
                                       ↑
                              (transcript stored here)
```

---

## API Endpoints

### Transcription

**Endpoint:** `POST /api/transcribe`

**Request:**
```typescript
{
  audioUrl: string      // Required: URL to audio/video file
  submissionId?: string // Optional: Auto-save to submission
}
```

**Response:**
```typescript
{
  success: true,
  transcript: string
}
```

**Authentication:** Required (user must own submission)

---

### Content Extraction

**Endpoint:** `POST /api/extract-content`

**Request:**
```typescript
{
  transcript: string     // Required: Transcribed text
  submissionId?: string  // Optional: Auto-save + generate website
}
```

**Response:**
```typescript
{
  success: true,
  businessContent: BusinessContent,
  websiteHtml?: string  // If submissionId provided
}
```

**Authentication:** Required

---

### Full Processing

**Endpoint:** `POST /api/process-submission`

**Request:**
```typescript
{
  submissionId: string  // Required
}
```

**Response:**
```typescript
{
  success: true,
  transcript: string,
  businessContent: BusinessContent,
  websiteUrl: string
}
```

**Description:** All-in-one endpoint that:
1. Transcribes audio
2. Extracts content
3. Generates website
4. Saves everything

**Authentication:** Admin only

---

### Website Generation

**Endpoint:** `POST /api/generate-website`

**Request:**
```typescript
{
  submissionId: string,
  templateName?: string,
  customizations?: {
    primaryColor?: string,
    secondaryColor?: string,
    fontFamily?: string
  }
}
```

**Response:**
```typescript
{
  success: true,
  website: {
    id: string,
    public_url: string,
    html_content: string
  },
  previewUrl: string,
  htmlContent: string
}
```

**Authentication:** Admin only

---

## Key Files

### Services

| File | Description |
|------|-------------|
| `/lib/services/groq.service.ts` | Core transcription and extraction logic |
| `/lib/services/supabase.service.ts` | Database operations |

### API Routes

| File | Endpoint | Purpose |
|------|----------|---------|
| `/app/api/transcribe/route.ts` | POST /api/transcribe | Audio → Text |
| `/app/api/extract-content/route.ts` | POST /api/extract-content | Text → JSON |
| `/app/api/process-submission/route.ts` | POST /api/process-submission | Full pipeline |
| `/app/api/generate-website/route.ts` | POST /api/generate-website | JSON → HTML |

### Client Hooks

| File | Purpose |
|------|---------|
| `/hooks/useGroqProcessing.ts` | Client-side state management for processing |

### Pages

| File | Purpose |
|------|---------|
| `/app/submit/success/page.tsx` | Auto-triggers transcription after submission |
| `/app/admin/submissions/[id]/page.tsx` | Admin review and manual processing |
| `/app/test-groq/page.tsx` | Testing interface for each step |

### Type Definitions

| File | Purpose |
|------|---------|
| `/types/database.ts` | Database schema types |
| `/types/submission.ts` | Submission-related types |

---

## Models & Services

### AI Models Used

| Model | Provider | Purpose | Configuration |
|-------|----------|---------|---------------|
| `whisper-large-v3` | Groq | Audio transcription | Language: English, Format: JSON |
| `llama-3.3-70b-versatile` | Groq | Content extraction | Temperature: 0.7, JSON mode |
| `llama-3.3-70b-versatile` | Groq | Website generation | Temperature: 0.8, Creative mode |

### External Services

| Service | Purpose | Configuration Required |
|---------|---------|----------------------|
| Groq API | AI transcription & generation | `GROQ_API_KEY` environment variable |
| Supabase | Database & authentication | Multiple env vars (see `.env.example`) |
| Supabase Storage | File storage | Configured in Supabase dashboard |

---

## Data Security & Privacy

### Access Control

- **Authentication Required:** All transcript operations require user login
- **Ownership Validation:** Users can only access their own submissions
- **Admin Access:** Admins can view all submissions for review
- **Row Level Security (RLS):** Enforced at database level in Supabase

### Data Storage

- **Transcripts:** Stored as plain text in PostgreSQL
- **Audio/Video:** Stored in Supabase Storage with public URLs
- **Generated HTML:** Stored in both database and cloud storage
- **Sensitive Data:** Contact info extracted only if mentioned in audio

### Privacy Considerations

- Audio files are processed by third-party AI (Groq)
- Transcripts may contain personal information
- No automatic deletion of source audio
- Generated websites are publicly accessible

---

## Error Handling

### Transcription Errors

```typescript
try {
  const transcript = await groqService.transcribeAudioFromUrl(audioUrl)
} catch (error) {
  // Returns 500 error
  // Error message: "Failed to transcribe audio"
}
```

### Content Extraction Errors

```typescript
try {
  const content = await groqService.extractBusinessContent(transcript)
} catch (error) {
  // Falls back to empty defaults
  return {
    tagline: "",
    about: "",
    services: [],
    contact: {},
    highlights: []
  }
}
```

### Validation Errors

- **400 Bad Request:** Missing required fields (audioUrl, transcript, etc.)
- **401 Unauthorized:** User not authenticated
- **403 Forbidden:** User doesn't own the submission
- **500 Internal Server Error:** AI service or database errors

---

## Performance Considerations

### Processing Time

- **Transcription:** 10-60 seconds (depends on audio length)
- **Content Extraction:** 5-15 seconds
- **Website Generation:** 10-30 seconds
- **Total Pipeline:** 25-105 seconds

### Optimization Strategies

- **Background Processing:** Long operations run asynchronously
- **Caching:** Transcripts cached in database to avoid re-processing
- **Incremental Updates:** Each step saves independently
- **Status Tracking:** UI shows progress for each step

### Rate Limiting

- Groq API has rate limits (check current tier)
- Consider implementing queue system for high volume
- Background job processing recommended for production

---

## Testing

### Test Interface

Location: `/app/test-groq/page.tsx`

Features:
- Test transcription with audio URL
- Test content extraction with sample transcript
- View results in real-time
- Debug API responses

### Manual Testing Flow

1. Upload audio via submission form
2. Navigate to `/app/submit/success/[id]`
3. Watch automatic transcription
4. Check admin panel for results
5. Verify database updates

---

## Future Improvements

### Potential Enhancements

- [ ] Support for multiple languages (not just English)
- [ ] Speaker identification in transcripts
- [ ] Confidence scores for extracted content
- [ ] Human review/editing before website generation
- [ ] Batch processing for multiple submissions
- [ ] Real-time transcription progress indicators
- [ ] A/B testing different AI prompts
- [ ] Webhook notifications when processing completes

### Known Limitations

- English language only
- No support for multiple speakers
- Audio quality affects transcription accuracy
- Extraction depends on clear business description in audio
- No fallback if AI services are down

---

## Support & Troubleshooting

### Common Issues

**Issue:** Transcription fails with 500 error
- Check audio URL is accessible
- Verify Groq API key is valid
- Ensure audio format is supported (MP3, WAV, M4A)

**Issue:** Extraction returns empty content
- Verify transcript contains business information
- Check transcript is in English
- Try manual extraction via test interface

**Issue:** Website generation fails
- Ensure extracted content is valid JSON
- Check submission has required metadata
- Verify admin permissions

### Debug Tools

1. Check `/app/test-groq` for isolated testing
2. View browser console for API errors
3. Check Supabase logs for database issues
4. Review Groq dashboard for API usage/errors

---

## Changelog

### Version 1.0 (Current)
- Initial transcript processing pipeline
- Groq Whisper integration
- LLaMA 3.3 content extraction
- Automatic website generation
- Admin review interface

---

## References

- [Groq API Documentation](https://console.groq.com/docs)
- [Whisper Model Details](https://platform.openai.com/docs/models/whisper)
- [LLaMA 3.3 Information](https://www.llama.com/)
- [Supabase Documentation](https://supabase.com/docs)
- [Database Schema](./DATABASE.sql)
