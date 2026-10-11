import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '@clerk/clerk-expo';
import { useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useFocusEffect } from 'expo-router';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { GuardedLink } from '../../../components/GuardedLink';
import { Ionicons } from '@expo/vector-icons';
import { openExternalUrl } from '../../../services/links';

// Statuses where the generated website is live and worth linking to (mirrors the
// submission detail screen's "View Live Website" gate).
const WEBSITE_READY_STATUSES = [
  'deployed', 'pending_payment', 'paid', 'completed', 'website_generated',
];

export default function SubmissionsScreen() {
  const router = useGuardedRouter();
  const { user, isLoaded } = useUser();

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );

  const submissions = useQuery(
    api.submissions.getByCreatorId,
    creator?._id ? { creatorId: creator._id } : 'skip'
  );

  // Always go to dashboard when back button is pressed (prevents going back to submit flow)
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        router.replace('/(app)/dashboard');
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => {
        subscription.remove();
      };
    }, [router])
  );

  if (!isLoaded || creator === undefined || submissions === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#E4B05E" />
      </View>
    );
  }

  const getStatusBadge = (sub: any) => {
    const isIncomplete =
      !sub.photos ||
      sub.photos.length === 0 ||
      (!sub.videoStorageId && !sub.audioStorageId);
    const isDraft = sub.status === 'draft' || isIncomplete;

    if (sub.status === 'approved') return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Verified' };
    if (sub.status === 'rejected') return { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' };
    if (isDraft) return { bg: 'bg-zinc-100', text: 'text-zinc-600', label: 'Draft' };
    if (sub.status === 'submitted') return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Submitted' };
    if (sub.status === 'website_generated') return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Website Ready' };
    if (sub.status === 'deployed') return { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Deployed' };
    if (sub.status === 'paid') return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Paid' };
    return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' };
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 py-4 flex-row items-center border-b border-zinc-100">
        <TouchableOpacity
          onPress={() => router.replace('/(app)/dashboard')}
          className="w-10 h-10 items-center justify-center rounded-full bg-zinc-50"
        >
          <Ionicons name="arrow-back" size={20} color="#18181b" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-zinc-900 ml-4">My Submissions</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
        {submissions && submissions.length > 0 ? (
          <View className="space-y-3">
            {submissions.map((sub: any) => {
              const badge = getStatusBadge(sub);
              const isIncomplete =
                !sub.photos ||
                sub.photos.length === 0 ||
                (!sub.videoStorageId && !sub.audioStorageId);
              const isDraft = sub.status === 'draft' || isIncomplete;

              return (
                <GuardedLink key={sub._id} href={`/(app)/submissions/${sub._id}`} asChild>
                  <TouchableOpacity className="bg-white rounded-xl p-4 border border-zinc-100 shadow-sm mb-3">
                    <View className="flex-row items-start justify-between">
                      <View className="flex-row items-center flex-1">
                        <View
                          className={`w-12 h-12 rounded-xl items-center justify-center ${
                            isDraft
                              ? 'bg-zinc-100'
                              : sub.status === 'approved'
                              ? 'bg-emerald-100'
                              : sub.status === 'rejected'
                              ? 'bg-red-100'
                              : 'bg-yellow-100'
                          }`}
                        >
                          <Ionicons
                            name={isDraft ? 'time' : 'storefront'}
                            size={24}
                            color={
                              isDraft
                                ? '#71717a'
                                : sub.status === 'approved'
                                ? '#E4B05E'
                                : sub.status === 'rejected'
                                ? '#ef4444'
                                : '#eab308'
                            }
                          />
                        </View>
                        <View className="ml-3 flex-1">
                          <Text className="font-bold text-base text-zinc-900" numberOfLines={1}>
                            {sub.businessName}
                          </Text>
                          <Text className="text-xs text-zinc-500 mt-0.5">
                            {sub.businessType} • {sub.city}
                          </Text>
                          <Text className="text-xs text-zinc-400 mt-1">
                            {new Date(sub._creationTime).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                      <View className={`px-3 py-1.5 rounded-full ${badge.bg}`}>
                        <Text className={`text-xs font-bold ${badge.text}`}>{badge.label}</Text>
                      </View>
                    </View>

                    {/* Progress indicators */}
                    <View className="flex-row mt-4 pt-3 border-t border-zinc-100">
                      <View className="flex-row items-center mr-4">
                        <Ionicons
                          name={sub.photos?.length > 0 ? 'checkmark-circle' : 'ellipse-outline'}
                          size={16}
                          color={sub.photos?.length > 0 ? '#E4B05E' : '#d4d4d8'}
                        />
                        <Text className="text-xs text-zinc-500 ml-1">Photos</Text>
                      </View>
                      <View className="flex-row items-center mr-4">
                        <Ionicons
                          name={
                            sub.videoStorageId || sub.audioStorageId
                              ? 'checkmark-circle'
                              : 'ellipse-outline'
                          }
                          size={16}
                          color={
                            sub.videoStorageId || sub.audioStorageId ? '#E4B05E' : '#d4d4d8'
                          }
                        />
                        <Text className="text-xs text-zinc-500 ml-1">Interview</Text>
                      </View>
                      <View className="flex-row items-center">
                        <Ionicons
                          name={sub.status !== 'draft' ? 'checkmark-circle' : 'ellipse-outline'}
                          size={16}
                          color={sub.status !== 'draft' ? '#E4B05E' : '#d4d4d8'}
                        />
                        <Text className="text-xs text-zinc-500 ml-1">Submitted</Text>
                      </View>
                    </View>

                    {/* Finished website — links straight to the live site. */}
                    {WEBSITE_READY_STATUSES.includes(sub.status) && sub.websiteUrl && (
                      <TouchableOpacity
                        onPress={() => void openExternalUrl(sub.websiteUrl)}
                        hitSlop={6}
                        accessibilityRole="link"
                        accessibilityLabel={`View ${sub.businessName} website`}
                        className="flex-row items-center mt-3"
                      >
                        <Ionicons name="globe-outline" size={16} color="#8b5cf6" />
                        <Text className="text-xs font-medium text-purple-700 ml-1.5">View website</Text>
                        <Ionicons name="open-outline" size={14} color="#8b5cf6" style={{ marginLeft: 4 }} />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                </GuardedLink>
              );
            })}
          </View>
        ) : (
          <View className="flex-1 items-center justify-center py-16">
            <View className="w-20 h-20 bg-zinc-100 rounded-full items-center justify-center mb-4">
              <Ionicons name="folder-open-outline" size={40} color="#a1a1aa" />
            </View>
            <Text className="text-lg font-bold text-zinc-900 mb-2">No Submissions Yet</Text>
            <Text className="text-zinc-500 text-center px-8 mb-6">
              Start by adding your first business submission.
            </Text>
            <GuardedLink href="/(app)/submit/info" asChild>
              <TouchableOpacity className="flex-row items-center bg-emerald-500 rounded-xl px-6 py-3">
                <Ionicons name="add" size={20} color="white" />
                <Text className="text-white font-semibold ml-2">Add Submission</Text>
              </TouchableOpacity>
            </GuardedLink>
          </View>
        )}
      </ScrollView>

      {/* FAB for new submission */}
      {submissions && submissions.length > 0 && (
        <View className="absolute bottom-6 right-6">
          <GuardedLink href="/(app)/submit/info" asChild>
            <TouchableOpacity className="w-14 h-14 bg-emerald-500 rounded-full items-center justify-center shadow-lg shadow-emerald-500/40">
              <Ionicons name="add" size={28} color="white" />
            </TouchableOpacity>
          </GuardedLink>
        </View>
      )}
    </SafeAreaView>
  );
}
