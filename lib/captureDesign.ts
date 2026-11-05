import { templateByCode, type TemplateDef } from '../components/editor/templateCatalog';
import { BUSINESS_TYPES, mapCategoryToBusinessType } from './prospectPrefill';

/** Existing captures may store a scraped category rather than the current select value. */
export function normalizeCaptureBusinessType(value: unknown): string {
    if (typeof value !== 'string') return 'Other';
    const businessType = value.trim();
    const canonical = BUSINESS_TYPES.find(type => type === businessType);
    return canonical ?? (mapCategoryToBusinessType(businessType) || 'Other');
}

/** Resolve every canonical design, including saved choices outside mobile's curated list. */
export function captureDesignByCode(value: unknown): TemplateDef | undefined {
    return typeof value === 'string' ? templateByCode(value.trim()) : undefined;
}

/** Do not upgrade bare letters or guess a design at the capture API boundary. */
export function validCaptureDesignCode(value: unknown): string | null {
    return captureDesignByCode(value)?.code ?? null;
}

/** Canonical category of an approved business design; legacy designs are kept. */
export function captureDesignBusinessType(value: unknown): string | null {
    const code = validCaptureDesignCode(value);
    const match = code && /^business:C([A-X])$/.exec(code);
    if (!match) return null;
    return ['Barber/Salon', 'Auto Shop', 'Spa/Massage', 'Restaurant', 'Clinic', 'Law Office', 'Craft/Producer', 'Other']
        [Math.floor((match[1].charCodeAt(0) - 65) / 3)] ?? null;
}
