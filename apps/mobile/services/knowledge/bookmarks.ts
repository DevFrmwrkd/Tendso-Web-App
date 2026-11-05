import AsyncStorage from '@react-native-async-storage/async-storage';

export const BOOKMARK_LIMIT = 500;
export const knowledgeBookmarkKey = (clerkId: string) => `knowledge:bookmarks:v1:${encodeURIComponent(clerkId)}`;

/** Store article IDs only. Article content still comes from the authorized corpus. */
export async function readKnowledgeBookmarks(clerkId: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(knowledgeBookmarkKey(clerkId));
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? [...new Set(parsed.filter((id): id is string =>
      typeof id === 'string' && id.length > 0 && id.length <= 200))].slice(0, BOOKMARK_LIMIT) : [];
  } catch { return []; }
}

export async function writeKnowledgeBookmarks(clerkId: string, ids: readonly string[]): Promise<void> {
  await AsyncStorage.setItem(knowledgeBookmarkKey(clerkId), JSON.stringify(ids));
}
