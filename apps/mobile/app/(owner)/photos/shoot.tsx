import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ShotGuide } from '../../../components/v2/capture';
import { Button, ScreenShell } from '../../../components/v2';
import { shotList } from '../../../lib/v2/captureContent';
import { sellKind, sellKindFromServer } from '../../../lib/v2/ownerContent';
import { useOwnerSubmission } from '../../../lib/v2/ownerData';
import { useOwnerIntake } from '../../../lib/v2/ownerIntake';
import { ownerPhotosFor } from '../../../lib/v2/ownerMedia';
import { STEP_ROUTE } from '../../../lib/v2/ownerFlow';
import { useSaveOwnerPhoto } from '../../../lib/v2/ownerPhotos';
import { useOwnerScope } from '../../../lib/v2/useOwnerScope';

export default function PhotosShoot() {
  const scope = useOwnerScope();
  const { shot } = useLocalSearchParams<{ shot?: string }>();
  const parsed = typeof shot === 'string' && /^\d+$/.test(shot) ? Number(shot) : -1;
  return <OwnerCamera key={`${scope.scopeKey}:${parsed}`} scope={scope} selected={parsed} />;
}
function OwnerCamera({ scope, selected }: { scope: ReturnType<typeof useOwnerScope>; selected: number }) {
  const router = useRouter();
  const intake = useOwnerIntake();
  const sub = useOwnerSubmission(scope.id);
  const save = useSaveOwnerPhoto();
  const kind = sellKind(intake.kind) ?? sellKindFromServer(sub?.businessType, sub?.shotListKey);
  const tasks = shotList(kind.shots);
  const photos = ownerPhotosFor(scope.id, sub, intake);
  const initial = tasks.map((_, index) => photos.find(photo => !photo.extra && photo.index === index)?.uri ?? null);
  const index = selected >= 0 && selected < tasks.length ? selected : undefined;
  if (scope.site && scope.site.phase !== 'draft') return <ScreenShell title="Your shop photos are saved"
    subtitle="Ask the team for a change to your website." footer={<Button title="View my site" onPress={() => router.replace('/(owner)/(tabs)/site' as never)} />} />;
  return <ShotGuide tasks={tasks} initial={initial} initialIndex={index} singleShot={index !== undefined}
    onShot={(shotIndex, uri) => { if (scope.id && scope.isDraftCurrent()) save(scope.id, uri, { index: shotIndex, extra: false, label: tasks[shotIndex].t }); }}
    onDone={() => { if (scope.isCurrent()) router.replace(STEP_ROUTE['photos-done'] as never); }}
    onClose={taken => {
      if (!scope.isCurrent()) return;
      if (taken.some(Boolean)) router.replace(STEP_ROUTE['photos-done'] as never); else router.back();
    }} />;
}
