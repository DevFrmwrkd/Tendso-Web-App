type AttributionCreator = {
    role?: string;
    firstName?: string;
    lastName?: string;
    affiliateHandle?: string;
    affiliateDisplayName?: string;
};

type AttributedSubmission = {
    affiliateHandle?: string;
    creator?: AttributionCreator | null;
};

/** Order attribution survives suspension and price changes after the sale. */
export function affiliateAttribution(submission: AttributedSubmission): { name: string; handle: string | null; label: string } | null {
    const creator = submission.creator;
    if (!submission.affiliateHandle && creator?.role !== 'affiliate') return null;
    const handle = submission.affiliateHandle || creator?.affiliateHandle || null;
    const name = creator?.affiliateDisplayName?.trim()
        || [creator?.firstName, creator?.lastName].filter(Boolean).join(' ').trim()
        || (handle ? `@${handle}` : 'Unknown affiliate');
    return { name, handle, label: handle ? `Affiliate · @${handle}` : 'Affiliate' };
}
