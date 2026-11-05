import { LegalDoc, type DocKey, type LegalDocData } from "./LegalDoc";
import { PageShell } from "./PageShell";
import { PRIVACY, TERMS, policySections, termsDocSections } from "./legal-content";

const DOCS: Record<DocKey, LegalDocData> = {
    privacy: { ...PRIVACY, sections: policySections },
    terms: { ...TERMS, sections: termsDocSections },
};

/** The legal layout. `/v2/legal` switches in place; `/v2/privacy` and `/v2/terms` open on their own document. */
export function LegalPage({ initial, mode }: { initial: DocKey; mode: "path" | "hash" }) {
    return (
        <PageShell page="legal">
            <LegalDoc docs={DOCS} initial={initial} mode={mode} />
        </PageShell>
    );
}
