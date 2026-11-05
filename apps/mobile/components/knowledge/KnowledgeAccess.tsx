import React, { createContext, useContext } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useMobileAccount } from '../../hooks/useMobileAccount';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { affiliateNeedsApproval, fieldAgentNeedsOnboarding, mobileHome } from '../../services/accountAccess';
import type { KnowledgeViewer } from '../../services/knowledge/api';
import { Button, EmptyState, Loading, ScreenShell } from '../v2';

type Session = { viewer: KnowledgeViewer; scope: string; home: string };
const Context = createContext<Session | null>(null);

export function useKnowledgeViewer(): Session {
  const session = useContext(Context);
  if (!session) throw new Error('Knowledge screens require KnowledgeAccess');
  return session;
}

/** A separate route group deliberately never mounts the owner provisioning flow. */
export function KnowledgeAccess({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const mobile = useMobileAccount();
  const router = useGuardedRouter();
  const enabled = auth.isLoaded && auth.isSignedIn === true && !!auth.userId
    && mobile.isAuthenticated && !mobile.isOffline && !mobile.isPreview;
  const result = useQuery(api.knowledge.viewerContext, enabled ? {} : 'skip') as KnowledgeViewer | undefined;
  // Convex may retain the prior result while its authenticated subscription changes.
  const audience = mobile.role === 'creator' ? 'field_agent' : mobile.role ?? (mobile.isOwner ? 'owner' : 'everyone');
  const viewer = enabled && result?.clerkId === auth.userId && (result.blocked || result.audience === audience) ? result : undefined;
  const home = mobile.isOwner && !mobile.account ? '/(owner)' : mobileHome(mobile.role);
  const back = () => router.canGoBack() ? router.back() : router.replace(home as never);

  if (mobile.isOffline || mobile.isPreview) return <ScreenShell title="Ask Tendso" onBack={back}>
    <EmptyState icon="chatbubble-ellipses-outline" title={mobile.isPreview ? 'Available in your account' : 'Reconnect to ask Tendso'}
      body={mobile.isPreview ? 'Sign in to get answers for your account.' : 'Your questions and account details need a secure connection.'} />
  </ScreenShell>;
  if (auth.isLoaded && !auth.isSignedIn) return <Redirect href="/(auth)/login" />;
  if (!auth.isLoaded || mobile.isLoading || !viewer) return <Loading />;
  if (mobile.isBlocked || mobile.account?.status === 'suspended' || mobile.account?.status === 'deleted'
    || mobile.account?.isDeleted || viewer.blocked || !viewer.authenticated) return <ScreenShell title="Ask Tendso" onBack={back}>
    <EmptyState icon="lock-closed-outline" title="Account unavailable" body="This account cannot use Ask Tendso right now." />
    <Button title="Back to your account" onPress={() => router.replace(home as never)} />
  </ScreenShell>;
  // Keep existing approval and onboarding deep-link gates intact.
  if (affiliateNeedsApproval(mobile.account)) return <Redirect href={'/(app)/(affiliate-tabs)/' as never} />;
  if (fieldAgentNeedsOnboarding(mobile.account)) return <Redirect href={'/(app)/agent-onboarding' as never} />;
  if (viewer.audience === 'everyone') return <Redirect href={'/(app)/' as never} />;

  const scope = JSON.stringify([auth.userId, auth.sessionId, viewer.audience, viewer.canAccessWiki]);
  // Keying during render clears private answers before another actor/role can paint.
  return <Context.Provider key={scope} value={{ viewer, scope, home }}>{children}</Context.Provider>;
}
