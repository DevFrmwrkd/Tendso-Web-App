"use client";

/* eslint-disable @next/next/no-img-element -- Draft media includes local Blob previews and owner-uploaded R2 files. */

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, CloudCheck, CloudUpload, FileImage, MessageSquare, RefreshCw, Smartphone, X } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Button, ConfirmDialog, Field, Input, Select, Textarea } from '@/components/r1';
import { OwnerPageHeader, OwnerShell } from '@/components/shells/OwnerShell';
import { useOwnerWebScope } from '@/hooks/useOwnerWebScope';
import { useOwnerDraftSync, type SharedDraft } from '@/hooks/useOwnerDraftSync';
import { OWNER_APP_QUESTIONS } from '@/convex/lib/ownerApp';
import { BUSINESS_TYPES } from '@/lib/prospectPrefill';
import { ownerDraftEditable, ownerDraftDesignMatchesBusinessType, ownerDraftDesignOptions, ownerDraftResumeStep,
    normalizedOwnerPhotos, firstMissingOwnerAnswer, validateOwnerPhotoUpload, type DraftStep } from '@/lib/ownerSharedDraft';
import type { OwnerDraftOperation } from '@/lib/ownerDraftJournal';
import { ownerDraftError, validateOwnerRecordingUpload } from '@/lib/ownerDraftJournal';
import { templateByCode } from '@/components/editor/templateCatalog';
import { SHOT_LISTS, type ShotListKey } from '@/apps/mobile/lib/v2/captureContent';
import { OwnerSectionBoundary } from '../../_components/OwnerSectionBoundary';
import styles from './OwnerDraft.module.css';

const MapPicker = dynamic(() => import('@/app/start/MapPicker'), { ssr: false, loading: () => <p role="status">Opening the map…</p> });
const STEPS: { id: DraftStep; label: string }[] = [{ id: 'details', label: 'Your business' }, { id: 'interview', label: 'Your story' },
    { id: 'photos', label: 'Photos' }, { id: 'design', label: 'Design' }, { id: 'review', label: 'Last look' }];
const shotsForType: Record<string, ShotListKey> = { 'Barber/Salon': 'barber', 'Auto Shop': 'repair', 'Spa/Massage': 'salon',
    Restaurant: 'food', Clinic: 'clinic', 'Law Office': 'law', 'Craft/Producer': 'craft', Other: 'shop' };

export function OwnerDraftPage({ submissionId }: { submissionId: string }) {
    return <OwnerShell><OwnerPageHeader title="Let’s finish your business setup." subtitle="Your saved answers, photos and design stay together on mobile and web." back />
        <OwnerSectionBoundary label="Business draft"><DraftAccess submissionId={submissionId} /></OwnerSectionBoundary></OwnerShell>;
}
function DraftAccess({ submissionId }: { submissionId: string }) {
    const scope = useOwnerWebScope();
    const response = useQuery(api.ownerApp.getSubmission, scope.ready && scope.userId ? { submissionId: submissionId as Id<'submissions'> } : 'skip');
    if (scope.error) return <p role="alert">{scope.error}</p>;
    if (!scope.isSignedIn && !scope.loading) return <SignIn returnTo={`/my-business/drafts/${encodeURIComponent(submissionId)}`} />;
    const draft = scope.ready && response?.actorClerkId === scope.userId && response.ownerId === scope.owner?._id && response.submissionId === submissionId ? response : undefined;
    if (!draft) return <p role="status">Opening your saved draft…</p>;
    if (!ownerDraftEditable(draft)) return <section className={styles.card}><h2>This business has already been sent.</h2><p>Your saved information stays with this business. Use Ask for a change for website updates.</p><Link className={styles.primary} href={`/my-business/${submissionId}`}>Open business <ArrowRight size={17} /></Link></section>;
    return <DraftEditor key={`${scope.scopeKey}:${submissionId}`} draft={draft} scope={scope} />;
}
function SignIn({ returnTo }: { returnTo: string }) { return <section className={styles.card}><h2>Open your saved business setup</h2><p>Sign in with the same owner account you use in the Tendso app.</p><Link className={styles.primary} href={`/my-business/sign-in?returnTo=${encodeURIComponent(returnTo)}`}>Sign in to continue</Link></section>; }

