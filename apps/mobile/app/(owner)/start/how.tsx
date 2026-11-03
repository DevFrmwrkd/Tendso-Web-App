/** Start 3/3 — how do you want to do this: by myself, or a friend holds the phone. */
import React, { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, ScreenShell, Text } from '../../../components/v2';
import { WayCard } from '../../../components/v2/owner/OwnerUI';
import { OwnerSaveExit } from '../../../components/v2/owner/OwnerSaveExit';
import { ownerIntake, useOwnerIntake } from '../../../lib/v2/ownerIntake';
import { STEP_ROUTE, startProgress } from '../../../lib/v2/ownerFlow';
import { useOwnerScope } from '../../../lib/v2/useOwnerScope';
import { space } from '../../../theme/v2';

export default function HowScreen() {
  const scope = useOwnerScope();
  return <PhoneChoice key={`${scope.scopeKey}:${ownerIntake.scope()}`} scope={scope} />;
}
function PhoneChoice({ scope }: { scope: ReturnType<typeof useOwnerScope> }) {
  const router = useRouter();
  const intake = useOwnerIntake();
  const confirmed = !!scope.id && intake.submissionId === scope.id && intake.howConfirmedFor === scope.id;
  const [how, setHow] = useState<'self' | 'friend' | null>(confirmed && (intake.how === 'self' || intake.how === 'friend') ? intake.how : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const select = (choice: 'self' | 'friend') => {
    if (!saving.current && scope.isDraftCurrent()) setHow(choice);
  };
  const next = async () => {
    if (!scope.id || !how || saving.current || !scope.isDraftCurrent()) return;
    saving.current = true; setBusy(true); setError(null);
    const previous = ownerIntake.get();
    try {
      ownerIntake.set({ submissionId: scope.id, how, howConfirmedFor: scope.id });
      await ownerIntake.flush();
      if (scope.isDraftCurrent()) router.push(STEP_ROUTE['talk-intro'] as never);
    } catch {
      if (scope.isCurrent()) {
        ownerIntake.set({ how: previous.how, howConfirmedFor: previous.howConfirmedFor });
        setError('Could not save your choice. Please try again.');
      }
    } finally {
      saving.current = false;
      if (scope.isCurrent()) setBusy(false);
    }
  };

  return (
    <ScreenShell
      title="Who holds the phone?"
      progress={startProgress('how')}
      headerRight={<OwnerSaveExit disabled={busy} canExit={() => !saving.current} beforeSave={() => {
        if (scope.id && how && scope.isDraftCurrent()) ownerIntake.set({ submissionId: scope.id, how, howConfirmedFor: scope.id });
      }} />}
      onBack={() => { if (!saving.current && scope.isCurrent()) router.dismissTo(STEP_ROUTE.place as never); }}
      footer={
        <>
          {error ? <Text tone="danger" align="center">{error}</Text> : null}
          <Button
            title="Next"
            disabled={!scope.id || !how || !scope.isDraftCurrent()}
            loading={busy}
            onPress={() => { void next(); }}
          />
        </>
      }
    >
      <View style={{ gap: space.md }} accessibilityRole="radiogroup">
        <WayCard title="By myself" meta="You film yourself" photo={require('../../../assets/v2/owner/how-self.jpg')} selected={how === 'self'} onPress={() => select('self')} />
        <WayCard title="With a friend" meta="A friend films you" photo={require('../../../assets/v2/owner/how-friend.jpg')} selected={how === 'friend'} onPress={() => select('friend')} />
        <Pressable
          onPress={() => { if (!saving.current && scope.isCurrent()) router.push('/(owner)/(tabs)/agents' as never); }}
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
