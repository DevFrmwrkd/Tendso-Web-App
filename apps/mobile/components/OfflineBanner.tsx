import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetwork } from '../providers/NetworkProvider';

export function OfflineBanner() {
  const { isConnected } = useNetwork();

  // null = still determining network state, don't flash the banner
  if (isConnected !== false) return null;

  return (
    <View className="bg-amber-500 px-4 py-2.5 flex-row items-center justify-center">
      <Ionicons name="cloud-offline-outline" size={16} color="white" />
      <Text className="text-white text-sm font-medium ml-2">
        You're offline. Some features are unavailable.
      </Text>
    </View>
  );
}
