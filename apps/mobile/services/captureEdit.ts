import type { Doc, Id } from '@tendso/convex-client';

/** Rejected captures stay rejected while their owner corrects the same record. */
export function isEditableCaptureStatus(status: string | null | undefined): boolean {
  return status === 'draft' || status === 'rejected';
}

export type CaptureSnapshot = Partial<Doc<'submissions'>> & {
  submissionId: string;
  creatorId: string;
  initialSellPrice?: number;
  resolvedPhotoUrls?: string[];
};

/** Local metadata permits offline editing, never authorization for a server read. */
export function cachedRejectedCapture(snapshot: CaptureSnapshot | null, id: string | null, creatorId?: string): Doc<'submissions'> | null {
  if (!id || !snapshot || snapshot.submissionId !== id || snapshot.creatorId !== creatorId
    || snapshot.status !== 'rejected' || (snapshot._id !== undefined && snapshot._id !== id)) return null;
  const { businessName, businessType, ownerName, ownerPhone, address, city } = snapshot;
  if (typeof businessName !== 'string' || typeof businessType !== 'string' || typeof ownerName !== 'string'
    || typeof ownerPhone !== 'string' || typeof address !== 'string' || typeof city !== 'string') return null;
  if (snapshot.photos !== undefined && (!Array.isArray(snapshot.photos) || snapshot.photos.some(photo => typeof photo !== 'string'))) return null;
  return {
    ...snapshot, _id: (snapshot._id ?? id) as Id<'submissions'>,
    _creationTime: typeof snapshot._creationTime === 'number' && Number.isFinite(snapshot._creationTime) ? snapshot._creationTime : 0,
    creatorId: snapshot.creatorId as Id<'creators'>, status: 'rejected',
    businessName, businessType, ownerName, ownerPhone, address, city,
  };
}
