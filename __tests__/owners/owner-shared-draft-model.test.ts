import { describe, expect, it } from 'vitest';
import { OWNER_APP_QUESTIONS } from '../../convex/lib/ownerApp';
import { BUSINESS_TYPES } from '../../lib/prospectPrefill';
import { firstMissingOwnerAnswer, normalizedOwnerPhotos, ownerAnswerWithText, ownerDraftDesignMatchesBusinessType, ownerDraftDesignOptions,
    ownerDraftEditable, ownerDraftProgressStep, ownerDraftResumePosition, ownerDraftResumeStep, ownerPhotoKey, validateOwnerPhotoUpload,
    type OwnerDraftAnswer, type OwnerDraftPhoto, type SharedOwnerDraft } from '../../lib/ownerSharedDraft';

const answers = (): OwnerDraftAnswer[] => OWNER_APP_QUESTIONS.slice(0, 10).map((_, index) => ({ index, lang: 'en', answerText: `Saved answer ${index}` }));
const photos = (): OwnerDraftPhoto[] => [0, 1, 2].map(index => ({ index, extra: false, url: `https://media.example/${index}.jpg`, label: `Original label ${index}` }));
function complete(overrides: Partial<SharedOwnerDraft> = {}): SharedOwnerDraft {
    return { contentSource: 'owner_app', status: 'draft', phase: 'draft', businessName: 'Narra Legal', businessType: 'Law Office',
        address: '123 Main Street', interview: answers(), shots: photos(), templateId: 'business:CP', templateIds: ['business:CP', 'business:CQ'], ...overrides };
}

describe('shared owner draft resume', () => {
    it('resumes by canonical required content rather than eight legacy narrative answers', () => {
        expect(ownerDraftResumeStep(complete({ businessName: '' }))).toBe('details');
        expect(ownerDraftResumeStep(complete({ interview: answers().slice(0, 8) }))).toBe('interview');
        expect(ownerDraftResumeStep(complete({ shots: photos().slice(0, 2) }))).toBe('photos');
        expect(ownerDraftResumeStep(complete({ templateId: null }))).toBe('design');
        expect(ownerDraftResumeStep(complete())).toBe('review');
    });
    it('does not count the optional extra answer in place of a missing required question', () => {
        const recorded = answers().filter(answer => answer.index !== 4);
        recorded.push({ index: 10, answerText: 'Anything else', lang: 'tl' });
        expect(firstMissingOwnerAnswer(recorded)).toBe(4);
        recorded.push({ index: 4, lang: 'tl', mediaUrl: 'https://media.example/answer.m4a', mediaType: 'audio' });
        expect(firstMissingOwnerAnswer(recorded)).toBe(10);
        expect(ownerDraftResumeStep(complete({ interview: recorded }))).toBe('review');
    });
    it('honors earlier saved progress without skipping missing answers, photos or a required design', () => {
        expect(ownerDraftResumePosition(complete({ interview: answers().slice(0, 3), draftProgress: { step: 'review', questionIndex: 9 } })))
            .toEqual({ step: 'interview', questionIndex: 3 });
        expect(ownerDraftResumeStep(complete({ shots: [], draftProgress: { step: 'review' } }))).toBe('photos');
        expect(ownerDraftResumeStep(complete({ templateId: null, draftProgress: { step: 'review' } }))).toBe('design');
        expect(ownerDraftResumePosition(complete({ draftProgress: { step: 'interview', questionIndex: 7 } }))).toEqual({ step: 'interview', questionIndex: 7 });
        expect(ownerDraftProgressStep('setup')).toBe('details'); expect(ownerDraftProgressStep('unknown')).toBeNull();
    });
    it('keeps the selected design and all other data intact when it requires a compatible design after a type change', () => {
        const draft = complete({ businessType: 'Auto Shop' });
        const original = structuredClone(draft);
        expect(ownerDraftResumeStep(draft)).toBe('design'); expect(draft).toEqual(original);
        expect(ownerDraftResumeStep(complete({ businessType: 'Auto Shop', templateId: 'business:CE' }))).toBe('review');
    });
    it('allows a confirmed location in place of a written address, matching the draft submit contract', () => {
        expect(ownerDraftResumeStep(complete({ address: '', coordinates: { lat: 14.5, lng: 121 } }))).toBe('review');
        expect(ownerDraftResumeStep(complete({ address: '', coordinates: { lat: NaN, lng: 121 } }))).toBe('details');
    });
    it.each([{ status: 'submitted' }, { phase: 'live' }, { contentSource: 'owner_intake' }, { contentSource: 'creator' }])
    ('does not enable self editing for a sent, published or non-owner-app website: %j', change => {
        expect(ownerDraftEditable(complete())).toBe(true); expect(ownerDraftEditable(complete(change))).toBe(false);
    });
});

