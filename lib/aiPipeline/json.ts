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
 * Numbers people SAY instead of writing ("alas otso", "eight",
 * "dose"), as digits. Compound numbers are kept whole on both sides of
 * grounding checks ("twenty-one" is 21, never separate 20 and 1 claims).
 */
const SPOKEN_NUMBERS: Record<string, string> = {
    zero: '0', thirteen: '13', fourteen: '14', fifteen: '15', sixteen: '16', seventeen: '17', eighteen: '18', nineteen: '19',
    twenty: '20', thirty: '30', forty: '40', fifty: '50', sixty: '60', seventy: '70', eighty: '80', ninety: '90',
    dalawampung: '20', tatlumpung: '30', limampung: '50', pitumpung: '70', walumpung: '80',
    dalawampu: '20', tatlumpu: '30', apatnapu: '40', limampu: '50', animnapu: '60', pitumpu: '70', walumpu: '80', siyamnapu: '90',
    sampung: '10', labindalawa: '12',
    labintatlo: '13', labinlima: '15', labimpito: '17', labingwalo: '18', labinsiyam: '19',
    labing: '10', isang: '1', dalawang: '2', tatlong: '3', apatnapung: '40',
    one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12',
    uno: '1', dos: '2', tres: '3', kwatro: '4', kuwatro: '4', singko: '5', sais: '6', siyete: '7', syete: '7', otso: '8', nuwebe: '9', nueve: '9', diyes: '10', dyes: '10', onse: '11', dose: '12',
    isa: '1', dalawa: '2', tatlo: '3', apat: '4', lima: '5', anim: '6', pito: '7', walo: '8', siyam: '9', sampu: '10',
    limang: '5', animnapung: '60', pitong: '7', walong: '8', siyamnapung: '90',
    noon: '12', tanghali: '12',
};

const NUMBER_SCALES: Record<string, number> = {
    hundred: 100, hundreds: 100, daan: 100, daang: 100,
    thousand: 1000, thousands: 1000, libo: 1000, libong: 1000,
    million: 1_000_000, millions: 1_000_000, milyon: 1_000_000,
};

export function spokenNumbersIn(text: string): string[] {
    const tokens = text.toLowerCase().replace(/([a-zñ])['’]t\b/g, '$1 at').match(/[a-zñ]+|[^a-zñ\s-]+/g) ?? [];
    const out: string[] = [];
    let total = 0, group = 0, active = false;
    const flush = () => {
        if (active) out.push(String(total + group));
        total = group = 0;
        active = false;
    };
    for (let i = 0; i < tokens.length; i++) {
        const word = tokens[i];
        const value = SPOKEN_NUMBERS[word];
        const scale = NUMBER_SCALES[word];
        if (typeof value === 'string') {
            group += Number(value);
            active = true;
        } else if (typeof scale === 'number') {
            if (scale === 100) group = (group || 1) * scale;
            else { total += (group || 1) * scale; group = 0; }
            active = true;
        } else if (active && /^(and|at|na)$/.test(word)
            && (typeof SPOKEN_NUMBERS[tokens[i + 1]] === 'string' || typeof NUMBER_SCALES[tokens[i + 1]] === 'number')) {
            continue;
        } else flush();
    }
    flush();
    return out;
}

/** Digits-only runs in a text ("₱1,500" → "1500"), used for grounding checks. */
export function numbersIn(text: string): string[] {
    return (text.match(/\d[\d,.]*/g) ?? [])
        .map((n) => n.replace(/[,.](?=\d{3}\b)/g, '').replace(/[.,]+$/, ''))
        .filter(Boolean);
}
