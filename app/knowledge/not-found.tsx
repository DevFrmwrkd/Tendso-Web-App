import { Button, Container } from "@/components/v2";
import { PbPage } from "@/components/v2/pages-b/shared";

// An article slug that does not exist (or is not published): a 404 inside the
// Help Center frame, with the two ways forward, instead of a bare error page.
export default function KnowledgeNotFound() {
    return (
        <PbPage><Container className="kh-page kh-state"><p className="pb-label">Help</p><h1>That answer isn’t here.</h1><p className="kh-lead">It may have moved, or the link has a typo. Search the help center, or ask our team.</p><div className="kh-actions"><Button href="/help">Find an answer</Button><Button href="/help#contact" variant="ghost">Ask a person</Button></div></Container></PbPage>
    );
}
