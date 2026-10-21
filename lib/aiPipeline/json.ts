/** Small JSON + text helpers shared by the pipeline. Pure. */

/** Parse a model's JSON answer, tolerating a ```json fence or text around one object. */
export function parseJsonLoose(raw: string): unknown {
    const text = (raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    try {
        return JSON.parse(text);
    } catch {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
        throw new Error('The model did not return JSON');
    }
}

export const isRecord = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v);

/** A trimmed single-line string, capped. Anything that is not a string becomes ''. */
export function str(v: unknown, max = 500): string {
    if (typeof v !== 'string' && typeof v !== 'number') return '';
    const s = String(v).replace(/\s+/g, ' ').trim();
    if (/^(n\/?a|none|null|unknown|not mentioned|wala)$/i.test(s)) return '';
    return s.slice(0, max);
}

/** An array of trimmed non-empty strings, de-duplicated, capped. */
export function strList(v: unknown, maxItems = 10, maxLen = 200): string[] {
    if (!Array.isArray(v)) return [];
    const out: string[] = [];
    for (const item of v) {
        const s = str(item, maxLen);
        if (s && !out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s);
        if (out.length >= maxItems) break;
    }
    return out;
}

export const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/** Cut to at most `max` words without leaving a dangling comma. */
export function capWords(s: string, max: number): string {
    const words = s.trim().split(/\s+/).filter(Boolean);
    if (words.length <= max) return s.trim();
    return words.slice(0, max).join(' ').replace(/[,;:–-]+$/, '').trim();
}

/**
 * Clock and small numbers people SAY instead of writing ("alas otso", "eight",
 * "dose"), as digits. Only used to widen the SOURCE side of a grounding check,
 * so "8am" in the facts is accepted when the owner said "alas otso".
 */
const SPOKEN_NUMBERS: Record<string, string> = {
    one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12',
    uno: '1', dos: '2', tres: '3', kwatro: '4', kuwatro: '4', singko: '5', sais: '6', siyete: '7', syete: '7', otso: '8', nuwebe: '9', nueve: '9', diyes: '10', dyes: '10', onse: '11', dose: '12',
    isa: '1', dalawa: '2', tatlo: '3', apat: '4', lima: '5', anim: '6', pito: '7', walo: '8', siyam: '9', sampu: '10',
    noon: '12', tanghali: '12',
};

export function spokenNumbersIn(text: string): string[] {
    return (text.toLowerCase().match(/[a-zñ]+/g) ?? []).map((w) => SPOKEN_NUMBERS[w]).filter((n): n is string => !!n);
}

/** Digits-only runs in a text ("₱1,500" → "1500"), used for grounding checks. */
export function numbersIn(text: string): string[] {
    return (text.match(/\d[\d,.]*/g) ?? [])
        .map((n) => n.replace(/[,.](?=\d{3}\b)/g, '').replace(/[.,]+$/, ''))
        .filter(Boolean);
}
