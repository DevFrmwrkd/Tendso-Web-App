import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OwnerDraftJournal, OwnerDraftOperation } from '../../lib/ownerDraftJournal';

type JournalModule = typeof import('../../lib/ownerDraftJournal');
let journal: JournalModule;
let rows: Map<string, unknown>;
let failTransaction: boolean;
let openCount: number;
let failOpen: boolean;

/** IndexedDB-shaped harness exercises transaction completion and structured cloning without browser globals. */
function storage() {
    const connection = {
        createObjectStore: vi.fn(),
        transaction: () => {
            const tx = { error: null as Error | null, oncomplete: null as (() => void) | null,
                onerror: null as (() => void) | null, onabort: null as (() => void) | null,
                objectStore: () => ({
                    get: (key: string) => request(() => structuredClone(rows.get(key))),
                    put: (value: unknown, key: string) => request(() => { rows.set(key, structuredClone(value)); return key; }),
                }) };
            function request(work: () => unknown) {
                const result = { result: undefined as unknown, error: null as Error | null };
                queueMicrotask(() => {
                    if (failTransaction) { tx.error = new Error('Storage quota unavailable'); tx.onabort?.(); }
                    else { result.result = work(); tx.oncomplete?.(); }
                });
                return result;
            }
            return tx;
        },
    };
    return { open: () => {
        openCount++;
        const result = { result: connection, error: new Error('Storage could not open'), onupgradeneeded: null as (() => void) | null,
            onsuccess: null as (() => void) | null, onerror: null as (() => void) | null, onblocked: null as (() => void) | null };
        queueMicrotask(() => { if (failOpen) result.onerror?.(); else { result.onupgradeneeded?.(); result.onsuccess?.(); } });
        return result;
    } };
}
const answer = (id: string, index = 0, text = id): OwnerDraftOperation => ({ id, kind: 'answer', index, text, lang: 'en' });
const photo = (id: string, extra = false, index = 0): OwnerDraftOperation => ({ id, kind: 'photo', index, extra,
    file: new Blob(['image bytes'], { type: 'image/webp' }), name: 'shop.webp', label: 'Shop entrance' });
const saved = (operations: OwnerDraftOperation[] = [answer('pending')]): OwnerDraftJournal => ({ version: 1, baseRevision: 4, operations });

beforeEach(async () => {
    vi.resetModules(); rows = new Map(); failTransaction = false; openCount = 0; failOpen = false;
    vi.stubGlobal('indexedDB', storage());
    journal = await import('../../lib/ownerDraftJournal');
});
afterEach(() => vi.unstubAllGlobals());

