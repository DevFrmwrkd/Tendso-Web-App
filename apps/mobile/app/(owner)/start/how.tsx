/** Start 3/3 — how do you want to do this: by myself, or a friend holds the phone. */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, ScreenShell, Text } from '../../../components/v2';
import { WayCard } from '../../../components/v2/owner/OwnerUI';
import { ownerIntake, useOwnerIntake } from '../../../lib/v2/ownerIntake';
import { STEP_ROUTE, startProgress } from '../../../lib/v2/ownerFlow';
import { space } from '../../../theme/v2';

export default function HowScreen() {
  const router = useRouter();
  const intake = useOwnerIntake();
  const [how, setHow] = useState<'self' | 'friend'>(intake.how ?? 'self');

  return (
    <ScreenShell
      title="Who holds the phone?"
      progress={startProgress('how')}
      onBack={() => router.back()}
      footer={
        <Button
          title="Next"
          onPress={() => {
            ownerIntake.set({ how });
            router.push(STEP_ROUTE['talk-intro'] as never);
          }}
        />
      }
    >
      <View style={{ gap: space.md }} accessibilityRole="radiogroup">
        <WayCard title="By myself" meta="You film yourself" photo={require('../../../assets/v2/owner/how-self.jpg')} selected={how === 'self'} onPress={() => setHow('self')} />
        <WayCard title="With a friend" meta="A friend films you" photo={require('../../../assets/v2/owner/how-friend.jpg')} selected={how === 'friend'} onPress={() => setHow('friend')} />
        <Pressable
          onPress={() => router.push('/(owner)/(tabs)/agents' as never)}
          accessibilityRole="link"
          hitSlop={8}
          style={{ minHeight: 48, justifyContent: 'center', alignSelf: 'center' }}
        >
          <Text weight="bold" align="center">Send someone to my shop</Text>
        </Pressable>
      </View>
    </ScreenShell>
  );
}
