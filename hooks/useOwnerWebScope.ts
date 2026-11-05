"use client";

import { createContext, createElement, useCallback, useContext, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useConvexAuth, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useOwnerAuth } from './useOwnerAuth';
import type { OwnerSite } from '@/app/my-business/_components/ownerSite';

export type OwnerWebScope = {
    owner: ReturnType<typeof useOwnerAuth>['owner'];
    sites: readonly OwnerSite[] | undefined;
    userId: string | null;
    sessionId: string | null;
    scopeKey: string;
    ready: boolean;
    loading: boolean;
    error: string | null;
    isSignedIn: boolean;
    isOwner: boolean;
    /** Recheck before a write and after awaited work, including a new session for the same owner. */
    isCurrent: () => boolean;
};

const Context = createContext<OwnerWebScope | null>(null);

/** One authenticated owner scope per workspace; sample previews never mount this provider. */
export function OwnerWebScopeProvider({ children }: { children: ReactNode }) {
    const auth = useAuth();
    const convex = useConvexAuth();
    const gate = useOwnerAuth();
    const userId = auth.userId ?? null;
    const sessionId = auth.sessionId ?? null;
    const actorReady = !!auth.isLoaded && auth.isSignedIn === true && !!userId && !!sessionId
        && !convex.isLoading && convex.isAuthenticated && !gate.loading
        && gate.isOwner && gate.owner?.clerkId === userId;
    const raw = useQuery(api.owners.me, actorReady ? {} : 'skip');
    const workspace = actorReady && raw && raw.owner._id === gate.owner?._id ? raw : undefined;
    const ready = actorReady && workspace !== undefined;
    const owner = gate.isOwner && gate.owner?.clerkId === userId ? gate.owner : null;
    const scopeKey = `${userId ?? 'signed-out'}:${sessionId ?? 'no-session'}:${owner?._id ?? 'no-owner'}`;
    const committed = useRef({ key: scopeKey, ready: false });
    useLayoutEffect(() => {
        const value = { key: scopeKey, ready };
        committed.current = value;
        return () => { if (committed.current === value) committed.current = { key: scopeKey, ready: false }; };
    }, [scopeKey, ready]);
    const isCurrent = useCallback(() => ready && committed.current.key === scopeKey && committed.current.ready, [scopeKey, ready]);
    const scope = useMemo<OwnerWebScope>(() => ({
        owner, sites: workspace?.sites, userId, sessionId, scopeKey, ready,
        isSignedIn: auth.isSignedIn === true,
        isOwner: gate.isOwner,
        loading: !auth.isLoaded || gate.loading || (auth.isSignedIn === true && (convex.isLoading || !convex.isAuthenticated))
            || (actorReady && raw === undefined),
        error: gate.error ?? (actorReady && raw !== undefined && !workspace ? 'We could not load your owner workspace. Refresh and try again.' : null),
        isCurrent,
    }), [owner, workspace, userId, sessionId, scopeKey, ready, auth.isSignedIn, auth.isLoaded, gate.isOwner, gate.loading, gate.error,
        convex.isLoading, convex.isAuthenticated, actorReady, raw, isCurrent]);
    // isCurrent closes over a ref for event/async guards; publishing the callback does not read it.
    // eslint-disable-next-line react-hooks/refs
    return createElement(Context.Provider, { value: scope }, children);
}

export function useOwnerWebScope(): OwnerWebScope {
    const scope = useContext(Context);
    if (!scope) throw new Error('Owner workspace scope requires OwnerShell.');
    return scope;
}
