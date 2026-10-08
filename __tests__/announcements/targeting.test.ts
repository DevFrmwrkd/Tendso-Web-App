import { selectTargets, type AudienceRow } from '../../lib/announcements/audience';

type Row = AudienceRow & { _id: string };

const rows: Row[] = [
    { _id: 'a', email: 'a@x.com', role: 'creator', status: 'active', certifiedAt: 1 },
    { _id: 'b', email: 'b@x.com', role: 'creator', status: 'active', quizPassedAt: 1 },
    { _id: 'c', email: 'c@x.com', role: 'admin', status: 'active', certifiedAt: 1 },
    { _id: 'd', email: 'd@x.com', role: 'creator', status: 'active', rejectedAt: 1 },
    { _id: 'e', email: 'e@x.com', role: 'creator', status: 'active', certifiedAt: 1, isDeleted: true },
    { _id: 'f', email: undefined, role: 'creator', status: 'active', certifiedAt: 1 },
];

const ids = (rs: Row[]) => rs.map((r) => r._id);

/**
 * Picking people bypasses the audience rule but NOT the two exclusions that
 * decide whether mail can arrive at all. Choosing someone explicitly is a
 * statement of intent; it is not a claim their account still exists.
 */
describe('selectTargets', () => {
    it('falls back to the audience rule when nobody is named', () => {
        expect(ids(selectTargets(rows, { audience: 'certified' }))).toEqual(['a']);
        expect(ids(selectTargets(rows, { audience: 'certified', creatorIds: null }))).toEqual(['a']);
    });

    it('targets exactly the named people, ignoring the audience', () => {
        // 'b' is quiz-passed, not certified — the audience would exclude them.
        expect(ids(selectTargets(rows, { audience: 'certified', creatorIds: ['b'] }))).toEqual(['b']);
        expect(ids(selectTargets(rows, { audience: 'certified', creatorIds: ['a', 'b'] }))).toEqual(['a', 'b']);
    });

    it('can explicitly reach an affiliate without adding them to creator broadcasts', () => {
        const affiliate: Row = { _id: 'affiliate', role: 'affiliate', email: 'affiliate@x.com', status: 'active' };
        expect(selectTargets([affiliate], { audience: 'active' })).toEqual([]);
        expect(selectTargets([affiliate], { audience: 'active', creatorIds: ['affiliate'] })).toEqual([affiliate]);
    });

    it('can reach people no audience would', () => {
        // Explicitly choosing an admin or a rejected creator is legitimate:
        // you picked them by name.
        expect(ids(selectTargets(rows, { audience: 'certified', creatorIds: ['c', 'd'] }))).toEqual(['c', 'd']);
    });

    it('still refuses deleted accounts and rows with no email', () => {
        // Not audience rules — "can mail arrive" rules. A hand-pick cannot
        // override them.
        expect(selectTargets(rows, { audience: 'all', creatorIds: ['e'] })).toEqual([]);
        expect(selectTargets(rows, { audience: 'all', creatorIds: ['f'] })).toEqual([]);
    });

    it('drops only the unsendable ones from a mixed selection', () => {
        // Picking five people where two cannot receive mail sends to three,
        // and the count shown to the admin says three.
        expect(ids(selectTargets(rows, { audience: 'all', creatorIds: ['a', 'e', 'b', 'f', 'c'] })))
            .toEqual(['a', 'b', 'c']);
    });

    it('sends to NOBODY on an empty selection, never the audience', () => {
        // Presence of the array selects the mode, not its length. If clearing
        // the picker fell back to the audience, emptying it would silently turn
        // one email into a broadcast.
        expect(selectTargets(rows, { audience: 'certified', creatorIds: [] })).toEqual([]);
    });

    it('ignores ids that match nobody', () => {
        expect(selectTargets(rows, { audience: 'all', creatorIds: ['nope'] })).toEqual([]);
        expect(ids(selectTargets(rows, { audience: 'all', creatorIds: ['a', 'nope'] }))).toEqual(['a']);
    });

    it('never mails the same person twice for a duplicated id', () => {
        expect(ids(selectTargets(rows, { audience: 'all', creatorIds: ['a', 'a', 'a'] }))).toEqual(['a']);
    });

    it('always returns an array, so callers count with .length', () => {
        const cases: Array<string[] | undefined | null> = [undefined, null, [], ['a'], ['nope']];
        for (const creatorIds of cases) {
            expect(Array.isArray(selectTargets(rows, { audience: 'certified', creatorIds }))).toBe(true);
        }
    });
});
