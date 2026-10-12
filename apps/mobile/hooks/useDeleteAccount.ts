import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useClerk, useUser } from '@clerk/clerk-expo';
import { useMutation } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useMobileAccount } from './useMobileAccount';

/** Shared self-deletion, available before affiliate approval as well as in Profile. */
export function useDeleteAccount() {
  const clerk = useClerk();
  const { user, isLoaded } = useUser();
  const account = useMobileAccount();
  const deleteAccount = useMutation(api.creators.deleteAccount);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const locked = useRef(false);
  const canDelete = isLoaded && !!user && account.isAuthenticated && !account.isOffline
    && !account.isLoading && !!account.account && !account.account.isDeleted
    && account.account.clerkId === user.id && clerk.user?.id === user.id && !!clerk.session?.id;
  const current = useRef({ canDelete, userId: user?.id, accountId: account.account?._id });
  current.current = { canDelete, userId: user?.id, accountId: account.account?._id };
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  function requestDelete() {
    if (!canDelete || !user || !account.account || locked.current) return;
    const capturedUser = user;
    const accountId = account.account._id;
    const sessionId = clerk.session?.id;
    const sameSession = () => clerk.user?.id === capturedUser.id && clerk.session?.id === sessionId;
    const canStart = () => mounted.current && current.current.canDelete
      && current.current.userId === capturedUser.id && current.current.accountId === accountId && sameSession();
    const sameUser = () => clerk.user?.id === capturedUser.id && !!clerk.session?.id;
    let backendDeleted = false;
    let loginDeleted = false;
    let logoutSessionId = sessionId;

    async function remove() {
      // A completed backend delete hides the account and can unmount this hook.
      // Retries use the same Clerk identity and skip that completed first step.
      if (locked.current || (!backendDeleted && !canStart())
        || (backendDeleted && !loginDeleted && !sameUser())) return;
      locked.current = true;
      if (mounted.current) setBusy(true);
      try {
        if (!backendDeleted) {
          await deleteAccount({ id: accountId });
          backendDeleted = true;
        }
        if (!loginDeleted) {
          const ownUser = clerk.user;
          const ownSession = clerk.session;
          if (!ownUser || ownUser.id !== capturedUser.id || !ownSession?.id) {
            throw new Error('Your signed-in account changed. Sign in to the original account to finish deleting it.');
          }
          logoutSessionId = ownSession.id;
          // Convex requires the live token: delete its row before Clerk credentials.
          await ownUser.delete();
          loginDeleted = true;
        }
        // Never sign out another account if the active session changed meanwhile.
        if (!clerk.user || clerk.user.id === capturedUser.id) {
          await clerk.signOut(logoutSessionId ? { sessionId: logoutSessionId } : undefined);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete account. Please try again.';
        Alert.alert('Could not delete account', message, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => { void remove(); } },
        ]);
      } finally {
        locked.current = false;
        if (mounted.current) setBusy(false);
      }
    }

    Alert.alert('Delete Account',
      'Your account will be deleted and you will be signed out immediately. Records are kept for 30 days, then permanently erased. If you sign up again you will start fresh, with no prior data.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete My Account', style: 'destructive', onPress: () => {
          if (!canStart() || locked.current) return;
          Alert.alert('Final Confirmation',
            'After 30 days your data will be permanently removed. If you re-register, you will start as a brand new account.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Yes, Delete Everything', style: 'destructive', onPress: () => { void remove(); } },
            ]);
        } },
      ]);
  }

  return { busy, canDelete, requestDelete };
}
