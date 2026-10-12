import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  activateSignupSession, clearPendingSignupProfiles, createSignupAccount, loadPendingSignupProfile,
  normalizeSignupProfile, savePendingSignupProfile, signupAccountHome, signupProfileErrors,
} from '../../services/signupProfile';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const identity = { clerkId: 'user_creator', email: 'alex@example.com', sessionId: 'session_creator' };
const creator = normalizeSignupProfile({
  accountType: 'creator', firstName: ' Alex ', lastName: ' Cruz ', phone: ' 0917 123 4567 ', referredByCode: ' aff123 ',
});
const affiliate = normalizeSignupProfile({ ...creator, accountType: 'affiliate', handle: ' Alex-Shop ', referredByCode: 'ignored' });
const mutations = () => ({ createCreator: jest.fn().mockResolvedValue('creator_id'), createAffiliate: jest.fn().mockResolvedValue('affiliate_id') });

beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });

it('persists signup details before activating Clerk and resumes the creator referral and phone', async () => {
  const setActive = jest.fn(async () => {
    expect(await loadPendingSignupProfile(identity)).toEqual(creator);
  });
  await activateSignupSession(creator, identity, identity.sessionId, setActive);
  expect(setActive).toHaveBeenCalledWith({ session: identity.sessionId });
  expect(await loadPendingSignupProfile(identity)).toMatchObject({ phone: '09171234567', referredByCode: 'AFF123' });
});

it('does not activate Clerk when saving the pending profile fails', async () => {
  const setActive = jest.fn();
  jest.spyOn(AsyncStorage, 'multiSet').mockRejectedValueOnce(new Error('Storage unavailable'));
  await expect(activateSignupSession(creator, identity, identity.sessionId, setActive)).rejects.toThrow('Storage unavailable');
  expect(setActive).not.toHaveBeenCalled();
});

it('keeps the scoped SSO draft when Clerk activation fails so setup can resume', async () => {
  const setActive = jest.fn().mockRejectedValue(new Error('Activation interrupted'));
  await expect(activateSignupSession(affiliate, identity, identity.sessionId, setActive)).rejects.toThrow('Activation interrupted');
  expect(await loadPendingSignupProfile(identity)).toEqual(affiliate);
});

it('resumes an email-scoped profile once the verified Clerk user is available', async () => {
  await savePendingSignupProfile(creator, { email: ' ALEX@example.com ' });
  expect(await loadPendingSignupProfile(identity)).toEqual(creator);
});

it('uses a session-scoped fallback when SSO omits its email and user id', async () => {
  await activateSignupSession(affiliate, {}, identity.sessionId, jest.fn());
  expect(await loadPendingSignupProfile(identity)).toEqual(affiliate);
  expect(await loadPendingSignupProfile({ clerkId: 'other', email: 'other@example.com', sessionId: 'other-session' })).toBeNull();
});

it('does not expose another user draft, even when its old email matches', async () => {
  await savePendingSignupProfile(creator, identity);
  expect(await loadPendingSignupProfile({ clerkId: 'other', email: identity.email })).toBeNull();
  expect(await loadPendingSignupProfile({ clerkId: 'other', email: 'other@example.com' })).toBeNull();
});

it('drops expired and malformed drafts', async () => {
  await savePendingSignupProfile(creator, identity);
  const keys = await AsyncStorage.getAllKeys();
  for (const key of keys) {
    const data = JSON.parse((await AsyncStorage.getItem(key))!);
    await AsyncStorage.setItem(key, JSON.stringify({ ...data, savedAt: Date.now() - 8 * 86400000 }));
  }
  expect(await loadPendingSignupProfile(identity)).toBeNull();
  expect(await AsyncStorage.getAllKeys()).toEqual([]);
  await AsyncStorage.setItem(keys[0], 'invalid json');
  expect(await loadPendingSignupProfile(identity)).toBeNull();
});

