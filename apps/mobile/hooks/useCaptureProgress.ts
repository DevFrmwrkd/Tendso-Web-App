import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import type { useCaptureSession } from './useCaptureSession';
import type { CaptureProgress, CaptureStep } from '../services/captureResume';

type ProgressSession = Pick<ReturnType<typeof useCaptureSession>, 'actorKey' | 'isCurrent' | 'read' | 'write'>;

/** Call only after the screen has hydrated and accepted this capture's ownership/status. */
export function useCaptureProgress(capture: ProgressSession, step: CaptureStep, submissionId: string | null,
  ready: boolean) {
  const { actorKey, isCurrent, read, write } = capture;
  useFocusEffect(useCallback(() => {
    let active = true;
    if (ready && submissionId && actorKey && isCurrent()) {
      void (async () => {
        const pointer = await read<string>('current_submission_id');
        if (!active || !isCurrent() || pointer !== submissionId) return;
        const progress: CaptureProgress = { submissionId, step, savedAt: Date.now() };
        await write('submission_progress', progress);
      })().catch(() => { /* Draft content remains authoritative if this navigation hint cannot save. */ });
    }
    return () => { active = false; };
  }, [actorKey, step, submissionId, ready, isCurrent, read, write]));
}
