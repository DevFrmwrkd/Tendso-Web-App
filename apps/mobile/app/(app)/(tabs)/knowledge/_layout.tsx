import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { KnowledgeProvider } from '../../../../services/knowledge/KnowledgeProvider';

export default function KnowledgeLayout() {
  return (
    <KnowledgeProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: Platform.OS === 'ios' ? 'default' : 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="search" />
        <Stack.Screen name="ask" />
        <Stack.Screen name="article/[slug]" />
        <Stack.Screen name="category/[slug]" />
      </Stack>
    </KnowledgeProvider>
  );
}
