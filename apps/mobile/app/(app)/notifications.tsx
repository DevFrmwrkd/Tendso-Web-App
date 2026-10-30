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
import { api, type Doc } from '@tendso/convex-client';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { useNetwork } from '../../providers/NetworkProvider';
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
  const { user } = useUser();
  if (!user) return <Loading />;
  return <NotificationInbox key={user.id} clerkId={user.id} />;
}

function NotificationInbox({ clerkId }: { clerkId: string }) {
  const router = useGuardedRouter();
  const { isConnected } = useNetwork();
  const [selectedNotification, setSelectedNotification] = useState<Doc<'notifications'> | null>(null);
  const [showCertModal, setShowCertModal] = useState(false);
  const certModalRef = useRef<View>(null);

  const creator = useQuery(
    api.creators.getByClerkId,
    { clerkId }
  );

  const notifications = useQuery(
    api.notifications.getByCreator,
    creator?._id ? { creatorId: creator._id } : 'skip'
  );

  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);
  const selected = selectedNotification?.creatorId === creator?._id ? selectedNotification : null;
  const details = useQuery(api.notifications.getDetails, selected ? { id: selected._id } : 'skip');
  const message = details ?? selected;
  const waitingForAnnouncement = !!selected?.data?.announcementId && details === undefined;

  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

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

  const handleNotificationPress = (notification: Doc<'notifications'>) => {
    // Reading never waits for a network write or requires a deep-link payload.
    setSelectedNotification(notification);
    if (!notification.read) {
      void markAsRead({ id: notification._id }).catch(() => {});
    }
  };

  const closeDetails = () => { setSelectedNotification(null); setShowCertModal(false); };

  const handleMarkAllRead = async () => {
    if (creator?._id && unreadCount > 0) {
      try { await markAllAsRead({ creatorId: creator._id }); }
      catch { Alert.alert('Could not mark notifications read', 'You can still open and read each message. Try again when you are connected.'); }
    }
  };

  if (!creator || notifications === undefined) {
    return <Loading />;
  }

  const groups = (['Today', 'This week', 'Earlier'] as const)
    .map((title) => ({
      title,
      items: notifications.filter((n) => groupOf(n.sentAt) === title),
    }))
    .filter((g) => g.items.length > 0);

  const certName = `${creator.firstName || ''} ${creator.lastName || ''}`.trim().toUpperCase();
  const certDate = creator.certifiedAt ? new Date(creator.certifiedAt) : new Date();
  const isFieldAgent = (!creator.role || creator.role === 'creator') && !!creator.certifiedAt && !creator.rejectedAt;
  const canOpenCertificate = isFieldAgent && message?.data?.showCertificate === true;
  const articleSlug = isFieldAgent && typeof message?.data?.articleSlug === 'string' && message.data.articleSlug.trim()
    ? message.data.articleSlug.trim() : null;
  const openArticle = () => {
    if (!articleSlug) return;
    setSelectedNotification(null);
    router.push({ pathname: '/(app)/(tabs)/knowledge/article/[slug]', params: { slug: articleSlug } } as never);
  };

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
                const unread = !notification.read;
                return (
                  <Pressable
                    key={notification._id}
                    onPress={() => handleNotificationPress(notification)}
                    accessibilityLabel={`${notification.title}: ${notification.body}`}
                    accessibilityHint="Opens the full notification"
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
                    <Ionicons name="chevron-forward" size={20} color={colors.ink3Text} style={styles.chevron} />
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

      {/* One native modal keeps the detail-to-certificate transition reliable on iOS. */}
      <Modal
        visible={!!selected || showCertModal}
        animationType="slide"
        transparent
        onRequestClose={closeDetails}
      >
        <View style={styles.scrim} accessibilityViewIsModal onAccessibilityEscape={closeDetails}>
          <Card variant="lg" style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Pressable
                onPress={closeDetails}
                style={styles.roundBtn}
                accessibilityLabel={showCertModal ? 'Close certificate' : 'Close notification'}
                accessibilityRole="button"
              >
                <Ionicons name="close" size={22} color={colors.ink} />
              </Pressable>
              <Text variant="heading" align="center" style={styles.sheetTitle}>
                {showCertModal ? 'My certificate' : 'Notification'}
              </Text>
              {showCertModal ? <Pressable
                onPress={handleShareCert}
                style={styles.roundBtn}
                accessibilityLabel="Share certificate"
                accessibilityRole="button"
              >
                <Ionicons name="share-outline" size={22} color={colors.ink} />
              </Pressable> : <View style={styles.roundSpacer} />}
            </View>

            {showCertModal ? <>
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
            </> : message ? <>
              <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailBody} showsVerticalScrollIndicator>
                <View style={styles.detailMeta}>
                  <NotificationIcon type={message.type} />
                  <Text variant="label" tone="muted" style={styles.rowText}>
                    {new Date(message.sentAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </Text>
                </View>
                <Text variant="heading" accessibilityRole="header" selectable>{message.title}</Text>
                <Text variant="bodyLg" selectable testID="notification-full-body">{message.body}</Text>
                {waitingForAnnouncement ? <Text tone="muted">{isConnected === false
                  ? 'Connect to read the full announcement.' : 'Loading the full message…'}</Text> : null}
              </ScrollView>
              <View style={styles.sheetFoot}>
                {canOpenCertificate ? <Button title="View certificate" icon="ribbon-outline"
                  onPress={() => { setSelectedNotification(null); setShowCertModal(true); }} />
                  : articleSlug ? <Button title="Read article" icon="book-outline" onPress={openArticle} /> : null}
                <Button title="Close" variant={canOpenCertificate || articleSlug ? 'ghost' : 'primary'} onPress={closeDetails} />
              </View>
            </> : null}
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
  chevron: { alignSelf: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink },
  scrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', paddingHorizontal: space.lg },
  sheet: { maxHeight: '88%', padding: 0, overflow: 'hidden' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  sheetTitle: { flex: 1 },
  roundSpacer: { width: hit.icon },
  detailScroll: { flexShrink: 1 },
  detailBody: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.lg },
  detailMeta: { flexDirection: 'row', alignItems: 'center', gap: space.md },
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
