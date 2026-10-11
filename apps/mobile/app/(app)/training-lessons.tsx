import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface LessonTip {
  icon: string;
  text: string;
}

interface Lesson {
  id: number;
  title: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  deepDive: string;
  action: string;
  tips?: LessonTip[];
}

const LESSONS: Lesson[] = [
  {
    id: 1,
    title: 'Lighting',
    icon: 'sunny',
    iconColor: '#f59e0b',
    iconBg: '#fffbeb',
    deepDive:
      'Always check where the light is coming from. If you are indoors, ask the owner to stand facing a window. Never have the window behind them, or they will look like a dark shadow on camera.',
    action: 'Ensure their face is bright and clear without squinting.',
    tips: [
      { icon: '☀️', text: 'Face the Light: Always stand facing the main light source (window or sun) so your face is clear.' },
      { icon: '🚫', text: "Avoid Backlighting: Don't place a bright window behind your subject. It makes them look like a silhouette." },
      { icon: '🌅', text: 'Golden Hour: If filming outdoors, early morning or late afternoon provides the most flattering natural light.' },
    ],
  },
  {
    id: 2,
    title: 'Audio',
    icon: 'mic',
    iconColor: '#3b82f6',
    iconBg: '#dbeafe',
    deepDive:
      'Background noise like fans, traffic, or loud music will ruin the website video. Before the real interview, record a "test clip" of the owner saying their name. Play it back immediately.',
    action: "If you can't hear them clearly in the test, move to a quieter corner.",
    tips: [
      { icon: '🎙️', text: 'Test First: Record a quick test clip and play it back before the real interview.' },
      { icon: '🔇', text: 'Kill Noise: Turn off fans, TVs, and radios. Move away from busy streets.' },
      { icon: '📱', text: 'Phone Close: Hold your phone within arm\'s length of the speaker for the clearest audio.' },
    ],
  },
  {
    id: 3,
    title: 'Portrait',
    icon: 'person',
    iconColor: '#14b8a6',
    iconBg: '#ccfbf1',
    deepDive:
      'Use the on-screen "Portrait Helper" frame. The owner should be centered from the chest up (head and shoulders). Keep the phone at their eye level—don\'t tilt it up or down.',
    action: "Make sure they aren't wearing a hat or sunglasses that hide their face.",
    tips: [
      { icon: '🖼️', text: 'Chest Up: Frame the owner from the chest up — head and shoulders centered.' },
      { icon: '👀', text: "Eye Level: Hold the phone at the owner's eye level. Don't shoot from above or below." },
      { icon: '🧢', text: 'No Obstructions: Ask them to remove hats or sunglasses that hide their face.' },
    ],
  },
  {
    id: 4,
    title: 'Interview',
    icon: 'chatbubbles',
    iconColor: '#8b5cf6',
    iconBg: '#ede9fe',
    deepDive:
      "Don't just start recording. Spend 2 minutes talking to them first. Explain that this is to help their business get more customers. When they are relaxed, they will speak more naturally.",
    action: 'Remind them to speak slowly and tell their "Origin Story."',
    tips: [
      { icon: '💬', text: 'Warm Up: Chat with the owner for 2 minutes before pressing record.' },
      { icon: '📖', text: 'Origin Story: Ask them how and why they started the business.' },
      { icon: '🐢', text: 'Slow Down: Gently remind them to speak slowly and clearly.' },
    ],
  },
  {
    id: 5,
    title: 'Requirements',
    icon: 'camera',
    iconColor: '#f43f5e',
    iconBg: '#ffe4e6',
    deepDive:
      'To get paid, you must submit exactly three types of photos:\n\n• The Portrait — A clear shot of the owner.\n• The Location — A wide shot showing the front of the shop.\n• The Craft — A "working shot" (e.g., a barber cutting hair, a chef cooking).',
    action: 'All photos must be sharp and in focus.',
    tips: [
      { icon: '🧑', text: 'The Portrait: A clear, well-lit headshot of the business owner.' },
      { icon: '🏪', text: 'The Location: A wide-angle shot showing the shop front and signage.' },
      { icon: '✂️', text: 'The Craft: A "working shot" — the owner doing what they do best.' },
    ],
  },
];

