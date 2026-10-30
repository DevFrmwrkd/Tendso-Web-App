import React, { useState } from 'react';
import {
  View,
  Pressable,
  ScrollView,
  LayoutAnimation,
  Platform,
  StyleSheet,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { useMobileAccount } from '../../hooks/useMobileAccount';
import { Card, ScreenShell, Text } from '../../components/v2';
import { colors, hit, radius, space } from '../../theme/v2';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Category = 'Start' | 'Submissions' | 'Money' | 'Account';

interface FAQItem {
  id: number;
  category: Category;
  /** Who sees it. Omitted = everyone. `agent` = field agents, `creator` = creators (code role `affiliate`). */
  audience?: 'agent' | 'creator';
  question: string;
  answer: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  /** Three "you keep" cells shown under the answer. */
  keep?: { amount: string; at: string; mid?: boolean }[];
}

const CATEGORIES: Category[] = ['Start', 'Submissions', 'Money', 'Account'];

const FAQ_ITEMS: FAQItem[] = [
  // ---- Start ----
  {
    id: 1,
    category: 'Start',
    question: 'What is Tendso?',
    answer:
      'Tendso builds a website for a small local shop. A field agent visits the shop, takes photos and records a short interview. The site is ready about 20 minutes later, the same day. The owner sees it first, then pays once to keep it. You keep half of every sale.',
    icon: 'information-circle-outline',
  },
  {
    id: 2,
    category: 'Start',
    audience: 'agent',
    question: 'How do I get certified?',
    answer:
      'Open Training from your Home tab. Finish the 5 lessons: Lighting, Audio, Portrait, Interview and Requirements. Then pass the quiz. After that you can submit shops and get paid.',
    icon: 'ribbon-outline',
  },
  {
    id: 3,
    category: 'Start',
    audience: 'creator',
    question: 'How do I get started as a creator?',
    answer:
      'Choose Creator when you sign up, then add your name, mobile number and page handle. Tendso approves your account before your page goes live. Creators share a link and a code online. They do not visit shops, take photos or do training.',
    icon: 'share-social-outline',
  },
  // ---- Submissions ----
  {
    id: 4,
    category: 'Submissions',
    audience: 'agent',
    question: 'What are the steps to submit a shop?',
    answer:
      'There are 4 steps:\n\n1. Shop info: the name, type, owner and address.\n2. Photos: 3 to 10, with a portrait of the owner, the shop front and the owner at work.\n3. Interview: a video (best) or audio with the owner.\n4. Review and submit: set your price.',
    icon: 'list-outline',
  },
  {
    id: 5,
    category: 'Submissions',
    audience: 'agent',
    question: 'What happens after I submit?',
    answer:
      'The site is ready about 20 minutes after the interview and photos, the same day. It goes live first. The owner sees it, says yes, then pays. If they do not pay, the site is taken down.\n\n• Draft: saved, not sent yet.\n• In review: our team is checking it.\n• Live: the owner can see the site.\n• Paid: the owner paid. Your half is in your wallet.\n• Rejected: something is missing. You get a note and can send it again.',
    icon: 'checkmark-circle-outline',
  },
  {
    id: 6,
    category: 'Submissions',
    audience: 'agent',
    question: 'Which photos do I need?',
    answer:
      'At least 3 kinds:\n\n• Portrait: the owner from the chest up, in good light.\n• Shop front: a wide shot with the signage.\n• At work: the owner doing the craft, like a barber cutting hair or a tailor sewing.\n\nAll photos must be sharp and well lit.',
    icon: 'camera-outline',
  },
  {
    id: 7,
    category: 'Submissions',
    audience: 'agent',
    question: 'Can I finish a draft later?',
    answer:
      'Yes. Open it from your submissions list and carry on where you stopped. The app also saves your progress, so closing it by accident will not lose your work.',
    icon: 'create-outline',
  },
  // ---- Money ----
  {
    id: 8,
    category: 'Money',
    audience: 'agent',
    question: 'How much do I earn per site?',
    answer:
      'You keep half of every sale. You set the price for each site, from ₱999 to ₱4,999, starting with your first site. Video or audio interview, the pay is the same.',
    icon: 'wallet-outline',
    keep: [
      { amount: '₱500', at: 'at ₱999' },
      { amount: '₱1,500', at: 'at ₱2,999', mid: true },
      { amount: '₱2,500', at: 'at ₱4,999' },
    ],
  },
  {
    id: 9,
    category: 'Money',
    audience: 'creator',
    question: 'How much do I earn as a creator?',
    answer:
      'Your code gives owners 30% off (₱3,499) and you keep half (₱1,750). You also earn 5% of every sale by field agents who join with your link, for 12 months from the day each agent joins. That is one level only, and it is paid when the shop has paid in full.',
    icon: 'wallet-outline',
  },
  {
    id: 10,
    category: 'Money',
    question: 'When and how do I get paid?',
    answer:
      'You get paid when the shop pays, not when the site is approved. Once the payment is confirmed, your share lands in your wallet. You can withdraw to your Wise account from the Earn tab.',
    icon: 'send-outline',
  },
  {
    id: 11,
    category: 'Money',
    audience: 'agent',
    question: 'What if the owner pays in parts?',
    answer:
      'A down payment is allowed, with a minimum of ₱500. You still get your whole cut up front. Tendso collects the rest from the owner.',
    icon: 'cash-outline',
  },
  {
    id: 12,
    category: 'Money',
    audience: 'agent',
    question: 'How do referrals work?',
    answer:
      'Share your code from the Me tab with a friend who wants to join as a field agent. When their first site is paid, your bonus lands in your wallet. Referrals that were already pending keep their ₱1,000.',
    icon: 'people-outline',
  },
  // ---- Account ----
  {
    id: 13,
    category: 'Account',
    question: 'How do I change my password?',
    answer:
      'Go to Me, then Change password. Enter your current password, then a new one with at least 8 characters. For safety, your other sessions are signed out.',
    icon: 'key-outline',
  },
  {
    id: 14,
    category: 'Account',
    question: 'How do I update my details?',
    answer:
      'Go to Me, then Edit profile to change your name, phone number and photo. Your email is tied to your account and cannot be changed in the app.',
    icon: 'person-outline',
  },
  {
    id: 15,
    category: 'Account',
    question: 'Something is not working. What do I do?',
    answer:
      'Try these in order:\n\n1. Check your internet connection.\n2. Close the app and open it again.\n3. Look for an app update.\n4. Still stuck? Take a screenshot and send it to our support team.\n\nIf you were offline, reconnecting usually syncs everything by itself.',
    icon: 'construct-outline',
  },
];

export default function HelpFAQScreen() {
  const router = useGuardedRouter();
  const { view } = useMobileAccount();
  const audience = view === 'affiliate' ? 'creator' : 'agent';
  const items = FAQ_ITEMS.filter((item) => !item.audience || item.audience === audience);
  const categories = CATEGORIES.filter((c) => items.some((item) => item.category === c));

  const [category, setCategory] = useState<Category>('Start');
  const [expandedId, setExpandedId] = useState<number | null>(1);

  const shown = items.filter((item) => item.category === (categories.includes(category) ? category : categories[0]));

  const toggleItem = (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  const pickCategory = (next: Category) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCategory(next);
    setExpandedId(items.find((item) => item.category === next)?.id ?? null);
  };

  return (
    <ScreenShell title="Help & FAQ" onBack={() => router.back()}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillsScroll}
        contentContainerStyle={styles.pills}
        accessibilityRole="tablist"
      >
        {categories.map((c) => {
          const active = (categories.includes(category) ? category : categories[0]) === c;
          return (
            <Pressable
              key={c}
              onPress={() => pickCategory(c)}
              accessibilityRole="button"
              accessibilityLabel={c}
              accessibilityState={{ selected: active }}
              hitSlop={4}
              style={[styles.pill, active ? styles.pillOn : styles.pillOff]}
            >
              <Text variant="chip" tone={active ? 'onDark' : 'ink'}>
                {c}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.list}>
        {shown.map((item) => {
          const isExpanded = expandedId === item.id;
          return (
            <Card key={item.id} style={styles.card}>
              <Pressable
                onPress={() => toggleItem(item.id)}
                accessibilityRole="button"
                accessibilityLabel={item.question}
                accessibilityState={{ expanded: isExpanded }}
                style={styles.question}
              >
                <View style={styles.iconTile}>
                  <Ionicons name={item.icon} size={20} color={colors.ink} />
                </View>
                <Text variant="body" weight="bold" style={styles.questionText}>
                  {item.question}
                </Text>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={22}
                  color={isExpanded ? colors.ink : colors.ink3}
                />
              </Pressable>

              {isExpanded ? (
                <View style={styles.answer}>
                  <Text variant="body" tone="ink2">
                    {item.answer}
                  </Text>
                  {item.keep ? (
                    <View style={styles.keepRow}>
                      {item.keep.map((k) => (
                        <View key={k.at} style={[styles.keepCell, k.mid ? styles.keepMid : null]}>
                          <Text variant="body" weight="extrabold" tabular>
                            {k.amount}
                          </Text>
                          <Text variant="label" tone="muted">
                            {k.at}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </Card>
          );
        })}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  pillsScroll: { marginHorizontal: -space.gutter, marginTop: -space.sm, marginBottom: space.lg, flexGrow: 0 },
  pills: { paddingHorizontal: space.gutter, gap: space.sm },
  pill: {
    minHeight: hit.min - 8,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillOn: { backgroundColor: colors.ink },
  pillOff: { backgroundColor: colors.card },
  list: { gap: space.md },
  card: { paddingVertical: space.sm, paddingHorizontal: space.lg },
  question: { minHeight: hit.large, flexDirection: 'row', alignItems: 'center', gap: space.md },
  questionText: { flex: 1 },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answer: { gap: space.md, paddingBottom: space.md },
  keepRow: { flexDirection: 'row', gap: space.sm },
  keepCell: { flex: 1, backgroundColor: colors.bg, borderRadius: 14, padding: space.md, gap: 2 },
  keepMid: { backgroundColor: colors.accentSoft },
});
