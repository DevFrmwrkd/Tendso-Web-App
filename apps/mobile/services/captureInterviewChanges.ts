const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

/** A saved older interview must never hide a newer take left on this phone. */
export function captureInterviewNeedsSave(value: unknown, submissionId: string, pendingValue: unknown, savedValue?: unknown): boolean {
  const draft = record(value);
  if (draft?.submissionId !== submissionId || !text(draft.recordingUri)
    || !['video', 'audio'].includes(String(draft.type))) return false;
  const pending = record(pendingValue);
  if (pending?.submissionId === submissionId) {
    return draft.type !== pending.type || text(draft.recordingUri) !== text(pending.recordingUri)
      || (draft.type === 'video' && 'parallelAudioUri' in draft && text(draft.parallelAudioUri) !== text(pending.parallelAudioUri));
  }
  if (draft.attached !== true) return true;
  const primary = text(draft.storageId);
  const saved = record(savedValue);
  // Offline, a confirmed attachment with its uploaded key remains usable.
  // When a server/snapshot baseline exists, compare the actual attached media.
  if (!saved) return !primary;
  const video = draft.type === 'video';
  const primaryMatches = primary ? primary === text(video ? saved.videoStorageId : saved.audioStorageId)
    : text(draft.recordingUri) === text(video ? saved.videoUrl : saved.audioUrl);
  return !primaryMatches || (video && !!text(draft.parallelAudioUri)
    && (!text(draft.audioStorageId) || text(draft.audioStorageId) !== text(saved.audioStorageId)));
}
