import { ALL_TEMPLATES, type TemplateDef } from '../components/editor/templateCatalog';
import { EXTRA_QUESTION_INDEX, GUIDED_SHOT_COUNT, MAX_EXTRA_SHOTS, MIN_REAL_PHOTOS } from '../convex/lib/ownerApp';
import { captureDesignBusinessType, captureDesignByCode } from './captureDesign';
import { BUSINESS_TYPES } from './prospectPrefill';

export const OWNER_DRAFT_STEPS = ['details', 'interview', 'photos', 'design', 'review'] as const;
export type DraftStep = typeof OWNER_DRAFT_STEPS[number];
export type OwnerDraftProgress = {
    step: DraftStep | 'setup'; questionIndex?: number; photoIndex?: number;
    how?: 'self' | 'friend'; audioOnly?: boolean; lang?: 'en' | 'tl';
};
export type OwnerDraftAnswer = {
    index: number; lang?: 'en' | 'tl'; answerText?: string; mediaUrl?: string;
    mediaType?: 'video' | 'audio'; durationSec?: number; updatedAt?: number;
};
export type OwnerDraftPhoto = { index: number; extra: boolean; url: string; label?: string; updatedAt?: number };
/** Structural subset of ownerApp.getSubmission; no anonymous-intake cache is used. */
export type SharedOwnerDraft = {
    businessName?: string | null; businessType?: string | null; address?: string | null;
    coordinates?: { lat: number; lng: number } | null; contentSource?: string | null;
    status?: string | null; phase?: string | null; interview?: readonly OwnerDraftAnswer[] | null;
    shots?: readonly OwnerDraftPhoto[] | null; templateId?: string | null; templateIds?: readonly string[];
    draftProgress?: OwnerDraftProgress | null;
};

export function ownerDraftEditable(draft: Pick<SharedOwnerDraft, 'contentSource' | 'status' | 'phase'>): boolean {
    return draft.contentSource === 'owner_app' && draft.status === 'draft' && draft.phase === 'draft';
}

/** Question 10 is optional; recorded answers count without a text transcript. */
export function firstMissingOwnerAnswer(interview: readonly OwnerDraftAnswer[] | null | undefined): number {
    for (let index = 0; index < EXTRA_QUESTION_INDEX; index++) {
        if (!interview?.some(answer => answer.index === index && (!!answer.answerText?.trim() || !!answer.mediaUrl?.trim()))) return index;
    }
    return EXTRA_QUESTION_INDEX;
}

export const ownerPhotoKey = (photo: Pick<OwnerDraftPhoto, 'index' | 'extra'>): string => `${photo.extra ? 'extra' : 'shot'}:${photo.index}`;

/** Slot identity is (extra,index), never the photo's position in a filtered list. */
export function normalizedOwnerPhotos<T extends OwnerDraftPhoto>(photos: readonly T[] | null | undefined): T[] {
    const slots = new Map<string, T>();
    for (const photo of photos ?? []) {
        const max = photo.extra ? MAX_EXTRA_SHOTS : GUIDED_SHOT_COUNT;
        if (!Number.isInteger(photo.index) || photo.index < 0 || photo.index >= max || !photo.url?.trim()) continue;
        const key = ownerPhotoKey(photo), previous = slots.get(key);
        if (!previous || (photo.updatedAt ?? 0) >= (previous.updatedAt ?? 0)) slots.set(key, photo);
    }
    return [...slots.values()].sort((a, b) => Number(a.extra) - Number(b.extra) || a.index - b.index);
}

/** Editing a transcript must not remove the saved recording from that answer. */
export function ownerAnswerWithText(answer: OwnerDraftAnswer, text: string) {
    return {
        index: answer.index, lang: answer.lang ?? 'en', answerText: text.trim() || undefined,
        mediaUrl: answer.mediaUrl || undefined,
        mediaType: answer.mediaUrl ? answer.mediaType : undefined,
        durationSec: answer.mediaUrl ? answer.durationSec : undefined,
    };
}

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const PHOTO_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
export function validateOwnerPhotoUpload(file: { type: string; size: number }): string | null {
    if (!PHOTO_TYPES.has(file.type.toLowerCase().trim())) return 'Choose a JPG, PNG or WebP photo.';
    if (!Number.isFinite(file.size) || file.size <= 0) return 'This photo is empty. Choose another photo.';
    return file.size > MAX_PHOTO_BYTES ? 'This photo is over 10 MB. Choose a smaller photo.' : null;
}

