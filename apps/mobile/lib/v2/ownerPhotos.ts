/**
 * Owner photo saving, shared by the guided camera and the library picker:
 * upload to R2, then ownerApp.saveShot (guided index 0-9, or an extra).
 */
import { useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useOwnerUploads } from './ownerUploads';
import type { SubmissionId } from './ownerTypes';

export const MAX_EXTRAS = 10;

export function useSaveOwnerPhoto() {
  const { remember } = useOwnerUploads();
  return useCallback(
    (id: SubmissionId, uri: string, opts: { index: number; extra: boolean; label?: string }) => {
      remember({ kind: 'photo', submissionId: id, uri, ...opts });
    },
    [remember],
  );
}

/** Pick photos from the phone (secondary to the in-app camera). */
export async function pickFromLibrary(limit: number): Promise<string[]> {
  if (limit <= 0) return [];
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return [];
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: limit,
    quality: 0.8,
  });
  return res.canceled ? [] : res.assets.map((a) => a.uri);
}
