import { useCallback } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import type { FunctionReturnType } from 'convex/server';
import { OWNER_SAMPLE_DATA } from './ownerFlags';

export type OwnerInbox = Omit<NonNullable<FunctionReturnType<typeof api.ownerInbox.list>>, 'ownerId'> & { ownerId: string };
export type OwnerMessage = OwnerInbox['items'][number];
export function useOwnerInbox(ownerId?: string): OwnerInbox | undefined {
  const { userId } = useAuth();
  const raw = useQuery(api.ownerInbox.list, !OWNER_SAMPLE_DATA && userId && ownerId ? { clerkId: userId } : 'skip');
  if (OWNER_SAMPLE_DATA) return { ownerId: ownerId ?? 'sample-owner', actorClerkId: userId ?? 'sample-owner', items: [], unreadCount: 0 };
  return raw && raw.actorClerkId === userId && raw.ownerId === ownerId ? raw : undefined;
}
export function useOwnerInboxActions() {
  const { userId } = useAuth();
  const read = useMutation(api.ownerInbox.markRead);
  const all = useMutation(api.ownerInbox.markAllRead);
  const markRead = useCallback((key: string) => OWNER_SAMPLE_DATA ? Promise.resolve() : userId ? read({ key, clerkId: userId }) : Promise.reject(new Error('Please sign in again.')), [read,userId]);
  const markAllRead = useCallback(() => OWNER_SAMPLE_DATA ? Promise.resolve() : userId ? all({ clerkId: userId }) : Promise.reject(new Error('Please sign in again.')), [all,userId]);
  return { markRead, markAllRead };
}
