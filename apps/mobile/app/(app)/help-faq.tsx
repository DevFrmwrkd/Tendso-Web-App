import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FAQItem {
  id: number;
  question: string;
  answer: string;
  icon: string;
  iconColor: string;
  iconBg: string;
}

interface FAQSection {
  title: string;
  items: FAQItem[];
}

const FAQ_SECTIONS: FAQSection[] = [
  {
    title: 'GETTING STARTED',
    items: [
      {
        id: 1,
        question: 'What is Tendso?',
        answer:
          'Tendso is a mobile app that helps Filipino creators (field agents) digitize local businesses. You visit a small business, collect information like photos, a video or audio interview, and business details, then submit it through the app. The platform generates a professional website for the business and you earn a payout for each successful submission.',
        icon: 'information-circle-outline',
        iconColor: '#3b82f6',
        iconBg: '#dbeafe',
      },
      {
        id: 2,
        question: 'How do I become a certified creator?',
        answer:
          'After signing up, go to the Training section from your dashboard. Complete the 5 training lessons covering Lighting, Audio, Portrait, Interview, and Requirements. Then pass the Certification Quiz. Once certified, you can start submitting businesses and earning payouts.',
        icon: 'ribbon-outline',
        iconColor: '#E4B05E',
        iconBg: '#F5E4C0',
      },
      // {
      //   id: 3,
      //   question: 'Do I need internet to use the app?',
      //   answer:
      //     'You can fill in business information, take photos, and record interviews while offline. Your data is saved locally on your device. Once you reconnect to the internet, the app will automatically sync your pending submissions to the server. However, you need internet to create a new account or log in for the first time.',
      //   icon: 'cloud-offline-outline',
      //   iconColor: '#f59e0b',
      //   iconBg: '#fef3c7',
      // },
    ],
  },
  {
    title: 'SUBMISSIONS',
    items: [
      {
        id: 4,
        question: 'What are the steps to submit a business?',
        answer:
          'There are 4 steps:\n\n1. Business Info — Enter the business name, type, owner details, and address.\n2. Photos — Upload 3-10 photos including a portrait of the owner, a location shot, and a craft/working shot.\n3. Interview — Record a video (preferred — your TikTok asset) or audio (fallback) with the business owner.\n4. Review & Submit — Set your sale price with the slider. You keep 50% of every sale.',
        icon: 'list-outline',
        iconColor: '#8b5cf6',
        iconBg: '#ede9fe',
      },
      {
        id: 5,
        question: 'What happens after I submit?',
        answer:
          'Your submission goes through a lifecycle:\n\n• Draft — Saved but not yet submitted.\n• Submitted — Under review by our team.\n• Approved — Accepted! The business gets a payment link.\n• Paid — The business paid. Your 50% commission lands in your wallet now.\n• Website Generated — A professional website is created for the business.\n• Deployed — The website goes live.\n• Rejected — If something is missing, you\'ll get feedback and can resubmit.',
        icon: 'checkmark-circle-outline',
        iconColor: '#E4B05E',
        iconBg: '#F5E4C0',
      },
      {
        id: 6,
        question: 'What photo requirements do I need to follow?',
        answer:
          'You need at least 3 types of photos:\n\n• The Portrait — A clear, well-lit headshot of the business owner from the chest up.\n• The Location — A wide-angle shot showing the shop front and signage.\n• The Craft — A "working shot" of the owner doing what they do best (e.g., a barber cutting hair, a chef cooking).\n\nAll photos must be sharp, in focus, and well-lit.',
        icon: 'camera-outline',
        iconColor: '#f43f5e',
        iconBg: '#ffe4e6',
      },
      {
        id: 7,
        question: 'Can I edit or continue a draft submission?',
        answer:
          'Yes! Any submission saved as a draft can be continued from your My Submissions list. Tap on the draft to pick up where you left off. The app also auto-saves your form progress so you won\'t lose data if you accidentally close the app.',
        icon: 'create-outline',
        iconColor: '#A67836',
        iconBg: '#cffafe',
      },
    ],
  },
  {
    title: 'EARNINGS & PAYMENTS',
    items: [
      {
        id: 8,
        question: 'How much do I earn per submission?',
        answer:
          'You keep 50% of every sale — same rate for video and audio.\n\n• At the ₱999 launch price: you earn ₱500.\n• At ₱2,500: you earn ₱1,250.\n• At ₱4,999 (full price): you earn ₱2,500.\n\nYour first 5 submissions are locked at the ₱999 launch price. After that, the slider on the Review screen lets you set any price between ₱999 and ₱4,999 — higher price, higher earnings.\n\nVideo is the preferred interview format because it doubles as a TikTok asset for the business. Pay is identical to audio.',
        icon: 'cash-outline',
        iconColor: '#E4B05E',
        iconBg: '#F5E4C0',
      },
      {
        id: 9,
        question: 'How do referral bonuses work?',
        answer:
          'You earn ₱1000 when a creator you referred gets their first submission was paid by the business owner. Share your unique referral code (found on your Profile page) with friends. When they sign up using your code and get their first submission paid, the bonus is automatically credited to your balance.',
        icon: 'people-outline',
        iconColor: '#8b5cf6',
        iconBg: '#ede9fe',
      },
      {
        id: 10,
        question: 'When and how do I get paid?',
        answer:
          'You get paid when the business pays — not when the site is approved. Once Wise confirms the business owner\'s payment, your 50% commission lands in your wallet balance immediately. You can withdraw to your Wise account through the Wallet section.',
        icon: 'wallet-outline',
        iconColor: '#f59e0b',
        iconBg: '#fef3c7',
      },
    ],
  },
  {
    title: 'ACCOUNT & SUPPORT',
    items: [
      {
        id: 11,
        question: 'How do I reset my password?',
        answer:
          'Go to Profile > Change Password. Enter your current password, then your new password (minimum 8 characters). Your new password must be different from your current one. After changing, all other active sessions will be signed out for security.',
        icon: 'key-outline',
        iconColor: '#ef4444',
        iconBg: '#fee2e2',
      },
      {
        id: 12,
        question: 'How do I update my profile information?',
        answer:
          'Go to Profile > Edit Profile to update your name, phone number, and other details. Your email address is tied to your account and cannot be changed from the app.',
        icon: 'person-outline',
        iconColor: '#3b82f6',
        iconBg: '#dbeafe',
      },
      {
        id: 13,
        question: 'I\'m having technical issues. What should I do?',
        answer:
          'Try these steps:\n\n1. Make sure you have a stable internet connection.\n2. Close and reopen the app.\n3. Check if there\'s an app update available.\n4. If the issue persists, take a screenshot and contact our support team.\n\nFor offline-related issues, reconnecting to the internet usually resolves sync problems automatically.',
        icon: 'construct-outline',
        iconColor: '#71717a',
        iconBg: '#f4f4f5',
      },
    ],
  },
];

