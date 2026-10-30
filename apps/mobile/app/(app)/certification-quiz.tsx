import React, { useState, useRef, useCallback } from 'react';
import { Animated, Alert, Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useAuth } from '@clerk/clerk-expo';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CertificateCard from '../../components/CertificateCard';
import { colors, radius, shadow, space } from '../../theme/v2';
import { Banner, Bubble, Button, Card, Chip, OptionRow, ProgressBar, ScreenShell, Text } from '../../components/v2';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface QuizOption {
  label: string;
  text: string;
}

interface QuizQuestion {
  id: number;
  category: string;
  question: string;
  options: QuizOption[];
  correctAnswer: string; // "A", "B", "C", or "D"
}

const QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    category: 'Lighting',
    question: 'Which photo has better lighting for a business owner portrait?',
    options: [
      { label: 'A', text: 'Subject standing with a bright window behind them' },
      { label: 'B', text: 'Subject facing the window so light falls on their face' },
      { label: 'C', text: 'Subject in a dark room with flash on' },
      { label: 'D', text: 'Subject standing under direct harsh sunlight' },
    ],
    correctAnswer: 'B',
  },
  {
    id: 2,
    category: 'Audio',
    question: 'Before starting the real interview, what should you always do first?',
    options: [
      { label: 'A', text: 'Start recording immediately to save time' },
      { label: 'B', text: 'Do a 10-second test clip and play it back' },
      { label: 'C', text: 'Ask the owner to speak as loudly as possible' },
      { label: 'D', text: 'Move to an outdoor area for natural sound' },
    ],
    correctAnswer: 'B',
  },
  {
    id: 3,
    category: 'Portrait',
    question: 'What is the correct way to frame the business owner in a portrait photo?',
    options: [
      { label: 'A', text: 'Full body shot from a distance' },
      { label: 'B', text: 'Head and shoulders, phone at eye level' },
      { label: 'C', text: 'Close-up of face only, shot from below' },
      { label: 'D', text: 'Side profile with the owner looking away' },
    ],
    correctAnswer: 'B',
  },
  {
    id: 4,
    category: 'Interview',
    question: 'What is the best way to help the owner feel comfortable before recording?',
    options: [
      { label: 'A', text: 'Give them a script to read word-for-word' },
      { label: 'B', text: 'Start recording without telling them' },
      { label: 'C', text: 'Chat with them for 2 minutes before pressing record' },
      { label: 'D', text: 'Tell them to hurry up because you are busy' },
    ],
    correctAnswer: 'C',
  },
  {
    id: 5,
    category: 'Requirements',
    question: 'How many required photos must you submit to get paid?',
    options: [
      { label: 'A', text: '1 photo — just the business owner' },
      { label: 'B', text: '2 photos — the owner and the location' },
      { label: 'C', text: '3 photos — portrait, location, and craft (working shot)' },
    ],
    correctAnswer: 'C',
  },
];

const PASS_THRESHOLD = 4;

