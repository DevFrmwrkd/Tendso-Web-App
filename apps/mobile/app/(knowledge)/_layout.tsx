import React from 'react';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { KnowledgeAccess } from '../../components/knowledge/KnowledgeAccess';

export default function SharedKnowledgeLayout() {
  return <KnowledgeAccess><Stack screenOptions={{ headerShown: false, animation: Platform.OS === 'ios' ? 'default' : 'slide_from_right' }}>
    <Stack.Screen name="ask" />
    <Stack.Screen name="article/[slug]" />
  </Stack></KnowledgeAccess>;
}
