const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

function photoKeys(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const keys: string[] = [];
  for (const item of value) {
    const entry = record(item);
    const key = typeof item === 'string' ? item.trim()
      : typeof entry?.storageId === 'string' && entry.storageId.trim() ? entry.storageId.trim()
        : typeof entry?.uri === 'string' ? entry.uri.trim() : '';
    if (!key) return null;
    keys.push(key);
  }
  return [...new Set(keys)].sort();
}

/** Compare actual photo membership; editing a caption does not require a save. */
export function capturePhotosNeedSave(photoDraft: unknown, submissionId: string, savedPhotos: unknown): boolean {
  const draft = record(photoDraft);
  if (!submissionId || draft?.submissionId !== submissionId) return false;
  const draftKeys = photoKeys(draft.items);
  if (!draftKeys) return false;
  let savedKeys: string[] | null;
  if (Array.isArray(savedPhotos) || savedPhotos == null) savedKeys = photoKeys(savedPhotos ?? []);
  else {
    const pending = record(savedPhotos);
    if (pending?.submissionId !== submissionId) return false;
    const existing = photoKeys(pending.existingPhotos ?? []);
    const added = photoKeys(Array.isArray(pending.entries) ? pending.entries : pending.photoUris ?? []);
    savedKeys = existing && added ? [...new Set([...existing, ...added])].sort() : null;
  }
  return !!savedKeys && JSON.stringify(draftKeys) !== JSON.stringify(savedKeys);
}
