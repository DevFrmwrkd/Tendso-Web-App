import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EmailProposalBoard } from './EmailProposalBoard';

export const metadata: Metadata = { title: 'Email concepts — Tendso', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function EmailProposalsPage() {
    if (process.env.NODE_ENV !== 'development') notFound();
    const { getProposalBrandAssets } = await import('./brandAssets');
    const { directions, messages, renderEmailProposal } = await import('@/lib/email/proposals');
    const previews = directions.map(direction => ({
        ...direction,
        examples: messages.map(message => ({ messageId: message.id, html: renderEmailProposal(direction.id, message.id) })),
    }));
    return <EmailProposalBoard directions={previews} messages={messages} brandAssets={await getProposalBrandAssets()} />;
}