function canonicalBusinessType(value: string | null | undefined): typeof BUSINESS_TYPES[number] | null {
    return BUSINESS_TYPES.find(type => type === value) ?? null;
}

/** New recommendations are the approved three for this exact business type. */
export function ownerDraftDesignOptions(businessType: string | null | undefined): readonly TemplateDef[] {
    const type = canonicalBusinessType(businessType);
    return type ? ALL_TEMPLATES.filter(template => captureDesignBusinessType(template.code) === type) : [];
}

/** Keep a compatible legacy choice, but never reinterpret it as another business's design. */
export function ownerDraftDesignMatchesBusinessType(businessType: string | null | undefined, code: string | null | undefined): boolean {
    const type = canonicalBusinessType(businessType), saved = captureDesignByCode(code);
    if (!type || !saved) return false;
    const approvedType = captureDesignBusinessType(saved.code);
    if (approvedType) return approvedType === type;
    const family = saved.code.split(':')[0];
    switch (type) {
        case 'Barber/Salon': return family === 'barbershop' || family === 'salonspa';
        case 'Spa/Massage': return family === 'salonspa';
        case 'Auto Shop': return family === 'autoshop' || saved.code === 'filipino:BG';
        case 'Restaurant': return family === 'restaurant' || family === 'foodcraft' || family === 'filipino' && !['filipino:BB', 'filipino:BG'].includes(saved.code);
        case 'Clinic': return family === 'medical';
        case 'Law Office': return ['generic:B', 'generic:D', 'generic:E'].includes(saved.code);
        case 'Craft/Producer': return ['woodworks', 'florist', 'shirtstore'].includes(family);
        case 'Other': return ['generic', 'services', 'retail', 'layouts'].includes(family) || saved.code === 'filipino:BB';
    }
}

/** Native's setup step has no separate web screen; its progress resumes at details. */
export function ownerDraftProgressStep(step: unknown): DraftStep | null {
    if (step === 'setup') return 'details';
    return OWNER_DRAFT_STEPS.includes(step as DraftStep) ? step as DraftStep : null;
}

function firstIncompleteStep(draft: SharedOwnerDraft): DraftStep {
    const point = draft.coordinates;
    const hasPin = !!point && Number.isFinite(point.lat) && Math.abs(point.lat) <= 90 && Number.isFinite(point.lng) && Math.abs(point.lng) <= 180;
    if (!draft.businessName?.trim() || !canonicalBusinessType(draft.businessType) || !draft.address?.trim() && !hasPin) return 'details';
    if (firstMissingOwnerAnswer(draft.interview) < EXTRA_QUESTION_INDEX) return 'interview';
    if (normalizedOwnerPhotos(draft.shots).length < MIN_REAL_PHOTOS) return 'photos';
    if (!ownerDraftDesignMatchesBusinessType(draft.businessType, draft.templateId)) return 'design';
    return 'review';
}

export function ownerDraftResumePosition(draft: SharedOwnerDraft): { step: DraftStep; questionIndex?: number; photoIndex?: number } {
    const missing = firstIncompleteStep(draft), progress = draft.draftProgress;
    const saved = ownerDraftProgressStep(progress?.step);
    const step = saved && OWNER_DRAFT_STEPS.indexOf(saved) < OWNER_DRAFT_STEPS.indexOf(missing) ? saved : missing;
    if (step === 'interview') {
        const first = firstMissingOwnerAnswer(draft.interview);
        const index = progress?.questionIndex;
        return { step, questionIndex: typeof index === 'number' && Number.isInteger(index) && index >= 0 && index <= EXTRA_QUESTION_INDEX ? Math.min(index, first) : first };
    }
    if (step === 'photos') {
        const photos = normalizedOwnerPhotos(draft.shots), index = progress?.photoIndex;
        let first = 0;
        while (first < GUIDED_SHOT_COUNT - 1 && photos.some(photo => !photo.extra && photo.index === first)) first++;
        return { step, photoIndex: typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < GUIDED_SHOT_COUNT ? Math.min(index, first) : first };
    }
    return { step };
}

/** Saved progress may return to an earlier screen, never skip missing required content. */
export const ownerDraftResumeStep = (draft: SharedOwnerDraft): DraftStep => ownerDraftResumePosition(draft).step;
