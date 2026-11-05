/**
 * Step 3 of the pipeline: which photos to polish, with which references and
 * which prompt, and where each result goes on the page.
 *
 * Theo's bar (brief §4C.3): the result must look like a professional
 * photographer RE-SHOT the same person in the same place — new camera position,
 * framing and light; bright, friendly, commercial, realistic. Never a filter on
 * the same frame, never dark / cinematic / orange. Signs and price lists are
 * never sent (generated text gets garbled); they stay as shot.
 * Pure. See docs/v2-ai-pipeline.md.
 */

import type { PipelineShot, ShotType } from './types';

/** Role (positional photos) or label (owner-app shots) → shot type. */
export function classifyShot(shot: Pick<PipelineShot, 'role' | 'label'>): ShotType {
    const label = (shot.label ?? '').toLowerCase();
    if (label) {
        if (/sign|price|menu|list|karatula|presyo/.test(label)) return 'sign';
        if (/headshot|profile|portrait|owner|you or your staff|staff/.test(label) && !/at work|cooking|in progress/.test(label)) return 'portrait';
        if (/in progress|at work|cooking|working|client|customers?/.test(label)) return 'action';
        if (/outside|front|storefront|street|exterior/.test(label)) return 'exterior';
        if (/inside|interior|station|chairs|bay|dining|kitchen|room|shop|workshop/.test(label)) return 'interior';
        return 'detail';
    }
    const role = shot.role ?? '';
    if (role === 'headshot') return 'portrait';
    if (role.startsWith('interior')) return 'interior';
    if (role === 'exterior') return 'exterior';
    return 'detail';
}

const PEOPLE: ReadonlySet<ShotType> = new Set(['portrait', 'action']);

/** The rule every prompt carries, word for word. */
export const PHOTO_RULES =
    'Same person, same room, new camera position and light. Bright, friendly, commercial, realistic photograph, ' +
    'like a professional photographer re-shot it on the same day. Natural daylight colours and true skin tones. ' +
    'Never dark, never cinematic, never moody, never orange or teal grading, never a filter on the same frame. ' +
    'Do not add or remove people, signs, logos or text. Do not change faces, clothes, the room or the products.';

const SHOT_DIRECTION: Record<Exclude<ShotType, 'sign'>, string> = {
    portrait: 'A friendly portrait of the owner from reference 1, half body, looking at the camera with a relaxed smile, standing in their own shop from the location reference, camera at eye level slightly to one side, soft bright window light, shop softly visible behind.',
    action: 'The owner from the owner reference at work, exactly as in reference 1, photographed from a new three-quarter angle a few steps away, hands and work clearly visible, bright even light, candid and natural.',
    interior: 'The same room as reference 1, photographed wide from a corner at chest height so the whole space reads, lights on, bright and clean, straight vertical lines, nothing moved or added.',
    exterior: 'The same shop front as reference 1, photographed from across the street in bright daytime light, straight on and level, the whole front and entrance in frame, nothing added.',
    detail: 'The same object or work as reference 1, photographed close from a new angle on the same surface in the same shop, bright soft light, sharp focus, shallow but natural depth of field.',
};

export interface PolishPlanItem {
    shot: PipelineShot;
    shotType: ShotType;
    /** Image URLs sent to the model; the shot itself is always first. */
    referenceUrls: string[];
    prompt: string;
}

export interface PolishPlan {
    items: PolishPlanItem[];
    /** Shots kept as they are, with the reason. */
    skipped: Array<{ shot: PipelineShot; shotType: ShotType; reason: string }>;
    ownerRefUrl?: string;
    locationRefUrl?: string;
}

