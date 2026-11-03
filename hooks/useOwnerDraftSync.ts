"use client";

import { useAction, useMutation } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '@/convex/_generated/api';
import type { OwnerWebScope } from './useOwnerWebScope';
import { appendOwnerDraftOperation, OwnerDraftJournalRecoveryError, ownerDraftConflict, ownerDraftError, ownerDraftJournalKey, readOwnerDraftJournal,
    writeOwnerDraftJournal, type OwnerDraftJournal, type OwnerDraftOperation } from '@/lib/ownerDraftJournal';

export type SharedDraft = FunctionReturnType<typeof api.ownerApp.getSubmission>;
type NewOperation = OwnerDraftOperation extends infer O ? O extends { id: string } ? Omit<O, 'id'> : never : never;
const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;

/** Per-owner/business write queue. Server revisions arbitrate every device, including submit. */
export function useOwnerDraftSync(draft: SharedDraft, scope: OwnerWebScope) {
    const isCurrentScope = scope.isCurrent;
    const details = useMutation(api.ownerApp.updateDraft), answer = useMutation(api.ownerApp.saveAnswer);
    const photo = useMutation(api.ownerApp.saveShot), removePhoto = useMutation(api.ownerApp.removeShot);
    const design = useMutation(api.ownerApp.chooseDesign), progress = useMutation(api.ownerApp.saveDraftProgress);
    const submit = useMutation(api.ownerApp.submit), uploadUrl = useAction(api.r2.generateUploadUrl);
    const key = ownerDraftJournalKey(scope.userId!, draft.submissionId);
    const [pending, setPending] = useState<OwnerDraftOperation[]>([]);
    const [optimistic, setOptimistic] = useState<OwnerDraftOperation[]>([]);
    const [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false);
    const [conflict, setConflict] = useState(false), [error, setError] = useState('');
    const [storageWarning, setStorageWarning] = useState(''), [connected, setConnected] = useState(online);
    const [writable, setWritable] = useState(false), [storageBlocked, setStorageBlocked] = useState(false), [recoveryMessage, setRecoveryMessage] = useState('');
    const mounted = useRef(false), latest = useRef(draft), blocked = useRef(false), inFlight = useRef<string | undefined>(undefined);
    const leaseOwned = useRef(false), leaseKey = useRef<string | null>(null), storageIsBlocked = useRef(false);
    const journal = useRef<OwnerDraftJournal>({ version: 1, baseRevision: draft.draftRevision, operations: [] });
    const storageWrites = useRef(Promise.resolve()), working = useRef<Promise<boolean> | null>(null), submitting = useRef(false);
    useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    useLayoutEffect(() => { latest.current = draft; }, [draft]);
    const current = useCallback(() => mounted.current && isCurrentScope(), [isCurrentScope]);
    const canWrite = useCallback(() => current() && leaseOwned.current && leaseKey.current === key && !storageIsBlocked.current, [current, key]);
    const persist = useCallback(() => {
        if (!canWrite()) return Promise.resolve();
        const snapshot = { ...journal.current, operations: [...journal.current.operations] };
        storageWrites.current = storageWrites.current.catch(() => {}).then(() => {
            // Already-admitted snapshots may finish while unmount releases the lease.
            if (leaseOwned.current && leaseKey.current === key && !storageIsBlocked.current) return writeOwnerDraftJournal(key, snapshot);
        }).catch(cause => {
            if (cause instanceof OwnerDraftJournalRecoveryError) {
                storageIsBlocked.current = true;
                if (current()) { setStorageBlocked(true); setWritable(false); setRecoveryMessage(cause.message); }
            } else if (current()) setStorageWarning('This browser cannot keep pending files after closing. Keep this page open until everything is saved.');
        });
        return storageWrites.current;
    }, [canWrite, current, key]);
    const publish = useCallback(() => { if (current()) setPending([...journal.current.operations]); }, [current]);
    useEffect(() => {
        let active = true;
        let release: (() => void) | undefined;
        const held = new Promise<void>(resolve => { release = resolve; });
        const unavailable = (message: string) => {
            if (!active || !current()) return;
            storageIsBlocked.current = true; setStorageBlocked(true); setRecoveryMessage(message); setWritable(false); setLoaded(true);
        };
        const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
        if (!locks?.request) {
            unavailable('This browser cannot safely keep shared draft changes. Open this page in a browser with Web Locks support, then reload. Your saved account draft is available to view.');
            return () => { active = false; };
        }
        void locks.request(`tendso:${key}`, { mode: 'exclusive', ifAvailable: true }, async lock => {
            if (!active || !current()) return;
            if (!lock) { unavailable('This business draft is being edited in another tab. Close that tab, then reload here to continue. Your saved account draft is available to view.'); return; }
            leaseOwned.current = true;
            leaseKey.current = key;
            try {
                try {
                    const saved = await readOwnerDraftJournal(key);
                    if (!active || !current()) return;
                    if (saved?.operations.length) {
                        journal.current = saved;
                        if (saved.baseRevision !== latest.current.draftRevision) { blocked.current = true; setConflict(true); }
                        publish();
                    } else journal.current.baseRevision = latest.current.draftRevision;
                    setWritable(true); setLoaded(true);
                } catch (cause) {
                    unavailable(cause instanceof OwnerDraftJournalRecoveryError ? cause.message
                        : 'This browser could not open pending draft storage. Reload to retry. Your saved account draft is available to view; pending files have not been replaced.');
                }
                if (active) await held;
            } finally { if (leaseKey.current === key) { leaseOwned.current = false; leaseKey.current = null; } }
        }).catch(() => unavailable('This browser could not lock the draft for editing. Close other Tendso tabs and reload, or use a browser with Web Locks support.'));
        return () => {
            active = false;
            // Finish admitted storage snapshots before another tab can acquire the same draft.
            void storageWrites.current.catch(() => {}).then(() => release?.());
        };
    }, [key, current, publish]);
    useEffect(() => {
        if (!loaded || working.current || journal.current.operations.length) return;
        if (draft.draftRevision >= journal.current.baseRevision) {
            journal.current.baseRevision = draft.draftRevision;
            setOptimistic([]);
        }
    }, [draft.draftRevision, loaded]);
    useEffect(() => {
        const change = () => setConnected(online());
        window.addEventListener('online', change); window.addEventListener('offline', change);
        return () => { window.removeEventListener('online', change); window.removeEventListener('offline', change); };
    }, []);
    useEffect(() => {
        if (!pending.length && !busy) return;
        const leave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', leave);
        return () => window.removeEventListener('beforeunload', leave);
    }, [pending.length, busy]);

    const enqueue = useCallback((operation: NewOperation) => {
        if (!canWrite() || !loaded || blocked.current || submitting.current || latest.current.status !== 'draft') return;
        setError('');
        const next = { ...operation, id: crypto.randomUUID() } as OwnerDraftOperation;
        journal.current.operations = appendOwnerDraftOperation(journal.current.operations, next, inFlight.current);
        publish(); void persist();
    }, [canWrite, loaded, publish, persist]);

    const flush = useCallback((): Promise<boolean> => {
        if (working.current) return working.current;
        if (!canWrite() || !loaded || blocked.current || !online() || latest.current.status !== 'draft') return Promise.resolve(false);
        const run = async () => {
            setBusy(true); setError('');
            try {
                await storageWrites.current;
                while (journal.current.operations.length) {
                    if (!canWrite() || !online() || latest.current.status !== 'draft') return false;
                    if (latest.current.draftRevision > journal.current.baseRevision) throw { data: { code: 'OWNER_DRAFT_CONFLICT', message: 'This draft changed on another device. Review the latest saved version before continuing.' } };
                    const operation = journal.current.operations[0];
                    inFlight.current = operation.id;
                    const guard = { submissionId: draft.submissionId, actorClerkId: scope.userId!, expectedRevision: journal.current.baseRevision };
                    let result: { draftRevision: number };
                    switch (operation.kind) {
                        case 'details': result = await details({ ...guard, ...operation.patch }); break;
                        case 'answer': result = await answer({ ...guard, index: operation.index, answerText: operation.text, lang: operation.lang }); break;
                        case 'progress': result = await progress({ ...guard, progress: operation.progress }); break;
                        case 'design': result = await design({ ...guard, templateId: operation.templateId }); break;
                        case 'remove-photo': result = await removePhoto({ ...guard, index: operation.index, extra: operation.extra }); break;
                        default: {
                            if (!operation.publicUrl) {
                                const upload = await uploadUrl({ fileName: operation.name, fileType: operation.file.type,
                                    folder: `owner/${draft.submissionId}`, mediaType: operation.kind === 'photo' ? 'photo' : operation.file.type.startsWith('video/') ? 'video' : 'audio' });
                                if (!canWrite()) return false;
                                const response = await fetch(upload.uploadUrl, { method: 'PUT', headers: { 'Content-Type': operation.file.type }, body: operation.file });
                                if (!response.ok) throw new Error('The file could not upload. Its original is kept on this browser.');
                                if (!canWrite()) return false;
                                operation.publicUrl = upload.publicUrl;
                                await persist();
                            }
                            if (!canWrite() || !online()) return false;
                            result = operation.kind === 'photo'
                                ? await photo({ ...guard, index: operation.index, extra: operation.extra, label: operation.label, url: operation.publicUrl! })
                                : await answer({ ...guard, index: operation.index, lang: operation.lang ?? 'en', mediaUrl: operation.publicUrl!,
                                    mediaType: operation.file.type.startsWith('video/') ? 'video' : 'audio' });
                        }
                    }
                    if (!canWrite() || latest.current.status !== 'draft') return false;
                    journal.current.baseRevision = result.draftRevision;
                    journal.current.operations = journal.current.operations.filter(item => item.id !== operation.id);
                    setOptimistic(previous => [...previous, operation]);
                    inFlight.current = undefined;
                    publish(); await persist();
                }
                return true;
            } catch (cause) {
                if (current()) {
                    if (ownerDraftConflict(cause)) { blocked.current = true; setConflict(true); }
                    setError(ownerDraftError(cause));
                }
                return false;
            } finally {
                inFlight.current = undefined; working.current = null;
                if (current()) setBusy(false);
            }
        };
        working.current = run();
        return working.current;
    }, [canWrite, current, loaded, draft.submissionId, scope.userId, details, answer, photo, removePhoto, progress, design, uploadUrl, persist, publish]);
    useEffect(() => {
        if (!loaded || !pending.length || conflict || !connected || error) return;
        const timer = window.setTimeout(() => { void flush(); }, 650);
        return () => window.clearTimeout(timer);
    }, [loaded, pending, conflict, connected, error, flush]);

    const resolveConflict = async (keepMine: boolean) => {
        if (!canWrite() || working.current || latest.current.status !== 'draft') return;
        journal.current.baseRevision = latest.current.draftRevision;
        if (!keepMine) journal.current.operations = [];
        blocked.current = false; setConflict(false); setError(''); setOptimistic([]); publish(); await persist();
        if (keepMine && current()) await flush();
    };
    const retry = () => { setError(''); return flush(); };
    const send = async () => {
        if (submitting.current || !canWrite() || blocked.current || !online()) return false;
        submitting.current = true;
        try {
            if (!await flush() || !canWrite()) return false;
            const result = await submit({ submissionId: draft.submissionId, actorClerkId: scope.userId!, expectedRevision: journal.current.baseRevision });
            if (!canWrite()) return false;
            journal.current.baseRevision = result.draftRevision; journal.current.operations = [];
            publish(); await persist(); return true;
        } catch (cause) {
            if (current()) { setError(ownerDraftError(cause)); if (ownerDraftConflict(cause)) { blocked.current = true; setConflict(true); } }
            return false;
        } finally { submitting.current = false; }
    };
    return { loaded, writable, storageBlocked, recoveryMessage, busy, connected, conflict, error, storageWarning, pending, optimistic, enqueue, flush, retry, resolveConflict, send };
}
