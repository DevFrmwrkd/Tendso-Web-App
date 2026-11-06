import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Tendso booking design preview', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function BookingDesignPreviewPage() {
    if (process.env.NODE_ENV !== 'development') notFound();
    const { BookingDesignPreview } = await import('./BookingDesignPreview');
    return <BookingDesignPreview />;
}
