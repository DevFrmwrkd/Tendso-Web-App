import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { TRAINING_LESSONS, saveLessonsDone } from '../../lib/trainingLessons';
import { radius, space } from '../../theme/v2';
import { Button, CheckRow, ScreenShell, SectionLabel, Text } from '../../components/v2';

export default function TrainingLessonsScreen() {
  const router = useGuardedRouter();
  const { userId } = useAuth();
  const { lesson } = useLocalSearchParams<{ lesson?: string }>();

  const last = TRAINING_LESSONS.length - 1;
  const parsed = parseInt(String(lesson ?? '0'), 10);
  const [index, setIndex] = useState(Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), last) : 0);

  const current = TRAINING_LESSONS[index];
  const isLast = index === last;

  const handleBack = () => {
    if (index > 0) setIndex(index - 1);
    else router.back();
  };

  const handleNext = async () => {
    await saveLessonsDone(userId, index + 1);
    if (isLast) {
      router.push('/(app)/certification-quiz' as any);
    } else {
      setIndex(index + 1);
    }
  };

  return (
    // key: a new lesson starts at the top of the page.
    <ScreenShell
      key={current.id}
      onBack={handleBack}
      progress={(index + 1) / TRAINING_LESSONS.length}
      footer={<Button title={isLast ? 'Start the quiz' : 'Got it · next lesson'} onPress={handleNext} />}
      contentStyle={styles.body}
    >
      <Image source={current.photo} style={styles.photo} resizeMode="cover" accessibilityIgnoresInvertColors />

      <View style={styles.head}>
        <Text variant="label" weight="semibold" tone="muted">
          Lesson {current.id} of {TRAINING_LESSONS.length} · {current.minutes} min
        </Text>
        <Text variant="display" accessibilityRole="header">
          {current.title}
        </Text>
        <Text variant="bodyLg" tone="ink2">
          {current.line}
        </Text>
      </View>

      <View style={styles.group}>
        <SectionLabel>Do</SectionLabel>
        {current.dos.map((tip) => (
          <CheckRow key={tip.title} title={tip.title} subtitle={tip.text} state="ok" />
        ))}
      </View>

      {current.donts.length > 0 ? (
        <View style={styles.group}>
          <SectionLabel>{"Don't"}</SectionLabel>
          {current.donts.map((tip) => (
            <CheckRow key={tip.title} title={tip.title} subtitle={tip.text} state="bad" />
          ))}
        </View>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg, paddingTop: space.lg },
  photo: { width: '100%', height: 190, borderRadius: radius.cardLg },
  head: { gap: space.xs },
  group: { gap: space.sm },
});
