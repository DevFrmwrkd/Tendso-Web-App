/** Start 1/3 — What do you sell? One question, photo rows (mock owner board "q1"). */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, ScreenShell } from '../../../components/v2';
import { OptionRow } from '../../../components/v2/owner/OwnerUI';
import { SELL_KINDS, type SellKindId } from '../../../lib/v2/ownerContent';
import { ownerIntake, useOwnerIntake } from '../../../lib/v2/ownerIntake';
import { STEP_ROUTE, startProgress } from '../../../lib/v2/ownerFlow';
import { space } from '../../../theme/v2';

export default function SellScreen() {
  const router = useRouter();
  const intake = useOwnerIntake();
  const [kind, setKind] = useState<SellKindId | undefined>(intake.kind);
  useEffect(() => { if (!kind && intake.kind) setKind(intake.kind); }, [intake.kind, kind]);

  return (
    <ScreenShell
      title="What do you sell?"
      progress={startProgress('sell')}
      onBack={router.canGoBack() ? () => router.back() : undefined}
      footer={
        <Button
          title="Next"
          disabled={!kind}
          onPress={() => {
            ownerIntake.set({ kind });
            router.push(STEP_ROUTE.place as never);
          }}
        />
      }
    >
      <View style={{ gap: space.md }} accessibilityRole="radiogroup">
        {SELL_KINDS.map((k) => (
          <OptionRow key={k.id} label={k.label} photo={k.photo} selected={kind === k.id} onPress={() => setKind(k.id)} />
        ))}
      </View>
    </ScreenShell>
  );
}
