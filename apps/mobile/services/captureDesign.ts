import { captureDesignByCode, validCaptureDesignCode } from '../../../lib/captureDesign';
import { sellKindFromServer, type Design, type SellKindId } from '../lib/v2/ownerContent';
import type { CaptureDesignDraft } from './captureSession';
import { CAPTURE_PREVIEW_CATALOG } from './generated/capturePreviewCatalog';

export function captureDesign(value: unknown): Design | null {
  const template = captureDesignByCode(value);
  if (!template) return null;
  const sample = CAPTURE_PREVIEW_CATALOG.find(design => design.code === template.code);
  return { code: template.code, name: sample?.name ?? template.label, preview: sample?.preview ?? template.preview };
}

type CaptureDesignKind = SellKindId | 'law';
const LAW_DESIGN_CODES = new Set(['generic:B', 'generic:D', 'generic:E']);

function suggestedCaptureDesigns(kind: CaptureDesignKind): readonly Design[] {
  return CAPTURE_PREVIEW_CATALOG.filter(design => design.category === kind)
    .map(design => ({ code: design.code, name: design.name, preview: design.preview }));
}

function captureDesignKinds(businessType?: string | null): readonly CaptureDesignKind[] {
  if (businessType === 'Law Office') return ['law'];
  if (businessType === 'Barber/Salon') return ['barber', 'salon'];
  if (businessType === 'Spa/Massage') return ['salon'];
  return [sellKindFromServer(businessType, undefined).id];
}

/** A business-type change must not keep a different trade's saved design selected. */
export function captureDesignMatchesBusinessType(businessType: string | null | undefined, value: unknown): boolean {
  const code = validCaptureDesignCode(value);
  if (!code) return false;
  const kinds = captureDesignKinds(businessType);
  if (LAW_DESIGN_CODES.has(code)) return kinds.includes('law');
  const sample = CAPTURE_PREVIEW_CATALOG.find(design => design.code === code);
  if (sample) return kinds.includes(sample.category);
  const family = code.split(':')[0];
  const familyKind: Record<string, SellKindId> = {
    barbershop: 'barber', salonspa: 'salon', autoshop: 'repair',
    woodworks: 'craft', florist: 'craft', shirtstore: 'craft',
    restaurant: 'food', foodcraft: 'food', generic: 'other', services: 'other', retail: 'other', layouts: 'other',
  };
  const kind = family === 'filipino' ? code === 'filipino:BG' ? 'repair'
    : code === 'filipino:BB' ? 'other' : 'food' : familyKind[family];
  return !!kind && kinds.includes(kind);
}

/** Keep same-category legacy choices, while requiring a new choice after a type change. */
export function captureDesignChoices(businessType?: string | null, selectedCode?: string | null): readonly Design[] {
  const suggested = captureDesignKinds(businessType).flatMap(suggestedCaptureDesigns);
  const saved = captureDesign(selectedCode);
  return saved && captureDesignMatchesBusinessType(businessType, saved.code)
    && !suggested.some(design => design.code === saved.code) ? [saved, ...suggested] : suggested;
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
