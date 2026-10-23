/** The guided camera: 10 tasks for this kind of shop. Each photo uploads in the background. */
import React from 'react';
import { useRouter } from 'expo-router';
import { ShotGuide } from '../../../components/v2/capture';
import { shotList } from '../../../lib/v2/captureContent';
import { sellKind, sellKindFromServer } from '../../../lib/v2/ownerContent';
import { useOwnerSubmission } from '../../../lib/v2/ownerData';
import { useOwnerIntake } from '../../../lib/v2/ownerIntake';
import { STEP_ROUTE } from '../../../lib/v2/ownerFlow';
import { useSaveOwnerPhoto } from '../../../lib/v2/ownerPhotos';
import { useOwnerSite } from '../../../lib/v2/useOwnerSite';

export default function PhotosShoot() {
  const router = useRouter();
  const intake = useOwnerIntake();
  const { id } = useOwnerSite();
  const sub = useOwnerSubmission(id);
  const save = useSaveOwnerPhoto();
  const kind = sellKind(intake.kind) ?? sellKindFromServer(sub?.businessType, sub?.shotListKey);
  const tasks = shotList(kind.shots);
  // Resume: local photos first, else what the server already has.
  const initial = tasks.map((_, i) => intake.shots?.[i] ?? sub?.shots.find((s) => !s.extra && s.index === i)?.url ?? null);

  return (
    <ShotGuide
      tasks={tasks}
      initial={initial}
      onShot={(index, uri) => {
        if (id) save(id, uri, { index, extra: false, label: tasks[index].t });
      }}
      onDone={() => router.replace(STEP_ROUTE['photos-done'] as never)}
      onClose={(taken) => {
        if (taken.some(Boolean)) router.replace(STEP_ROUTE['photos-done'] as never);
        else router.back();
      }}
    />
  );
}
