import fs from 'node:fs';
import path from 'node:path';
import { cleanGiftedBy, GIFTED_BY_MAX, HOUSE_CREATOR_EMAIL, isHouseCreator } from '@/lib/houseCreator';

/**
 * "Give free" on a self-serve site named the house account in the owner's
 * email ("Tendso Self-Serve chose Liwayway Flowers…"). The admin now types the
 * giver there instead; these pin how a self-serve site is recognised and how
 * the typed name is normalised.
 */
describe('isHouseCreator', () => {
    it('recognises the seeded house creator', () => {
        expect(isHouseCreator({ email: 'self-serve@tendso.com' })).toBe(true);
        expect(isHouseCreator({ email: '  Self-Serve@Tendso.com ' })).toBe(true);
    });

    it('does not mistake a real creator, or a missing one, for the house row', () => {
        expect(isHouseCreator({ email: 'jane@example.com' })).toBe(false);
        expect(isHouseCreator({ email: null })).toBe(false);
        expect(isHouseCreator(null)).toBe(false);
        expect(isHouseCreator(undefined)).toBe(false);
    });

    it('matches the email the seed actually writes', () => {
        // Two copies of one constant is how these drift; read the seed itself.
        const seed = fs.readFileSync(path.join(__dirname, '..', '..', 'convex', 'seed', 'houseCreator.ts'), 'utf8');
        expect(seed).toContain(`email: '${HOUSE_CREATOR_EMAIL}'`);
    });
});

describe('cleanGiftedBy', () => {
    it('keeps a normal name as typed', () => {
        expect(cleanGiftedBy('Off the Record')).toBe('Off the Record');
        expect(cleanGiftedBy('Mr. Beast')).toBe('Mr. Beast');
    });

    it('trims and collapses whitespace, including newlines', () => {
        expect(cleanGiftedBy('  Off   the\nRecord  ')).toBe('Off the Record');
    });

    it('caps the length so it stays one line of the sentence', () => {
        const long = 'x'.repeat(GIFTED_BY_MAX + 40);
        expect(cleanGiftedBy(long)).toHaveLength(GIFTED_BY_MAX);
    });

    it('treats blanks and non-strings as missing', () => {
        expect(cleanGiftedBy('   ')).toBe('');
        expect(cleanGiftedBy(undefined)).toBe('');
        expect(cleanGiftedBy(42)).toBe('');
        expect(cleanGiftedBy({ name: 'x' })).toBe('');
    });
});
