import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useFocusEffect } from 'expo-router';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { Ionicons } from '@expo/vector-icons';
import type { Id } from '@tendso/convex-client';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import CertificateCard from '../../components/CertificateCard';

type NotificationType =
  | 'submission_approved'
  | 'submission_rejected'
  | 'new_lead'
  | 'payout_sent'
  | 'website_live'
  | 'submission_created'
  | 'profile_updated'
  | 'password_changed'
  | 'certification'
  | 'system';

function getNotificationIcon(type: NotificationType): { name: string; color: string; bg: string } {
  switch (type) {
    case 'submission_approved':
      return { name: 'checkmark-circle', color: '#E4B05E', bg: 'bg-emerald-100' };
    case 'submission_rejected':
      return { name: 'close-circle', color: '#ef4444', bg: 'bg-red-100' };
    case 'new_lead':
      return { name: 'person-add', color: '#3b82f6', bg: 'bg-blue-100' };
    case 'payout_sent':
      return { name: 'cash', color: '#E4B05E', bg: 'bg-emerald-100' };
    case 'website_live':
      return { name: 'globe', color: '#8b5cf6', bg: 'bg-purple-100' };
    case 'submission_created':
      return { name: 'add-circle', color: '#6366f1', bg: 'bg-indigo-100' };
    case 'profile_updated':
      return { name: 'person-circle', color: '#f59e0b', bg: 'bg-amber-100' };
    case 'password_changed':
      return { name: 'lock-closed', color: '#71717a', bg: 'bg-zinc-100' };
    case 'certification':
      return { name: 'ribbon', color: '#E4B05E', bg: 'bg-emerald-100' };
    case 'system':
    default:
      return { name: 'information-circle', color: '#71717a', bg: 'bg-zinc-100' };
  }
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function NotificationsScreen() {
  const router = useGuardedRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const [showCertModal, setShowCertModal] = useState(false);
  const certModalRef = useRef<View>(null);

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
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#E4B05E" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 py-4 flex-row items-center justify-between border-b border-zinc-100">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center rounded-full bg-zinc-50"
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={20} color="#18181b" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-zinc-900 ml-4">Notifications</Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} accessibilityLabel="Mark all as read" accessibilityRole="button">
            <Text className="text-sm font-semibold text-emerald-600">Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {notifications && notifications.length > 0 ? (
          notifications.map((notification) => {
            const icon = getNotificationIcon(notification.type as NotificationType);
            return (
              <TouchableOpacity
                key={notification._id}
                className={`px-4 py-4 flex-row border-b border-zinc-50 ${
                  !notification.read ? 'bg-emerald-50/30' : ''
                }`}
                onPress={() => handleNotificationPress(notification)}
                accessibilityLabel={`${notification.title}: ${notification.body}`}
                accessibilityRole="button"
              >
                <View className={`w-10 h-10 rounded-full items-center justify-center ${icon.bg}`}>
                  <Ionicons name={icon.name as any} size={20} color={icon.color} />
                </View>
                <View className="ml-3 flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text
                      className={`text-sm font-bold ${
                        !notification.read ? 'text-zinc-900' : 'text-zinc-700'
                      }`}
                      numberOfLines={1}
                    >
                      {notification.title}
                    </Text>
                    {!notification.read && (
                      <View className="w-2 h-2 rounded-full bg-emerald-500 ml-2" />
                    )}
                  </View>
                  <Text className="text-sm text-zinc-500 mt-0.5" numberOfLines={2}>
                    {notification.body}
                  </Text>
                  <Text className="text-xs text-zinc-400 mt-1">
                    {timeAgo(notification.sentAt)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View className="flex-1 items-center justify-center py-20">
            <Ionicons name="notifications-off-outline" size={48} color="#a1a1aa" />
            <Text className="text-zinc-500 text-base mt-4">No notifications yet</Text>
            <Text className="text-zinc-400 text-sm mt-1">
              You'll be notified about submission updates and more.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Certificate Modal */}
      <Modal
        visible={showCertModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCertModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 20,
        }}>
          <View style={{
            backgroundColor: '#fff',
            borderRadius: 24,
            width: '100%',
            maxHeight: '85%',
            overflow: 'hidden',
          }}>
            {/* Modal header */}
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: 16, paddingVertical: 14,
              borderBottomWidth: 1, borderBottomColor: '#f4f4f5',
            }}>
              <TouchableOpacity
                onPress={() => setShowCertModal(false)}
                style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: '#f4f4f5',
                  alignItems: 'center', justifyContent: 'center',
                }}
                accessibilityLabel="Close certificate"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={18} color="#18181b" />
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#18181b', flex: 1, textAlign: 'center' }}>
                My Certificate
              </Text>
              <TouchableOpacity
                onPress={handleShareCert}
                style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: '#f4f4f5',
                  alignItems: 'center', justifyContent: 'center',
                }}
                accessibilityLabel="Share certificate"
                accessibilityRole="button"
              >
                <Ionicons name="share-outline" size={16} color="#18181b" />
              </TouchableOpacity>
            </View>

            {/* Certificate */}
            <ScrollView
              contentContainerStyle={{ padding: 20, alignItems: 'center' }}
              showsVerticalScrollIndicator={false}
            >
              <CertificateCard
                ref={certModalRef}
                creatorName={
                  creator
                    ? `${((creator as any).firstName || '').toUpperCase()} ${((creator as any).lastName || '').toUpperCase()}`.trim()
                    : ''
                }
                certMonth={
                  (creator as any)?.certifiedAt
                    ? new Date((creator as any).certifiedAt).toLocaleString('en-US', { month: 'long' })
                    : new Date().toLocaleString('en-US', { month: 'long' })
                }
                certYear={
                  (creator as any)?.certifiedAt
                    ? new Date((creator as any).certifiedAt).getFullYear()
                    : new Date().getFullYear()
                }
              />
            </ScrollView>

            {/* Action buttons */}
            <View style={{
              paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20,
              borderTopWidth: 1, borderTopColor: '#f4f4f5',
            }}>
              <TouchableOpacity
                onPress={handleDownloadCert}
                activeOpacity={0.85}
                style={{
                  backgroundColor: '#E4B05E',
                  height: 50, borderRadius: 14,
                  flexDirection: 'row',
                  alignItems: 'center', justifyContent: 'center',
                  marginBottom: 8,
                }}
                accessibilityLabel="Save certificate to gallery"
                accessibilityRole="button"
              >
                <Ionicons name="download-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>
                  Save to Gallery
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleShareCert}
                activeOpacity={0.7}
                style={{
                  height: 44, borderRadius: 14,
                  flexDirection: 'row',
                  alignItems: 'center', justifyContent: 'center',
                }}
                accessibilityLabel="Share certificate"
                accessibilityRole="button"
              >
                <Ionicons name="share-outline" size={16} color="#E4B05E" style={{ marginRight: 6 }} />
                <Text style={{ color: '#E4B05E', fontSize: 14, fontWeight: '700' }}>
                  Share Certificate
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
