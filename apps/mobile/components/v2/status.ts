import type { ChipTone } from './Chip';

export interface StatusLabel {
  label: string;
  tone: ChipTone;
}

/**
 * Submission status -> the chip the field agent sees. Words follow the creator board
 * (Live, Paid, Website ready, In review, Draft, Rejected). `isDraft` is true when the
 * submission is still missing photos or the interview even if the backend says otherwise.
 */
export function submissionStatus(status: string | undefined, isDraft = false): StatusLabel {
  if (isDraft || status === 'draft') return { label: 'Draft', tone: 'muted' };
  switch (status) {
    case 'rejected':
      return { label: 'Rejected', tone: 'danger' };
    case 'paid':
    case 'completed':
      return { label: 'Paid', tone: 'ok' };
    case 'deployed':
      return { label: 'Live', tone: 'ok' };
    case 'website_generated':
    case 'pending_payment':
      return { label: 'Website ready', tone: 'info' };
    case 'approved':
      return { label: 'Approved', tone: 'info' };
    case 'submitted':
    case 'in_review':
      return { label: 'In review', tone: 'warn' };
    default:
      return { label: 'Pending', tone: 'warn' };
  }
}

/** Lead (CRM) status -> chip. The backend keeps its own words; the labels are the simple ones. */
export function leadStatus(status: string | undefined): StatusLabel {
  switch (status) {
    case 'new':
      return { label: 'New', tone: 'info' };
    case 'reserved':
      return { label: 'Yours', tone: 'ok' };
    case 'contacted':
      return { label: 'Contacted', tone: 'warn' };
    case 'qualified':
      return { label: 'Visiting', tone: 'warn' };
    case 'converted':
      return { label: 'Live', tone: 'ok' };
    case 'lost':
      return { label: 'Lost', tone: 'muted' };
    default:
      return { label: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'New', tone: 'muted' };
  }
}
