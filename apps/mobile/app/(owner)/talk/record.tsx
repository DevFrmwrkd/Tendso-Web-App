import React, { useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { InterviewCam, type InterviewClip } from '../../../components/v2/capture';
import { Button, Loading, ScreenShell } from '../../../components/v2';
import { useOwnerSubmission } from '../../../lib/v2/ownerData';
import { ownerIntake, useOwnerIntake } from '../../../lib/v2/ownerIntake';
import { ownerAnswersFor } from '../../../lib/v2/ownerMedia';
import { firstMissingAnswer, STEP_ROUTE } from '../../../lib/v2/ownerFlow';
import { useOwnerUploads } from '../../../lib/v2/ownerUploads';
import { useOwnerScope } from '../../../lib/v2/useOwnerScope';

export default function TalkRecord() {
  const scope = useOwnerScope();
  const { answer } = useLocalSearchParams<{ answer?: string }>();
  const parsed = typeof answer === 'string' && /^\d+$/.test(answer) ? Number(answer) : -1;
  const redo = parsed >= 0 && parsed <= 10 ? parsed : null;
  return <OwnerRecorder key={`${scope.scopeKey}:${redo ?? 'all'}`} scope={scope} redo={redo} />;
}
function OwnerRecorder({ scope, redo }: { scope: ReturnType<typeof useOwnerScope>; redo: number | null }) {
  const router = useRouter();
  const intake = useOwnerIntake();
  const sub = useOwnerSubmission(scope.id);
  const { remember } = useOwnerUploads();
  const onClip = useCallback((clip: InterviewClip) => {
    if (!scope.id || !scope.isDraftCurrent() || (redo !== null && clip.index !== redo)) return;
    remember({ kind: 'answer', submissionId: scope.id, index: clip.index, uri: clip.uri, mediaType: clip.kind, lang: clip.lang, durationSec: clip.durationSec });
  }, [scope.id, scope.isDraftCurrent, remember, redo]);
  if (scope.site && scope.site.phase !== 'draft') return <ScreenShell title="Your interview is saved"
    subtitle="Ask the team for a change to your website." footer={<Button title="View my site" onPress={() => router.replace('/(owner)/(tabs)/site' as never)} />} />;
  if (!scope.id || sub === undefined || sub.submissionId !== scope.id) return <Loading />;
  const startAt = redo ?? firstMissingAnswer(ownerAnswersFor(scope.id, sub, intake).map(answer => answer.index));
  return <InterviewCam recording="perQuestion" startAt={startAt} stopAfterQuestion={redo ?? undefined}
    facing={intake.how === 'friend' ? 'back' : 'front'} audioOnly={!!intake.audioOnly} lang={intake.lang ?? 'en'} onClip={onClip}
    onFinish={result => {
      if (!scope.isDraftCurrent()) return;
      ownerIntake.set({ lang: result.lang }); router.replace(STEP_ROUTE['talk-done'] as never);
    }} onClose={() => { if (scope.isCurrent()) router.back(); }} />;
}
