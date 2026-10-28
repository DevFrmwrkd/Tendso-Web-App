import React, { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { OwnerDesignGallery } from '../../components/v2/owner/OwnerDesignGallery';
import { DESIGNS, designsFor, sellKind, sellKindFromServer } from '../../lib/v2/ownerContent';
import { useChooseDesign, useOwnerSubmission, useSubmitSite } from '../../lib/v2/ownerData';
import { ownerIntake, useOwnerIntake } from '../../lib/v2/ownerIntake';
import { STEP_ROUTE } from '../../lib/v2/ownerFlow';
import { uploadQueue } from '../../lib/v2/uploadQueue';
import { useOwnerUploads } from '../../lib/v2/ownerUploads';
import { useOwnerScope } from '../../lib/v2/useOwnerScope';

export default function DesignPicker() {
  const scope = useOwnerScope();
  return <OwnerDesignStep key={scope.scopeKey} scope={scope} />;
}
function OwnerDesignStep({ scope }: { scope: ReturnType<typeof useOwnerScope> }) {
  const router = useRouter();
  const intake = useOwnerIntake();
  const sub = useOwnerSubmission(scope.id);
  const choose = useChooseDesign();
  const submit = useSubmitSite();
  const { resume } = useOwnerUploads();
  const kind = sellKind(intake.kind) ?? sellKindFromServer(sub?.businessType, sub?.shotListKey);
  const ownSub = sub?.submissionId === scope.id ? sub : undefined;
  const saved = ownSub?.templateId ?? (intake.submissionId === scope.id ? intake.design : null) ?? null;
  const catalog = designsFor(kind.id);
  // Barber/salon share a server category. Keep a saved valid choice visible.
  const savedDesign = Object.values(DESIGNS).flat().find(design => design.code === saved);
  const designs = savedDesign && !catalog.some(design => design.code === savedDesign.code) ? [savedDesign, ...catalog] : catalog;
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const use = async (code: string) => {
    if (!scope.id || !ownSub || !scope.isCurrent() || scope.isOffline || (scope.site && scope.site.phase !== 'draft') || inFlight.current || !designs.some(design => design.code === code)) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      await choose({ submissionId: scope.id, templateId: code });
      if (!scope.isCurrent()) return;
      ownerIntake.set({ design: code });
      await resume(scope.id, ownSub);
      if (!scope.isCurrent()) return;
      await uploadQueue.drain();
      if (!scope.isCurrent()) return;
      if (uploadQueue.snapshot().failed > 0) { uploadQueue.retry(); await uploadQueue.drain(); }
      if (!scope.isCurrent()) return;
      if (uploadQueue.snapshot().failed > 0) throw new Error('Some answers or photos could not upload. Please try again.');
      await submit({ submissionId: scope.id });
      if (!scope.isCurrent()) return;
      ownerIntake.set({ shots: undefined, uploads: undefined });
      await ownerIntake.flush();
      if (scope.isCurrent()) router.replace(STEP_ROUTE.building as never);
    } catch (cause) {
      if (scope.isCurrent()) setError(cause instanceof Error ? cause.message : 'Could not send your site. Please try again.');
    } finally { inFlight.current = false; if (scope.isCurrent()) setBusy(false); }
  };
  return <OwnerDesignGallery designs={designs} selectedCode={selected ?? saved} onSelect={setSelected} onUse={use}
    onBack={() => scope.site && scope.site.phase !== 'draft' ? router.replace('/(owner)/(tabs)/site' as never) : router.back()}
    busy={busy} disabled={!scope.id || !ownSub} canUse={!scope.isOffline && (!scope.site || scope.site.phase === 'draft')}
    isOffline={scope.isOffline} error={scope.site && scope.site.phase !== 'draft' ? 'Your site is already sent. Ask for design changes from My site.' : scope.isOffline ? 'Reconnect to use this design and send your site.' : error} />;
}
