/**
 * Owner photo saving, shared by the guided camera and the library picker:
 * upload to R2, then ownerApp.saveShot (guided index 0-9, or an extra).
 */
import { useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useSaveShot, useUploadFile } from './ownerData';
import { uploadQueue } from './uploadQueue';
import type { SubmissionId } from './ownerTypes';

export const MAX_EXTRAS = 10;

export function useSaveOwnerPhoto() {
  const upload = useUploadFile();
  const saveShot = useSaveShot();
  return useCallback(
    (id: SubmissionId, uri: string, opts: { index: number; extra: boolean; label?: string }) => {
      const key = `${opts.extra ? 'extra' : 'shot'}-${opts.index}`;
      uploadQueue.add(key, opts.label ?? 'Photo', async () => {
        const url = await upload(uri, { folder: 'images', contentType: 'image/jpeg', filename: `owner-${key}.jpg` });
        await saveShot({ submissionId: id, index: opts.index, url, label: opts.label, extra: opts.extra });
      });
    },
    [upload, saveShot],
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
