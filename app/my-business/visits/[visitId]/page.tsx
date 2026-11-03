import { OwnerVisitDetailsPage } from '../_components/OwnerVisitPages';

export default async function VisitPage({ params }: { params: Promise<{ visitId: string }> }) {
    const { visitId } = await params;
    return <OwnerVisitDetailsPage visitId={visitId} />;
}