it('clears only pending signup data on sign-out', async () => {
  await savePendingSignupProfile(creator, identity);
  await AsyncStorage.setItem('unrelated-cache', 'keep');
  await clearPendingSignupProfiles();
  expect(await loadPendingSignupProfile(identity)).toBeNull();
  expect(await AsyncStorage.getItem('unrelated-cache')).toBe('keep');
});

it('defers both backend mutations until Convex is authenticated', async () => {
  const calls = mutations();
  await expect(createSignupAccount(creator, identity, { isAuthenticated: false, hasAccount: false }, calls)).rejects.toThrow('secure session');
  expect(calls.createCreator).not.toHaveBeenCalled();
  expect(calls.createAffiliate).not.toHaveBeenCalled();
});

it.each(['creator', 'affiliate'] as const)('never converts an existing account into %s', async (accountType) => {
  const calls = mutations();
  await expect(createSignupAccount({ ...affiliate, accountType }, identity, { isAuthenticated: true, hasAccount: true }, calls)).rejects.toThrow('already has an account');
  expect(calls.createCreator).not.toHaveBeenCalled();
  expect(calls.createAffiliate).not.toHaveBeenCalled();
});

it('creates a creator with its pending phone and affiliate referral, then clears the draft', async () => {
  const calls = mutations();
  await savePendingSignupProfile(creator, identity);
  await createSignupAccount(creator, identity, { isAuthenticated: true, hasAccount: false }, calls);
  expect(calls.createCreator).toHaveBeenCalledWith(expect.objectContaining({
    clerkId: identity.clerkId, email: identity.email, firstName: 'Alex', lastName: 'Cruz', phone: '09171234567',
    referredByCode: 'AFF123', referralCode: expect.stringMatching(/^ALC[A-Z0-9]+$/),
  }));
  expect(calls.createAffiliate).not.toHaveBeenCalled();
  expect(await loadPendingSignupProfile(identity)).toBeNull();
});

it('creates an affiliate with a lowercase handle and no incoming referral fields', async () => {
  const calls = mutations();
  await createSignupAccount(affiliate, identity, { isAuthenticated: true, hasAccount: false }, calls);
  expect(calls.createAffiliate).toHaveBeenCalledWith({
    email: identity.email, firstName: 'Alex', lastName: 'Cruz', phone: '09171234567', handle: 'alex-shop',
  });
  expect(calls.createCreator).not.toHaveBeenCalled();
});

it('retains the scoped draft when backend validation refuses a referral or handle', async () => {
  const calls = mutations();
  calls.createAffiliate.mockRejectedValue(new Error('That page handle is already taken.'));
  await savePendingSignupProfile(affiliate, identity);
  await expect(createSignupAccount(affiliate, identity, { isAuthenticated: true, hasAccount: false }, calls)).rejects.toThrow('already taken');
  expect(await loadPendingSignupProfile(identity)).toEqual(affiliate);
});

it.each(['admin', 'Bad Handle', 'ab', '-bad'])('refuses invalid or reserved affiliate handle %s', async (handle) => {
  const calls = mutations();
  await expect(createSignupAccount({ ...affiliate, handle }, identity, { isAuthenticated: true, hasAccount: false }, calls)).rejects.toThrow();
  expect(calls.createAffiliate).not.toHaveBeenCalled();
});

it('requires mobile for affiliates while keeping it optional for creators', () => {
  expect(signupProfileErrors({ ...affiliate, phone: '' })).toHaveProperty('phone');
  expect(signupProfileErrors({ ...creator, phone: '' })).toEqual({});
});

it('routes each existing role to its own native home', () => {
  expect(signupAccountHome('affiliate')).toBe('/(app)/(affiliate-tabs)');
  expect(signupAccountHome('admin')).toBe('/(app)/admin');
  expect(signupAccountHome(undefined)).toBe('/(app)/(tabs)');
});
