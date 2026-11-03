import { OwnerDashboardPreview } from '../_components/OwnerDashboardPreview';

export default async function OwnerPreviewPage({ searchParams }: { searchParams: Promise<{ business?: string | string[] }> }) {
    const { business } = await searchParams;
    return <OwnerDashboardPreview business={typeof business === 'string' ? business : undefined} />;
}
