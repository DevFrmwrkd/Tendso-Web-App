import React, { useCallback, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { TRAINING_LESSONS, readLessonsDone } from '../../lib/trainingLessons';
import { colors, radius, space } from '../../theme/v2';
import { Button, Card, CheckRow, ProgressBar, ScreenShell, Text, type CheckState } from '../../components/v2';

const OVERVIEW_PHOTO = require('../../assets/training/overview.jpg'); // eslint-disable-line @typescript-eslint/no-require-imports

export default function TrainingIntroScreen() {
  const router = useGuardedRouter();
  const { userId } = useAuth();
  const [done, setDone] = useState(0);

  // Re-read on every focus so the bar is right after coming back from a lesson.
  useFocusEffect(
    useCallback(() => {
      let live = true;
      void readLessonsDone(userId).then((n) => {
        if (live) setDone(n);
      });
      return () => {
        live = false;
      };
    }, [userId])
  );

  const total = TRAINING_LESSONS.length;
  const finished = done >= total;

  const openLesson = (index: number) => {
    router.push({ pathname: '/(app)/training-lessons', params: { lesson: String(index) } } as any);
  };

  const primaryTitle = done === 0 ? 'Start training' : finished ? 'Take the quiz' : `Continue lesson ${done + 1}`;
  const onPrimary = () => {
    if (finished) router.push('/(app)/certification-quiz' as any);
    else openLesson(done);
  };

  return (
    <ScreenShell
      title="Training"
      onBack={router.canGoBack() ? () => router.back() : undefined}
      footer={<Button title={primaryTitle} onPress={onPrimary} />}
    >
      <Card style={styles.hero}>
        <View style={styles.heroClip}>
          <Image source={OVERVIEW_PHOTO} style={styles.heroImg} resizeMode="cover" accessibilityIgnoresInvertColors />
          <View style={styles.heroBody}>
            <View style={styles.heroTop}>
              <Text variant="heading" style={styles.flex}>
                Become a certified agent
              </Text>
              <Text variant="label" weight="bold" tone="muted">
                {done} of {total}
              </Text>
            </View>
            <ProgressBar value={done / total} tone="accent" label="Training progress" />
            <Text variant="label" weight="medium" tone="muted">
              Then a 5-question quiz. Pass with 4.
            </Text>
          </View>
        </View>
      </Card>

      <View style={styles.list}>
        {TRAINING_LESSONS.map((lesson, i) => {
          const state: CheckState = i < done ? 'ok' : i === done && !finished ? 'now' : 'todo';
          return (
            <CheckRow
              key={lesson.id}
              title={lesson.title}
              subtitle={`${lesson.minutes} min${state === 'now' ? ' · next' : ''}`}
              state={state}
              onPress={() => openLesson(i)}
              right={state === 'now' ? <Ionicons name="chevron-forward" size={22} color={colors.ink} /> : undefined}
            />
          );
        })}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { padding: 0, borderRadius: radius.cardLg },
  heroClip: { overflow: 'hidden', borderRadius: radius.cardLg },
  heroImg: { width: '100%', height: 150 },
  heroBody: { padding: space.lg, gap: space.sm },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  list: { gap: space.sm, marginTop: space.lg },
});
