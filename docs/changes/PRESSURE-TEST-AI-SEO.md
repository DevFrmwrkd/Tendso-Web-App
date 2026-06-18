[AI IDEA — Steven rethink it] Build GEO + SEO into every generated page (schema, sitemap, crawlable KB, backlink flywheel)

Your job:

Pressure-test every assumption — especially the big bet ("1000s of unique AI-generated local sites build authority"), the cost models, and the per-engine claims.
Correct what's wrong. The AI's own critics already caught fabricated codebase "facts" (there is no generatedWebsites.slug; the Cloudflare Worker serves one HTML string for all paths; KB queries are api.knowledge.* not api.knowledgeArticles.*; the Astro template has no shared <head> — 15 components each emit their own). Assume more errors are lurking — confirm every file path, table field, and API behavior against the real code before building.
Implement it the best possible way using your own judgment. Where the doc and reality disagree, reality wins. Where it's vague, your engineering judgment wins.
Do NOT implement blindly. Several tactics will backfire if shipped naively (scaled-content de-indexing, footer-link → PBN reclassification, fabricated review ratings, hallucinated business hours/NAP). The guardrails ARE the point.

📄 Full plan (read the whole thing)

ClickUp Doc: https://app.clickup.com/90151674303/docs/2kyqardz-3915 — "Tendso GEO + SEO Strategy & Implementation Plan (AI IDEA — UNVERIFIED)", in the Tendso folder. 4 pages: (1) Read First · Strategy & Flywheel, (2) Implementation · P0 Foundation, (3) Implementation · P1 Flywheel + P2 Advanced, (4) Measurement · Risks · Open Questions. All detail — full code skeletons, JSON-LD blocks, 13-row risk register, and 12 open questions — lives in those 4 pages.

🎯 The goal

Increase Tendso's SEO + GEO reach so that (A) people looking for Tendso find it and AI engines (ChatGPT, Perplexity, Gemini, Google AI Overviews) recommend it, and (B) every client site we generate ranks + gets cited locally — the product value the ₱999→₱4,999 fee buys.

💡 The core idea (the unfair advantage)

Tendso mass-generates local-business websites, so GEO/SEO can be baked into the generation template once and apply to every future site — and every generated site can feed a backlink + directory + entity flywheel back to the Tendso brand:

Generated client sites get LocalBusiness/FAQ/Breadcrumb JSON-LD schema, answer-first content, Bing indexing + IndexNow.
A public Tendso directory (/businesses/[city]/[category]) links out to client sites (the real dofollow authority flow); client sites carry only a nofollow sponsored attribution footer back (NOT an authority link — doing it dofollow at scale = penalty).
The Knowledge Base (today an invisible client-side SPA) becomes crawlable SSR → topical authority + AI citations for "how do I get my barbershop in Cebu online" type queries.

🔑 The 3 non-negotiable guardrails (per the AI's own risk analysis)

Content gate before publish — completeness + embedding-uniqueness + owner-verified facts + structural variation. 1000s of thin/near-dup AI pages is exactly the Google scaled-content enforcement pattern. Word count alone does NOT satisfy the policy.
Get off *.workers.dev (zero authority) onto *.tendso.ph before spending on indexing/authority — and set every schema @id to the permanent domain from day one. (This is an architecture rewrite of publish-website, not a DNS toggle.)
Named de-index kill-switch — auto-pause the generation pipeline if GSC "Crawled–not indexed" on client URLs crosses a threshold.

🧭 Suggested critical path (P0 first — see doc for full detail + code skeletons)

Decide OQ-1/OQ-2/OQ-4/OQ-5 (domain + client-site serving architecture + Cloudflare SSL cost + migration of existing sites) — blocks almost everything.
P0.1 domain/router-Worker + add slug to generatedWebsites.
P0.8 + P0.10 + P0.13 shared <SiteHead> across the 15 Astro components + content/uniqueness/owner-verify gate + schema validation (fixes all future sites safely).
P0.9 + P0.11 + P0.3 + P0.2 KB SSR routes + sitemap + robots (un-hides the platform; allow GPTBot/OAI-SearchBot/ClaudeBot/Google-Extended/PerplexityBot/Bingbot, block Bytespider/CCBot).
P0.12 + P1.5 GSC + Bing Webmaster + tendso.ph property + IndexNow (opens the Bing→ChatGPT gate).
P1.1–P1.4 business profiles + inventory-gated directory + safe attribution footer + internal-linking loop (closes the flywheel).
P2 data-study PR → Wikidata (only after independent coverage exists) → validated upsell dashboard.

📋 First deliverable from you

Before writing code: a short reality-check note on the doc (or as a task comment) — which assumptions hold, which are wrong, what you'd change, and your recommended OQ-1/OQ-2 decisions. Then we scope the P0 sprint from there.

(There are 12 Open Questions and a 13-row risk register in page 4 of the doc — please weigh in on those.)


