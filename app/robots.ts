import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/**
 * robots.txt for the Tendso platform (tendso.com).
 *
 * 2025/2026 AI-crawler policy:
 *  - ALLOW the AI search/retrieval crawlers that CITE sources — being absent
 *    from these = invisible to ChatGPT/Perplexity/Gemini answers:
 *      • GPTBot          (OpenAI training)
 *      • OAI-SearchBot   (ChatGPT search retrieval — a DIFFERENT bot than GPTBot;
 *                         ChatGPT search also relies on the Bing index → allow Bingbot)
 *      • ClaudeBot / anthropic-ai / claude-web (Anthropic)
 *      • Google-Extended (Gemini / AI Overviews opt-in)
 *      • PerplexityBot   (Perplexity)
 *      • Bingbot         (Bing index = the ChatGPT-search gate)
 *  - BLOCK scrapers with no citation/referral value:
 *      • Bytespider (ByteDance/TikTok), CCBot (Common Crawl)
 *  - Keep private/app surfaces out of every crawler.
 */

const PRIVATE_PATHS = ['/api/', '/admin/', '/connect-ai', '/dashboard/', '/wallet', '/submit/'];

const AI_BOTS = [
    'GPTBot',
    'OAI-SearchBot',
    'ClaudeBot',
    'anthropic-ai',
    'claude-web',
    'Google-Extended',
    'PerplexityBot',
    'Bingbot',
];

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            { userAgent: '*', allow: '/', disallow: [...PRIVATE_PATHS, '/_next/'] },
            // Explicitly welcome the AI crawlers (same private exclusions).
            { userAgent: AI_BOTS, allow: '/', disallow: PRIVATE_PATHS },
            // Block the no-value scrapers entirely.
            { userAgent: ['Bytespider', 'CCBot'], disallow: '/' },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    };
}
