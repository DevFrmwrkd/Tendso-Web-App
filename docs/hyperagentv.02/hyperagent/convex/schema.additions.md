# Additive schema fields for `generatedWebsites` (SEO layer)

The SEO content needs a few new fields. They're all **optional**, so adding them is
backward-compatible (existing rows stay valid). Add these to the `generatedWebsites` table
definition in `convex/schema.ts`:

```ts
// --- SEO layer (added for Tendso Studio) ---
seoTitle: v.optional(v.string()),          // title tag, <=60 chars: "[service] in [city] | [name]"
metaDescription: v.optional(v.string()),   // meta description, <=155 chars
seoKeywords: v.optional(v.any()),          // string[]
structuredData: v.optional(v.any()),       // LocalBusiness JSON-LD object
gbpDescription: v.optional(v.string()),    // Google Business Profile description (250-750 chars)
imageAlt: v.optional(v.any()),             // { [enhancedImageKey]: altText }
```

No index changes are needed. After editing the schema, `npx convex deploy` (or `dev`) picks it
up. `saveStudioContent` in `convex/hyperagent.ts` already whitelists these keys, so they flow
through automatically.

These feed the page `<head>` (title, meta description, canonical, OG, and the LocalBusiness
JSON-LD script) - see `astro/SeoHead.astro` for the ready-to-paste partial - and `imageAlt`
supplies the `alt` attribute on each gallery/hero image.
