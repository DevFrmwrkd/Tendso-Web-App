import type { FunctionArgs } from 'convex/server';
import type { api } from '@/convex/_generated/api';

export type OwnerDraftProgress = FunctionArgs<typeof api.ownerApp.saveDraftProgress>['progress'];
type Details = Omit<FunctionArgs<typeof api.ownerApp.updateDraft>, 'submissionId' | 'actorClerkId' | 'expectedRevision'>;
export type OwnerDraftOperation = { id: string } & (
    | { kind: 'details'; patch: Details }
    | { kind: 'answer'; index: number; text: string; lang: 'en' | 'tl' }
    | { kind: 'progress'; progress: OwnerDraftProgress }
    | { kind: 'design'; templateId: string }
    | { kind: 'remove-photo'; index: number; extra: boolean }
    | { kind: 'photo' | 'recording'; index: number; extra: boolean; label?: string; file: Blob; name: string; publicUrl?: string; lang?: 'en' | 'tl' }
);
export type OwnerDraftJournal = { version: 1; baseRevision: number; operations: OwnerDraftOperation[] };

export class OwnerDraftJournalRecoveryError extends Error {
    readonly code = 'OWNER_DRAFT_STORAGE_INVALID';
    constructor() {
        super('This browser’s pending draft could not be read safely. It has been kept unchanged. Check your saved business before recovering or replacing these pending changes.');
        this.name = 'OwnerDraftJournalRecoveryError';
    }
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'
    && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const keysOnly = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).every(key => keys.includes(key));
const text = (value: unknown, max: number, empty = true): value is string => typeof value === 'string'
    && value.length <= max && (empty || value.trim().length > 0) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
const index = (value: unknown, max: number) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;
const lang = (value: unknown) => value === 'en' || value === 'tl';
const optional = (value: unknown, valid: (value: unknown) => boolean) => value === undefined || valid(value);
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'];
const AUDIO_TYPES = ['audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg', 'audio/aac', 'audio/flac'];
export function validateOwnerRecordingUpload(file: { type: string; size: number }): string | null {
    const mime = file.type.toLowerCase().split(';')[0].trim();
    const video = VIDEO_TYPES.includes(mime), audio = AUDIO_TYPES.includes(mime);
    if (!video && !audio) return 'Choose an MP4, MOV, WebM or supported audio recording.';
    if (!Number.isFinite(file.size) || file.size <= 0) return 'This recording is empty. Choose another recording.';
    return file.size > (video ? 500 : 50) * 1024 * 1024 ? `Choose a ${video ? 'video under 500 MB' : 'voice recording under 50 MB'}.` : null;
}
const coordinate = (value: unknown) => record(value) && keysOnly(value, ['lat', 'lng'])
    && typeof value.lat === 'number' && Number.isFinite(value.lat) && Math.abs(value.lat) <= 90
    && typeof value.lng === 'number' && Number.isFinite(value.lng) && Math.abs(value.lng) <= 180;
function publicUrl(value: unknown): boolean {
    if (!text(value, 2048, false)) return false;
    try { const url = new URL(value); return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password; }
    catch { return false; }
}
function details(value: unknown): boolean {
    if (!record(value)) return false;
    const limits: Record<string, number> = { businessType: 120, businessName: 120, address: 300, city: 120,
        province: 120, barangay: 120, shotListKey: 32, ownerName: 120, ownerPhone: 40 };
    return keysOnly(value, [...Object.keys(limits), 'coordinates']) && Object.entries(value).every(([key, item]) =>
        key === 'coordinates' ? optional(item, coordinate) : optional(item, item => text(item, limits[key])));
}
function progress(value: unknown): boolean {
    return record(value) && keysOnly(value, ['step', 'questionIndex', 'photoIndex', 'how', 'audioOnly', 'lang'])
        && ['details', 'setup', 'interview', 'photos', 'design', 'review'].includes(value.step as string)
        && optional(value.questionIndex, item => index(item, 10)) && optional(value.photoIndex, item => index(item, 9))
        && optional(value.how, item => item === 'self' || item === 'friend')
        && optional(value.audioOnly, item => typeof item === 'boolean') && optional(value.lang, lang);
}
function media(value: Record<string, unknown>): boolean {
    if (typeof Blob === 'undefined' || !(value.file instanceof Blob) || !text(value.name, 255, false)
        || !Number.isFinite(value.file.size) || value.file.size <= 0 || !optional(value.label, item => text(item, 80))
        || !optional(value.publicUrl, publicUrl) || !optional(value.lang, lang)) return false;
    const mime = value.file.type.toLowerCase().split(';')[0].trim();
    if (value.kind === 'photo') return ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(mime) && value.file.size <= 10 * 1024 * 1024;
    return validateOwnerRecordingUpload(value.file) === null;
}
function operation(value: unknown): value is OwnerDraftOperation {
    if (!record(value) || !text(value.id, 200, false)) return false;
    switch (value.kind) {
        case 'details': return keysOnly(value, ['id', 'kind', 'patch']) && details(value.patch);
        case 'answer': return keysOnly(value, ['id', 'kind', 'index', 'text', 'lang']) && index(value.index, 10) && text(value.text, 2000) && lang(value.lang);
        case 'progress': return keysOnly(value, ['id', 'kind', 'progress']) && progress(value.progress);
        case 'design': return keysOnly(value, ['id', 'kind', 'templateId']) && text(value.templateId, 80, false);
        case 'remove-photo': return keysOnly(value, ['id', 'kind', 'index', 'extra']) && index(value.index, 9) && typeof value.extra === 'boolean';
        case 'photo': case 'recording': return keysOnly(value, ['id', 'kind', 'index', 'extra', 'label', 'file', 'name', 'publicUrl', 'lang'])
            && index(value.index, value.kind === 'photo' ? 9 : 10) && typeof value.extra === 'boolean' && media(value);
        default: return false;
    }
}
function validJournal(value: unknown): value is OwnerDraftJournal {
    if (!record(value) || !keysOnly(value, ['version', 'baseRevision', 'operations']) || value.version !== 1
        || typeof value.baseRevision !== 'number' || !Number.isSafeInteger(value.baseRevision) || value.baseRevision < 0 || !Array.isArray(value.operations)) return false;
    const ids = new Set<string>();
    for (const item of value.operations) {
        if (!operation(item) || ids.has(item.id)) return false;
        ids.add(item.id);
    }
    return true;
}

