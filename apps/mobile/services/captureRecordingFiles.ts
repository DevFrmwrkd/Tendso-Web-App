import * as FileSystem from 'expo-file-system/legacy';

type Scope = { creatorId: string; submissionId: string; isCurrent: () => boolean };

/** Keep recorded takes and parallel audio out of the OS-purgeable camera cache. */
export async function retainCaptureRecording(uri: string, extension: 'mp4' | 'm4a', scope: Scope):
  Promise<{ uri: string; missing: boolean } | null> {
  if (!scope.isCurrent()) return null;
  if (!uri.startsWith('file://') && !uri.startsWith('/')) return { uri, missing: false };
  if (!/^[a-zA-Z0-9_-]+$/.test(scope.creatorId) || !/^[a-zA-Z0-9_-]+$/.test(scope.submissionId))
    throw new Error('Reopen this capture before saving its recording.');
  if (!FileSystem.documentDirectory) throw new Error('Recording storage is unavailable on this device.');
  const source = uri.startsWith('/') ? `file://${uri}` : uri;
  const root = `${FileSystem.documentDirectory}capture-recordings/`;
  const owner = `${root}${scope.creatorId}/`;
  if (source.startsWith(root) && !source.startsWith(owner)) return { uri: source, missing: true };
  const info = await FileSystem.getInfoAsync(source);
  if (!scope.isCurrent()) return null;
  if (!info.exists || info.isDirectory) return { uri: source, missing: true };
  // Offline drafts can acquire a server ID without moving or duplicating files.
  if (source.startsWith(owner)) return { uri: source, missing: false };
  const directory = `${owner}${scope.submissionId}/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  if (!scope.isCurrent()) return null;
  const target = `${directory}${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}.${extension}`;
  await FileSystem.copyAsync({ from: source, to: target });
  return scope.isCurrent() ? { uri: target, missing: false } : null;
}
