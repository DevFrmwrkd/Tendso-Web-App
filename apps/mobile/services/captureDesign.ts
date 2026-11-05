import { captureDesignByCode, normalizeCaptureBusinessType, validCaptureDesignCode } from '../../../lib/captureDesign';
import type { Design } from '../lib/v2/ownerContent';
import type { CaptureDesignDraft } from './captureSession';
import { CAPTURE_PREVIEW_CATALOG, LEGACY_CAPTURE_PREVIEW_CATALOG } from './generated/capturePreviewCatalog';

type CaptureDesignKind = 'barber' | 'repair' | 'spa' | 'food' | 'clinic' | 'law' | 'craft' | 'other';
const kindByBusinessType: Readonly<Record<string, CaptureDesignKind>> = {
  'Barber/Salon': 'barber', 'Auto Shop': 'repair', 'Spa/Massage': 'spa', Restaurant: 'food',
  Clinic: 'clinic', 'Law Office': 'law', 'Craft/Producer': 'craft', Other: 'other',
};
const kindForBusinessType = (value?: string | null): CaptureDesignKind =>
  kindByBusinessType[normalizeCaptureBusinessType(value)] ?? 'other';

// Retain the exact sample labels/URLs previously saved on this account, while
// keeping only the approved designs in the recommendations for new captures.
const allPreviewDesigns = [...CAPTURE_PREVIEW_CATALOG, ...LEGACY_CAPTURE_PREVIEW_CATALOG];

export function captureDesign(value: unknown): Design | null {
  const template = captureDesignByCode(value);
  if (!template) return null;
  const sample = allPreviewDesigns.find(design => design.code === template.code);
  return { code: template.code, name: sample?.name ?? template.label, preview: sample?.preview ?? template.preview };
}

function suggestedCaptureDesigns(kind: CaptureDesignKind): readonly Design[] {
  return CAPTURE_PREVIEW_CATALOG.filter(design => design.category === kind)
    .map(design => ({ code: design.code, name: design.name, preview: design.preview }));
}

/** A business-type change must not keep a different trade's saved design selected. */
export function captureDesignMatchesBusinessType(businessType: string | null | undefined, value: unknown): boolean {
  const code = validCaptureDesignCode(value);
  if (!code) return false;
  const kind = kindForBusinessType(businessType);
  const sample = CAPTURE_PREVIEW_CATALOG.find(design => design.code === code);
  if (sample) return sample.category === kind;
  const legacy = LEGACY_CAPTURE_PREVIEW_CATALOG.find(design => design.code === code);
  if (legacy) return legacy.category === kind
    || (legacy.category === 'salon' && (kind === 'barber' || kind === 'spa'))
    || (legacy.category === 'other' && kind === 'clinic');
  const family = code.split(':')[0];
  if (family === 'salonspa') return kind === 'barber' || kind === 'spa';
  const familyKind: Readonly<Record<string, CaptureDesignKind>> = {
    barbershop: 'barber', autoshop: 'repair', medical: 'clinic',
    woodworks: 'craft', florist: 'craft', shirtstore: 'craft',
    restaurant: 'food', foodcraft: 'food', generic: 'other', services: 'other', retail: 'other', layouts: 'other',
  };
  const savedKind = family === 'filipino' ? code === 'filipino:BG' ? 'repair'
    : code === 'filipino:BB' ? 'other' : 'food' : familyKind[family];
  return savedKind === kind;
}

/** Keep same-category legacy choices, while requiring a new choice after a type change. */
export function captureDesignChoices(businessType?: string | null, selectedCode?: string | null): readonly Design[] {
  const suggested = suggestedCaptureDesigns(kindForBusinessType(businessType));
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
