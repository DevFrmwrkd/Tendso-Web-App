import React, { useCallback, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { TRAINING_LESSONS, readCompletedLessons } from '../../lib/trainingLessons';
import { colors, radius, shadow, space } from '../../theme/v2';
import { Button, Card, ListRow, ProgressBar, ScreenShell, Text } from '../../components/v2';

const OVERVIEW_PHOTO = require('../../assets/training/overview.jpg'); // eslint-disable-line @typescript-eslint/no-require-imports
const overviewAsset = Image.resolveAssetSource(OVERVIEW_PHOTO);
const overviewAspectRatio = overviewAsset?.width > 0 && overviewAsset?.height > 0 ? overviewAsset.width / overviewAsset.height : 3 / 2;

export default function TrainingIntroScreen() {
  const router = useGuardedRouter();
  const { userId } = useAuth();
  const [completed, setCompleted] = useState<number[]>([]);

  // Re-read on every focus so the bar is right after coming back from a lesson.
  useFocusEffect(
    useCallback(() => {
      let live = true;
      void readCompletedLessons(userId).then((ids) => {
        if (live) setCompleted(ids);
      });
      return () => {
        live = false;
      };
    }, [userId])
  );

  const total = TRAINING_LESSONS.length;
  const done = completed.length;
  const nextIndex = TRAINING_LESSONS.findIndex((lesson) => !completed.includes(lesson.id));
  const finished = nextIndex === -1;

  const openLesson = (index: number) => {
    router.push({ pathname: '/(app)/training-lessons', params: { lesson: String(index) } } as any);
  };

  const primaryTitle = done === 0 ? 'Start training' : finished ? 'Take the quiz' : `Continue lesson ${nextIndex + 1}`;
  const onPrimary = () => {
    if (finished) router.push('/(app)/certification-quiz' as any);
    else openLesson(nextIndex);
  };

  return (
    <ScreenShell
      title="Training"
      onBack={router.canGoBack() ? () => router.back() : undefined}
      footer={<Button title={primaryTitle} onPress={onPrimary} />}
    >
      <Card style={styles.hero}>
        <View style={styles.heroClip}>
          <Image source={OVERVIEW_PHOTO} style={[styles.heroImg, { aspectRatio: overviewAspectRatio }]} resizeMode="contain" accessibilityLabel="An instructor teaching a group of field agents." accessibilityIgnoresInvertColors />
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
          const isComplete = completed.includes(lesson.id);
          const isNext = i === nextIndex;
          const status = isComplete ? 'Completed' : isNext ? 'Next' : 'Not completed';
          return (
            <ListRow
              key={lesson.id}
              title={lesson.title}
              titleNumberOfLines={2}
              subtitle={`${lesson.minutes} min${isComplete ? ' · Completed' : isNext ? ' · Next' : ''}`}
              leading={(
                <View style={[styles.lessonNumber, isComplete ? styles.lessonDone : null]}>
                  {isComplete ? <Ionicons name="checkmark" size={22} color={colors.ink} /> : <Text variant="label" weight="bold">{lesson.id}</Text>}
                </View>
              )}
              accessibilityLabel={`Lesson ${lesson.id}: ${lesson.title}, ${status.toLowerCase()}, ${lesson.minutes} minutes`}
              accessibilityHint="Open lesson"
              onPress={() => openLesson(i)}
              style={[styles.lessonRow, isNext ? styles.nextLesson : null]}
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
  heroImg: { width: '100%' },
  heroBody: { padding: space.lg, gap: space.sm },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  list: { gap: space.sm, marginTop: space.lg },
  lessonRow: { backgroundColor: colors.card, paddingHorizontal: space.md, borderWidth: 2, borderColor: 'transparent', ...shadow.soft },
  nextLesson: { borderColor: colors.ink },
  lessonNumber: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg2 },
  lessonDone: { backgroundColor: colors.accent },
});
