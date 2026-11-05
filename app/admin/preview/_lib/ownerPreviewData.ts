import type { Id } from '@/convex/_generated/dataModel';
import type { OwnerSite } from '@/app/my-business/_components/ownerSite';
import type { OwnerVisit } from '@/app/my-business/visits/_components/visitPresentation';
import type { OwnerWebInbox } from '@/app/my-business/notifications/_components/OwnerNotifications';

const createdAt = Date.UTC(2026, 9, 21, 8);
export const OWNER_PREVIEW_NOW = Date.UTC(2026, 10, 3, 2);
const ownerId = 'preview-business-owner' as Id<'businessOwners'>;
const actorClerkId = 'preview-owner-clerk';

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

function visit(id: string, shopName: string, status: OwnerVisit['status'], overrides: Partial<OwnerVisit> = {}): OwnerVisit {
    return {
        _id: id as Id<'ownerVisitRequests'>, _creationTime: createdAt,
        ownerId, actorClerkId, requestKey: `sample-${id}`, shopName, ownerName: 'Alex Santos',
        phone: '09000000000', email: 'alex.preview@example.com',
        address: '12 Sample Street', city: 'Marikina', coordinates: { lat: 14.634, lng: 121.1 },
        preferredWhen: 'This week', status, revision: 1, createdAt, updatedAt: OWNER_PREVIEW_NOW - 60 * 60_000,
        assignedAgent: null, ...overrides,
    };
}
const sampleAgent = {
    id: 'preview-visit-agent' as Id<'creators'>, name: 'Jamie Reyes', phone: '09000000001', profileImage: null,
};

/** Fictional scheduling examples. No request, contact or dispatch API receives these ids. */
export const OWNER_PREVIEW_VISITS: OwnerVisit[] = [
    visit('preview-visit-confirmed', 'Luna Hair Studio', 'confirmed', {
        submissionId: 'preview-owner-preview' as Id<'submissions'>,
        assignedAgent: sampleAgent, assignedAgentId: sampleAgent.id,
        scheduledAt: OWNER_PREVIEW_NOW + 3 * 60 * 60_000, acceptedAt: OWNER_PREVIEW_NOW - 60 * 60_000,
    }),
    visit('preview-visit-assigned', 'Santos Bakery', 'assigned', {
        submissionId: 'preview-owner-draft' as Id<'submissions'>,
        assignedAgent: sampleAgent, assignedAgentId: sampleAgent.id, scheduledAt: OWNER_PREVIEW_NOW + 86400_000,
    }),
    visit('preview-visit-requested', 'Santos Sari-Sari Store', 'requested', {
        submissionId: 'preview-owner-live' as Id<'submissions'>,
    }),
    visit('preview-visit-completed', 'Reyes Auto Care', 'completed', {
        submissionId: 'preview-owner-building' as Id<'submissions'>,
        assignedAgent: sampleAgent, assignedAgentId: sampleAgent.id,
        scheduledAt: OWNER_PREVIEW_NOW - 3 * 86400_000, completedAt: OWNER_PREVIEW_NOW - 3 * 86400_000 + 3600_000,
    }),
    visit('preview-visit-cancelled', 'Maya’s Flower Shop', 'cancelled', {
        submissionId: 'preview-owner-review' as Id<'submissions'>,
        cancellationReason: 'The shop owner asked to arrange a different day.', cancelledAt: OWNER_PREVIEW_NOW - 2 * 86400_000,
    }),
];

/** Read and unread samples are local display data; opening them never marks a real event read. */
export const OWNER_PREVIEW_INBOX: OwnerWebInbox = {
    ownerId, actorClerkId, unreadCount: 3,
    items: [
        { key: 'preview-visit-accepted', type: 'visit_confirmed', title: 'Your shop visit is confirmed',
            body: 'Jamie Reyes accepted the visit for Luna Hair Studio.\nCheck the confirmed time and location before the visit. Your agent will take photos and record your story with you.',
            createdAt: OWNER_PREVIEW_NOW - 30 * 60_000, read: false, submissionId: null, visitRequestId: OWNER_PREVIEW_VISITS[0]!._id },
        { key: 'preview-website-ready', type: 'preview_ready', title: 'Your website preview is ready',
            body: 'The preview for Luna Hair Studio is ready. Check your photos, business details and wording before sending your feedback.',
            createdAt: OWNER_PREVIEW_NOW - 2 * 3600_000, read: false, submissionId: OWNER_PREVIEW_SITES[2]!.submissionId, visitRequestId: null },
        { key: 'preview-down-payment', type: 'deposit_received', title: 'Down payment recorded',
            body: 'Your ₱2,000 down payment for Corner Coffee is recorded. There is ₱2,999 remaining. Open the business workspace to review payment details.',
            createdAt: OWNER_PREVIEW_NOW - 86400_000, read: false, submissionId: OWNER_PREVIEW_SITES[1]!.submissionId, visitRequestId: null },
        { key: 'preview-website-published', type: 'website_live', title: 'Your website is published',
            body: 'Santos Sari-Sari Store was published. Open the business workspace to check its public address and latest status.',
            createdAt: OWNER_PREVIEW_NOW - 3 * 86400_000, read: true, submissionId: OWNER_PREVIEW_SITES[0]!.submissionId, visitRequestId: null },
    ],
};
