import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Pressable,
  ScrollView,
  Modal,
  Alert,
  Platform,
  PermissionsAndroid,
  StyleSheet,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useFocusEffect } from 'expo-router';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import CertificateCard from '../../components/CertificateCard';
import {
  Button,
  Card,
  EmptyState,
  Loading,
  ScreenShell,
  SectionLabel,
  Text,
  TextLink,
} from '../../components/v2';
import { NotificationIcon, timeAgo } from '../../components/v2/NotificationIcon';
import { colors, hit, radius, shadow, space } from '../../theme/v2';

const DAY = 86_400_000;

/** Today = last 24 hours, This week = last 7 days, everything else = Earlier. */
function groupOf(sentAt: number): 'Today' | 'This week' | 'Earlier' {
  const age = Date.now() - sentAt;
  if (age < DAY) return 'Today';
  if (age < 7 * DAY) return 'This week';
  return 'Earlier';
}

export default function NotificationsScreen() {
  const router = useGuardedRouter();
  const { user } = useUser();
  const [showCertModal, setShowCertModal] = useState(false);
  const certModalRef = useRef<View>(null);
  const seenUnread = useRef<Set<string>>(new Set());

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );

  const notifications = useQuery(
    api.notifications.getByCreator,
    creator?._id ? { creatorId: creator._id } : 'skip'
  );

  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);

  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  // Auto-clear the bell badge whenever this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (creator?._id) {
        markAllAsRead({ creatorId: creator._id });
      }
    }, [creator?._id])
  );

  const handleShareCert = useCallback(async () => {
    try {
      const uri = await captureRef(certModalRef, {
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

  const handleDownloadCert = useCallback(async () => {
    try {
      if (Platform.OS === 'android' && (Platform.Version as number) < 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Save Certificate',
            message: 'Allow the app to save your certificate to your gallery.',
            buttonPositive: 'Allow',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission needed', 'Please allow access to save the certificate.');
          return;
        }
      }
      const uri = await captureRef(certModalRef, {
        format: 'png',
        quality: 1,
      });
      const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;
      await MediaLibrary.saveToLibraryAsync(fileUri);
      Alert.alert('Saved!', 'Certificate has been saved to your gallery.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save certificate. Please try again.');
    }
  }, []);

  const handleNotificationPress = async (notification: any) => {
    // Mark as read
    if (!notification.read) {
      await markAsRead({ id: notification._id });
    }

    // Deep link based on notification type
    if (notification.data?.showCertificate) {
      setShowCertModal(true);
    } else if (notification.data?.submissionId) {
      router.push(`/(app)/submissions/${notification.data.submissionId}` as any);
    } else if (notification.data?.articleSlug) {
      // "Your question was answered" — the escalation loop captures the answer as
      // a KB article and puts its slug here. Open the article. (No-ops safely
      // until the backend that sets articleSlug is deployed.)
      router.push(`/(app)/(tabs)/knowledge/article/${notification.data.articleSlug}` as any);
    }
  };

  const handleMarkAllRead = async () => {
    if (creator?._id && unreadCount > 0) {
      await markAllAsRead({ creatorId: creator._id });
    }
  };

  if (!creator || notifications === undefined) {
    return <Loading />;
  }

  // Auto mark-all-read runs as soon as this screen opens. Remember what was unread when it
  // arrived so those cards stay white (with the ink dot) for this visit.
  for (const n of notifications) {
    if (!n.read) seenUnread.current.add(n._id);
  }

  const groups = (['Today', 'This week', 'Earlier'] as const)
    .map((title) => ({
      title,
      items: notifications.filter((n) => groupOf(n.sentAt) === title),
    }))
    .filter((g) => g.items.length > 0);

  const certName = creator
    ? `${((creator as any).firstName || '').toUpperCase()} ${((creator as any).lastName || '').toUpperCase()}`.trim()
    : '';
  const certDate = (creator as any)?.certifiedAt ? new Date((creator as any).certifiedAt) : new Date();

  return (
    <ScreenShell
      title="Notifications"
      onBack={() => router.back()}
      headerRight={
        unreadCount > 0 ? <TextLink label="Mark all read" onPress={handleMarkAllRead} /> : undefined
      }
    >
      {notifications.length > 0 ? (
        <View style={styles.list}>
          {groups.map((group) => (
            <View key={group.title} style={styles.group}>
              <SectionLabel>{group.title}</SectionLabel>
              {group.items.map((notification) => {
                const unread = seenUnread.current.has(notification._id);
                return (
                  <Pressable
                    key={notification._id}
                    onPress={() => handleNotificationPress(notification)}
                    accessibilityLabel={`${notification.title}: ${notification.body}`}
                    accessibilityRole="button"
                    style={[styles.row, unread ? styles.rowUnread : styles.rowOld, unread ? shadow.soft : null]}
                  >
                    <NotificationIcon type={notification.type} />
                    <View style={styles.rowText}>
                      <View style={styles.rowHead}>
                        <Text variant="body" weight="bold" numberOfLines={1} style={styles.rowTitle}>
                          {notification.title}
                        </Text>
                        {unread ? <View style={styles.dot} accessibilityLabel="Unread" /> : null}
                      </View>
                      <Text variant="label" weight="medium" tone="ink2" numberOfLines={2}>
                        {notification.body}
                      </Text>
                      <Text variant="label" tone="muted">
                        {timeAgo(notification.sentAt)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ) : (
        <EmptyState
          icon="notifications-off-outline"
          title="No notifications yet"
          body="Updates about your sites show up here."
        />
      )}

      {/* Certificate Modal */}
      <Modal
        visible={showCertModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCertModal(false)}
      >
        <View style={styles.scrim}>
          <Card variant="lg" style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Pressable
                onPress={() => setShowCertModal(false)}
                style={styles.roundBtn}
                accessibilityLabel="Close certificate"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={22} color={colors.ink} />
              </Pressable>
              <Text variant="heading" align="center" style={styles.sheetTitle}>
                My certificate
              </Text>
              <Pressable
                onPress={handleShareCert}
                style={styles.roundBtn}
                accessibilityLabel="Share certificate"
                accessibilityRole="button"
              >
                <Ionicons name="share-outline" size={22} color={colors.ink} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.certBody} showsVerticalScrollIndicator={false}>
              <CertificateCard
                ref={certModalRef}
                creatorName={certName}
                certMonth={certDate.toLocaleString('en-US', { month: 'long' })}
                certYear={certDate.getFullYear()}
              />
            </ScrollView>

            <View style={styles.sheetFoot}>
              <Button
                title="Save to gallery"
                icon="download-outline"
                onPress={handleDownloadCert}
                accessibilityLabel="Save certificate to gallery"
              />
              <Button
                title="Share certificate"
                variant="ghost"
                size="md"
                icon="share-outline"
                onPress={handleShareCert}
                accessibilityLabel="Share certificate"
              />
            </View>
          </Card>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.lg },
  group: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, borderRadius: radius.card, padding: space.md },
  rowUnread: { backgroundColor: colors.card },
  rowOld: { backgroundColor: 'transparent' },
  rowText: { flex: 1, gap: 2 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowTitle: { flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink },
  scrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', paddingHorizontal: space.lg },
  sheet: { maxHeight: '88%', padding: 0, overflow: 'hidden' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  sheetTitle: { flex: 1 },
  roundBtn: {
    width: hit.icon,
    height: hit.icon,
    borderRadius: 999,
    backgroundColor: colors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  certBody: { padding: space.lg, alignItems: 'center' },
  sheetFoot: { padding: space.lg, gap: space.sm },
});