/** This is intake data only. Built/published websites remain managed through Ask for a change. */
function DraftEditor({ draft, scope }: { draft: SharedDraft; scope: ReturnType<typeof useOwnerWebScope> }) {
    const router = useRouter();
    const sync = useOwnerDraftSync(draft, scope);
    const [step, setStep] = useState<DraftStep>(() => ownerDraftResumeStep(draft));
    const [notice, setNotice] = useState(''), [moving, setMoving] = useState(false), [sending, setSending] = useState(false);
    const [decision, setDecision] = useState<'latest' | 'mine' | 'submit' | null>(null);
    const [previewPhoto, setPreviewPhoto] = useState<string | null>(null), [previewDesign, setPreviewDesign] = useState<string | null>(null);
    const [remove, setRemove] = useState<{ index: number; extra: boolean; label: string } | null>(null);
    const positioned = useRef(false);
    const operations = [...sync.optimistic, ...sync.pending];
    const view = overlayDraft(draft, operations);
    const photos = normalizedOwnerPhotos(view.shots), answers = view.interview;
    const designs = [...ownerDraftDesignOptions(view.businessType)];
    const savedDesign = templateByCode(view.templateId);
    if (savedDesign && ownerDraftDesignMatchesBusinessType(view.businessType, savedDesign.code) && !designs.some(item => item.code === savedDesign.code)) designs.unshift(savedDesign);
    const suggestions = SHOT_LISTS[(view.shotListKey && view.shotListKey in SHOT_LISTS ? view.shotListKey : shotsForType[view.businessType] ?? 'shop') as ShotListKey];
    const completeAnswers = firstMissingOwnerAnswer(answers) === 10;
    const validDetails = !!view.businessName.trim() && (!!view.address.trim() || !!view.coordinates);
    const validDesign = ownerDraftDesignMatchesBusinessType(view.businessType, view.templateId);
    const canSend = validDetails && completeAnswers && photos.length >= 3 && validDesign && sync.writable && !sync.conflict && sync.connected && !sync.pending.length && !sync.busy;
    const locked = !sync.loaded || !sync.writable || sync.conflict || sending || moving;
    useEffect(() => {
        if (!sync.loaded || positioned.current) return;
        positioned.current = true;
        const question = draft.draftProgress?.questionIndex;
        const target = step === 'interview' && question !== undefined ? `draft-question-${question}`
            : step === 'photos' && draft.draftProgress?.photoIndex !== undefined ? `draft-photo-${draft.draftProgress.photoIndex}` : null;
        if (target && typeof document !== 'undefined') document.getElementById(target)?.scrollIntoView({ block: 'center' });
    }, [sync.loaded, step, draft.draftProgress]);
    const update = (patch: Parameters<typeof sync.enqueue>[0]) => { if (!locked) { setNotice(''); sync.enqueue(patch); } };
    const go = async (next: DraftStep) => {
        if (locked) return;
        const index = STEPS.findIndex(item => item.id === step), nextIndex = STEPS.findIndex(item => item.id === next);
        if (nextIndex > index) {
            if (!validDetails) { setNotice('Add your business name and an address or map pin first.'); setStep('details'); return; }
            if (step === 'interview' && !completeAnswers) { setNotice('Answer all 10 questions with text or a recording before continuing.'); return; }
            if (step === 'photos' && photos.length < 3) { setNotice('Add at least 3 shop photos before continuing.'); return; }
            if (next === 'review' && !validDesign) { setNotice('Choose a design that fits this business before continuing.'); setStep('design'); return; }
        }
        setMoving(true); setNotice('');
        sync.enqueue({ kind: 'progress', progress: { ...view.draftProgress, step: next } });
        const saved = await sync.flush();
        if (scope.isCurrent() && saved) setStep(next);
        if (scope.isCurrent()) setMoving(false);
    };
    const file = (event: ChangeEvent<HTMLInputElement>, index: number, extra: boolean, label: string, kind: 'photo' | 'recording' = 'photo') => {
        const selected = event.target.files?.[0]; event.target.value = '';
        if (!selected || locked) return;
        const problem = kind === 'photo' ? validateOwnerPhotoUpload(selected) : validateOwnerRecordingUpload(selected);
        if (problem) { setNotice(problem); return; }
        update({ kind, index, extra, label, file: selected, name: selected.name, lang: view.draftProgress?.lang ?? 'en' });
    };
    const leave = async () => { if (locked) return; setMoving(true); const saved = await sync.flush(); if (scope.isCurrent()) { if (saved) router.push('/my-business/today'); else setMoving(false); } };
    if (!sync.loaded) return <p role="status">Restoring saved work from this browser…</p>;
    return <div className={styles.workspace}>
        <div className={styles.saveBar}><div className={styles.saveState} role="status">{sync.busy || sync.pending.length ? <CloudUpload size={21} /> : <CloudCheck size={21} />}<span><strong>{sync.recoveryMessage ? 'Draft is read-only here' : sync.conflict ? 'Review newer changes' : !sync.connected ? 'Waiting for a connection' : sync.busy ? 'Saving your changes…' : sync.pending.length ? 'Changes waiting to sync' : 'Saved to your owner account'}</strong><small>{sync.pending.length ? 'Pending changes stay on this browser until uploaded.' : 'Continue on your phone or web with this same owner account.'}</small></span></div><button className={styles.secondary} disabled={locked || sync.busy} onClick={() => { void leave(); }}>Save and exit <ArrowRight size={16} /></button></div>
        {sync.storageWarning ? <p className={styles.warning} role="status">{sync.storageWarning}</p> : null}
        {sync.recoveryMessage ? <p className={styles.warning} role="alert">{sync.recoveryMessage} <button className={styles.textButton} onClick={() => window.location.reload()}>Reload this draft</button></p> : null}
        {sync.conflict ? <section className={styles.warning} role="alert"><h2>This draft changed on another device.</h2><p>Your pending changes are kept on this browser. Compare them with the latest saved draft before choosing what to keep.</p><details><summary>Your pending changes ({sync.pending.length})</summary><ul>{sync.pending.map(operation => <li key={operation.id}>{operationLabel(operation)}</li>)}</ul></details><div className={styles.actions}><button className={styles.secondary} disabled={sync.busy} onClick={() => setDecision('latest')}>Use latest saved version</button><button className={styles.secondary} disabled={sync.busy} onClick={() => setDecision('mine')}>Apply my pending changes</button></div></section> : null}
        {sync.error && !sync.conflict ? <p className={styles.warning} role="alert">{sync.error} <button className={styles.textButton} disabled={sync.busy || !sync.connected} onClick={() => { void sync.retry(); }}><RefreshCw size={15} />Retry sync</button></p> : null}
        <nav className={styles.steps} aria-label="Business setup steps">{STEPS.map((item, index) => <button key={item.id} type="button" disabled={locked} aria-current={step === item.id ? 'step' : undefined} onClick={() => { void go(item.id); }}><span>{index + 1}</span>{item.label}</button>)}</nav>
        {notice ? <p className={styles.warning} role="alert">{notice}</p> : null}
        {step === 'details' ? <section className={styles.card}><p className={styles.eyebrow}>YOUR BUSINESS</p><h2>Keep the details together.</h2><p>These are the details for this business setup.</p><div className={styles.fields}>
            <Field label="Business name" required><Input value={view.businessName} maxLength={120} disabled={locked} onChange={event => update({ kind: 'details', patch: { businessName: event.target.value } })} /></Field>
            <Field label="Business type" required><Select value={view.businessType} disabled={locked} onChange={event => { update({ kind: 'details', patch: { businessType: event.target.value, shotListKey: shotsForType[event.target.value] } }); setNotice('Your saved photos and answers are kept. Check that they still fit this business type.'); }}>{BUSINESS_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</Select></Field>
            <Field label="Shop address" help="Street, building or landmark."><Input value={view.address} maxLength={300} disabled={locked} onChange={event => update({ kind: 'details', patch: { address: event.target.value } })} /></Field>
            <Field label="City or municipality"><Input value={view.city} maxLength={120} disabled={locked} onChange={event => update({ kind: 'details', patch: { city: event.target.value } })} /></Field>
            <Field label="Contact number for this business"><Input type="tel" value={view.ownerPhone} maxLength={40} disabled={locked} onChange={event => update({ kind: 'details', patch: { ownerPhone: event.target.value } })} /></Field>
            <Field label="Interview language"><Select value={view.draftProgress?.lang ?? 'en'} disabled={locked} onChange={event => update({ kind: 'progress', progress: { ...view.draftProgress, step: 'details', lang: event.target.value as 'en' | 'tl' } })}><option value="en">English</option><option value="tl">Tagalog</option></Select></Field>
        </div><fieldset className={styles.choices} disabled={locked}><legend>Who holds the phone when recording?</legend>{(['self', 'friend'] as const).map(how => <label key={how}><input type="radio" name="how" checked={view.draftProgress?.how === how} onChange={() => update({ kind: 'progress', progress: { ...view.draftProgress, step: 'details', how } })} />{how === 'self' ? 'By myself' : 'With a friend'}</label>)}</fieldset>
            <details className={styles.map}><summary>Shop location on the map</summary><MapPicker address={[view.address, view.city, 'Philippines'].filter(Boolean).join(', ')} value={view.coordinates} disabled={locked} onChange={coordinates => { if (coordinates) update({ kind: 'details', patch: { coordinates } }); }} /></details>
        </section> : null}
        {step === 'interview' ? <section className={styles.card}><p className={styles.eyebrow}>YOUR STORY</p><h2>In your own words.</h2><p>Your phone recordings stay attached when you edit text here. Answer with text, a recording, or both.</p><div className={styles.questions}>{OWNER_APP_QUESTIONS.map((question, index) => {
            const value = answers.find(item => item.index === index);
            const pendingRecording = sync.pending.find(item => item.kind === 'recording' && item.index === index);
            return <article key={index} id={`draft-question-${index}`} className={styles.question}><Field label={`${index < 10 ? `${index + 1}. ` : ''}${question[view.draftProgress?.lang ?? 'en']}${index === 10 ? ' (optional)' : ''}`} required={index < 10}><Textarea maxLength={2000} rows={3} value={value?.answerText ?? ''} disabled={locked} onFocus={() => update({ kind: 'progress', progress: { ...view.draftProgress, step: 'interview', questionIndex: index } })} onChange={event => update({ kind: 'answer', index, text: event.target.value, lang: view.draftProgress?.lang ?? 'en' })} /></Field>
                {value?.mediaUrl ? value.mediaType === 'video' ? <video className={styles.recording} controls preload="metadata" src={value.mediaUrl} aria-label={`Saved recording for question ${index + 1}`} /> : <audio controls preload="metadata" src={value.mediaUrl} aria-label={`Saved recording for question ${index + 1}`} /> : null}
                {pendingRecording ? <p className={styles.pending}>Recording waiting to sync. Its original stays on this browser.</p> : null}
                <label className={styles.upload}>{value?.mediaUrl ? 'Replace recording' : 'Add a recording'}<input type="file" accept="audio/*,video/*" disabled={locked} onChange={event => file(event, index, false, question.en, 'recording')} /></label>
            </article>;
        })}</div></section> : null}
        {step === 'photos' ? <section className={styles.card}><p className={styles.eyebrow}>SHOW US THE SHOP</p><h2>Your photos, ready on either device.</h2><p>At least 3 photos are needed. Photos still uploading on your phone appear here after that device finishes syncing.</p><div className={styles.photoGrid}>{suggestions.map((task, index) => {
            const saved = photos.find(item => item.index === index && !item.extra), operation = sync.pending.find(item => item.kind === 'photo' && item.index === index && !item.extra);
            return <PhotoSlot key={`shot:${index}`} id={`draft-photo-${index}`} label={saved?.label || task.t} hint={task.h} url={saved?.url} pending={operation?.kind === 'photo' ? operation.file : undefined} disabled={locked} onPreview={saved ? () => setPreviewPhoto(saved.url) : undefined} onFile={event => file(event, index, false, task.t)} onRemove={saved ? () => setRemove({ index, extra: false, label: saved.label || task.t }) : undefined} />;
        })}{Array.from({ length: 10 }, (_, index) => {
            const saved = photos.find(item => item.index === index && item.extra), operation = sync.pending.find(item => item.kind === 'photo' && item.index === index && item.extra);
            if (!saved && !operation && index > 0 && !photos.some(item => item.extra && item.index === index - 1)) return null;
            return <PhotoSlot key={`extra:${index}`} label={saved?.label || 'Extra shop photo'} hint="Something else you want on the site." url={saved?.url} pending={operation?.kind === 'photo' ? operation.file : undefined} disabled={locked} onPreview={saved ? () => setPreviewPhoto(saved.url) : undefined} onFile={event => file(event, index, true, saved?.label || 'Extra shop photo')} onRemove={saved ? () => setRemove({ index, extra: true, label: saved.label || 'Extra shop photo' }) : undefined} />;
        })}</div></section> : null}
        {step === 'design' ? <section className={styles.card}><p className={styles.eyebrow}>PICK A DESIGN</p><h2>Choose the look for your business.</h2><p>These previews use example content. Your website will use your own words and photos after you submit.</p>{view.templateId && !validDesign ? <p className={styles.warning}>Your previous selection is kept, but it belongs to another business type. Pick a matching design before submitting.</p> : null}<div className={styles.designs}>{designs.map(item => <article className={styles.designCard} key={item.code}><button className={styles.designPreview} onClick={() => setPreviewDesign(item.preview)} aria-label={`Preview ${item.label}`}><iframe src={item.preview} title={`${item.label} sample thumbnail`} tabIndex={-1} loading="lazy" sandbox="" /><span>Preview design</span></button><h3>{item.label}</h3><p>{item.tagline}</p><button className={view.templateId === item.code ? styles.selected : styles.secondary} disabled={locked || view.templateId === item.code} aria-pressed={view.templateId === item.code} onClick={() => update({ kind: 'design', templateId: item.code })}>{view.templateId === item.code ? <><Check size={17} />Selected</> : 'Choose this design'}</button></article>)}</div></section> : null}
        {step === 'review' ? <section className={styles.card}><p className={styles.eyebrow}>LAST LOOK</p><h2>Check it, then send.</h2><p>Your setup stays a draft until you send it.</p><dl className={styles.review}><div><dt>Business</dt><dd>{view.businessName}<small>{view.businessType}</small></dd></div><div><dt>Location</dt><dd>{view.address || 'Map pin added'}{view.city ? `, ${view.city}` : ''}</dd></div><div><dt>Interview</dt><dd>{answers.filter(item => item.index < 10 && (item.answerText?.trim() || item.mediaUrl)).length} of 10 answered</dd></div><div><dt>Photos</dt><dd>{photos.length} saved photos</dd></div><div><dt>Design</dt><dd>{savedDesign?.label ?? view.templateId ?? 'Choose a design'}</dd></div></dl><div className={styles.reviewPhotos}>{photos.map(item => <button key={`${item.extra}:${item.index}`} onClick={() => setPreviewPhoto(item.url)} aria-label={`View ${item.label || 'shop photo'}`}><img src={item.url} alt={item.label || 'Saved shop photo'} /></button>)}</div><p className={styles.note}><MessageSquare size={20} />After submission, use Ask for a change for website updates. Your draft selection does not edit a published website.</p><button className={styles.primary} disabled={!canSend || sending} onClick={() => setDecision('submit')}>{sending ? 'Sending…' : 'Send for review'}<ArrowRight size={17} /></button>{!canSend ? <p className={styles.pending}>Finish the required details and wait for all changes to sync before sending.</p> : null}</section> : null}
        <div className={styles.footer}><button className={styles.secondary} disabled={locked || step === 'details'} onClick={() => { const previous = STEPS[STEPS.findIndex(item => item.id === step) - 1]; if (previous) void go(previous.id); }}><ArrowLeft size={16} />Back</button>{step !== 'review' ? <button className={styles.primary} disabled={locked || !sync.connected || sync.busy} onClick={() => { const next = STEPS[STEPS.findIndex(item => item.id === step) + 1]; if (next) void go(next.id); }}>{moving ? 'Saving…' : 'Save and continue'}<ArrowRight size={17} /></button> : null}</div>
        <ConfirmDialog open={decision !== null} title={decision === 'submit' ? 'Send this business for review?' : decision === 'mine' ? 'Apply your pending changes?' : 'Use the latest saved version?'} confirmLabel={decision === 'submit' ? 'Send for review' : decision === 'mine' ? 'Apply pending changes' : 'Use latest saved version'} cancelLabel="Keep reviewing" busy={sending || sync.busy} onCancel={() => { if (!sending && !sync.busy) setDecision(null); }} onConfirm={() => { void (async () => { if (decision === 'submit') { setSending(true); if (await sync.send() && scope.isCurrent()) router.replace(`/my-business/${draft.submissionId}`); if (scope.isCurrent()) { setSending(false); setDecision(null); } } else { await sync.resolveConflict(decision === 'mine'); if (scope.isCurrent()) setDecision(null); } })(); }}><p>{decision === 'submit' ? 'We’ll use your synced photos, interview and selected design to prepare your website. You can check the private preview before paying.' : decision === 'mine' ? 'Only your listed pending changes will replace the corresponding fields or files in the latest draft. Other saved answers and photos stay.' : 'Your pending changes and pending files on this browser will be removed. The latest account version stays unchanged.'}</p></ConfirmDialog>
        <ConfirmDialog open={remove !== null} title={`Remove ${remove?.label ?? 'this photo'}?`} confirmLabel="Remove photo" cancelLabel="Keep photo" onCancel={() => setRemove(null)} onConfirm={() => { if (remove) update({ kind: 'remove-photo', index: remove.index, extra: remove.extra }); setRemove(null); }}><p>This removes the photo from this business draft on both mobile and web.</p></ConfirmDialog>
        {previewPhoto || previewDesign ? <MediaPreview photo={previewPhoto} design={previewDesign} onClose={() => { setPreviewPhoto(null); setPreviewDesign(null); }} /> : null}
    </div>;
}

function PhotoSlot({ id, label, hint, url, pending, disabled, onFile, onPreview, onRemove }: { id?: string; label: string; hint: string; url?: string; pending?: Blob; disabled: boolean; onFile: (event: ChangeEvent<HTMLInputElement>) => void; onPreview?: () => void; onRemove?: () => void }) {
    return <article id={id} className={styles.photoCard}><button type="button" className={styles.photo} disabled={!onPreview} onClick={onPreview} aria-label={`View ${label}`}>{pending ? <PendingPhoto file={pending} label={label} /> : url ? <img src={url} alt={label} /> : <FileImage size={32} />}{pending ? <span>Waiting to sync</span> : null}</button><h3>{label}</h3><p>{hint}</p><div className={styles.photoActions}><label className={styles.upload}>{url ? 'Replace' : 'Add photo'}<input disabled={disabled} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} /></label>{onRemove ? <button className={styles.textButton} disabled={disabled} onClick={onRemove}>Remove</button> : null}</div></article>;
}
function PendingPhoto({ file, label }: { file: Blob; label: string }) {
    const image = useRef<HTMLImageElement>(null);
    useEffect(() => { const value = URL.createObjectURL(file); const element = image.current; if (element) element.src = value; return () => { URL.revokeObjectURL(value); }; }, [file]);
    return <img ref={image} alt={label} />;
}
function MediaPreview({ photo, design, onClose }: { photo: string | null; design: string | null; onClose: () => void }) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => { dialog?.close(); }; }, []);
    return <dialog ref={ref} className={styles.mediaDialog} onCancel={event => { event.preventDefault(); onClose(); }} aria-label={photo ? 'Shop photo preview' : 'Sample design preview'}><div className={styles.mediaHead}><strong>{photo ? 'Your shop photo' : 'Sample design · example content'}</strong><button aria-label="Close preview" onClick={onClose}><X size={22} /></button></div>{photo ? <img src={photo} alt="Saved shop photo, full size" /> : <iframe src={design!} sandbox="allow-scripts" title="Full sample design" />}</dialog>;
}
function overlayDraft(draft: SharedDraft, operations: OwnerDraftOperation[]): SharedDraft {
    let result = { ...draft, interview: [...draft.interview], shots: [...draft.shots] };
    for (const operation of operations) {
        switch (operation.kind) {
            case 'details': result = { ...result, ...operation.patch }; break;
            case 'answer': { const existing = result.interview.find(item => item.index === operation.index); result.interview = [...result.interview.filter(item => item.index !== operation.index), { ...OWNER_APP_QUESTIONS[operation.index], questionEn: OWNER_APP_QUESTIONS[operation.index].en, questionTl: OWNER_APP_QUESTIONS[operation.index].tl, ...existing, mediaType: existing?.mediaType, index: operation.index, lang: operation.lang, answerText: operation.text, updatedAt: existing?.updatedAt ?? 0 }]; break; }
            case 'design': result.templateId = operation.templateId; result.templateIds = [operation.templateId]; break;
            case 'progress': result.draftProgress = { ...result.draftProgress, ...operation.progress }; break;
            case 'remove-photo': result.shots = result.shots.filter(item => item.index !== operation.index || item.extra !== operation.extra); break;
            case 'photo': if (operation.publicUrl) result.shots = [...result.shots.filter(item => item.index !== operation.index || item.extra !== operation.extra), { index: operation.index, extra: operation.extra, url: operation.publicUrl, label: operation.label, updatedAt: 0 }]; break;
        }
    }
    return result;
}
function operationLabel(operation: OwnerDraftOperation) {
    switch (operation.kind) { case 'answer': return `Question ${operation.index + 1}: ${operation.text || 'Clear typed answer'}`; case 'details': return `Business details: ${Object.entries(operation.patch).map(([key, value]) => `${key}: ${typeof value === 'object' ? 'Map pin' : value}`).join(', ')}`; case 'progress': return `Resume at ${operation.progress.step}`; case 'design': return `Selected design: ${templateByCode(operation.templateId)?.label || operation.templateId}`; case 'remove-photo': return `Remove ${operation.extra ? 'extra photo' : 'guided photo'} ${operation.index + 1}`; default: return `${operation.kind === 'photo' ? 'Photo' : 'Recording'}: ${operation.label || operation.name}`; }
}

