import { encryptSecret, decryptSecret, isEncrypted } from '../../convex/lib/encryption';

const SECRET = 'test-secret-at-least-16-chars-long-xxxxx';
const OTHER_SECRET = 'a-different-secret-also-16-plus-chars-yyyy';

describe('encryption (AES-256-GCM via Web Crypto)', () => {
    describe('round-trip', () => {
        it('decrypts back to the original plaintext', async () => {
            const plain = 'AIzaSyD-EXAMPLE-gemini-key-1234567890';
            const enc = await encryptSecret(plain, SECRET);
            expect(await decryptSecret(enc, SECRET)).toBe(plain);
        });

        it('handles unicode and long values', async () => {
            const plain = 'kéy-✓-' + 'x'.repeat(500);
            const enc = await encryptSecret(plain, SECRET);
            expect(await decryptSecret(enc, SECRET)).toBe(plain);
        });

        it('produces different ciphertext each time (random IV)', async () => {
            const plain = 'same-input-value-1234567890';
            const a = await encryptSecret(plain, SECRET);
            const b = await encryptSecret(plain, SECRET);
            expect(a).not.toBe(b);                       // IV differs
            expect(await decryptSecret(a, SECRET)).toBe(plain);
            expect(await decryptSecret(b, SECRET)).toBe(plain);
        });
    });

    describe('isEncrypted', () => {
        it('recognizes the enc:v1: format', async () => {
            const enc = await encryptSecret('hello-world-1234567890', SECRET);
            expect(isEncrypted(enc)).toBe(true);
        });
        it('treats anything else as plaintext', () => {
            expect(isEncrypted('AIzaSyD-raw-plaintext-key')).toBe(false);
            expect(isEncrypted('')).toBe(false);
        });
    });

    describe('legacy plaintext pass-through', () => {
        it('returns non-encrypted values unchanged (migration window)', async () => {
            const legacy = 'AIzaSyD-legacy-plaintext-key-123456';
            expect(await decryptSecret(legacy, SECRET)).toBe(legacy);
        });
    });

    describe('security properties', () => {
        it('fails to decrypt with the wrong secret', async () => {
            const enc = await encryptSecret('secret-key-1234567890', SECRET);
            await expect(decryptSecret(enc, OTHER_SECRET)).rejects.toBeDefined();
        });

        it('fails to decrypt tampered ciphertext (GCM auth tag)', async () => {
            const enc = await encryptSecret('secret-key-1234567890', SECRET);
            // Flip a character in the ciphertext body
            const tampered = enc.slice(0, -2) + (enc.endsWith('A') ? 'B' : 'A') + enc.slice(-1);
            await expect(decryptSecret(tampered, SECRET)).rejects.toBeDefined();
        });

        it('rejects a too-short secret on encrypt', async () => {
            await expect(encryptSecret('x', 'short')).rejects.toThrow(/at least 16/);
        });

        it('does not leak the plaintext anywhere in the stored string', async () => {
            const plain = 'AIzaSyD-very-distinctive-token-ABCDEF';
            const enc = await encryptSecret(plain, SECRET);
            expect(enc.includes(plain)).toBe(false);
            expect(enc.includes('distinctive')).toBe(false);
        });
    });
});
