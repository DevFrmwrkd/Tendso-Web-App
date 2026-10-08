import {
    matchesAudience,
    selectAudience,
    isSendable,
    AUDIENCES,
    type AudienceRow,
    type AudienceKey,
} from '../../lib/announcements/audience';

const row = (over: Partial<AudienceRow> = {}): AudienceRow => ({
    email: 'creator@example.com',
    role: 'creator',
    status: 'active',
    ...over,
});

const ALL_KEYS: AudienceKey[] = ['certified', 'active', 'awaiting_approval', 'all'];

/**
 * This decides who receives an email that cannot be recalled. The admin page
 * shows a count from this function and then sends using the same function — so
 * anything it gets wrong is both invisible beforehand and irreversible after.
 */
describe('matchesAudience', () => {
    it('never sends to a deleted account, under any audience', () => {
        for (const key of ALL_KEYS) {
            expect(matchesAudience(row({ isDeleted: true, certifiedAt: 1 }), key)).toBe(false);
            expect(matchesAudience(row({ status: 'deleted', certifiedAt: 1 }), key)).toBe(false);
        }
    });

    it('never sends to a row without a usable email', () => {
        // Every creator has one today. That is exactly why an unchecked
        // assumption would go unnoticed the day one does not.
        for (const key of ALL_KEYS) {
            expect(matchesAudience(row({ email: undefined, certifiedAt: 1 }), key)).toBe(false);
            expect(matchesAudience(row({ email: '', certifiedAt: 1 }), key)).toBe(false);
            expect(matchesAudience(row({ email: 'not-an-email', certifiedAt: 1 }), key)).toBe(false);
        }
    });

    it('certified means approved by an admin, not merely quiz-passed', () => {
        expect(matchesAudience(row({ certifiedAt: 1 }), 'certified')).toBe(true);
        expect(matchesAudience(row({ quizPassedAt: 1 }), 'certified')).toBe(false);
        expect(matchesAudience(row({}), 'certified')).toBe(false);
    });

    it('awaiting_approval excludes those already certified or rejected', () => {
        expect(matchesAudience(row({ quizPassedAt: 1 }), 'awaiting_approval')).toBe(true);
        expect(matchesAudience(row({ quizPassedAt: 1, certifiedAt: 2 }), 'awaiting_approval')).toBe(false);
        expect(matchesAudience(row({ quizPassedAt: 1, rejectedAt: 2 }), 'awaiting_approval')).toBe(false);
    });

    it('excludes rejected creators from every audience except "all"', () => {
        const rejected = row({ rejectedAt: 1, certifiedAt: 1 });
        expect(matchesAudience(rejected, 'certified')).toBe(false);
        expect(matchesAudience(rejected, 'active')).toBe(false);
        expect(matchesAudience(rejected, 'awaiting_approval')).toBe(false);
        // "Everyone" is offered precisely so an admin can see what creators see.
        expect(matchesAudience(rejected, 'all')).toBe(true);
    });

    it('keeps admins out of creator-facing audiences', () => {
        const admin = row({ role: 'admin', certifiedAt: 1 });
        expect(matchesAudience(admin, 'certified')).toBe(false);
        expect(matchesAudience(admin, 'active')).toBe(false);
        expect(matchesAudience(admin, 'all')).toBe(true);
    });

    it('keeps affiliates and staff out of creator audiences, even with stale certification fields', () => {
        for (const role of ['affiliate', 'staff']) {
            for (const key of ['certified', 'active', 'awaiting_approval'] as const) {
                expect(matchesAudience(row({ role, certifiedAt: 1, quizPassedAt: 1 }), key)).toBe(false);
            }
            expect(matchesAudience(row({ role }), 'all')).toBe(true);
        }
        expect(matchesAudience(row({ role: undefined, certifiedAt: 1 }), 'certified')).toBe(true);
    });

    it('sends to NOBODY on an unrecognised audience key', () => {
        // A typo or a stale client must not fall through to a full broadcast.
        expect(matchesAudience(row({ certifiedAt: 1 }), 'everyone' as AudienceKey)).toBe(false);
        expect(matchesAudience(row({ certifiedAt: 1 }), '' as AudienceKey)).toBe(false);
    });

    it('isSendable is independent of audience', () => {
        expect(isSendable(row())).toBe(true);
        expect(isSendable(row({ isDeleted: true }))).toBe(false);
    });

    it('selectAudience filters a real-shaped list', () => {
        const rows = [
            row({ email: 'a@x.com', certifiedAt: 1 }),
            row({ email: 'b@x.com', quizPassedAt: 1 }),
            row({ email: 'c@x.com', role: 'admin', certifiedAt: 1 }),
            row({ email: 'd@x.com', certifiedAt: 1, isDeleted: true }),
        ];
        expect(selectAudience(rows, 'certified').map((r) => r.email)).toEqual(['a@x.com']);
        expect(selectAudience(rows, 'active').map((r) => r.email)).toEqual(['a@x.com', 'b@x.com']);
        expect(selectAudience(rows, 'all').map((r) => r.email)).toEqual(['a@x.com', 'b@x.com', 'c@x.com']);
    });

    it('every advertised audience is implemented', () => {
        // A key in the picker with no branch here would silently send to nobody.
        for (const a of AUDIENCES) {
            expect(matchesAudience(row({ certifiedAt: 1, quizPassedAt: 1 }), a.key)).toBe(
                a.key !== 'awaiting_approval'
            );
        }
    });
});
