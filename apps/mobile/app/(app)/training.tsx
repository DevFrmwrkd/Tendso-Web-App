import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Image,
} from 'react-native';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TIPS = [
  {
    icon: 'sunny',
    color: '#f59e0b',
    bg: '#fffbeb',
    title: 'Perfect Lighting',
    desc: 'Make businesses shine and look professional.',
  },
  {
    icon: 'mic',
    color: '#3b82f6',
    bg: '#dbeafe',
    title: 'Clear Audio',
    desc: 'Capture crystal-clear owner interviews.',
  },
  {
    icon: 'person',
    color: '#14b8a6',
    bg: '#ccfbf1',
    title: 'Portrait Photos',
    desc: 'Frame the owner perfectly every time.',
  },
  {
    icon: 'chatbubbles',
    color: '#8b5cf6',
    bg: '#ede9fe',
    title: 'Interview Skills',
    desc: 'Get owners to share their best stories.',
  },
  {
    icon: 'camera',
    color: '#f43f5e',
    bg: '#ffe4e6',
    title: 'Required Shots',
    desc: 'Know exactly which photos are needed.',
  },
];

export default function TrainingIntroScreen() {
  const router = useGuardedRouter();
  const insets = useSafeAreaInsets();

  // Fade-up animations
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroTranslateY = useRef(new Animated.Value(30)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(30)).current;
  const tipsOpacity = useRef(new Animated.Value(0)).current;
  const tipsTranslateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.stagger(200, [
      Animated.parallel([
        Animated.timing(heroOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(heroTranslateY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(contentTranslateY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(tipsOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(tipsTranslateY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero section */}
        <Animated.View style={{
          opacity: heroOpacity,
          transform: [{ translateY: heroTranslateY }],
        }}>
          <View style={{
            backgroundColor: '#FBF3E0',
            paddingTop: insets.top + 20,
            paddingBottom: 30,
            paddingHorizontal: 24,
            alignItems: 'center',
          }}>
            {/* Camera illustration */}
            <View style={{
              width: 200, height: 160,
              backgroundColor: '#fff',
              borderRadius: 20,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
              marginBottom: 8,
            }}>
              <View style={{
                width: 80, height: 80, borderRadius: 40,
                backgroundColor: '#F5E4C0',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="videocam" size={40} color="#E4B05E" />
              </View>
              <View style={{
                position: 'absolute', bottom: 12, right: 16,
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: '#E4B05E', borderRadius: 12,
                paddingHorizontal: 8, paddingVertical: 4,
              }}>
                <View style={{
                  width: 6, height: 6, borderRadius: 3,
                  backgroundColor: '#fff', marginRight: 4,
                }} />
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>REC</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Content */}
        <Animated.View style={{
          paddingHorizontal: 24, paddingTop: 28,
          opacity: contentOpacity,
          transform: [{ translateY: contentTranslateY }],
        }}>
          <Text style={{ fontSize: 32, fontWeight: '900', color: '#18181b', lineHeight: 38 }}>
            Become a{'\n'}
            <Text style={{ color: '#E4B05E' }}>Certified Creator</Text>
          </Text>
          <Text style={{
            fontSize: 15, color: '#71717a', lineHeight: 22, marginTop: 14,
          }}>
            Master the art of capturing local businesses.{'\n'}
            High-quality videos mean higher approval rates and faster payouts.
          </Text>
        </Animated.View>

        {/* Tips list */}
        <Animated.View style={{
          paddingHorizontal: 24, paddingTop: 24,
          opacity: tipsOpacity,
          transform: [{ translateY: tipsTranslateY }],
        }}>
          {TIPS.map((tip, idx) => (
            <View key={tip.title} style={{
              flexDirection: 'row', alignItems: 'center',
              paddingVertical: 14,
              borderBottomWidth: idx < TIPS.length - 1 ? 1 : 0,
              borderBottomColor: '#f4f4f5',
            }}>
              <View style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: tip.bg,
                alignItems: 'center', justifyContent: 'center',
                marginRight: 14,
              }}>
                <Ionicons name={tip.icon as any} size={22} color={tip.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#18181b' }}>{tip.title}</Text>
                <Text style={{ fontSize: 13, color: '#71717a', marginTop: 2 }}>{tip.desc}</Text>
              </View>
            </View>
          ))}
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
          onPress={() => router.push('/(app)/training-lessons' as any)}
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
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>Start Training</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
