import type { OwnerIntake } from './ownerIntake';
import type { InterviewAnswer, OwnerSubmission, SubmissionId } from './ownerTypes';

export type OwnerPhotoItem = { key: string; index: number; extra: boolean; uri: string; label: string };

/** Only this site's server media and matching local upload journal are merged. */
export function ownerPhotosFor(id: SubmissionId | null, sub: OwnerSubmission | undefined, intake: OwnerIntake): OwnerPhotoItem[] {
  if (!id) return [];
  const photos = new Map<string, OwnerPhotoItem>();
  const put = (index: number, extra: boolean, uri: string, label?: string) => {
    if (!uri) return;
    const key = `${extra ? 'extra' : 'shot'}:${index}`;
    photos.set(key, { key, index, extra, uri, label: label || (extra ? 'Your photo' : `Photo ${index + 1}`) });
  };
  if (sub?.submissionId === id) sub.shots.forEach(shot => put(shot.index, shot.extra, shot.url, shot.label));
  if (intake.submissionId === id) {
    intake.shots?.forEach((uri, index) => { if (uri) put(index, false, uri); });
    intake.uploads?.forEach(upload => {
      if (upload.kind === 'photo' && upload.submissionId === id) put(upload.index, upload.extra, upload.uri, upload.label);
    });
  }
  return [...photos.values()].sort((a, b) => Number(a.extra) - Number(b.extra) || a.index - b.index);
}

export function ownerAnswersFor(id: SubmissionId | null, sub: OwnerSubmission | undefined, intake: OwnerIntake): InterviewAnswer[] {
  if (!id) return [];
  const answers = new Map<number, InterviewAnswer>();
  if (sub?.submissionId === id) sub.interview.forEach(answer => answers.set(answer.index, answer));
  if (intake.submissionId === id) intake.uploads?.forEach(upload => {
    if (upload.kind !== 'answer' || upload.submissionId !== id) return;
    const existing = answers.get(upload.index);
    answers.set(upload.index, { ...existing, index: upload.index, questionEn: existing?.questionEn ?? '', questionTl: existing?.questionTl ?? '',
      lang: upload.lang, mediaUrl: upload.uri, mediaType: upload.mediaType, durationSec: upload.durationSec,
      // A new take has no transcript until that take has actually been transcribed.
      answerText: upload.uploadedUrl && existing?.mediaUrl === upload.uploadedUrl ? existing.answerText : undefined, updatedAt: existing?.updatedAt ?? 0 });
  });
  return [...answers.values()].filter(answer => !!answer.mediaUrl || !!answer.answerText?.trim()).sort((a, b) => a.index - b.index);
}
