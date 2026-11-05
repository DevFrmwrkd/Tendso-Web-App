import React, { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { Card, ScreenShell, SectionLabel, Text } from '../../components/v2';
import { colors, space } from '../../theme/v2';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface PolicySection {
  id: number;
  title: string;
  icon: string;
  content: string;
}

const POLICY_SECTIONS: PolicySection[] = [
  {
    id: 1,
    title: 'Information We Collect',
    icon: 'document-text-outline',
    content:
      'We collect the following types of information when you use Tendso:\n\nAccount Information:\n• Full name (first and last name)\n• Email address\n• Phone number (optional)\n• Password (encrypted)\n• Profile image (optional)\n\nSubmission Data:\n• Business information (name, type, address, owner details)\n• Photos taken during business visits\n• Video and audio recordings of interviews\n• Location data associated with submissions\n\nUsage Data:\n• App usage patterns and feature interactions\n• Device information (model, operating system)\n• Login timestamps and session activity\n• Push notification tokens',
  },
  {
    id: 2,
    title: 'How We Use Your Information',
    icon: 'analytics-outline',
    content:
      'We use your information to:\n\n• Authenticate your identity and manage your account.\n• Process and review your business submissions.\n• Generate professional websites for submitted businesses.\n• Calculate and process your earnings and payouts.\n• Track referral bonuses and program participation.\n• Send you notifications about submission updates, approvals, and payments.\n• Improve the App\'s features, performance, and user experience.\n• Prevent fraud, abuse, and violations of our Terms of Service.\n• Comply with legal obligations and enforce our agreements.',
  },
  {
    id: 3,
    title: 'Data Storage & Security',
    icon: 'shield-checkmark-outline',
    content:
      'Your data is stored securely using industry-standard practices:\n\n• Account credentials are managed by Clerk, a trusted authentication provider, with encrypted token storage on your device via Expo SecureStore.\n• Application data (submissions, earnings, notifications) is stored on Convex, a secure real-time database platform.\n• Photos and media files are stored on Cloudflare R2 with secure access controls.\n• Audio/video transcriptions are processed through Groq\'s Whisper API and stored securely.\n\nWe implement appropriate technical and organizational measures to protect your data against unauthorized access, alteration, disclosure, or destruction. However, no method of electronic storage is 100% secure, and we cannot guarantee absolute security.',
  },
  {
    id: 4,
    title: 'Offline Data Storage',
    icon: 'phone-portrait-outline',
    content:
      'When you use the App offline, certain data is temporarily stored on your device:\n\n• Draft form data is saved locally using AsyncStorage.\n• Photos and recordings are stored on your device until they can be uploaded.\n• Pending submissions are queued locally and automatically synced when connectivity is restored.\n\nLocally stored data is automatically cleaned up after 7 days if not synced. This data remains on your device and is not accessible to us until it is uploaded to our servers upon reconnection.',
  },
  {
    id: 5,
    title: 'Third-Party Services',
    icon: 'git-network-outline',
    content:
      'We use trusted third-party services to operate the App:\n\n• Clerk — Authentication and session management.\n• Convex — Real-time database and backend functions.\n• Cloudflare R2 — Secure file storage for photos and media.\n• Groq — AI-powered audio/video transcription.\n• Expo — App framework, push notifications, and updates.\n• Google OAuth — Optional social login.\n\nEach third-party provider has their own privacy policy governing how they handle your data. We only share the minimum data necessary for each service to function.',
  },
  {
    id: 6,
    title: 'Business Owner Data',
    icon: 'business-outline',
    content:
      'When you submit a business, you collect data about the business owner on our behalf. This includes:\n\n• Business owner\'s name and contact information.\n• Business details (name, type, address).\n• Portrait photos and interview recordings.\n\nYou must obtain the business owner\'s informed consent before collecting this data. We use this information solely to create and maintain a professional website for the business. Business owners may request removal of their information by contacting us.\n\nAs a creator, you are responsible for ensuring you have proper consent before submitting any business owner\'s personal information through the App.',
  },
  {
    id: 7,
    title: 'Push Notifications',
    icon: 'notifications-outline',
    content:
      'We send push notifications to keep you informed about:\n\n• Submission status updates (approved, rejected, deployed).\n• Payment and earnings notifications.\n• Referral bonus credits.\n• Important announcements and app updates.\n\nYou can manage notification preferences through your device settings. Disabling push notifications will not affect in-app notifications, which will still appear in your notification center within the App.',
  },
  {
    id: 8,
    title: 'Data Retention',
    icon: 'time-outline',
    content:
      'We retain your data as follows:\n\n• Account data is kept for as long as your account is active.\n• Submission data is retained indefinitely as it is used to maintain generated websites.\n• Transaction and payment records are kept for 5 years for legal and tax purposes.\n• Locally cached draft data expires after 7 days.\n• Audit logs and activity records are retained for 2 years.\n\nUpon account deletion, your personal account information will be removed within 30 days. Submitted business data may be retained in anonymized form for the continued operation of generated websites.',
  },
  {
    id: 9,
    title: 'Your Rights',
    icon: 'hand-left-outline',
    content:
      'Under applicable data privacy laws (including the Philippine Data Privacy Act of 2012), you have the right to:\n\n• Access — Request a copy of the personal data we hold about you.\n• Correction — Request correction of inaccurate or incomplete data.\n• Erasure — Request deletion of your personal data (subject to legal retention requirements).\n• Portability — Request your data in a structured, commonly used format.\n• Objection — Object to certain processing of your personal data.\n• Withdrawal — Withdraw consent for data processing at any time.\n\nTo exercise any of these rights, contact us at frmwrkd.media@gmail.com. We will respond within 30 days.',
  },
  {
    id: 10,
    title: 'Children\'s Privacy',
    icon: 'people-outline',
    content:
      'Tendso is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected data from a minor, we will take steps to delete that information promptly.\n\nIf you are a parent or guardian and believe your child has provided personal information through the App, please contact us immediately.',
  },
  {
    id: 11,
    title: 'Changes to This Policy',
    icon: 'create-outline',
    content:
      'We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or legal requirements. When we make significant changes:\n\n• We will notify you through the App or via email.\n• The "Last Updated" date at the top will be revised.\n• Continued use of the App after changes constitutes acceptance of the updated policy.\n\nWe encourage you to review this Privacy Policy periodically.',
  },
  {
    id: 12,
    title: 'Contact Us',
    icon: 'mail-outline',
    content:
      'If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:\n\n• Email: frmwrkd.media@gmail.com\n• In-App: Profile > Help & FAQ\n\nFor data privacy concerns, you may also contact the National Privacy Commission (NPC) of the Philippines at complaints@privacy.gov.ph.\n\nWe aim to respond to all privacy-related inquiries within 30 days.',
  },
];

export default function PrivacyPolicyScreen() {
  const router = useGuardedRouter();
  const [expandedId, setExpandedId] = useState<number | null>(1);

  const toggleItem = (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <ScreenShell title="Privacy Policy" subtitle="Learn how we collect, use, and protect your personal information." onBack={() => router.back()} contentStyle={styles.content}>
      <Text variant="label" weight="medium" tone="muted" style={styles.updated}>
        Last updated: February 2026
      </Text>

      <SectionLabel style={styles.sections}>Sections</SectionLabel>

      {POLICY_SECTIONS.map((section) => {
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
