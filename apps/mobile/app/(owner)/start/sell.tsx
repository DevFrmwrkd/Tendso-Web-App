/** Start 1/3 — What do you sell? One question, photo rows (mock owner board "q1"). */
import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, ScreenShell, Text } from '../../../components/v2';
import { OptionRow } from '../../../components/v2/owner/OwnerUI';
import { OwnerSaveExit } from '../../../components/v2/owner/OwnerSaveExit';
import { SELL_KINDS, sellKind, sellKindFromServer } from '../../../lib/v2/ownerContent';
import { useOwnerSubmission } from '../../../lib/v2/ownerData';
import { ownerIntake, useOwnerIntake, type OwnerIntake } from '../../../lib/v2/ownerIntake';
import { STEP_ROUTE, startProgress } from '../../../lib/v2/ownerFlow';
import { useOwnerScope } from '../../../lib/v2/useOwnerScope';
import { space } from '../../../theme/v2';

export default function SellScreen() {
  const scope = useOwnerScope();
  return <SellChoice key={scope.scopeKey} scope={scope} />;
}
function SellChoice({ scope }: { scope: ReturnType<typeof useOwnerScope> }) {
  const router = useRouter();
  const intake = useOwnerIntake();
  const sub = useOwnerSubmission(scope.id);
  const ownSub = sub?.submissionId === scope.id ? sub : undefined;
  const local: OwnerIntake = scope.isNewBusiness || !scope.id || intake.submissionId === scope.id ? intake : {};
  const kind = sellKind(local.kind)?.id ?? (ownSub ? sellKindFromServer(ownSub.businessType, ownSub.shotListKey).id : undefined);
  const editable = scope.isNewBusiness || !scope.site || scope.site.phase === 'draft';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const next = async () => {
    if (!kind || !editable || saving.current || !scope.isCurrent()) return;
    saving.current = true; setBusy(true); setError(null);
    try {
      ownerIntake.set({ kind });
      await ownerIntake.flush();
      if (scope.isCurrent()) router.push(STEP_ROUTE.place as never);
    } catch {
      if (scope.isCurrent()) setError('Could not save your choice. Please try again.');
    } finally { saving.current = false; if (scope.isCurrent()) setBusy(false); }
  };
  const back = () => {
    if (saving.current || !scope.isCurrent()) return;
    if (!scope.isNewBusiness) { router.back(); return; }
    const sites = scope.me?.sites ?? [];
    const previous = ownerIntake.previousBusiness();
    const fallback = sites.find(site => site.submissionId === previous)
      ?? sites.reduce<(typeof sites)[number] | undefined>((latest, site) => !latest || site.createdAt > latest.createdAt ? site : latest, undefined);
    ownerIntake.cancelNewBusiness(fallback?.submissionId);
    router.dismissTo(STEP_ROUTE.home as never);
  };

  return (
    <ScreenShell
      title="What do you sell?"
      progress={startProgress('sell')}
      headerRight={<OwnerSaveExit disabled={busy} canExit={() => !saving.current} />}
      onBack={scope.isNewBusiness || router.canGoBack() ? back : undefined}
      footer={
        <>
        {error ? <Text tone="danger" align="center">{error}</Text> : null}
        <Button
          title="Next"
          disabled={!kind || !editable}
          loading={busy}
          onPress={() => { void next(); }}
        />
        </>
      }
    >
      <View style={{ gap: space.md }} accessibilityRole="radiogroup">
        {SELL_KINDS.map((k) => (
          <OptionRow key={k.id} label={k.label} photo={k.photo} selected={kind === k.id} disabled={busy || !editable}
            onPress={() => { if (!saving.current && editable && scope.isCurrent()) ownerIntake.set({ kind: k.id }); }} />
        ))}
      </View>
    </ScreenShell>
  );
}
