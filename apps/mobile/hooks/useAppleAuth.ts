/**
 * Native Sign in with Apple — a replacement for Clerk's `useSignInWithApple`.
 *
 * WHY THIS EXISTS
 * ---------------
 * Clerk's hook requests Apple's FULL_NAME scope and then throws the answer away:
 *
 *     const { identityToken } = credential;   // credential.fullName discarded
 *     await signUp.create({ transfer: true, unsafeMetadata });
 *
 * It never forwards the name to `signUp.create`, and it doesn't return the
 * credential either — so the name is unrecoverable by the caller. Every user
 * who signed up with Apple landed with `first_name: ""` / `last_name: ""`,
 * which shows up as a blank profile name, blank Avatar initials, and a
 * referral code missing its name prefix.
 *
 * This is the same flow, with the name kept: it is passed to `signUp.create`
 * so Clerk stores it, and also returned so callers can write it to Convex.
 *
 * APPLE ONLY SENDS THE NAME ONCE. `credential.fullName` is populated on the
 * FIRST authorization for a given Apple ID and is null on every subsequent
 * sign-in, forever. Callers must treat it as optional, and testing this
 * requires revoking first:
 *   Settings > [your name] > Sign-In & Security > Sign in with Apple > Tendso
 *   > Stop Using Apple ID
 */
import { useCallback } from 'react';
import { useSignIn, useSignUp } from '@clerk/clerk-expo';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

export type AppleAuthOutcome = {
  createdSessionId: string | null;
  setActive: ReturnType<typeof useSignIn>['setActive'];
  signIn: ReturnType<typeof useSignIn>['signIn'];
  signUp: ReturnType<typeof useSignUp>['signUp'];
  /** True when the user dismissed Apple's sheet — not an error state. */
  cancelled: boolean;
  /** True when this authorization created a new Clerk user. */
  isNewUser: boolean;
  /**
   * Apple-supplied profile, present ONLY on a first-ever authorization.
   * `email` is a private relay address when the user chose "Hide My Email".
   */
  firstName?: string;
  lastName?: string;
  email?: string;
};

export function useAppleAuth() {
  const { signIn, setActive, isLoaded: isSignInLoaded } = useSignIn();
  const { signUp, isLoaded: isSignUpLoaded } = useSignUp();

  const startAppleAuth = useCallback(async (): Promise<AppleAuthOutcome> => {
    const idle: AppleAuthOutcome = {
      createdSessionId: null,
      setActive,
      signIn,
      signUp,
      cancelled: false,
      isNewUser: false,
    };

    if (!isSignInLoaded || !isSignUpLoaded) return idle;

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        // Apple embeds SHA256(nonce) in the identity token. Clerk doesn't
        // verify it, but sending one matches Clerk's own implementation and
        // costs nothing.
        nonce: Crypto.randomUUID(),
      });

      const { identityToken, fullName, email } = credential;
      if (!identityToken) {
        throw new Error('No identity token received from Apple.');
      }

      // Null on every authorization after the first — never assume it's here.
      const firstName = fullName?.givenName ?? undefined;
      const lastName = fullName?.familyName ?? undefined;

      await signIn!.create({ strategy: 'oauth_token_apple', token: identityToken });

      const needsUser = signIn!.firstFactorVerification.status === 'transferable';

      if (needsUser) {
        // The fix: hand Apple's name to Clerk at creation time. This is the
        // only moment it can be captured — the credential is gone afterwards,
        // and Apple will never send it again for this Apple ID.
        await signUp!.create({ transfer: true, firstName, lastName } as any);
        return {
          createdSessionId: signUp!.createdSessionId,
          setActive,
          signIn,
          signUp,
          cancelled: false,
          isNewUser: true,
          firstName,
          lastName,
          email: email ?? undefined,
        };
      }

      return {
        createdSessionId: signIn!.createdSessionId,
        setActive,
        signIn,
        signUp,
        cancelled: false,
        isNewUser: false,
        firstName,
        lastName,
        email: email ?? undefined,
      };
    } catch (err: any) {
      // Dismissing Apple's sheet raises this. Report it as a cancel rather
      // than letting callers render it as a failure.
      if (err?.code === 'ERR_REQUEST_CANCELED' || err?.code === 'ERR_CANCELED') {
        return { ...idle, cancelled: true };
      }
      throw err;
    }
  }, [isSignInLoaded, isSignUpLoaded, signIn, signUp, setActive]);

  return { startAppleAuth };
}