describe('shared owner media safety', () => {
    it('preserves slot indices, extra photos, labels and URLs without compacting missing guided slots', () => {
        const saved = [photos()[2], { index: 0, extra: true, url: 'https://media.example/extra.jpg', label: 'Shop award' }, photos()[0]];
        const original = structuredClone(saved), normalized = normalizedOwnerPhotos(saved);
        expect(normalized.map(ownerPhotoKey)).toEqual(['shot:0', 'shot:2', 'extra:0']);
        expect(normalized[2]).toMatchObject({ label: 'Shop award', url: 'https://media.example/extra.jpg', index: 0, extra: true });
        expect(saved).toEqual(original); expect(normalized).toHaveLength(3);
        expect(normalizedOwnerPhotos([...photos(), photos()[0]])).toHaveLength(3);
    });
    it('uses the newest duplicate slot and does not count empty or invalid slots as real photos', () => {
        const older = { ...photos()[0], updatedAt: 10 }, newer = { ...older, url: 'https://media.example/retaken.jpg', updatedAt: 20 };
        expect(normalizedOwnerPhotos([newer, older, { ...photos()[1], url: '' }, { ...photos()[2], index: 10 }])).toEqual([newer]);
    });
    it('preserves saved audio/video and its language/duration when changing or clearing only text', () => {
        const answer: OwnerDraftAnswer = { index: 4, lang: 'tl', answerText: 'Old transcript', mediaUrl: 'https://media.example/interview.mp4', mediaType: 'video', durationSec: 42 };
        expect(ownerAnswerWithText(answer, ' Corrected transcript ')).toEqual({ index: 4, lang: 'tl', answerText: 'Corrected transcript', mediaUrl: answer.mediaUrl, mediaType: 'video', durationSec: 42 });
        expect(ownerAnswerWithText(answer, '')).toMatchObject({ answerText: undefined, mediaUrl: answer.mediaUrl, mediaType: 'video', durationSec: 42 });
        expect(answer.answerText).toBe('Old transcript');
    });
    it.each(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])('allows an actual %s photo at the size ceiling', type => {
        expect(validateOwnerPhotoUpload({ type, size: 10 * 1024 * 1024 })).toBeNull();
    });
    it('rejects unsupported, empty and oversized uploads', () => {
        expect(validateOwnerPhotoUpload({ type: 'image/heic', size: 500 })).toContain('JPG, PNG or WebP');
        expect(validateOwnerPhotoUpload({ type: 'image/jpeg', size: 0 })).toContain('empty');
        expect(validateOwnerPhotoUpload({ type: 'image/png', size: 10 * 1024 * 1024 + 1 })).toContain('over 10 MB');
    });
});

describe('owner draft design categories', () => {
    it.each(BUSINESS_TYPES)('offers exactly three approved designs for %s', type => {
        const choices = ownerDraftDesignOptions(type);
        expect(choices).toHaveLength(3);
        for (const choice of choices) expect(ownerDraftDesignMatchesBusinessType(type, choice.code)).toBe(true);
    });
    it('never defaults a law office or clinic to a barber/spa template and retains compatible legacy choices', () => {
        expect(ownerDraftDesignOptions('Law Office').map(design => design.code)).toEqual(['business:CP', 'business:CQ', 'business:CR']);
        expect(ownerDraftDesignOptions('Clinic').map(design => design.code)).toEqual(['business:CM', 'business:CN', 'business:CO']);
        expect(ownerDraftDesignMatchesBusinessType('Law Office', 'salonspa:AN')).toBe(false);
        expect(ownerDraftDesignMatchesBusinessType('Barber/Salon', 'barbershop:BP')).toBe(true);
        expect(ownerDraftDesignMatchesBusinessType('Auto Shop', 'barbershop:BP')).toBe(false);
        expect(ownerDraftDesignOptions('Unknown category')).toEqual([]);
    });
});