export default function HelpFAQScreen() {
  const router = useGuardedRouter();
  const insets = useSafeAreaInsets();
  const [expandedId, setExpandedId] = useState<number | null>(1);

  const toggleItem = (id: number) => {
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
          Help & FAQ
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <Text style={{ fontSize: 26, fontWeight: '900', color: '#18181b', lineHeight: 32 }}>
            Frequently Asked{'\n'}Questions
          </Text>
          <Text style={{ fontSize: 14, color: '#71717a', lineHeight: 20, marginTop: 10 }}>
            Find answers to common questions about using Tendso.
          </Text>
        </View>

        {FAQ_SECTIONS.map((section) => (
          <View key={section.title}>
            <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#a1a1aa', letterSpacing: 1.5 }}>
                {section.title}
              </Text>
            </View>

            <View style={{ paddingHorizontal: 16 }}>
              {section.items.map((item) => {
                const isExpanded = expandedId === item.id;
                return (
                  <View key={item.id} style={{
                    backgroundColor: '#fff',
                    borderRadius: 16,
                    marginBottom: 10,
                    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
                    overflow: 'hidden',
                  }}>
                    <TouchableOpacity
                      onPress={() => toggleItem(item.id)}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: 'row', alignItems: 'center',
                        paddingVertical: 16, paddingHorizontal: 16,
                      }}
                    >
                      <View style={{
                        width: 40, height: 40, borderRadius: 20,
                        backgroundColor: item.iconBg,
                        alignItems: 'center', justifyContent: 'center',
                        marginRight: 14,
                      }}>
                        <Ionicons name={item.icon as any} size={20} color={item.iconColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#18181b', lineHeight: 20 }}>
                          {item.question}
                        </Text>
                      </View>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color="#a1a1aa"
                      />
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={{
                        paddingHorizontal: 16, paddingBottom: 18,
                        borderTopWidth: 1, borderTopColor: '#f4f4f5',
                      }}>
                        <Text style={{
                          fontSize: 13, color: '#3f3f46', lineHeight: 20,
                          marginTop: 14,
                        }}>
                          {item.answer}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