/** Actor + business scoping prevents another login or business adopting private pending files. */
export const ownerDraftJournalKey = (actor: string, business: string) => `owner-draft:v1:${encodeURIComponent(actor)}:${encodeURIComponent(business)}`;
let database: Promise<IDBDatabase> | undefined;
function db() {
    if (database) return database;
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
        if (typeof indexedDB === 'undefined') { reject(new Error('Browser storage unavailable')); return; }
        const request = indexedDB.open('tendso-owner-drafts', 1);
        request.onupgradeneeded = () => { request.result.createObjectStore('drafts'); };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Close another Tendso tab to open draft storage.'));
    });
    database = opening;
    void opening.catch(() => { if (database === opening) database = undefined; });
    return opening;
}
async function transaction<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const connection = await db();
    return new Promise((resolve, reject) => {
        const tx = connection.transaction('drafts', mode);
        const request = work(tx.objectStore('drafts'));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error ?? request.error);
        tx.onabort = () => reject(tx.error ?? new Error('Could not save this browser’s draft.'));
    });
}
export async function readOwnerDraftJournal(key: string): Promise<OwnerDraftJournal | null> {
    const value = await transaction<unknown>('readonly', store => store.get(key));
    if (value === undefined) return null;
    if (!validJournal(value)) throw new OwnerDraftJournalRecoveryError();
    return value;
}
export async function writeOwnerDraftJournal(key: string, value: OwnerDraftJournal): Promise<void> {
    if (!validJournal(value)) throw new OwnerDraftJournalRecoveryError();
    await transaction('readwrite', store => store.put(value, key));
}

export function ownerDraftOperationKey(operation: OwnerDraftOperation): string {
    if (operation.kind === 'answer' || operation.kind === 'recording') return `${operation.kind}:${operation.index}`;
    if (operation.kind === 'photo' || operation.kind === 'remove-photo') return `photo:${operation.extra}:${operation.index}`;
    if (operation.kind === 'details') return `details:${Object.keys(operation.patch).sort().join(',')}`;
    return operation.kind;
}
/** Coalesce only operations that have not started; an in-flight operation keeps its payload. */
export function appendOwnerDraftOperation(operations: OwnerDraftOperation[], next: OwnerDraftOperation, inFlightId?: string): OwnerDraftOperation[] {
    const key = ownerDraftOperationKey(next);
    return [...operations.filter(item => item.id === inFlightId || ownerDraftOperationKey(item) !== key), next];
}

export function ownerDraftError(error: unknown): string {
    const data = error && typeof error === 'object' && 'data' in error ? error.data : null;
    if (typeof data === 'string') return data;
    if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') return data.message;
    return error instanceof Error ? error.message : 'Could not save. Your pending changes are kept on this browser.';
}
export function ownerDraftConflict(error: unknown): boolean {
    const data = error && typeof error === 'object' && 'data' in error ? error.data : null;
    return !!data && typeof data === 'object' && 'code' in data && (data.code === 'OWNER_DRAFT_CONFLICT' || data.code === 'OWNER_DRAFT_REFRESH_REQUIRED');
}
