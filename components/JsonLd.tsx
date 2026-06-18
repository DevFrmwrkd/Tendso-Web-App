/**
 * Renders a Schema.org JSON-LD object as a <script type="application/ld+json">.
 *
 * Uses a native <script> (NOT next/script) so the markup is in the initial
 * server-rendered HTML where AI crawlers — which do NOT execute JavaScript —
 * can read it. The `<` escape prevents the JSON from breaking out of the tag.
 */
export function JsonLd({ data }: { data: unknown }) {
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
        />
    );
}