export function NewOwnerDraftPage() {
    return <OwnerShell><OwnerPageHeader title="Add your business." subtitle="Start here, then continue on mobile or web with the same owner account." back /><OwnerSectionBoundary label="New business"><NewDraftAccess /></OwnerSectionBoundary></OwnerShell>;
}
function NewDraftAccess() {
    const scope = useOwnerWebScope();
    if (scope.error) return <p role="alert">{scope.error}</p>;
    if (!scope.isSignedIn && !scope.loading) return <SignIn returnTo="/my-business/drafts/new" />;
    if (!scope.ready) return <p role="status">Opening your owner account…</p>;
    return <NewDraftForm key={scope.scopeKey} scope={scope} />;
}
function NewDraftForm({ scope }: { scope: ReturnType<typeof useOwnerWebScope> }) {
    const router = useRouter(), create = useMutation(api.ownerApp.createDraft);
    const [name, setName] = useState(''), [type, setType] = useState<string>('Other'), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const key = useRef<string | null>(null), locked = useRef(false);
    const [restored, setRestored] = useState(false), [attempted, setAttempted] = useState(false);
    const cacheKey = `tendso-owner-new-business:${encodeURIComponent(scope.userId!)}`;
    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(cacheKey) ?? 'null');
            if (saved && typeof saved.key === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(saved.key)
                && typeof saved.name === 'string' && saved.name.trim() && (BUSINESS_TYPES as readonly string[]).includes(saved.type)) {
                key.current = saved.key; setName(saved.name); setType(saved.type); setAttempted(true);
            }
        } catch { /* A new form still works when local storage is unavailable. */ }
        setRestored(true);
    }, [cacheKey]);
    const openDrafts = scope.sites?.filter(site => site.contentSource === 'owner_app' && site.status === 'draft').length ?? 0;
    const submit = async (event: FormEvent) => {
        event.preventDefault(); if (locked.current || !restored || !scope.isCurrent() || !name.trim() || openDrafts >= 3 && !key.current) return;
        locked.current = true; setBusy(true); setError('');
        try {
            if (!key.current) key.current = crypto.randomUUID();
            setAttempted(true);
            try { localStorage.setItem(cacheKey, JSON.stringify({ key: key.current, name: name.trim(), type })); } catch { /* Server retries still share the current key. */ }
            const id = await create({ businessName: name.trim(), businessType: type, shotListKey: shotsForType[type], clientDraftKey: key.current, actorClerkId: scope.userId! });
            if (scope.isCurrent()) { try { localStorage.removeItem(cacheKey); } catch { /* Idempotent recovery remains safe. */ } router.replace(`/my-business/drafts/${id}`); }
        } catch (cause) { if (scope.isCurrent()) setError(ownerDraftError(cause)); }
        finally { locked.current = false; if (scope.isCurrent()) setBusy(false); }
    };
    return <form className={styles.newForm} onSubmit={event => { void submit(event); }}><div className={styles.icon}><Smartphone size={28} /></div><h2>One draft, on either device.</h2><p>Photos, interview answers and your design are saved to this business. Use the same owner account in the Tendso app to pick up where you left off.</p><Field label="Business name" required><Input value={name} onChange={event => setName(event.target.value)} maxLength={120} disabled={busy || attempted || !restored} autoComplete="organization" /></Field><Field label="Business type" required><Select value={type} onChange={event => setType(event.target.value)} disabled={busy || attempted || !restored}>{BUSINESS_TYPES.map(item => <option key={item}>{item}</option>)}</Select></Field>{error ? <p role="alert" className={styles.warning}>{error}</p> : null}{attempted ? <p className={styles.pending}>Retrying opens this same saved business without creating a duplicate.</p> : null}{openDrafts >= 3 && !attempted ? <p className={styles.warning}>You have three open drafts. Continue one before adding another business.</p> : null}<Button type="submit" variant="primary" disabled={busy || !restored || !name.trim() || openDrafts >= 3 && !attempted}>{busy ? 'Saving your business…' : attempted ? 'Continue saved business' : 'Start business setup'}<ArrowRight size={17} /></Button></form>;
}
