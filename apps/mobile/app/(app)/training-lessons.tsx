import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { TRAINING_LESSONS, markLessonDone, readCompletedLessons } from '../../lib/trainingLessons';
import { space } from '../../theme/v2';
import { TrainingPhoto } from '../../components/TrainingPhoto';
import { Button, CheckRow, ScreenShell, SectionLabel, Text } from '../../components/v2';

export default function TrainingLessonsScreen() {
  const router = useGuardedRouter();
  const { userId } = useAuth();
  const { lesson } = useLocalSearchParams<{ lesson?: string }>();

  const last = TRAINING_LESSONS.length - 1;
  const parsed = parseInt(String(lesson ?? '0'), 10);
  const [index, setIndex] = useState(Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), last) : 0);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const current = TRAINING_LESSONS[index];
  const isLast = index === last;

  const handleBack = () => {
    active.current = false;
    // Pop to the existing overview, or replace a directly opened lesson when
    // there is no overview in history. Next never adds lesson history entries.
    router.dismissTo('/(app)/training');
  };

  const handleNext = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    try {
      await markLessonDone(userId, current.id);
      if (!active.current) return;
      if (isLast) {
        const completed = await readCompletedLessons(userId);
        if (!active.current) return;
        if (TRAINING_LESSONS.every((lesson) => completed.includes(lesson.id))) {
          router.replace('/(app)/certification-quiz');
        } else {
          handleBack();
        }
      } else {
        setIndex(index + 1);
      }
    } finally {
      inFlight.current = false;
      if (active.current) setSaving(false);
    }
  };

  return (
    // key: a new lesson starts at the top of the page.
    <ScreenShell
      key={current.id}
      onBack={handleBack}
      progress={(index + 1) / TRAINING_LESSONS.length}
      footer={<Button title={isLast ? 'Got it · finish lesson' : 'Got it · next lesson'} onPress={handleNext} loading={saving} disabled={saving} />}
      contentStyle={styles.body}
    >
      {current.examples ? (
        <View style={styles.examples}>
          {current.examples.map((example) => (
            <View key={example.id} style={styles.example}>
              <TrainingPhoto source={example.photo} label={example.title} description={example.description} height={140} cropPosition={example.cropPosition} />
              <Text variant="label" weight="bold">{example.title}</Text>
            </View>
          ))}
        </View>
      ) : (
        <TrainingPhoto source={current.photo} label={current.title} description={current.photoDescription} cropPosition={current.cropPosition} />
      )}

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
  examples: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  example: { flex: 1, minWidth: 0, gap: space.sm },
  head: { gap: space.xs },
  group: { gap: space.sm },
});
