import { captureDesignByCode, validCaptureDesignCode } from '../../../lib/captureDesign';
import { designsFor, sellKindFromServer, type Design } from '../lib/v2/ownerContent';
import type { CaptureDesignDraft } from './captureSession';

export function captureDesign(value: unknown): Design | null {
  const template = captureDesignByCode(value);
  return template ? { code: template.code, name: template.label, preview: template.preview } : null;
}

/** Saved canonical designs stay available even outside the suggested shortlist. */
export function captureDesignChoices(businessType?: string | null, selectedCode?: string | null): readonly Design[] {
  const suggested = businessType === 'Barber/Salon'
    ? [...designsFor('barber'), ...designsFor('salon')]
    : businessType === 'Spa/Massage' ? designsFor('salon')
      : designsFor(sellKindFromServer(businessType, undefined).id);
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
