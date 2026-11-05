import * as FileSystem from 'expo-file-system/legacy';

type PhotoScope = { creatorId: string; submissionId: string; isCurrent: () => boolean };
export type RetainedCapturePhoto = { uri: string; missing: boolean };

export const isLocalCapturePhoto = (uri: string) => uri.startsWith('file://') || uri.startsWith('/');

/** Keep draft JPEGs out of the OS-purgeable camera/manipulator cache. */
export async function retainCapturePhoto(uri: string, scope: PhotoScope): Promise<RetainedCapturePhoto | null> {
  if (!scope.isCurrent()) return null;
  if (!isLocalCapturePhoto(uri)) return { uri, missing: false };
  if (!/^[a-zA-Z0-9_-]+$/.test(scope.creatorId) || !/^[a-zA-Z0-9_-]+$/.test(scope.submissionId)) {
    throw new Error('Could not identify this photo draft. Reopen the capture and try again.');
  }
  if (!FileSystem.documentDirectory) throw new Error('Photo storage is unavailable on this device.');
  const source = uri.startsWith('/') ? `file://${uri}` : uri;
  const root = `${FileSystem.documentDirectory}capture-photos/`;
  const owner = `${root}${scope.creatorId}/`;
  // Never read or copy another signed-in creator's retained media.
  if (source.startsWith(root) && !source.startsWith(owner)) return { uri: source, missing: true };
  const info = await FileSystem.getInfoAsync(source);
  if (!scope.isCurrent()) return null;
  if (!info.exists || info.isDirectory) return { uri: source, missing: true };
  // An offline draft may have been assigned its server ID since this file was saved.
  if (source.startsWith(owner)) return { uri: source, missing: false };
  const directory = `${owner}${scope.submissionId}/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  if (!scope.isCurrent()) return null;
  const target = `${directory}${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}.jpg`;
  await FileSystem.copyAsync({ from: source, to: target });
  if (!scope.isCurrent()) return null;
  return { uri: target, missing: false };
}
