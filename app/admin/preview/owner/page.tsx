import { OwnerDashboardPreview } from '../_components/OwnerDashboardPreview';

type PreviewQuery = { business?: string | string[]; visit?: string | string[]; section?: string | string[]; eventKey?: string | string[] };

export default async function OwnerPreviewPage({ searchParams }: { searchParams: Promise<PreviewQuery> }) {
    const query = await searchParams;
    const value = (key: keyof PreviewQuery) => typeof query[key] === 'string' ? query[key] : undefined;
    return <OwnerDashboardPreview business={value('business')} visit={value('visit')} section={value('section')} eventKey={value('eventKey')} />;
}
