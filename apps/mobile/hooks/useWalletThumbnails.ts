import { useEffect, useMemo, useState } from 'react';
import { useConvex, useQuery } from 'convex/react';
import { api, type Id } from '@tendso/convex-client';
import type { WalletSubmissionDetail } from '../components/wallet/WalletActivity';

type ThumbnailRequest = {
  creatorId?: string;
  clerkId?: string;
  isAuthenticated: boolean;
  isAffiliate: boolean;
  isOffline?: boolean;
  /** Omit for all owned captures; a supplied list limits media resolution. */
  submissionIds?: string[];
};
type Resolved = { key: string; urls: (string | null)[] };
const imageUrl = (value: unknown): string | null => typeof value === 'string'
  && /^(https?:\/\/|data:image\/)/i.test(value) ? value : null;

/** Wallet media comes from the signed-in field agent's own capture list only. */
export function useWalletThumbnails({ creatorId, clerkId, isAuthenticated, isAffiliate, isOffline = false, submissionIds }: ThumbnailRequest) {
  const client = useConvex();
  const enabled = isAuthenticated && !!creatorId && !!clerkId && !isAffiliate && !isOffline;
  const submissions = useQuery(api.submissions.getByCreatorId,
    enabled ? { creatorId: creatorId as Id<'creators'> } : 'skip');
  const selectedKey = submissionIds === undefined ? null : JSON.stringify([...new Set(submissionIds)].sort());
  const owned = useMemo(() => {
    if (!enabled || !submissions) return [];
    const selected = selectedKey === null ? null : new Set<string>(JSON.parse(selectedKey));
    return submissions.filter(row => String(row.creatorId) === creatorId && (!selected || selected.has(String(row._id))));
  }, [enabled, submissions, creatorId, selectedKey]);
  const photoKeys = useMemo(() => [...new Set(owned.map(row => row.photos?.find(photo => typeof photo === 'string' && !!photo.trim()))
    .filter((key): key is string => !!key))], [owned]);
  const requestKey = enabled && photoKeys.length ? JSON.stringify([clerkId, creatorId, photoKeys]) : null;
  const [resolved, setResolved] = useState<Resolved | null>(null);

  useEffect(() => {
    let active = true;
    if (!requestKey) { setResolved(null); return; }
    const [,, storageIds] = JSON.parse(requestKey) as [string, string, string[]];
    void client.query(api.files.getMultipleUrls, { storageIds }).then(urls => {
      if (!active) return;
      setResolved({ key: requestKey, urls: Array.isArray(urls) && urls.length === storageIds.length
        ? urls.map(imageUrl) : storageIds.map(() => null) });
    }).catch(() => { if (active) setResolved({ key: requestKey, urls: storageIds.map(() => null) }); });
    return () => { active = false; };
  }, [client, requestKey]);

  const bySubmission = useMemo<ReadonlyMap<string, WalletSubmissionDetail>>(() => {
    if (!enabled) return new Map();
    const urls = resolved?.key === requestKey ? resolved?.urls : undefined;
    const byKey = new Map(photoKeys.map((key, index) => [key, urls?.[index] ?? null]));
    return new Map(owned.map(row => {
      const firstPhoto = row.photos?.find(photo => typeof photo === 'string' && !!photo.trim());
      return [String(row._id), {
        thumbnailUrl: firstPhoto ? byKey.get(firstPhoto) ?? null : null,
        submissionPrice: typeof row.amount === 'number' && Number.isFinite(row.amount) && row.amount >= 0 ? row.amount : null,
        paid: row.status === 'paid' || row.status === 'completed',
      }];
    }));
  }, [enabled, owned, photoKeys, resolved, requestKey]);

  return { bySubmission, isLoading: enabled && (submissions === undefined || (!!requestKey && resolved?.key !== requestKey)) };
}
