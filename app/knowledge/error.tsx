"use client";

import { Button, Container } from "@/components/v2";
import { PbPage } from "@/components/v2/pages-b/shared";

/**
 * Failed article reads use the same redesigned frame as the help front.
 */
export default function KnowledgeError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
    return <PbPage><Container className="kh-page kh-state"><p className="pb-label">Help</p><h1>We couldn’t open that answer.</h1><p className="kh-lead">Please refresh the page, or ask our team for help.</p>{error.digest && <p className="kh-meta">Reference: {error.digest}</p>}<div className="kh-actions"><Button onClick={() => window.location.reload()}>Try again</Button><Button href="/help#contact" variant="ghost">Ask a person</Button></div></Container></PbPage>;
}
