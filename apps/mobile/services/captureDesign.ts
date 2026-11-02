import { captureDesignByCode, validCaptureDesignCode } from '../../../lib/captureDesign';
import { sellKindFromServer, type Design, type SellKindId } from '../lib/v2/ownerContent';
import type { CaptureDesignDraft } from './captureSession';

/** Field-agent suggestions only; the owner catalog and saved canonical choices stay available. */
const FIELD_AGENT_DESIGN_CODES: Record<SellKindId, readonly string[]> = {
  barber: ['barbershop:F', 'barbershop:I'],
  salon: ['salonspa:L', 'salonspa:N'],
  repair: ['autoshop:AF'],
  craft: ['woodworks:BV', 'florist:BS'],
  food: ['foodcraft:AL'],
  other: ['generic:C'],
};

export function captureDesign(value: unknown): Design | null {
  const template = captureDesignByCode(value);
  return template ? { code: template.code, name: template.label, preview: template.preview } : null;
}

function suggestedCaptureDesigns(kind: SellKindId): readonly Design[] {
  return FIELD_AGENT_DESIGN_CODES[kind].map(captureDesign).filter((design): design is Design => design !== null);
}

/** Saved canonical designs stay available even outside the suggested shortlist. */
export function captureDesignChoices(businessType?: string | null, selectedCode?: string | null): readonly Design[] {
  const suggested = businessType === 'Barber/Salon'
    ? [...suggestedCaptureDesigns('barber'), ...suggestedCaptureDesigns('salon')]
    : businessType === 'Spa/Massage' ? suggestedCaptureDesigns('salon')
      : suggestedCaptureDesigns(sellKindFromServer(businessType, undefined).id);
  const saved = captureDesign(selectedCode);
  return saved && !suggested.some(design => design.code === saved.code) ? [saved, ...suggested] : suggested;
}

type FinalDesignChoice = { submissionId: string; templateId?: unknown; savedAt?: number };

/** A confirmed choice outranks an older cache; a later explicit edit stays visible until Send. */
export function selectedCaptureDesignCode(id: string | null, local: CaptureDesignDraft | null,
  queued: FinalDesignChoice | null, serverCode?: unknown): string | null {
  const localCode = id && local?.submissionId === id ? validCaptureDesignCode(local.templateId) : null;
  const queuedCode = id && queued?.submissionId === id ? validCaptureDesignCode(queued.templateId) : null;
  if (queuedCode && (!localCode || (queued?.savedAt ?? 0) >= (local?.savedAt ?? 0))) return queuedCode;
  return localCode ?? queuedCode ?? validCaptureDesignCode(serverCode);
}
