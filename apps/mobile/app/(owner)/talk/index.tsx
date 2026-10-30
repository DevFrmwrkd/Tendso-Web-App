import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, ScreenShell, Text } from '../../../components/v2';
import { INTERVIEW_QUESTIONS } from '../../../lib/v2/captureContent';
import { useOwnerSubmission } from '../../../lib/v2/ownerData';
import { ownerIntake, useOwnerIntake } from '../../../lib/v2/ownerIntake';
import { ownerAnswersFor } from '../../../lib/v2/ownerMedia';
import { STEP_ROUTE } from '../../../lib/v2/ownerFlow';
import { useOwnerScope } from '../../../lib/v2/useOwnerScope';
import { colors, radius, space } from '../../../theme/v2';

export default function TalkIntro() {
  const scope = useOwnerScope();
  const router = useRouter();
  const intake = useOwnerIntake();
  const sub = useOwnerSubmission(scope.id);
  const answers = ownerAnswersFor(scope.id, sub, intake);
  const completed = new Set(answers.map(answer => answer.index));
  const readOnly = !!scope.site && scope.site.phase !== 'draft';
  const start = (audioOnly: boolean) => {
    if (!scope.isCurrent() || !scope.id || readOnly) return;
    ownerIntake.set({ audioOnly }); router.push(STEP_ROUTE.talk as never);
  };
  return <ScreenShell title="10 short questions" subtitle="Answer in English or Tagalog, one at a time." progress={0.25}
    onBack={() => router.back()} contentStyle={styles.content} footer={<>
      <Button title={completed.size >= 10 || readOnly ? 'Review your answers' : 'Start'} disabled={!scope.id}
        onPress={() => completed.size >= 10 || readOnly ? router.push(STEP_ROUTE['talk-done'] as never) : start(false)} />
      {!readOnly ? <Pressable onPress={() => start(true)} accessibilityRole="button" style={styles.voice}><Text weight="bold">Voice only, no video</Text></Pressable> : null}
    </>}>
    <Text variant="label" tone="muted">{Math.min(10, INTERVIEW_QUESTIONS.filter((_, index) => completed.has(index)).length)} of 10 answered</Text>
    <Card style={styles.list}>
      {INTERVIEW_QUESTIONS.map((question, index) => <View key={question.en} style={[styles.row, index > 0 && styles.rule]}>
        <View style={[styles.number, completed.has(index) && styles.done]}>
          {completed.has(index) ? <Ionicons name="checkmark" size={20} color={colors.ink} /> : <Text weight="bold">{index + 1}</Text>}
        </View><View style={styles.flex}><Text weight="bold">{question.en}</Text><Text tone="muted">{question.tl}</Text></View>
      </View>)}
    </Card>
    <Text tone="muted">Then add anything else you want customers to know.</Text>
  </ScreenShell>;
}
const styles = StyleSheet.create({ content: { gap: space.md }, flex: { flex: 1, minWidth: 0 }, list: { paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.lg }, rule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rule },
  number: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center' },
  done: { backgroundColor: colors.accent }, voice: { minHeight: 48, alignItems: 'center', justifyContent: 'center' } });