describe('owner draft scope and durable media', () => {
    it('keeps another account, business and delimiter-containing identity separate', async () => {
        const keys = [journal.ownerDraftJournalKey('owner:a', 'business:b'), journal.ownerDraftJournalKey('owner', 'a:business:b'),
            journal.ownerDraftJournalKey('other-owner', 'business:b'), journal.ownerDraftJournalKey('owner:a', 'other-business')];
        expect(new Set(keys).size).toBe(4);
        await journal.writeOwnerDraftJournal(keys[0], saved());
        expect(await journal.readOwnerDraftJournal(keys[0])).toEqual(saved());
        for (const key of keys.slice(1)) expect(await journal.readOwnerDraftJournal(key)).toBeNull();
    });
    it('round-trips the original Blob, MIME, filename, slot and successful upload checkpoint', async () => {
        const operation = { ...photo('upload'), publicUrl: 'https://media.example/images/shop.webp' } as OwnerDraftOperation;
        await journal.writeOwnerDraftJournal('media', saved([operation]));
        const restored = (await journal.readOwnerDraftJournal('media'))!.operations[0];
        expect(restored).toMatchObject({ kind: 'photo', index: 0, extra: false, label: 'Shop entrance', name: 'shop.webp', publicUrl: 'https://media.example/images/shop.webp' });
        if (restored.kind !== 'photo') throw new Error('Expected photo');
        expect(restored.file).toBeInstanceOf(Blob); expect(restored.file.type).toBe('image/webp'); expect(await restored.file.text()).toBe('image bytes');
        expect(restored).not.toBe(operation);
    });
    it('retains the optional extra interview recording and validates audio/video size ceilings without allocating huge files', async () => {
        const recording: OwnerDraftOperation = { id: 'extra-answer', kind: 'recording', index: 10, extra: false, lang: 'tl',
            file: new Blob(['optional extra answer'], { type: 'audio/webm;codecs=opus' }), name: 'extra.webm' };
        await journal.writeOwnerDraftJournal('recording', saved([recording]));
        expect((await journal.readOwnerDraftJournal('recording'))!.operations[0]).toMatchObject({ index: 10, kind: 'recording', lang: 'tl' });
        expect(journal.validateOwnerRecordingUpload({ type: 'audio/webm;codecs=opus', size: 50 * 1024 * 1024 })).toBeNull();
        expect(journal.validateOwnerRecordingUpload({ type: 'audio/mp4', size: 50 * 1024 * 1024 + 1 })).toContain('50 MB');
        expect(journal.validateOwnerRecordingUpload({ type: 'video/mp4', size: 500 * 1024 * 1024 })).toBeNull();
        expect(journal.validateOwnerRecordingUpload({ type: 'video/webm', size: 500 * 1024 * 1024 + 1 })).toContain('500 MB');
        expect(journal.validateOwnerRecordingUpload({ type: 'text/html', size: 100 })).toContain('recording');
        const largePhoto = Object.defineProperty(new Blob(['x'], { type: 'image/jpeg' }), 'size', { value: 10 * 1024 * 1024 + 1 });
        const largeAudio = Object.defineProperty(new Blob(['x'], { type: 'audio/mp4' }), 'size', { value: 50 * 1024 * 1024 + 1 });
        await expect(journal.writeOwnerDraftJournal('photo', saved([{ ...photo('large'), file: largePhoto } as OwnerDraftOperation]))).rejects.toBeInstanceOf(journal.OwnerDraftJournalRecoveryError);
        await expect(journal.writeOwnerDraftJournal('audio', saved([{ ...recording, file: largeAudio }]))).rejects.toBeInstanceOf(journal.OwnerDraftJournalRecoveryError);
    });
    it('keeps a failed replacement transaction from erasing the last committed pending media', async () => {
        await journal.writeOwnerDraftJournal('draft', saved([photo('photo')]));
        failTransaction = true;
        await expect(journal.writeOwnerDraftJournal('draft', saved([answer('replacement')]))).rejects.toThrow('Storage quota');
        failTransaction = false;
        expect((await journal.readOwnerDraftJournal('draft'))!.operations[0].kind).toBe('photo');
    });
    it('can retry after storage was unavailable or its first open failed', async () => {
        vi.stubGlobal('indexedDB', undefined);
        await expect(journal.readOwnerDraftJournal('draft')).rejects.toThrow('storage unavailable');
        vi.stubGlobal('indexedDB', storage()); failOpen = true;
        await expect(journal.readOwnerDraftJournal('draft')).rejects.toThrow('could not open');
        failOpen = false;
        await journal.writeOwnerDraftJournal('draft', saved());
        expect(await journal.readOwnerDraftJournal('draft')).toEqual(saved()); expect(openCount).toBe(2);
    });
});

describe('pending operation coalescing', () => {
    it('supersedes the same pending answer without dropping another answer, recording or the in-flight payload', () => {
        const inFlight = answer('sending', 0, 'Original being sent');
        const recording: OwnerDraftOperation = { id: 'recording', kind: 'recording', index: 0, extra: false, name: 'voice.webm', lang: 'tl', file: new Blob(['voice'], { type: 'audio/webm;codecs=opus' }) };
        const operations = [inFlight, answer('old-edit'), answer('other-question', 1), recording];
        const result = journal.appendOwnerDraftOperation(operations, answer('new-edit', 0, 'Latest text'), 'sending');
        expect(result.map(item => item.id)).toEqual(['sending', 'other-question', 'recording', 'new-edit']);
        expect(inFlight).toMatchObject({ text: 'Original being sent' }); expect(operations).toHaveLength(4);
    });
    it('treats remove/replace as one photo slot while keeping extras and sparse indices separate', () => {
        const operations = [photo('guided-zero'), photo('extra-zero', true), photo('guided-seven', false, 7)];
        const removed: OwnerDraftOperation = { id: 'remove', kind: 'remove-photo', extra: false, index: 0 };
        const result = journal.appendOwnerDraftOperation(operations, removed);
        expect(result.map(item => item.id)).toEqual(['extra-zero', 'guided-seven', 'remove']);
        expect(journal.appendOwnerDraftOperation(result, photo('replacement')).map(item => item.id)).toEqual(['extra-zero', 'guided-seven', 'replacement']);
    });
    it('coalesces matching detail field sets but retains independent address edits and the latest progress/design', () => {
        const first: OwnerDraftOperation = { id: 'old-details', kind: 'details', patch: { businessName: 'Old', city: 'Manila' } };
        const address: OwnerDraftOperation = { id: 'address', kind: 'details', patch: { address: 'Saved street' } };
        const next: OwnerDraftOperation = { id: 'details', kind: 'details', patch: { city: 'Pasig', businessName: 'New' } };
        let result = journal.appendOwnerDraftOperation([first, address], next);
        result = journal.appendOwnerDraftOperation(result, { id: 'progress-one', kind: 'progress', progress: { step: 'interview', questionIndex: 3 } });
        result = journal.appendOwnerDraftOperation(result, { id: 'progress-two', kind: 'progress', progress: { step: 'photos', photoIndex: 7 } });
        result = journal.appendOwnerDraftOperation(result, { id: 'old-design', kind: 'design', templateId: 'business:CP' });
        result = journal.appendOwnerDraftOperation(result, { id: 'design', kind: 'design', templateId: 'business:CQ' });
        expect(result.map(item => item.id)).toEqual(['address', 'details', 'progress-two', 'design']);
        expect((result[0] as typeof address).patch.address).toBe('Saved street');
    });
});

describe('corrupt journal recovery and conflict errors', () => {
    it.each([
        null, { version: 2, baseRevision: 4, operations: [] }, { version: 1, baseRevision: -1, operations: [] },
        { version: 1, baseRevision: 4, operations: [null] }, { version: 1, baseRevision: 4, operations: [{ id: 'unknown', kind: 'run-script' }] },
        { version: 1, baseRevision: 4, operations: [answer('same'), answer('same', 1)] },
        { version: 1, baseRevision: 4, operations: [{ ...answer('answer'), index: 11 }] },
        { version: 1, baseRevision: 4, operations: [{ id: 'patch', kind: 'details', patch: { actorClerkId: 'another-owner' } }] },
        { version: 1, baseRevision: 4, operations: [{ id: 'progress', kind: 'progress', progress: { step: 'review', questionIndex: -1 } }] },
    ])('refuses malformed stored data without replaying or deleting it: %j', async value => {
        rows.set('corrupt', value);
        await expect(journal.readOwnerDraftJournal('corrupt')).rejects.toMatchObject({ name: 'OwnerDraftJournalRecoveryError', code: 'OWNER_DRAFT_STORAGE_INVALID' });
        expect(rows.has('corrupt')).toBe(true); expect(rows.get('corrupt')).toEqual(value);
    });
    it.each([
        { file: new Blob(['not an image'], { type: 'text/html' }) }, { file: new Blob([], { type: 'image/jpeg' }) },
        { file: { type: 'image/jpeg', size: 12 } }, { index: 10 }, { publicUrl: 'javascript:alert(1)' },
        { publicUrl: 'https://user:secret@media.example/shop.jpg' },
    ])('rejects unsafe media metadata instead of overwriting a valid saved journal: %j', async change => {
        const value = saved(); await journal.writeOwnerDraftJournal('draft', value);
        const malformed = saved([{ ...photo('bad'), ...change } as OwnerDraftOperation]);
        await expect(journal.writeOwnerDraftJournal('draft', malformed)).rejects.toBeInstanceOf(journal.OwnerDraftJournalRecoveryError);
        expect(await journal.readOwnerDraftJournal('draft')).toEqual(value);
    });
    it('recognizes structured CAS errors and keeps their useful messages distinct from transport errors', () => {
        const conflict = { data: { code: 'OWNER_DRAFT_CONFLICT', message: 'This draft changed on another device.', currentRevision: 9 } };
        expect(journal.ownerDraftConflict(conflict)).toBe(true); expect(journal.ownerDraftError(conflict)).toBe(conflict.data.message);
        expect(journal.ownerDraftConflict({ data: { code: 'OWNER_DRAFT_REFRESH_REQUIRED' } })).toBe(true);
        expect(journal.ownerDraftConflict(new Error('Network offline'))).toBe(false);
        expect(journal.ownerDraftError(new Error('Network offline'))).toBe('Network offline');
        expect(journal.ownerDraftError({ data: 'Owner account required' })).toBe('Owner account required');
    });
});