export default function TrainingLessonsScreen() {
  const router = useGuardedRouter();
  const insets = useSafeAreaInsets();
  const [expandedId, setExpandedId] = useState<number | null>(1); // First lesson open by default

  const toggleLesson = (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
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
          onPress={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: '#f4f4f5',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="chevron-back" size={20} color="#18181b" />
        </TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#18181b', marginLeft: 12 }}>
          Certification Training
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Title section */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <Text style={{ fontSize: 26, fontWeight: '900', color: '#18181b', lineHeight: 32 }}>
            Creator Certification{'\n'}Training
          </Text>
          <Text style={{ fontSize: 14, color: '#71717a', lineHeight: 20, marginTop: 10 }}>
            Tap each lesson to learn the essential skills needed to become a certified creator.
          </Text>
        </View>

        {/* Section label */}
        <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#a1a1aa', letterSpacing: 1.5 }}>
            MASTER THE BASICS
          </Text>
        </View>

        {/* Lessons accordion */}
        <View style={{ paddingHorizontal: 16 }}>
          {LESSONS.map((lesson) => {
            const isExpanded = expandedId === lesson.id;
            return (
              <View key={lesson.id} style={{
                backgroundColor: '#fff',
                borderRadius: 16,
                marginBottom: 10,
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
                overflow: 'hidden',
              }}>
                {/* Lesson header (tappable) */}
                <TouchableOpacity
                  onPress={() => toggleLesson(lesson.id)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingVertical: 16, paddingHorizontal: 16,
                  }}
                >
                  <View style={{
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: lesson.iconBg,
                    alignItems: 'center', justifyContent: 'center',
                    marginRight: 14,
                  }}>
                    <Ionicons name={lesson.icon as any} size={20} color={lesson.iconColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#18181b' }}>
                      {lesson.id}. {lesson.title}
                    </Text>
                    {!isExpanded && (
                      <Text style={{ fontSize: 12, color: '#a1a1aa', marginTop: 2 }}>
                        Click to expand details
                      </Text>
                    )}
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#a1a1aa"
                  />
                </TouchableOpacity>

                {/* Expanded content */}
                {isExpanded && (
                  <View style={{
                    paddingHorizontal: 16, paddingBottom: 18,
                    borderTopWidth: 1, borderTopColor: '#f4f4f5',
                  }}>
                    {/* Tips */}
                    {lesson.tips?.map((tip, idx) => (
                      <View key={idx} style={{
                        flexDirection: 'row', marginTop: 14,
                      }}>
                        <Text style={{ fontSize: 16, marginRight: 10, marginTop: 1 }}>{tip.icon}</Text>
                        <Text style={{ flex: 1, fontSize: 13, color: '#3f3f46', lineHeight: 19 }}>
                          <Text style={{ fontWeight: '700' }}>{tip.text.split(':')[0]}:</Text>
                          {tip.text.split(':').slice(1).join(':')}
                        </Text>
                      </View>
                    ))}

                    {/* Action box */}
                    <View style={{
                      marginTop: 16,
                      backgroundColor: '#FBF3E0',
                      borderRadius: 12,
                      padding: 12,
                      flexDirection: 'row', alignItems: 'flex-start',
                    }}>
                      <Ionicons name="checkmark-circle" size={16} color="#E4B05E" style={{ marginTop: 2, marginRight: 8 }} />
                      <Text style={{ flex: 1, fontSize: 13, color: '#6B4A12', lineHeight: 18, fontWeight: '600' }}>
                        {lesson.action}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
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
          onPress={() => {
            router.push('/(app)/certification-quiz' as any);
          }}
          activeOpacity={0.85}
          style={{
            backgroundColor: '#E4B05E',
            height: 56, borderRadius: 28,
            flexDirection: 'row',
            alignItems: 'center', justifyContent: 'center',
            shadowColor: '#E4B05E', shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>Start Certification Quiz</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
