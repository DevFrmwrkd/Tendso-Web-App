import {
    generateClaimToken,
    isValidClaimTokenFormat,
    claimTokenExpiry,
    isClaimTokenUsable,
    normalizeEmail,
    emailMatchesSubmission,
    ownsSubmission,
    CLAIM_TOKEN_TTL_MS,
} from '../../lib/ownerClaim';

describe('ownerClaim — token format & expiry', () => {
    it('generates a 64-char hex token', () => {
        const t = generateClaimToken();
        expect(t).toMatch(/^[0-9a-f]{64}$/);
    });
    it('generates distinct tokens', () => {
        const set = new Set(Array.from({ length: 50 }, () => generateClaimToken()));
        expect(set.size).toBe(50);
    });
    it('validates format strictly', () => {
        expect(isValidClaimTokenFormat('a'.repeat(64))).toBe(true);
        expect(isValidClaimTokenFormat('A'.repeat(64))).toBe(false); // uppercase
        expect(isValidClaimTokenFormat('a'.repeat(63))).toBe(false); // too short
        expect(isValidClaimTokenFormat('xyz')).toBe(false);
        expect(isValidClaimTokenFormat('')).toBe(false);
    });
    it('sets a 7-day expiry', () => {
        const now = 1_000_000;
        expect(claimTokenExpiry(now)).toBe(now + CLAIM_TOKEN_TTL_MS);
    });
});

describe('ownerClaim — token usability', () => {
    const now = 1_000_000;
    it('pending + not expired = usable', () => {
        expect(isClaimTokenUsable({ status: 'pending', expiresAt: now + 1000 }, now)).toBe(true);
    });
    it('expired = not usable', () => {
        expect(isClaimTokenUsable({ status: 'pending', expiresAt: now - 1 }, now)).toBe(false);
        expect(isClaimTokenUsable({ status: 'pending', expiresAt: now }, now)).toBe(false); // boundary
    });
    it('already consumed / cancelled = not usable', () => {
        expect(isClaimTokenUsable({ status: 'consumed', expiresAt: now + 1000 }, now)).toBe(false);
        expect(isClaimTokenUsable({ status: 'cancelled', expiresAt: now + 1000 }, now)).toBe(false);
        expect(isClaimTokenUsable({ status: 'expired', expiresAt: now + 1000 }, now)).toBe(false);
    });
});

describe('ownerClaim — email match (the claim trust anchor)', () => {
    it('normalizes (trim + lowercase)', () => {
        expect(normalizeEmail('  Owner@Shop.PH ')).toBe('owner@shop.ph');
        expect(normalizeEmail(undefined)).toBe('');
    });
    it('matches case/whitespace-insensitively', () => {
        expect(emailMatchesSubmission('owner@shop.ph', '  Owner@Shop.PH')).toBe(true);
    });
    it('rejects a mismatch', () => {
        expect(emailMatchesSubmission('attacker@evil.com', 'owner@shop.ph')).toBe(false);
    });
    it('rejects empty/missing on either side (no blank-matches-blank)', () => {
        expect(emailMatchesSubmission('', '')).toBe(false);
        expect(emailMatchesSubmission(undefined, 'owner@shop.ph')).toBe(false);
        expect(emailMatchesSubmission('owner@shop.ph', null)).toBe(false);
    });
});

describe('ownerClaim — ownership check (the per-mutation gate)', () => {
    const ownerships = [
        { businessOwnerId: 'owner1', submissionId: 'subA' },
        { businessOwnerId: 'owner1', submissionId: 'subB' },
    ];
    it('allows an owner to act on their own submission', () => {
        expect(ownsSubmission('owner1', 'subA', ownerships)).toBe(true);
        expect(ownsSubmission('owner1', 'subB', ownerships)).toBe(true);
    });
    it("blocks acting on someone else's submission (the URL-hop attack)", () => {
        expect(ownsSubmission('owner1', 'subC', ownerships)).toBe(false);
        expect(ownsSubmission('owner2', 'subA', ownerships)).toBe(false);
    });
    it('blocks when the owner has no ownership rows', () => {
        expect(ownsSubmission('owner9', 'subA', [])).toBe(false);
    });
});
