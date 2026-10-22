/**
 * The interview on camera. Each answer is its own clip; it uploads (R2) and is saved
 * (ownerApp.saveAnswer) in the background while the owner answers the next one.
 */
import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { InterviewCam, type InterviewClip } from '../../../components/v2/capture';
import { useOwnerSubmission, useSaveAnswer, useUploadFile } from '../../../lib/v2/ownerData';
import { ownerIntake, useOwnerIntake } from '../../../lib/v2/ownerIntake';
import { firstMissingAnswer, STEP_ROUTE } from '../../../lib/v2/ownerFlow';
import { uploadQueue } from '../../../lib/v2/uploadQueue';
import { useOwnerSite } from '../../../lib/v2/useOwnerSite';

export default function TalkRecord() {
  const router = useRouter();
  const intake = useOwnerIntake();
  const { id } = useOwnerSite();
  const sub = useOwnerSubmission(id);
  const upload = useUploadFile();
  const saveAnswer = useSaveAnswer();

  const onClip = useCallback((clip: InterviewClip) => {
    if (!id) return;
    const video = clip.kind === 'video';
    uploadQueue.add(`answer-${clip.index}`, `Answer ${clip.index + 1}`, async () => {
      const url = await upload(clip.uri, {
        folder: video ? 'videos' : 'audio',
        contentType: video ? 'video/mp4' : 'audio/m4a',
        filename: `owner-answer-${clip.index + 1}.${video ? 'mp4' : 'm4a'}`,
      });
      await saveAnswer({ submissionId: id, index: clip.index, lang: clip.lang, mediaUrl: url, mediaType: clip.kind, durationSec: clip.durationSec });
    });
  }, [id, upload, saveAnswer]);

  if (sub === undefined) return null;
  const startAt = firstMissingAnswer((sub?.interview ?? []).filter((a) => a.mediaUrl || a.answerText?.trim()).map((a) => a.index));

  return (
    <InterviewCam
      recording="perQuestion"
      startAt={startAt}
      facing={intake.how === 'friend' ? 'back' : 'front'}
      audioOnly={!!intake.audioOnly}
      lang={intake.lang ?? 'en'}
      onClip={onClip}
      onFinish={(r) => {
        ownerIntake.set({ lang: r.lang });
        router.replace(STEP_ROUTE['talk-done'] as never);
      }}
      onClose={() => router.back()}
    />
  );
}
