import { OwnerVisitRequestPage } from '../_components/OwnerVisitRequestForm';

export default async function NewVisitPage({ searchParams }: { searchParams: Promise<{ submissionId?: string | string[] }> }) {
    const { submissionId } = await searchParams;
    return <OwnerVisitRequestPage submissionId={typeof submissionId === 'string' ? submissionId : undefined} />;
}
