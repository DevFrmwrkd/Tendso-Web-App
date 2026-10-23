import { signOwnerBuild, verifyOwnerBuild } from '../../lib/ownerBuildProof';

const ID = 'jh7abc123';
const HTML = '<html><body>Forge</body></html>';

describe('owner build proof', () => {
    it('verifies the HTML it signed for the submission it signed for', async () => {
        const proof = await signOwnerBuild('s3cret', ID, HTML);
        expect(proof).toMatch(/^[0-9a-f]{64}$/);
        expect(await verifyOwnerBuild('s3cret', ID, HTML, proof)).toBe(true);
    });

    it('refuses other HTML, another submission, another secret, a missing secret and junk', async () => {
        const proof = await signOwnerBuild('s3cret', ID, HTML);
        expect(await verifyOwnerBuild('s3cret', ID, HTML + '<script>x</script>', proof)).toBe(false);
        expect(await verifyOwnerBuild('s3cret', 'other-site', HTML, proof)).toBe(false);
        expect(await verifyOwnerBuild('different', ID, HTML, proof)).toBe(false);
        expect(await verifyOwnerBuild(undefined, ID, HTML, proof)).toBe(false);
        expect(await verifyOwnerBuild('s3cret', ID, HTML, '')).toBe(false);
        expect(await verifyOwnerBuild('s3cret', ID, HTML, 'z'.repeat(64))).toBe(false);
    });

    it('will not sign without a secret', async () => {
        await expect(signOwnerBuild('', ID, HTML)).rejects.toThrow();
    });
});
