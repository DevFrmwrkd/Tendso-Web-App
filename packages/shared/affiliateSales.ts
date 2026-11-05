/** Shared workflow wording for creator sales; payment and commission remain separate facts. */
const SALE_STATUS_LABELS: Readonly<Record<string, string>> = {
    draft: 'Order received',
    pending: 'In review',
    approved: 'Approved',
    processing: 'Building website',
    website_generated: 'Website ready',
    deployed: 'Awaiting payment',
    pending_payment: 'Awaiting payment',
    deposit_paid: 'Down payment received',
    paid: 'Paid',
    completed: 'Completed',
    rejected: 'Not approved',
    failed: 'Needs attention',
    unpublished: 'Unpublished',
};

export function saleStatusLabel(status: string): string {
    return Object.prototype.hasOwnProperty.call(SALE_STATUS_LABELS, status)
        ? SALE_STATUS_LABELS[status] : status.replace(/_/g, ' ');
}
