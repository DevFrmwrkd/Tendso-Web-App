import React, { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { Card, ScreenShell, SectionLabel, Text } from '../../components/v2';
import { colors, space } from '../../theme/v2';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface TermsSection {
  id: number;
  title: string;
  icon: string;
  content: string;
}

const TERMS_SECTIONS: TermsSection[] = [
  {
    id: 1,
    title: 'Acceptance of Terms',
    icon: 'checkmark-done-outline',
    content:
      'By downloading, installing, or using the Tendso mobile application ("App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the App.\n\nThese Terms constitute a legally binding agreement between you and Tendso ("we," "us," or "our"). We reserve the right to update these Terms at any time. Continued use of the App after changes constitutes acceptance of the updated Terms.',
  },
  {
    id: 2,
    title: 'Account Registration',
    icon: 'person-add-outline',
    content:
      'To use the App, you must create an account by providing accurate and complete information including your full name, email address, and a secure password. You may also sign up using Google OAuth.\n\nYou are responsible for:\n• Maintaining the confidentiality of your account credentials.\n• All activities that occur under your account.\n• Notifying us immediately of any unauthorized use.\n\nYou must be at least 18 years old to create an account. We reserve the right to suspend or terminate accounts that violate these Terms or provide false information.',
  },
  {
    id: 3,
    title: 'Creator Certification',
    icon: 'ribbon-outline',
    content:
      'Before submitting businesses, you must complete the Creator Certification Program, which includes training lessons and a certification quiz. Certification ensures you understand the quality standards required for submissions.\n\nWe reserve the right to:\n• Revoke certification if submission quality consistently falls below standards.\n• Update certification requirements and require re-certification.\n• Reject submissions that do not meet the established guidelines.',
  },
  {
    id: 4,
    title: 'Submissions & Content',
    icon: 'cloud-upload-outline',
    content:
      'When you submit business information through the App, you represent and warrant that:\n\n• You have obtained the business owner\'s consent to collect and share their information, photos, and interview.\n• All information provided is accurate and truthful.\n• Photos and recordings are original and taken by you during the visit.\n• The content does not infringe on any third party\'s intellectual property, privacy, or other rights.\n\nBy submitting content, you grant Tendso a worldwide, non-exclusive, royalty-free license to use, modify, display, and distribute the submitted content for the purpose of creating and maintaining business websites.',
  },
  {
    id: 5,
    title: 'Payments & Earnings',
    icon: 'cash-outline',
    content:
      'Creators earn payouts for approved submissions:\n\n• Video interview submissions: ₱500 per approved submission.\n• Audio-only interview submissions: ₱300 per approved submission.\n• Referral bonuses: ₱1000 when a referred creator\'s first submission is paid.\n\nPayout amounts are subject to change with notice. Earnings are credited to your in-app wallet upon approval. Payouts are processed according to the current payout schedule and available methods.\n\nWe reserve the right to withhold payment for submissions found to be fraudulent, duplicated, or in violation of these Terms.',
  },
  {
    id: 6,
    title: 'Referral Program',
    icon: 'people-outline',
    content:
      'Each creator receives a unique referral code upon registration. You may share this code with others to invite them to join the platform.\n\nReferral program rules:\n• You earn a bonus when a referred creator\'s first submission is mark as paid.\n• Self-referrals or creating multiple accounts to earn referral bonuses is prohibited.\n• Misuse of the referral program may result in forfeiture of bonuses and account suspension.\n• We reserve the right to modify or discontinue the referral program at any time.',
  },
  {
    id: 7,
    title: 'Prohibited Conduct',
    icon: 'warning-outline',
    content:
      'You agree not to:\n\n• Submit false, fabricated, or misleading business information.\n• Submit duplicate entries for the same business.\n• Use automated tools, bots, or scripts to interact with the App.\n• Attempt to manipulate payout calculations or referral bonuses.\n• Share your account credentials with others.\n• Harass, intimidate, or pressure business owners during submissions.\n• Reverse-engineer, decompile, or attempt to extract the source code of the App.\n• Use the App for any illegal or unauthorized purpose.\n\nViolation of these rules may result in immediate account termination and forfeiture of any unpaid earnings.',
  },
  {
    id: 8,
    title: 'Intellectual Property',
    icon: 'shield-outline',
    content:
      'The App, including its design, code, features, and branding, is the intellectual property of Tendso and is protected by applicable copyright and trademark laws.\n\nYou may not reproduce, distribute, modify, or create derivative works from any part of the App without our prior written consent.\n\nWebsites generated from your submissions are owned by Tendso. Business owners featured on these websites retain rights to their personal likeness and business information.',
  },
  {
    id: 9,
    title: 'Termination',
    icon: 'close-circle-outline',
    content:
      'We may suspend or terminate your account at any time for:\n\n• Violation of these Terms of Service.\n• Fraudulent or suspicious activity.\n• Extended inactivity.\n• Any other reason at our sole discretion with notice.\n\nUpon termination:\n• Your access to the App will be revoked.\n• Pending payouts for legitimately approved submissions will be processed.\n• Any pending or draft submissions will be discarded.\n\nYou may also delete your account at any time by contacting our support team.',
  },
  {
    id: 10,
    title: 'Limitation of Liability',
    icon: 'alert-circle-outline',
    content:
      'The App is provided "as is" without warranties of any kind, express or implied. Tendso does not guarantee:\n\n• Uninterrupted or error-free operation of the App.\n• That all submissions will be approved.\n• Specific earning amounts or payment timelines.\n\nTo the maximum extent permitted by law, Tendso shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the App.\n\nOur total liability to you shall not exceed the total amount of payouts you have received in the 3 months preceding the claim.',
  },
  {
    id: 11,
    title: 'Governing Law',
    icon: 'globe-outline',
    content:
      'These Terms shall be governed by and construed in accordance with the laws of the Republic of the Philippines. Any disputes arising from these Terms or your use of the App shall be resolved through the appropriate courts in the Philippines.\n\nIf any provision of these Terms is found to be unenforceable, the remaining provisions shall remain in full force and effect.',
  },
  {
    id: 12,
    title: 'Contact Us',
    icon: 'mail-outline',
    content:
      'If you have any questions about these Terms of Service, please contact us:\n\n• Email: frmwrkd.media@gmail.com\n• In-App: Profile > Help & FAQ\n\nWe aim to respond to all inquiries within 2-3 business days.',
  },
];

export default function TermsOfServiceScreen() {
  const router = useGuardedRouter();
  const [expandedId, setExpandedId] = useState<number | null>(1);

  const toggleItem = (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <ScreenShell title="Terms of Service" subtitle="Please review our terms carefully. By using Tendso, you agree to the following terms." onBack={() => router.back()} contentStyle={styles.content}>
      <Text variant="label" weight="medium" tone="muted" style={styles.updated}>
        Last updated: February 2026
      </Text>

      <SectionLabel style={styles.sections}>Sections</SectionLabel>

      {TERMS_SECTIONS.map((section) => {
        const isExpanded = expandedId === section.id;
        return (
          <Card key={section.id} style={styles.card}>
            <Pressable
              onPress={() => toggleItem(section.id)}
              accessibilityRole="button"
              accessibilityLabel={`${section.id}. ${section.title}`}
              accessibilityState={{ expanded: isExpanded }}
              style={styles.head}
            >
              <View style={styles.icon}>
                <Ionicons name={section.icon as any} size={22} color={colors.ink} />
              </View>
              <Text variant="bodyLg" weight="bold" style={styles.flex}>
                {section.id}. {section.title}
              </Text>
              <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={22} color={isExpanded ? colors.ink : colors.ink3} />
            </Pressable>

            {isExpanded && (
              <View style={styles.bodyWrap}>
                <Text variant="body" tone="ink2" style={styles.bodyText}>
                  {section.content}
                </Text>
              </View>
            )}
          </Card>
        );
      })}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: space.md, paddingTop: space.md, paddingBottom: space.xxl },
  updated: { marginTop: -space.sm },
  sections: { marginTop: space.sm },
  card: { padding: 0, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 72, paddingVertical: space.md, paddingHorizontal: space.lg },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center' },
  bodyWrap: { paddingHorizontal: space.lg, paddingBottom: space.lg, paddingTop: space.xs },
  // Legal text: 17px on a 26px line. The words come straight from the data above and are not edited here.
  bodyText: { lineHeight: 26 },
});
