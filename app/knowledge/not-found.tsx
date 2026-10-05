import { Search } from "lucide-react";

import { ButtonLink, EmptyState, Icon } from "@/components/r1";

import { OpenSearchButton } from "./_components/OpenSearchButton";

// An article slug that does not exist (or is not published): a 404 inside the
// Help Center frame, with the two ways forward, instead of a bare error page.
export default function KnowledgeNotFound() {
    return (
        <EmptyState
            className="py-16"
            icon={<Icon icon={Search} size={18} />}
            title="That page is not in the Help Center"
            body="It may have moved, or the link has a typo. Search for it, or start from the Help Center."
            action={
                <div className="flex flex-wrap justify-center gap-2">
                    <OpenSearchButton />
                    <ButtonLink href="/knowledge">Back to Help Center</ButtonLink>
                </div>
            }
        />
    );
}
