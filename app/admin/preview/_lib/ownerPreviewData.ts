import type { Id } from '@/convex/_generated/dataModel';
import type { OwnerSite } from '@/app/my-business/_components/ownerSite';

const createdAt = Date.UTC(2026, 9, 21, 8);

function site(id: string, businessName: string, businessType: string, phase: OwnerSite['phase'], overrides: Partial<OwnerSite> = {}): OwnerSite {
    return {
        submissionId: id as Id<'submissions'>,
        businessName, businessType, phase,
        contentSource: null, publishPolicy: 'publish_first',
        status: 'submitted', publishedUrl: null,
        total: 4999, amountPaid: 0, balanceDue: 4999, paidInFull: false,
        openChangeRequests: 0, createdAt,
        ...overrides,
    };
}

/** Fictional display data only; these ids are never sent to account or payment APIs. */
export const OWNER_PREVIEW_SITES: OwnerSite[] = [
    site('preview-owner-live', 'Santos Sari-Sari Store', 'store', 'live', {
        status: 'completed', publishedUrl: 'https://santos-store.example.com',
        amountPaid: 4999, balanceDue: 0, paidInFull: true,
    }),
    site('preview-owner-payment', 'Corner Coffee', 'cafe', 'awaiting_payment', {
        status: 'pending_payment', amountPaid: 2000, balanceDue: 2999,
    }),
    site('preview-owner-preview', 'Luna Hair Studio', 'salon', 'ready_to_check', { status: 'in_review' }),
    site('preview-owner-building', 'Reyes Auto Care', 'auto', 'building', { status: 'in_review' }),
    site('preview-owner-review', 'Maya’s Flower Shop', 'florist', 'in_review'),
    site('preview-owner-draft', 'Santos Bakery', 'bakery', 'draft', { status: 'draft' }),
];