/** The prompt for one shot. */
export function buildPhotoPrompt(shotType: Exclude<ShotType, 'sign'>, refs: { hasOwnerRef: boolean; hasLocationRef: boolean }, businessType?: string): string {
    // Image order matches planPolish: [shot, owner ref?, location ref?].
    const ownerN = refs.hasOwnerRef ? 2 : 0;
    const locationN = refs.hasLocationRef ? (refs.hasOwnerRef ? 3 : 2) : 0;
    const refsLine = [
        'Reference 1 is the photo to re-shoot.',
        ownerN ? `Reference ${ownerN} is the owner reference and shows the same person: keep their face, hair, skin tone and clothes exactly.` : '',
        locationN ? `Reference ${locationN} is the location reference and shows the same shop: keep its walls, colours, furniture and equipment exactly.` : '',
    ].filter(Boolean).join(' ');
    const trade = businessType ? ` This is a small ${businessType.toLowerCase()} in the Philippines.` : ' This is a small shop in the Philippines.';
    return `${SHOT_DIRECTION[shotType]}${trade} ${refsLine} ${PHOTO_RULES}`;
}

/**
 * Decide what to polish. The owner reference is the first portrait; the
 * location reference is the first interior (else the exterior). At most
 * `maxPolished` shots are sent, in page order, people and rooms first.
 */
export function planPolish(
    shots: PipelineShot[],
    opts: { maxPolished: number; keepOriginals: boolean; offReason?: string | null; businessType?: string },
): PolishPlan {
    const typed = shots.map((shot) => ({ shot, shotType: classifyShot(shot) }));
    const ownerRef = typed.find((t) => t.shotType === 'portrait')?.shot.url;
    const locationRef = (typed.find((t) => t.shotType === 'interior') ?? typed.find((t) => t.shotType === 'exterior'))?.shot.url;
    const plan: PolishPlan = { items: [], skipped: [], ownerRefUrl: ownerRef, locationRefUrl: locationRef };

    const globalReason = opts.keepOriginals ? 'owner chose to keep original photos' : opts.offReason ?? null;
    const priority: Record<ShotType, number> = { portrait: 0, interior: 1, exterior: 2, action: 3, detail: 4, sign: 9 };
    const candidates = typed
        .filter((t) => {
            if (globalReason) { plan.skipped.push({ ...t, reason: globalReason }); return false; }
            if (t.shotType === 'sign') { plan.skipped.push({ ...t, reason: 'signs and price lists are never re-shot' }); return false; }
            return true;
        })
        .sort((a, b) => priority[a.shotType] - priority[b.shotType] || a.shot.index - b.shot.index);

    candidates.forEach((t, i) => {
        if (i >= opts.maxPolished) { plan.skipped.push({ ...t, reason: 'over the per-site polishing cap' }); return; }
        const type = t.shotType as Exclude<ShotType, 'sign'>;
        const useOwner = PEOPLE.has(type) && !!ownerRef && ownerRef !== t.shot.url;
        const useLocation = !!locationRef && locationRef !== t.shot.url;
        plan.items.push({
            shot: t.shot,
            shotType: type,
            referenceUrls: [t.shot.url, ...(useOwner ? [ownerRef!] : []), ...(useLocation ? [locationRef!] : [])],
            prompt: buildPhotoPrompt(type, { hasOwnerRef: useOwner, hasLocationRef: useLocation }, opts.businessType),
        });
    });
    plan.items.sort((a, b) => a.shot.index - b.shot.index);
    return plan;
}

/**
 * Builder image keys for each shot, in the Studio v0.2 placement family that
 * /api/generate-website already maps (convex/lib/enhancedImages.ts):
 * `enhanced_hero` (first exterior, else first interior, else first shot),
 * `enhanced_portrait` (first portrait), the rest `enhanced_gallery_<N>` in order.
 */
export function placementKeys(shots: Array<{ index: number; shotType: ShotType }>): Map<number, string> {
    const keys = new Map<number, string>();
    const sorted = [...shots].sort((a, b) => a.index - b.index);
    const hero = sorted.find((s) => s.shotType === 'exterior') ?? sorted.find((s) => s.shotType === 'interior') ?? sorted[0];
    const portrait = sorted.find((s) => s.shotType === 'portrait' && s !== hero);
    if (hero) keys.set(hero.index, 'enhanced_hero');
    if (portrait) keys.set(portrait.index, 'enhanced_portrait');
    let n = 1;
    for (const s of sorted) {
        if (!keys.has(s.index)) keys.set(s.index, `enhanced_gallery_${n++}`);
    }
    return keys;
}
