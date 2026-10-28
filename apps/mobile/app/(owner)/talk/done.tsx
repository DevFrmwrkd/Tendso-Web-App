import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Banner, Button, Card, ProgressBar, ScreenShell, Text } from '../../../components/v2';
import { OwnerMediaPreview } from '../../../components/v2/owner/OwnerMediaPreview';
import { formatClock } from '../../../components/v2/capture/level';
import { EXTRA_QUESTION, INTERVIEW_QUESTIONS } from '../../../lib/v2/captureContent';
import { useOwnerSubmission } from '../../../lib/v2/ownerData';
import { useOwnerIntake } from '../../../lib/v2/ownerIntake';
import { ownerAnswersFor } from '../../../lib/v2/ownerMedia';
import { firstMissingAnswer, STEP_ROUTE } from '../../../lib/v2/ownerFlow';
import { uploadQueue, useUploadQueue } from '../../../lib/v2/uploadQueue';
import { firstName } from '../../../lib/v2/useOwnerSite';
import { useOwnerScope } from '../../../lib/v2/useOwnerScope';
import type { InterviewAnswer } from '../../../lib/v2/ownerTypes';
import { colors, space } from '../../../theme/v2';

export default function TalkDone() {
  const scope = useOwnerScope();
  return <AnswerSummary key={scope.scopeKey} scope={scope} />;
}
function AnswerSummary({ scope }: { scope: ReturnType<typeof useOwnerScope> }) {
  const router = useRouter();
  const intake = useOwnerIntake();
  const sub = useOwnerSubmission(scope.id);
  const answers = ownerAnswersFor(scope.id, sub, intake);
  const q = useUploadQueue();
  const [preview, setPreview] = useState<InterviewAnswer | null>(null);
  const readOnly = !!scope.site && scope.site.phase !== 'draft';
  const complete = firstMissingAnswer(answers.map(answer => answer.index)) >= 10;
  const regular = answers.filter(answer => answer.index < 10).length;
  const duration = answers.reduce((sum, answer) => sum + (answer.durationSec ?? 0), 0);
  const name = firstName(scope.me);
  const redo = (index: number) => {
    if (!scope.isCurrent() || !scope.id || readOnly) return;
    setPreview(null);
    router.push({ pathname: '/(owner)/talk/record', params: { answer: String(index) } } as never);
  };
  return <ScreenShell title={name ? `Got it, ${name}.` : 'Your answers'} subtitle="Your own words help us build your site." progress={0.25}
    onBack={() => router.replace(STEP_ROUTE['talk-intro'] as never)} contentStyle={styles.content}
    footer={<>
      {!readOnly && q.failed > 0 ? <Button title="Retry saving answers" variant="ghost" onPress={() => uploadQueue.retry()} /> : null}
      <Button title={readOnly ? 'Back to my site' : complete ? 'Next: photos' : 'Finish your answers'}
        onPress={() => router.replace((readOnly ? '/(owner)/(tabs)/site' : complete ? STEP_ROUTE['photos-intro'] : STEP_ROUTE.talk) as never)} />
    </>}>
    <Card style={styles.summary}><View style={styles.tick}><Ionicons name="checkmark" size={26} color={colors.ink} /></View>
      <View style={styles.flex}><Text variant="heading">{regular} of 10 answers</Text>
        <Text tone="muted">{answers.some(answer => answer.index === 10) ? 'Extra answer saved' : 'Extra answer is optional'}{duration ? ` · ${formatClock(duration)}` : ''}</Text></View></Card>
    {!readOnly && q.pending > 0 ? <View style={styles.content}><Text tone="muted">Saving your answers…</Text>
      <ProgressBar value={q.total ? q.done / q.total : 0} label="Saving answers" /></View> : null}
    {!readOnly && q.failed > 0 ? <Banner tone="warn" body="Some answers have not uploaded. Your local recordings are kept on this phone." /> : null}
    {answers.map(answer => {
      const question = INTERVIEW_QUESTIONS[answer.index] ?? EXTRA_QUESTION;
      return <Card key={answer.index} style={styles.answer}>
        <Text weight="bold">{answer.index < 10 ? `${answer.index + 1}. ` : ''}{question.en}</Text>
        {answer.answerText?.trim() ? <Text tone="ink2" selectable>{answer.answerText}</Text>
          : <Text tone="muted">Recording saved{answer.durationSec ? ` · ${formatClock(answer.durationSec)}` : ''}</Text>}
        <View style={styles.actions}>
          {answer.mediaUrl ? <Pressable onPress={() => setPreview(answer)} accessibilityRole="button" accessibilityLabel={`Play answer ${answer.index + 1}`} style={styles.action}>
            <Ionicons name="play-circle-outline" size={24} color={colors.ink} /><Text weight="bold">Play</Text></Pressable> : null}
          {!readOnly ? <Pressable onPress={() => redo(answer.index)} accessibilityRole="button" accessibilityLabel={`Redo answer ${answer.index + 1}`} style={styles.action}>
            <Ionicons name="refresh-outline" size={22} color={colors.ink} /><Text weight="bold">Redo answer</Text></Pressable> : null}
        </View>
      </Card>;
    })}
    {preview?.mediaUrl ? <OwnerMediaPreview key={`${preview.index}:${preview.mediaUrl}`} uri={preview.mediaUrl} kind={preview.mediaType ?? 'audio'}
      label={(INTERVIEW_QUESTIONS[preview.index] ?? EXTRA_QUESTION).en} onClose={() => setPreview(null)} /> : null}
  </ScreenShell>;
}
const styles = StyleSheet.create({ content: { gap: space.md }, summary: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  flex: { flex: 1, minWidth: 0 }, tick: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  answer: { gap: space.sm }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  action: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm } });
