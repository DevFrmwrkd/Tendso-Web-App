import React, { useRef } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import type { Doc } from '@tendso/convex-client';
import { useMobileAccount } from '../../hooks/useMobileAccount';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { CreatorDashboardPreview } from '../AccountPreview';
import { EmptyState, Loading, ScreenShell } from '../v2';
import { OfflineBanner } from '../OfflineBanner';
import { fieldAgentWorkspaceRedirect } from '../../services/fieldAgentFinds';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { accountBlocked, fieldAgentNeedsOnboarding } from '../../services/accountAccess';

type WorkspaceChildren = { children: (creator: Doc<'creators'>) => React.ReactNode };

export function FieldAgentWorkspace({ children, preserveDraftWhileDisconnected = false }: WorkspaceChildren & {
  /** Spot only: keep an already-open draft through a same-subject reconnect. */
  preserveDraftWhileDisconnected?: boolean;
}) {
  return preserveDraftWhileDisconnected
    ? <DraftPreservingWorkspace>{children}</DraftPreservingWorkspace>
    : <WorkspaceContent>{children}</WorkspaceContent>;
}

function DraftPreservingWorkspace({ children }: WorkspaceChildren) {
  const { account, role, isLoading, isAuthenticated, isPreview, isOffline, isBlocked } = useMobileAccount();
  const { userId, isLoaded, isSignedIn } = useAuth();
  const remembered = useRef<{ subject: string; creator: Doc<'creators'> } | null>(null);
  const subject = isLoaded && isSignedIn === true && userId ? userId : null;
  const approved = !!account && !isBlocked && !accountBlocked(account)
    && !fieldAgentNeedsOnboarding(account) && fieldAgentWorkspaceRedirect(account) === null;

  // A retained draft never supplies authentication or permissions. Clear it as
  // soon as an explicit identity/account result contradicts its original actor.
  if (!subject || isPreview || isBlocked || (role != null && role !== 'creator')
    || (remembered.current && remembered.current.subject !== subject)
    || account === null || (account && (!approved || account.clerkId !== subject))) {
    remembered.current = null;
  }
  if (subject && account && approved && account.clerkId === subject && !isLoading && isAuthenticated && !isOffline && !isPreview) {
    remembered.current = { subject, creator: account };
  }

  if (!subject || (account && account.clerkId !== subject)) return <Loading />;
  if (isBlocked || accountBlocked(account)) return <Redirect href={'/(app)/account-unavailable' as never} />;
  const retained = remembered.current?.subject === subject
    && (isOffline || isLoading || !isAuthenticated || account === undefined)
    ? remembered.current.creator : null;
  return <WorkspaceContent key={subject} retainedCreator={retained}>{children}</WorkspaceContent>;
}

function WorkspaceContent({ children, retainedCreator }: WorkspaceChildren & { retainedCreator?: Doc<'creators'> | null }) {
  const { account, role, isLoading, isAuthenticated, isPreview, isOffline } = useMobileAccount();
  const router = useGuardedRouter();
  // Register even while training/review is pending so approval notifications arrive.
  usePushNotifications(!isPreview && role === 'creator' ? account?._id : undefined);
  if (isPreview) return <CreatorDashboardPreview />;
  if (retainedCreator) return <React.Fragment key={retainedCreator._id}>{children(retainedCreator)}</React.Fragment>;
  if (isOffline) return (
    <ScreenShell insetBottom={false}>
      <OfflineBanner />
      <EmptyState icon="cloud-offline-outline" title="Reconnect to find shops"
        body="Your saved drafts and dashboard are still available."
        actionLabel="Open dashboard" onAction={() => router.push('/(app)/(tabs)/dashboard' as never)} />
    </ScreenShell>
  );
  if (isLoading || !isAuthenticated || !account) return <Loading />;
  const destination = fieldAgentWorkspaceRedirect(account);
  if (destination) return <Redirect href={destination as never} />;
  return <React.Fragment key={account._id}>{children(account)}</React.Fragment>;
}
