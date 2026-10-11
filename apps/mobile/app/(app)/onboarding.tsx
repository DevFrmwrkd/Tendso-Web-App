import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { Ionicons } from '@expo/vector-icons';

function generateReferralCode(firstName: string, lastName: string): string {
  const namePrefix = (firstName.substring(0, 2) + lastName.substring(0, 1)).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${namePrefix}${random}`;
}

export default function OnboardingScreen() {
  const router = useGuardedRouter();
  const { user, isLoaded } = useUser();
  const createCreator = useMutation(api.creators.create);
  const existingCreator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Redirect if user already has a profile
  useEffect(() => {
    if (isLoaded && existingCreator) {
      router.replace('/(app)/dashboard');
    }
  }, [isLoaded, existingCreator, router]);

  // Pre-fill from Clerk if available (only once)
  useEffect(() => {
    if (isLoaded && user && !initialized) {
      if (user.firstName) setFirstName(user.firstName);
      if (user.lastName) setLastName(user.lastName);
      setInitialized(true);
    }
  }, [isLoaded, user, initialized]);

  const handleSubmit = async () => {
    setError(null);

    if (!user) {
      setError('You must be signed in');
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required');
      return;
    }

    // Basic phone validation (Philippine format)
    const phoneRegex = /^(\+63|0)?9\d{9}$/;
    if (phone && !phoneRegex.test(phone.replace(/\s/g, ''))) {
      setError('Please enter a valid Philippine phone number (e.g., 09123456789)');
      return;
    }

    setLoading(true);

    try {
      const referralCode = generateReferralCode(firstName, lastName);

      await createCreator({
        clerkId: user.id,
        firstName: firstName.trim(),
        middleName: middleName.trim() || undefined,
        lastName: lastName.trim(),
        email: user.primaryEmailAddress?.emailAddress,
        phone: phone.trim() || undefined,
        referralCode,
      });

      router.replace('/(app)/dashboard');
    } catch (err: any) {
      console.error('Failed to create profile:', err);
      setError(err.message || 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#E4B05E" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-6 pt-12 pb-8">
            {/* Header */}
            <View className="items-center mb-8">
              <View className="w-16 h-16 bg-emerald-100 rounded-full items-center justify-center mb-4">
                <Ionicons name="person-add" size={32} color="#E4B05E" />
              </View>
              <Text className="text-2xl font-bold text-zinc-900">Complete Your Profile</Text>
              <Text className="text-zinc-500 mt-1 text-center">
                Help us personalize your experience.
              </Text>
            </View>

            {/* Error Message */}
            {error ? (
              <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <Text className="text-red-600 text-sm font-medium">{error}</Text>
              </View>
            ) : null}

            {/* Form */}
            <View className="flex-1">
              {/* First Name & Middle Name Row */}
              <View className="flex-row mb-4">
                <View className="flex-1 mr-2">
                  <Text className="text-zinc-700 font-medium mb-2">First Name *</Text>
                  <TextInput
                    className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 h-14 text-base text-zinc-900"
                    placeholder="Juan"
                    placeholderTextColor="#a1a1aa"
                    value={firstName}
                    onChangeText={setFirstName}
                    editable={!loading}
                  />
                </View>
                <View className="flex-1 ml-2">
                  <Text className="text-zinc-700 font-medium mb-2">Middle Name</Text>
                  <TextInput
                    className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 h-14 text-base text-zinc-900"
                    placeholder="Santos"
                    placeholderTextColor="#a1a1aa"
                    value={middleName}
                    onChangeText={setMiddleName}
                    editable={!loading}
                  />
                </View>
              </View>

              {/* Last Name */}
              <View className="mb-4">
                <Text className="text-zinc-700 font-medium mb-2">Last Name *</Text>
                <TextInput
                  className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 h-14 text-base text-zinc-900"
                  placeholder="Dela Cruz"
                  placeholderTextColor="#a1a1aa"
                  value={lastName}
                  onChangeText={setLastName}
                  editable={!loading}
                />
              </View>

              {/* Phone Number */}
              <View className="mb-6">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-zinc-700 font-medium">Mobile Number</Text>
                  <Text className="text-xs text-zinc-400">Optional</Text>
                </View>
                <View className="flex-row">
                  <View className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 h-14 items-center justify-center mr-2">
                    <Text className="text-zinc-700 font-medium">+63</Text>
                  </View>
                  <View className="flex-1 flex-row items-center bg-zinc-50 border border-zinc-200 rounded-xl px-4 h-14">
                    <Ionicons name="call-outline" size={20} color="#71717a" />
                    <TextInput
                      className="flex-1 ml-3 text-base text-zinc-900"
                      placeholder="912 345 4567"
                      placeholderTextColor="#a1a1aa"
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      editable={!loading}
                    />
                  </View>
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                className={`h-14 rounded-xl items-center justify-center ${
                  loading ? 'bg-zinc-400' : 'bg-zinc-900'
                }`}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator color="white" size="small" />
                    <Text className="text-white font-semibold text-base ml-2">
                      Creating profile...
                    </Text>
                  </View>
                ) : (
                  <Text className="text-white font-semibold text-base">Complete Setup</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
