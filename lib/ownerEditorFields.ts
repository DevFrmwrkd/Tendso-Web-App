/**
 * What the owner's "Edit text" screen shows, and how a draft is read.
 *
 * The fields come from the SAME schema the admin editor renders
 * (components/editor/genericContentSchema.ts, narrowed per template by
 * templateFieldPaths.generated.ts through the editor's own groupsForTemplate).
 * This file only decides which of those an owner sees and what they are called:
 * plain words, no facts that live on the submission, nothing technical.
 *
 * Pure (no React, no DOM) so it is unit-tested.
 */

import type { FieldSpec, GroupSpec, ListSpec } from '../components/editor/genericContentSchema';

/** Fields an owner never edits as text: shop facts (they live on the submission) and plumbing. */
const HIDDEN_PATHS = new Set([
    'business_name',      // the shop's name is a fact from signup
    'tagline',            // browser tab + search snippet, not on the page
    'navbar_links',       // navigation structure
    'hero.scrim',         // a visual setting, not text
    'hero.headline',      // the single-line form of the lines below: structural
    'footer.locality',
]);
const HIDDEN_PREFIXES = ['contact.']; // phone, email, address come from the submission
/** Whole groups left to the team: customer quotes are guarded, the marquee is decoration. */
const HIDDEN_GROUPS = new Set(['marquee', 'testimonials']);

const isList = (f: FieldSpec | ListSpec): f is ListSpec => (f as ListSpec).kind === 'list';

function visible(path: string): boolean {
    if (HIDDEN_PATHS.has(path)) return false;
    return !HIDDEN_PREFIXES.some((p) => path.startsWith(p));
}

/** Plain-language names for the schema's admin vocabulary. */
const PLAIN: Array<[RegExp, string]> = [
    [/^Kicker \/ eyebrow$/i, 'Small line above the headline'],
    [/^Eyebrow tag$/i, 'Small label above the title'],
    [/^Headline lines \(3 lines\)$/i, 'Headline (up to 3 lines)'],
    [/^Sub-headline \/ elevator pitch$/i, 'Short introduction'],
    [/^Sub-headline$/i, 'Short introduction'],
    [/^Line under the headline$/i, 'Line under the headline'],
    [/^Primary CTA$/i, 'Main button'],
    [/^Secondary CTA$/i, 'Second button'],
    [/^Header CTA$/i, 'Top button'],
    [/^CTA button$/i, 'Button'],
    [/^Second CTA button$/i, 'Second button'],
    [/^Lead paragraph$/i, 'Main paragraph'],
    [/^Body paragraphs$/i, 'More paragraphs'],
    [/^Spec rows \(label . value\)$/i, 'Quick facts'],
    [/^Hero USP strip \(3 cells\)$/i, 'Three short highlights'],
    [/^Card button \(all cards\)$/i, 'Button on each card'],
    [/^Whole-package band . price$/i, 'Package price'],
    [/^Directions button$/i, 'Directions button'],
    [/^Brand name \(nav wordmark\)$/i, 'Name at the top'],
    [/^Footer brand$/i, 'Name at the bottom'],
    [/^Brand blurb$/i, 'Short line at the bottom'],
    [/^Policy \/ rules rows$/i, 'Good to know'],
    [/^Places with travel time$/i, 'Places and travel time'],
    [/^Footer notes \(copyright row\)$/i, 'Small print'],
    [/^Contact column heading$/i, 'Heading for contact details'],
    [/^Links column heading$/i, 'Heading for links'],
    [/^Visit column lines$/i, 'Contact lines'],
    [/^Explore column links$/i, 'Links'],
    [/^Hours rows$/i, 'Opening hours'],
    [/^Social links$/i, 'Social media'],
    [/^Items$/i, 'Entries'],
    [/^Tiles$/i, 'Photo captions'],
];

export function plainLabel(label: string): string {
    for (const [re, to] of PLAIN) if (re.test(label)) return to;
    return label;
}

/**
 * The groups an owner sees, from the editor's own (template-filtered) groups:
 * hidden groups and fields removed, image fields left to the Photos screen,
 * labels in plain words. A group left with nothing is dropped.
 */
export function ownerGroups(groups: GroupSpec[]): GroupSpec[] {
    const out: GroupSpec[] = [];
    for (const group of groups) {
        if (HIDDEN_GROUPS.has(group.id)) continue;
        const fields: GroupSpec['fields'] = [];
        for (const f of group.fields) {
            if (isList(f)) {
                if (!visible(f.path)) continue;
                const itemFields = f.itemFields.filter((i) => i.kind !== 'image' && visible(i.path === '' ? f.path : `${f.path}.N.${i.path}`));
                if (itemFields.length === 0) continue;
                fields.push({ ...f, label: plainLabel(f.label), itemFields: itemFields.map((i) => ({ ...i, label: plainLabel(i.label) })) });
            } else {
                if (f.kind === 'image' || !visible(f.path)) continue;
                fields.push({ ...f, label: plainLabel(f.label), hint: undefined });
            }
        }
        if (fields.length) out.push({ ...group, title: group.id === 'header' ? 'Top of the page' : group.title, fields, description: undefined });
    }
    return out;
}

/** A field's value: its own path, else the first fallback path that holds something. */
export function readWithFallbacks(
    get: (path: string) => unknown,
    primary: string,
    fallbacks?: string[],
): unknown {
    const own = get(primary);
    if (own !== undefined && own !== null && own !== '') return own;
    for (const fb of fallbacks ?? []) {
        const v = get(fb);
        if (v !== undefined && v !== null && v !== '') return v;
    }
    return own;
}

/** Joins path parts, skipping empty ones. */
export function joinPath(...parts: Array<string | number>): string {
    return parts.filter((p) => p !== '' && p !== null && p !== undefined).map(String).join('.');
}

export interface FillMessage { type: 'ed:update'; field: string; value: string }

/**
 * Every text the draft holds, as bridge updates for the preview iframe. Run on
 * load and after a design switch, so the preview shows what the owner typed
 * whichever built page is on screen.
 */
export function textFillMessages(groups: GroupSpec[], get: (path: string) => unknown): FillMessage[] {
    const out: FillMessage[] = [];
    const push = (field: string, v: unknown) => {
        if (typeof v === 'string' || typeof v === 'number') out.push({ type: 'ed:update', field, value: String(v) });
    };
    for (const group of groups) {
        for (const f of group.fields) {
            if (isList(f)) {
                const rows = readWithFallbacks(get, f.path, f.fallbackPaths);
                if (!Array.isArray(rows)) continue;
                rows.forEach((row, i) => {
                    for (const sub of f.itemFields) {
                        const path = joinPath(f.path, i, sub.path);
                        if (sub.path === '') push(path, row);
                        else push(path, (row as Record<string, unknown> | null)?.[sub.path.split('.')[0]!] !== undefined ? get(path) : undefined);
                    }
                });
            } else {
                push(f.path, readWithFallbacks(get, f.path, f.fallbackPaths));
            }
        }
    }
    return out;
}
