import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FunctionArgs } from 'convex/server';
import type { api } from '@tendso/convex-client';
import { affiliateHandleError, affiliatePhoneError } from '../../../lib/affiliates';

export type SignupAccountType = 'creator' | 'affiliate';
export type SignupProfile = {
  accountType: SignupAccountType;
  firstName: string;
  lastName: string;
  phone: string;
  handle: string;
  referredByCode: string;
};
export type SignupIdentity = { clerkId?: string; email?: string; sessionId?: string };
type PendingSignup = { version: 1; profile: SignupProfile; identity: SignupIdentity; savedAt: number };
type CreatorArgs = FunctionArgs<typeof api.creators.create>;
type AffiliateArgs = FunctionArgs<typeof api.affiliates.create>;

const PREFIX = 'tendso:signup-profile:v1:';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeSignupProfile(profile: Partial<SignupProfile>): SignupProfile {
  const accountType = profile.accountType === 'affiliate' ? 'affiliate' : 'creator';
  return {
    accountType,
    firstName: profile.firstName?.trim() ?? '',
    lastName: profile.lastName?.trim() ?? '',
    phone: profile.phone?.replace(/\s/g, '') ?? '',
    handle: accountType === 'affiliate' ? profile.handle?.trim().toLowerCase() ?? '' : '',
    referredByCode: accountType === 'creator' ? profile.referredByCode?.trim().toUpperCase() ?? '' : '',
  };
}

function normalizedIdentity(identity: SignupIdentity): SignupIdentity {
  return {
    clerkId: identity.clerkId || undefined,
    email: identity.email?.trim().toLowerCase() || undefined,
    sessionId: identity.sessionId || undefined,
  };
}

function keysFor(identity: SignupIdentity): string[] {
  const scope = normalizedIdentity(identity);
  return [
    scope.clerkId && `${PREFIX}user:${encodeURIComponent(scope.clerkId)}`,
    scope.sessionId && `${PREFIX}session:${encodeURIComponent(scope.sessionId)}`,
    scope.email && `${PREFIX}email:${encodeURIComponent(scope.email)}`,
  ].filter((key): key is string => !!key);
}

export async function savePendingSignupProfile(profile: Partial<SignupProfile>, identity: SignupIdentity): Promise<void> {
  const keys = keysFor(identity);
  if (!keys.length) throw new Error('Your signup session is missing. Please try again.');
  const pending: PendingSignup = {
    version: 1, profile: normalizeSignupProfile(profile), identity: normalizedIdentity(identity), savedAt: Date.now(),
  };
  await AsyncStorage.multiSet(keys.map((key) => [key, JSON.stringify(pending)]));
}

export async function loadPendingSignupProfile(identity: SignupIdentity): Promise<SignupProfile | null> {
  const scope = normalizedIdentity(identity);
  for (const key of keysFor(scope)) {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) continue;
    try {
      const pending: PendingSignup = JSON.parse(raw);
      if (pending.version !== 1 || !pending.profile || !pending.identity
        || !['creator', 'affiliate'].includes(pending.profile.accountType) || !Number.isFinite(pending.savedAt)
        || Date.now() - pending.savedAt > MAX_AGE || pending.savedAt > Date.now() + 60000) {
        await AsyncStorage.removeItem(key);
        continue;
      }
      // A Clerk-bound draft never transfers to a different user sharing an email.
      if (pending.identity.clerkId && pending.identity.clerkId !== scope.clerkId) continue;
      const sameUser = !!scope.clerkId && pending.identity.clerkId === scope.clerkId;
      const sameSession = !!scope.sessionId && pending.identity.sessionId === scope.sessionId;
      const sameEmail = !!scope.email && pending.identity.email === scope.email;
      if (!sameUser && !sameSession && !sameEmail) continue;
      return normalizeSignupProfile(pending.profile);
    } catch {
      await AsyncStorage.removeItem(key);
    }
  }
  return null;
}

export async function clearPendingSignupProfile(identity: SignupIdentity): Promise<void> {
  const keys = keysFor(identity);
  if (keys.length) await AsyncStorage.multiRemove(keys);
}

/** Clear local profile drafts on a confirmed sign-out. Never store credentials. */
export async function clearPendingSignupProfiles(): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(PREFIX));
  if (keys.length) await AsyncStorage.multiRemove(keys);
}

/** Save first; account setup creates the backend row only after Convex auth is ready. */
export async function activateSignupSession(
  profile: Partial<SignupProfile>, identity: SignupIdentity, sessionId: string,
  setActive: (args: { session: string }) => Promise<unknown>,
): Promise<void> {
  await savePendingSignupProfile(profile, { ...identity, sessionId });
  await setActive({ session: sessionId });
}

export function signupProfileErrors(profile: SignupProfile): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!profile.firstName || profile.firstName.length > 100 || profile.lastName.length > 100) {
    errors.firstName = 'Enter your name (up to 100 characters).';
  }
  if (profile.accountType === 'affiliate') {
    const phoneError = affiliatePhoneError(profile.phone);
    const handleError = affiliateHandleError(profile.handle);
    if (phoneError) errors.phone = phoneError;
    if (handleError) errors.handle = handleError;
  } else if (profile.phone && affiliatePhoneError(profile.phone)) {
    errors.phone = 'Enter a valid Philippine mobile number, or leave it blank.';
  }
  return errors;
}

export async function createSignupAccount(
  profileInput: SignupProfile, identity: SignupIdentity,
  auth: { isAuthenticated: boolean; hasAccount: boolean },
  mutations: { createCreator: (args: CreatorArgs) => Promise<unknown>; createAffiliate: (args: AffiliateArgs) => Promise<unknown> },
): Promise<void> {
  if (!auth.isAuthenticated || !identity.clerkId) throw new Error('Wait for your secure session, then try again.');
  if (auth.hasAccount) throw new Error('This login already has an account. Use a different email for another account type.');
  const profile = normalizeSignupProfile(profileInput);
  const errors = signupProfileErrors(profile);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const email = identity.email?.trim().toLowerCase() ?? '';
  if (!EMAIL_REGEX.test(email)) throw new Error('Add a verified email to your sign-in account before continuing.');
  if (profile.accountType === 'affiliate') {
    await mutations.createAffiliate({
      email, firstName: profile.firstName, lastName: profile.lastName || undefined,
      phone: profile.phone, handle: profile.handle,
    });
  } else {
    const prefix = (profile.firstName.slice(0, 2) + profile.lastName.slice(0, 1)).toUpperCase();
    await mutations.createCreator({
      clerkId: identity.clerkId, email, firstName: profile.firstName, lastName: profile.lastName || undefined,
      phone: profile.phone || undefined, referredByCode: profile.referredByCode || undefined,
      referralCode: `${prefix}${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    });
  }
  await clearPendingSignupProfile(identity);
}

export function signupAccountHome(role?: string): '/(app)/(affiliate-tabs)/' | '/(app)/(tabs)/' | '/(app)/admin' {
  if (role === 'affiliate') return '/(app)/(affiliate-tabs)/';
  if (role === 'admin') return '/(app)/admin';
  return '/(app)/(tabs)/';
}

export function signupErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'data' in error && typeof error.data === 'string') return error.data;
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
