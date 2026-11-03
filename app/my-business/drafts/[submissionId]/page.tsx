import { OwnerDraftPage } from '../_components/OwnerDraft';

export default async function DraftPage({ params }: { params: Promise<{ submissionId: string }> }) {
    const { submissionId } = await params;
    return <OwnerDraftPage submissionId={submissionId} />;
}
