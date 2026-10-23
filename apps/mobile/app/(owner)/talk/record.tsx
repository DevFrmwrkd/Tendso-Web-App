/**
 * The interview on camera. Each answer is its own clip; it uploads (R2) and is saved
 * (ownerApp.saveAnswer) in the background while the owner answers the next one.
 */
import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { InterviewCam, type InterviewClip } from '../../../components/v2/capture';
import { useOwnerSubmission } from '../../../lib/v2/ownerData';
import { ownerIntake, useOwnerIntake } from '../../../lib/v2/ownerIntake';
import { firstMissingAnswer, STEP_ROUTE } from '../../../lib/v2/ownerFlow';
import { useOwnerUploads } from '../../../lib/v2/ownerUploads';
import { useOwnerSite } from '../../../lib/v2/useOwnerSite';

export default function TalkRecord() {
  const router = useRouter();
  const intake = useOwnerIntake();
  const { id } = useOwnerSite();
  const sub = useOwnerSubmission(id);
  const { remember } = useOwnerUploads();

  const onClip = useCallback((clip: InterviewClip) => {
    if (!id) return;
    remember({ kind: 'answer', submissionId: id, index: clip.index, uri: clip.uri, mediaType: clip.kind, lang: clip.lang, durationSec: clip.durationSec });
  }, [id, remember]);

  if (sub === undefined) return null;
  const localAnswers = (intake.uploads ?? []).filter((u) => u.submissionId === id && u.kind === 'answer').map((u) => u.index);
  const startAt = firstMissingAnswer([...(sub?.interview ?? []).filter((a) => a.mediaUrl || a.answerText?.trim()).map((a) => a.index), ...localAnswers]);

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
