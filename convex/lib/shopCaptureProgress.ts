import type { Doc } from '../_generated/dataModel';
import { normalizePhone } from './phone';

/** Server provenance distinguishes shared shop captures from customer inquiries. */
export function isCaptureShopLead(lead: Doc<'leads'>, submission: Doc<'submissions'> | null) {
    if (lead.source === 'community' || lead.source === 'outscraper' || lead.isCaptureShop === true) return true;
    // Older submit() leads have no explicit stamp. Match the exact owner-derived
    // shape and retain the stamp before a later contact correction changes it.
    return lead.source === 'direct' && !!submission && lead.creatorId === submission.creatorId
        && !lead.message?.trim() && !!lead.name?.trim() && !!normalizePhone(lead.phone)
        && lead.name.trim() === submission.ownerName.trim()
        && normalizePhone(lead.phone) === normalizePhone(submission.ownerPhone);
}