export default function CertificationQuizScreen() {
  const router = useGuardedRouter();
  const { userId } = useAuth();

  const creator = useQuery(api.creators.getByClerkId, userId ? { clerkId: userId } : 'skip');
  const markQuizPassed = useMutation(api.creators.markQuizPassed);

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answers, setAnswers] = useState<(string | null)[]>(Array(QUESTIONS.length).fill(null));
  const [showResults, setShowResults] = useState(false);
  const [certifying, setCertifying] = useState(false);

  const certificateRef = useRef<View>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const resultScaleAnim = useRef(new Animated.Value(0)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;

  const question = QUESTIONS[currentQuestion];
  const progress = (currentQuestion + 1) / QUESTIONS.length;

  const score = answers.filter(
    (answer, idx) => answer === QUESTIONS[idx].correctAnswer
  ).length;
  const passed = score >= PASS_THRESHOLD;

  const animateTransition = (direction: 'next' | 'prev', callback: () => void) => {
    const toValue = direction === 'next' ? -SCREEN_WIDTH : SCREEN_WIDTH;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      callback();
      slideAnim.setValue(direction === 'next' ? SCREEN_WIDTH : -SCREEN_WIDTH);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleSelectAnswer = (label: string) => {
    setSelectedAnswer(label);
  };

  const handleNext = () => {
    if (!selectedAnswer) return;

    const newAnswers = [...answers];
    newAnswers[currentQuestion] = selectedAnswer;
    setAnswers(newAnswers);

    if (currentQuestion < QUESTIONS.length - 1) {
      animateTransition('next', () => {
        setCurrentQuestion(currentQuestion + 1);
        setSelectedAnswer(newAnswers[currentQuestion + 1]);
      });
    } else {
      // Show results
      setShowResults(true);
      Animated.parallel([
        Animated.spring(resultScaleAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
        Animated.timing(resultOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      animateTransition('prev', () => {
        setCurrentQuestion(currentQuestion - 1);
        setSelectedAnswer(answers[currentQuestion - 1]);
      });
    } else {
      router.back();
    }
  };

  const handleCertify = async () => {
    if (!creator?._id) return;
    setCertifying(true);
    try {
      // Marks quiz as passed; admin must approve before the field agent gains
      // full access (see /(app)/pending-review screen)
      await markQuizPassed({ id: creator._id });
      // Hint the routing gate to skip /training redirect on the next render
      // until the Convex query propagates quizPassedAt
      await AsyncStorage.setItem('ndm_just_quiz_passed', 'true');
      router.replace('/(app)/pending-review' as any);
    } catch (err: any) {
      setCertifying(false);
      Alert.alert(
        'Could not submit',
        err?.message || 'Something went wrong. Please try again.',
      );
    }
  };

  const handleShareCertificate = useCallback(async () => {
    try {
      const uri = await captureRef(certificateRef, {
        format: 'png',
        quality: 1,
      });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share your certificate',
      });
    } catch {
      Alert.alert('Error', 'Could not share certificate. Please try again.');
    }
  }, []);

  
  const creatorName = creator
    ? `${(creator.firstName || '').toUpperCase()} ${(creator.lastName || '').toUpperCase()}`.trim()
    : '';

  const certDate = new Date();
  const certMonth = certDate.toLocaleString('en-US', { month: 'long' });
  const certYear = certDate.getFullYear();

  const accuracy = Math.round((score / QUESTIONS.length) * 100);

  // Results screen — PASS
  if (showResults && passed) {
    return (
      <ScreenShell
        onBack={() => router.replace('/(app)/(tabs)/' as any)}
        // Share button only visible AFTER admin has approved (certifiedAt set).
        // Quiz-pass alone is not enough — the certificate doesn't exist yet.
        headerRight={
          creator?.certifiedAt ? (
            <Pressable
              onPress={handleShareCertificate}
              accessibilityRole="button"
              accessibilityLabel="Share certificate"
              style={[styles.roundBtn, shadow.soft]}
            >
              <Ionicons name="share-outline" size={22} color={colors.ink} />
            </Pressable>
          ) : undefined
        }
        footer={<Button title="Submit for review" loading={certifying} onPress={handleCertify} />}
      >
        <Animated.View style={[styles.resultWrap, { opacity: resultOpacity, transform: [{ scale: resultScaleAnim }] }]}>
          <View style={styles.resultIcon}>
            <Ionicons name="checkmark" size={40} color={colors.onAccent} />
          </View>

          <Text variant="display" align="center" accessibilityRole="header">
            Congratulations!
          </Text>
          <Text variant="bodyLg" tone="ink2" align="center">
            You passed the quiz.
          </Text>
          <Text variant="label" weight="bold" tone="muted" align="center" style={styles.scoreLine}>
            {score}/{QUESTIONS.length} correct · {accuracy}%
          </Text>

          {/* Certificate is only revealed AFTER admin approval (certifiedAt set).
              Until then, show a "we're reviewing" note so the field agent
              understands the certification is not yet finalized. They can view
              and share the certificate from their Profile tab once approved. */}
          {creator?.certifiedAt ? (
            <CertificateCard
              ref={certificateRef}
              creatorName={creatorName}
              certMonth={certMonth}
              certYear={certYear}
            />
          ) : (
            <Card style={styles.waitCard}>
              <View style={styles.waitIcon}>
                <Ionicons name="hourglass-outline" size={28} color={colors.ink} />
              </View>
              <Text variant="heading" align="center">
                Your certificate is on its way
              </Text>
              <Text variant="body" tone="ink2" align="center">
                Our team approves new agents within 24 hours. Then your certificate shows here and in your profile.
              </Text>
              <Chip label="Waiting for approval" tone="warn" style={styles.waitBadge} />
            </Card>
          )}
        </Animated.View>
      </ScreenShell>
    );
  }

  // Results screen — FAIL
  if (showResults && !passed) {
    return (
      <ScreenShell
        onBack={() => router.replace('/(app)/training' as any)}
        footer={<Button title="Try again" variant="dark" onPress={() => router.replace('/(app)/training' as any)} />}
      >
        <Animated.View style={[styles.resultWrap, { opacity: resultOpacity, transform: [{ scale: resultScaleAnim }] }]}>
          <View style={styles.resultIcon}>
            <Ionicons name="school-outline" size={38} color={colors.onAccent} />
          </View>

          <Text variant="display" align="center" accessibilityRole="header">
            Not quite there yet
          </Text>
          <Text variant="bodyLg" tone="ink2" align="center">
            Look over the lessons, then try again.
          </Text>

          <View style={styles.scoreRow}>
            <Text variant="number">{score}</Text>
            <Text variant="heading" tone="muted">
              / {QUESTIONS.length}
            </Text>
          </View>
          <ProgressBar value={score / QUESTIONS.length} tone="accent" label="Your score" style={styles.scoreBar} />
          <Banner tone="neutral" body={`You need ${PASS_THRESHOLD} right to pass. You can retake it.`} style={styles.failNote} />
        </Animated.View>
      </ScreenShell>
    );
  }

  // Quiz question screen
  const isLastQuestion = currentQuestion === QUESTIONS.length - 1;
  return (
    <ScreenShell
      onBack={handleBack}
      progress={progress}
      footer={
        <Button
          title={isLastQuestion ? 'Finish quiz' : 'Next question'}
          onPress={handleNext}
          disabled={!selectedAnswer}
        />
      }
    >
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
        <Bubble
          question={question.question}
          hint={`Question ${question.id} of ${QUESTIONS.length} · ${question.category}`}
        />

        <View style={styles.options} accessibilityRole="radiogroup">
          {question.options.map((option) => (
            <OptionRow
              key={option.label}
              letter={option.label}
              title={option.text}
              selected={selectedAnswer === option.label}
              onPress={() => handleSelectAnswer(option.label)}
            />
          ))}
        </View>

        <Text variant="label" weight="medium" tone="muted" align="center" style={styles.passNote}>
          Pass with {PASS_THRESHOLD} of {QUESTIONS.length}. You can retake it.
        </Text>
      </Animated.View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  roundBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  options: { gap: space.md - 2, marginTop: space.xl },
  passNote: { marginTop: space.lg },
  resultWrap: { alignItems: 'stretch', gap: space.md },
  resultIcon: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  scoreLine: { marginBottom: space.md },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: space.sm, marginTop: space.lg },
  scoreBar: { marginTop: space.sm },
  failNote: { marginTop: space.lg },
  waitCard: { alignItems: 'center', gap: space.md, paddingVertical: space.xl, borderRadius: radius.cardLg },
  waitBadge: { alignSelf: 'center' },
  waitIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
