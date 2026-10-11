import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useAuth } from '@clerk/clerk-expo';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CertificateCard from '../../components/CertificateCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface QuizOption {
  label: string;
  text: string;
}

interface QuizQuestion {
  id: number;
  category: string;
  categoryIcon: string;
  categoryColor: string;
  categoryBg: string;
  question: string;
  options: QuizOption[];
  correctAnswer: string; // "A", "B", "C", or "D"
}

const QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    category: 'Lighting',
    categoryIcon: 'sunny',
    categoryColor: '#f59e0b',
    categoryBg: '#fffbeb',
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
    categoryIcon: 'mic',
    categoryColor: '#3b82f6',
    categoryBg: '#dbeafe',
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
    categoryIcon: 'person',
    categoryColor: '#14b8a6',
    categoryBg: '#ccfbf1',
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
    categoryIcon: 'chatbubbles',
    categoryColor: '#8b5cf6',
    categoryBg: '#ede9fe',
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
    categoryIcon: 'camera',
    categoryColor: '#f43f5e',
    categoryBg: '#ffe4e6',
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
  const insets = useSafeAreaInsets();
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
      // Marks quiz as passed; admin must approve before the creator gains
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
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        {/* Header */}
        <View style={{
          backgroundColor: '#fff',
          paddingTop: insets.top + 8,
          paddingBottom: 14,
          paddingHorizontal: 16,
          flexDirection: 'row', alignItems: 'center',
          borderBottomWidth: 1, borderBottomColor: '#f4f4f5',
        }}>
          <TouchableOpacity
            onPress={() => router.replace('/(app)/(tabs)/' as any)}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: '#f4f4f5',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={20} color="#18181b" />
          </TouchableOpacity>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#18181b', flex: 1, textAlign: 'center' }}>
            Success
          </Text>
          {/* Share button only visible AFTER admin has approved (certifiedAt set).
              Quiz-pass alone is not enough — the certificate doesn't exist yet. */}
          {creator?.certifiedAt ? (
            <TouchableOpacity
              onPress={handleShareCertificate}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: '#f4f4f5',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="share-outline" size={18} color="#18181b" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 36, height: 36 }} />
          )}
        </View>

        <ScrollView
          contentContainerStyle={{
            alignItems: 'center',
            paddingHorizontal: 24,
            paddingTop: 28,
            paddingBottom: insets.bottom + 140,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{
            opacity: resultOpacity,
            transform: [{ scale: resultScaleAnim }],
            alignItems: 'center',
            width: '100%',
          }}>
            {/* Green checkmark */}
            <View style={{
              width: 72, height: 72, borderRadius: 36,
              backgroundColor: '#F5E4C0',
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 20,
            }}>
              <Ionicons name="checkmark-circle" size={44} color="#E4B05E" />
            </View>

            {/* Congratulations text */}
            <Text style={{
              fontSize: 26, fontWeight: '900', color: '#18181b',
              textAlign: 'center', marginBottom: 6,
            }}>
              Congratulations!
            </Text>
            <Text style={{
              fontSize: 14, color: '#71717a',
              textAlign: 'center', lineHeight: 20,
              marginBottom: 10,
            }}>
              You passed the Certification Quiz!
            </Text>

            {/* Score badge */}
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              marginBottom: 28,
            }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#E4B05E' }}>
                {score}/{QUESTIONS.length} Score
              </Text>
              <Text style={{ fontSize: 14, color: '#E4B05E', marginHorizontal: 6 }}>{'\u2022'}</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#E4B05E' }}>
                {accuracy}% Accuracy
              </Text>
            </View>

            {/* Certificate is only revealed AFTER admin approval (certifiedAt set).
                Until then, show a "we're reviewing" placeholder so the creator
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
              <View
                style={{
                  width: '100%',
                  backgroundColor: '#f9fafb',
                  borderWidth: 1,
                  borderColor: '#e4e4e7',
                  borderStyle: 'dashed',
                  borderRadius: 16,
                  paddingVertical: 32,
                  paddingHorizontal: 24,
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: '#fef3c7',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 14,
                  }}
                >
                  <Ionicons name="hourglass-outline" size={26} color="#c68a12" />
                </View>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: '#18181b',
                    textAlign: 'center',
                    marginBottom: 6,
                  }}
                >
                  Your certificate is on its way
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: '#71717a',
                    textAlign: 'center',
                    lineHeight: 19,
                    marginBottom: 4,
                  }}
                >
                  Once our admin team reviews and approves your application
                  (within 24 hours), your official Tendso certificate
                  will appear here and in your Profile.
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: '#c68a12',
                    marginTop: 8,
                    letterSpacing: 1,
                  }}
                >
                  PENDING ADMIN APPROVAL
                </Text>
              </View>
            )}
          </Animated.View>
        </ScrollView>

        {/* Bottom CTAs */}
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          paddingHorizontal: 24,
          paddingTop: 12,
          paddingBottom: insets.bottom + 16,
          backgroundColor: '#fff',
          borderTopWidth: 1, borderTopColor: '#f4f4f5',
        }}>
          <TouchableOpacity
            onPress={handleCertify}
            disabled={certifying}
            activeOpacity={0.85}
            style={{
              backgroundColor: '#E4B05E',
              height: 56, borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#E4B05E', shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
              opacity: certifying ? 0.7 : 1,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>
              {certifying ? 'Submitting…' : 'Submit for review'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Results screen — FAIL
  if (showResults && !passed) {
    const scoreBarWidth = (score / QUESTIONS.length) * 100;
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        {/* Header */}
        <View style={{
          backgroundColor: '#fff',
          paddingTop: insets.top + 8,
          paddingBottom: 14,
          paddingHorizontal: 16,
          flexDirection: 'row', alignItems: 'center',
          borderBottomWidth: 1, borderBottomColor: '#f4f4f5',
        }}>
          <TouchableOpacity
            onPress={() => router.replace('/(app)/training' as any)}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: '#f4f4f5',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={20} color="#18181b" />
          </TouchableOpacity>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#18181b', flex: 1, textAlign: 'center' }}>
            Certification Quiz
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: 'center',
            paddingHorizontal: 28,
            paddingTop: 40,
            paddingBottom: insets.bottom + 160,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{
            opacity: resultOpacity,
            transform: [{ scale: resultScaleAnim }],
            alignItems: 'center',
            width: '100%',
          }}>
            {/* Graduation cap icon */}
            <View style={{
              width: 72, height: 72, borderRadius: 36,
              backgroundColor: '#F5E4C0',
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 28,
            }}>
              <Ionicons name="school" size={36} color="#E4B05E" />
            </View>

            {/* Title */}
            <Text style={{
              fontSize: 24, fontWeight: '900', color: '#18181b',
              textAlign: 'center', marginBottom: 10,
            }}>
              Not quite there yet!
            </Text>

            <Text style={{
              fontSize: 14, color: '#71717a',
              textAlign: 'center', lineHeight: 21,
              marginBottom: 32,
              paddingHorizontal: 8,
            }}>
              You're on your way to helping local businesses. A little more study and you'll be a pro!
            </Text>

            {/* Score section */}
            <Text style={{
              fontSize: 11, fontWeight: '700', color: '#E4B05E',
              letterSpacing: 1.5, marginBottom: 12,
            }}>
              YOUR SCORE
            </Text>

            <View style={{
              flexDirection: 'row', alignItems: 'baseline',
              marginBottom: 16,
            }}>
              <Text style={{ fontSize: 56, fontWeight: '900', color: '#18181b' }}>
                {score}
              </Text>
              <Text style={{ fontSize: 24, fontWeight: '600', color: '#a1a1aa', marginLeft: 4 }}>
                / {QUESTIONS.length}
              </Text>
            </View>

            {/* Progress bar */}
            <View style={{
              width: '100%',
              height: 8,
              backgroundColor: '#f4f4f5',
              borderRadius: 4,
              overflow: 'hidden',
              marginBottom: 28,
            }}>
              <View style={{
                height: '100%',
                backgroundColor: '#E4B05E',
                borderRadius: 4,
                width: `${scoreBarWidth}%`,
              }} />
            </View>

            {/* Encouragement text */}
            <Text style={{
              fontSize: 13, color: '#71717a',
              textAlign: 'center', lineHeight: 20,
              paddingHorizontal: 4,
            }}>
              Review the training materials to brush up on the details, then take the quiz again to unlock your account.
            </Text>
          </Animated.View>
        </ScrollView>

        {/* Bottom CTAs */}
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          paddingHorizontal: 24,
          paddingTop: 12,
          paddingBottom: insets.bottom + 16,
          backgroundColor: '#fff',
          borderTopWidth: 1, borderTopColor: '#f4f4f5',
        }}>
          <TouchableOpacity
            onPress={() => router.replace('/(app)/training' as any)}
            activeOpacity={0.85}
            style={{
              backgroundColor: '#18181b',
              height: 56, borderRadius: 16,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Quiz question screen
  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <View style={{
        backgroundColor: '#fff',
        paddingTop: insets.top + 8,
        paddingBottom: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1, borderBottomColor: '#f4f4f5',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={handleBack}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: '#f4f4f5',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-back" size={20} color="#18181b" />
          </TouchableOpacity>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#18181b', marginLeft: 12, flex: 1 }}>
            Certification Quiz
          </Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#a1a1aa' }}>
            {currentQuestion + 1}/{QUESTIONS.length}
          </Text>
        </View>

        {/* Progress bar */}
        <View style={{
          marginTop: 12,
          height: 4,
          backgroundColor: '#f4f4f5',
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          <Animated.View style={{
            height: '100%',
            backgroundColor: '#E4B05E',
            borderRadius: 2,
            width: `${progress * 100}%`,
          }} />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{
          opacity: fadeAnim,
          transform: [{ translateX: slideAnim }],
        }}>
          {/* Category badge */}
          <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              alignSelf: 'flex-start',
              backgroundColor: question.categoryBg,
              borderRadius: 20,
              paddingHorizontal: 14, paddingVertical: 6,
            }}>
              <Ionicons name={question.categoryIcon as any} size={14} color={question.categoryColor} />
              <Text style={{
                fontSize: 12, fontWeight: '700',
                color: question.categoryColor,
                marginLeft: 6,
              }}>
                {question.category}
              </Text>
            </View>
          </View>

          {/* Question */}
          <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 }}>
            <Text style={{
              fontSize: 11, fontWeight: '700', color: '#a1a1aa',
              letterSpacing: 1.5, marginBottom: 8,
            }}>
              QUESTION {question.id} OF {QUESTIONS.length}
            </Text>
            <Text style={{
              fontSize: 20, fontWeight: '800', color: '#18181b',
              lineHeight: 28,
            }}>
              {question.question}
            </Text>
          </View>

          {/* Options */}
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            {question.options.map((option) => {
              const isSelected = selectedAnswer === option.label;
              return (
                <TouchableOpacity
                  key={option.label}
                  onPress={() => handleSelectAnswer(option.label)}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: isSelected ? '#FBF3E0' : '#fff',
                    borderRadius: 16,
                    marginBottom: 10,
                    padding: 16,
                    flexDirection: 'row', alignItems: 'center',
                    borderWidth: 2,
                    borderColor: isSelected ? '#E4B05E' : '#f4f4f5',
                    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
                  }}
                >
                  {/* Letter circle */}
                  <View style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: isSelected ? '#E4B05E' : '#f4f4f5',
                    alignItems: 'center', justifyContent: 'center',
                    marginRight: 14,
                  }}>
                    <Text style={{
                      fontSize: 15, fontWeight: '800',
                      color: isSelected ? '#fff' : '#71717a',
                    }}>
                      {option.label}
                    </Text>
                  </View>

                  {/* Option text */}
                  <Text style={{
                    flex: 1, fontSize: 14, fontWeight: '600',
                    color: isSelected ? '#6B4A12' : '#3f3f46',
                    lineHeight: 20,
                  }}>
                    {option.text}
                  </Text>

                  {/* Check icon */}
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color="#E4B05E" style={{ marginLeft: 8 }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Fixed bottom CTA */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: insets.bottom + 16,
        backgroundColor: '#fff',
        borderTopWidth: 1, borderTopColor: '#f4f4f5',
      }}>
        <TouchableOpacity
          onPress={handleNext}
          disabled={!selectedAnswer}
          activeOpacity={0.85}
          style={{
            backgroundColor: selectedAnswer ? '#E4B05E' : '#d4d4d8',
            height: 56, borderRadius: 28,
            flexDirection: 'row',
            alignItems: 'center', justifyContent: 'center',
            shadowColor: selectedAnswer ? '#E4B05E' : '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: selectedAnswer ? 0.3 : 0.1,
            shadowRadius: 12,
            elevation: selectedAnswer ? 6 : 2,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>
            {currentQuestion === QUESTIONS.length - 1 ? 'Finish Quiz' : 'Next Question'}
          </Text>
          <Ionicons
            name={currentQuestion === QUESTIONS.length - 1 ? 'checkmark' : 'arrow-forward'}
            size={20}
            color="#fff"
            style={{ marginLeft: 8 }}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
