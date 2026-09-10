/**
 * Which Groq models this app asks for — in one place, on purpose.
 *
 * WHY THIS FILE EXISTS. Groq retires models, and when it does every call that
 * names the old one starts failing at once. `llama-3.3-70b-versatile` was
 * decommissioned and it was hardcoded in five call sites, so website generation
 * broke with "Failed to extract website content" and the model name had to be
 * hunted through the codebase. One constant, five call sites, next time.
 *
 * OVERRIDABLE WITHOUT A DEPLOY. Set GROQ_TEXT_MODEL and the next request uses
 * it. That matters because a retirement is an outage on someone else's
 * schedule: an env var change is minutes, a deploy is not.
 *
 * Check what a key can actually reach:
 *   curl -H "Authorization: Bearer $GROQ_API_KEY" https://api.groq.com/openai/v1/models
 */

/** Everything that reasons over text: extraction, copywriting, summaries. */
export const GROQ_TEXT_MODEL = process.env.GROQ_TEXT_MODEL || 'openai/gpt-oss-120b'

/** Transcription. Untouched by the retirement above — it is still current. */
export const GROQ_TRANSCRIBE_MODEL = process.env.GROQ_TRANSCRIBE_MODEL || 'whisper-large-v3'
