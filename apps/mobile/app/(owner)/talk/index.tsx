/** Talk start (SIMPLE-FLOWS O6): the buddy, "Now just talk.", one button. Voice only on request. */
import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, ScreenShell, Text } from '../../../components/v2';
import { Buddy } from '../../../components/v2/owner/OwnerUI';
import { ownerIntake } from '../../../lib/v2/ownerIntake';
import { STEP_ROUTE } from '../../../lib/v2/ownerFlow';
import { space } from '../../../theme/v2';

export default function TalkIntro() {
  const router = useRouter();
  const start = (audioOnly: boolean) => {
    ownerIntake.set({ audioOnly });
    router.push(STEP_ROUTE.talk as never);
  };
  return (
    <ScreenShell
      onBack={() => router.back()}
      scroll={false}
      footer={
        <>
          <Button title="Start" onPress={() => start(false)} />
          <Pressable onPress={() => start(true)} accessibilityRole="button" hitSlop={8} style={{ minHeight: 48, justifyContent: 'center' }}>
            <Text weight="bold" align="center">Voice only, no video</Text>
          </Pressable>
        </>
      }
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
        <Buddy size={168} />
        <Text variant="display" align="center" accessibilityRole="header">Now just talk.</Text>
        <Text variant="bodyLg" tone="ink2" align="center">10 short questions.</Text>
      </View>
    </ScreenShell>
  );
}
