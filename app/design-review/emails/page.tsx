import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EmailDesignGallery } from './EmailDesignGallery';

export const metadata: Metadata = { title: 'Tendso email designs', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function EmailDesignReviewPage() {
    if (process.env.NODE_ENV !== 'development') notFound();
    // Production never loads or renders sample messages. No account or mail transport is called.
    const [{ getEmailPreviewSamples }, { getProposalBrandAssets }] = await Promise.all([
        import('@/lib/email/previewSamples'),
        import('./proposals/brandAssets'),
    ]);
    return <EmailDesignGallery samples={getEmailPreviewSamples()} brandAssets={await getProposalBrandAssets()} />;
}
