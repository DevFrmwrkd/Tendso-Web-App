/** Persist the work, not closures: rebuild uploads after the app process exits. */
import { useCallback } from 'react';
import { ownerIntake, type OwnerUpload } from './ownerIntake';
import { useSaveAnswer, useSaveShot, useUploadFile, type UploadSpec } from './ownerData';
import type { OwnerSubmission, SaveAnswerArgs, SaveShotArgs, SubmissionId } from './ownerTypes';
import { uploadQueue } from './uploadQueue';

type Uploads = {
  upload: (uri: string, spec: UploadSpec) => Promise<string>;
  saveShot: (args: SaveShotArgs) => Promise<unknown>;
  saveAnswer: (args: SaveAnswerArgs) => Promise<unknown>;
};

export function uploadSlot(u: OwnerUpload): string {
  return `${u.submissionId}:${u.kind === 'photo' ? (u.extra ? 'extra' : 'shot') : 'answer'}:${u.index}`;
}

function current(u: OwnerUpload, scope = ownerIntake.scope()) {
  if (!ownerIntake.isCurrent(scope) || ownerIntake.get().submissionId !== u.submissionId) return undefined;
  return ownerIntake.get().uploads?.find((v) => uploadSlot(v) === uploadSlot(u) && v.uri === u.uri);
}

function patchCurrent(u: OwnerUpload, patch: Partial<Pick<OwnerUpload, 'uploadedUrl' | 'saved'>>, scope = ownerIntake.scope()) {
  const uploads = ownerIntake.get().uploads ?? [];
  if (!current(u, scope)) return;
  ownerIntake.set({ uploads: uploads.map((v) => uploadSlot(v) === uploadSlot(u) && v.uri === u.uri ? { ...v, ...patch } : v) });
}

function schedule(u: OwnerUpload, io: Uploads) {
  if (u.saved) return;
  const scope = ownerIntake.scope();
  uploadQueue.ensure(`${uploadSlot(u)}:${u.uri}`, u.kind === 'answer' ? `Answer ${u.index + 1}` : u.label ?? 'Photo', async () => {
    await ownerIntake.flush();
    let entry = current(u, scope);
    if (!entry || entry.saved) return; // retaken or signed out while queued
    const video = entry.kind === 'answer' && entry.mediaType === 'video';
    const url = entry.uploadedUrl ?? await io.upload(entry.uri, entry.kind === 'photo'
      ? { folder: 'images', contentType: 'image/jpeg', filename: `owner-${entry.extra ? 'extra' : 'shot'}-${entry.index}.jpg` }
      : { folder: video ? 'videos' : 'audio', contentType: video ? 'video/mp4' : 'audio/m4a', filename: `owner-answer-${entry.index + 1}.${video ? 'mp4' : 'm4a'}` });
    if (!current(u, scope)) return;
    // If saving the answer/shot fails, retries reuse the successful R2 upload.
    patchCurrent(u, { uploadedUrl: url }, scope);
    await ownerIntake.flush();
    entry = current(u, scope);
    if (!entry) return;
    if (entry.kind === 'photo') {
      await io.saveShot({ submissionId: entry.submissionId, index: entry.index, extra: entry.extra, label: entry.label, url });
    } else {
      await io.saveAnswer({ submissionId: entry.submissionId, index: entry.index, lang: entry.lang, mediaUrl: url, mediaType: entry.mediaType, durationSec: entry.durationSec });
    }
    patchCurrent(u, { saved: true }, scope);
    await ownerIntake.flush();
  });
}

export function rememberOwnerUpload(u: OwnerUpload, io: Uploads) {
  if (ownerIntake.get().submissionId !== u.submissionId) return;
  const uploads = ownerIntake.get().uploads ?? [];
  const previous = uploads.find((v) => uploadSlot(v) === uploadSlot(u));
  if (previous) uploadQueue.cancel(`${uploadSlot(previous)}:${previous.uri}`);
  const shots = u.kind === 'photo' && !u.extra ? [...(ownerIntake.get().shots ?? [])] : undefined;
  if (shots) shots[u.index] = u.uri;
  ownerIntake.set({
    uploads: [...uploads.filter((v) => uploadSlot(v) !== uploadSlot(u)), u],
    ...(shots ? { shots } : {}),
  });
  schedule(u, io);
}

/** Called on resume and again before submit. The server upserts by slot, so an
 * interrupted acknowledgement never creates duplicate answers or photos. */
export async function resumeOwnerUploads(id: SubmissionId, sub: OwnerSubmission | undefined, io: Uploads) {
  const scope = ownerIntake.scope();
  await ownerIntake.load();
  if (!ownerIntake.isCurrent(scope) || (sub && (sub.submissionId !== id || sub.phase !== 'draft'))) return;
  const intake = ownerIntake.get();
  if (intake.submissionId !== id) return;
  // Migrate drafts captured before the upload journal was introduced.
  if (sub) {
    intake.shots?.forEach((uri, index) => {
      if (!uri || intake.uploads?.some((u) => u.submissionId === id && u.kind === 'photo' && !u.extra && u.index === index)) return;
      const saved = sub.shots.find((s) => !s.extra && s.index === index);
      rememberOwnerUpload({ kind: 'photo', submissionId: id, index, uri, extra: false, ...(saved ? { uploadedUrl: saved.url, saved: true } : {}) }, io);
    });
  }
  for (const u of ownerIntake.get().uploads ?? []) {
    if (u.submissionId !== id || u.saved) continue;
    const savedUrl = u.kind === 'photo'
      ? sub?.shots.find((s) => s.index === u.index && s.extra === u.extra)?.url
      : sub?.interview.find((a) => a.index === u.index)?.mediaUrl;
    if (u.uploadedUrl && savedUrl === u.uploadedUrl) patchCurrent(u, { saved: true });
    else schedule(u, io);
  }
  await ownerIntake.flush();
}

export function useOwnerUploads() {
  const upload = useUploadFile();
  const saveShot = useSaveShot();
  const saveAnswer = useSaveAnswer();
  const scope = ownerIntake.scope();
  const remember = useCallback((u: OwnerUpload) => {
    if (ownerIntake.isCurrent(scope)) rememberOwnerUpload(u, { upload, saveShot, saveAnswer });
  }, [upload, saveShot, saveAnswer, scope]);
  const resume = useCallback(async (id: SubmissionId, sub?: OwnerSubmission) => {
    if (ownerIntake.isCurrent(scope)) await resumeOwnerUploads(id, sub, { upload, saveShot, saveAnswer });
  }, [upload, saveShot, saveAnswer, scope]);
  return { remember, resume };
}
