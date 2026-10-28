import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { BOOKMARK_LIMIT, readKnowledgeBookmarks, writeKnowledgeBookmarks } from './bookmarks';

type Snapshot = { subject: string; ids: string[]; loaded: boolean; error: string | null };

export function useArticleBookmarks() {
  const { userId, isLoaded, isSignedIn } = useAuth();
  const subject = isLoaded && isSignedIn && userId ? userId : null;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [, setBusyRevision] = useState(0);
  const [readRevision, setReadRevision] = useState(0);
  const mounted = useRef(true);
  const liveSubject = useRef(subject);
  const busy = useRef(new Map<string, object>());
  liveSubject.current = subject;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    setSnapshot(null);
    if (!subject) return;
    void readKnowledgeBookmarks(subject).then(ids => {
      if (active) setSnapshot({ subject, ids, loaded: true, error: null });
    }).catch(() => {
      if (active) setSnapshot({ subject, ids: [], loaded: false, error: 'Could not load saved articles. Please try again.' });
    });
    return () => { active = false; };
  }, [subject, readRevision]);
  const current = snapshot?.subject === subject ? snapshot : null;
  const ready = !!subject && !!current?.loaded;
  const saving = !!subject && busy.current.has(subject);

  const toggle = async (articleId: string): Promise<boolean> => {
    if (!subject || !current || !ready || busy.current.has(subject)) return false;
    const exists = current.ids.includes(articleId);
    if (!exists && current.ids.length >= BOOKMARK_LIMIT) {
      setSnapshot({ ...current, error: 'Remove a saved article before saving another.' });
      return false;
    }
    const ids = exists ? current.ids.filter(id => id !== articleId) : [...current.ids, articleId];
    const operation = {};
    busy.current.set(subject, operation); setBusyRevision(value => value + 1);
    try {
      await writeKnowledgeBookmarks(subject, ids);
      if (!mounted.current || liveSubject.current !== subject) return false;
      setSnapshot({ subject, ids, loaded: true, error: null });
      return true;
    } catch {
      if (mounted.current && liveSubject.current === subject)
        setSnapshot({ ...current, error: 'Could not save this bookmark. Please try again.' });
      return false;
    } finally {
      if (busy.current.get(subject) === operation) {
        busy.current.delete(subject);
        if (mounted.current) setBusyRevision(value => value + 1);
      }
    }
  };
  return { bookmarkedIds: current?.ids ?? [], bookmarksReady: ready, bookmarkSaving: saving,
    bookmarkError: current?.error ?? null, toggleBookmark: toggle,
    reloadBookmarks: () => setReadRevision(value => value + 1) };
}
