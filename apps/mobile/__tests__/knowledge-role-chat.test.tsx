import React, { type ReactNode } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { KnowledgeAccess } from '../components/knowledge/KnowledgeAccess';
import AskTendsoScreen from '../components/knowledge/AskTendsoScreen';
import SourceArticleScreen from '../components/knowledge/SourceArticleScreen';
import type { Article, AskResult, KnowledgeViewer } from '../services/knowledge/api';

const mockPush = jest.fn(), mockReplace = jest.fn(), mockAsk = jest.fn(), mockMutation = jest.fn();
type MockMobileState = {
  role: 'creator' | 'affiliate' | 'admin' | null;
  isOwner: boolean;
  isAuthenticated: boolean;
  isOffline: boolean;
  isPreview: boolean;
  isLoading: boolean;
  isBlocked: boolean;
  account: { clerkId: string; role: MockMobileState['role']; status: string; fieldAgentOnboardingRequired?: boolean } | null;
};
let mockAuth: { userId: string; sessionId: string; isLoaded: boolean; isSignedIn: boolean };
let mockMobile: MockMobileState;
let mockViewer: KnowledgeViewer;
let mockSource: { viewer: KnowledgeViewer; article: Pick<Article, '_id' | 'title' | 'body'> | null } | undefined;
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => mockAuth }));
jest.mock('../hooks/useMobileAccount', () => ({ useMobileAccount: () => mockMobile }));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), canGoBack: () => false }) }));
jest.mock('@tendso/convex-client', () => ({ api: {
  knowledge: { viewerContext: 'viewer', articleForViewer: 'article', recordFeedback: 'feedback' },
  knowledgeAI: { ask: 'ask' },
} }));
jest.mock('convex/react', () => ({
  useQuery: (name: string, args: unknown) => args === 'skip' ? undefined : name === 'viewer' ? mockViewer : mockSource,
  useAction: () => mockAsk,
  useMutation: (...args: unknown[]) => { mockMutation(...args); return jest.fn(); },
}));
jest.mock('expo-router', () => ({
  Redirect: function MockRedirect({ href }: { href: string }) {
    return jest.requireActual<typeof import('react')>('react').createElement(jest.requireActual<typeof import('react-native')>('react-native').Text, null, `Redirect ${href}`);
  },
  useLocalSearchParams: () => ({ slug: 'private-guide' }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../components/knowledge/Blocks', () => ({ ArticleBody: function MockBody({ body }: { body: { text?: string }[] }) {
  return jest.requireActual<typeof import('react')>('react').createElement(jest.requireActual<typeof import('react-native')>('react-native').Text, null, body[0]?.text);
} }));
jest.mock('../components/v2', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View, Text, Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Text,
    ScreenShell: function MockShell({ children, footer }: { children?: ReactNode; footer?: ReactNode }) { return <View>{children}{footer}</View>; },
    TendsoMark: () => null,
    Card: View,
    Loading: () => <Text>Loading</Text>,
    EmptyState: function MockEmptyState({ title }: { title: string }) { return <Text>{title}</Text>; },
    Button: function MockButton({ title, onPress }: { title: string; onPress?: () => void }) { return <Pressable onPress={onPress}><Text>{title}</Text></Pressable>; },
  };
});

function role(audience: 'owner' | 'affiliate' | 'field_agent' | 'admin') {
  mockMobile.role = audience === 'field_agent' ? 'creator' : audience === 'owner' ? null : audience;
  mockMobile.isOwner = audience === 'owner';
  mockMobile.account = audience === 'owner' ? null : { clerkId: mockAuth.userId, role: mockMobile.role, status: 'active' };
  mockViewer = { clerkId: mockAuth.userId, authenticated: true, blocked: false, audience,
    canAccessWiki: audience === 'field_agent' || audience === 'admin', isAdmin: audience === 'admin' };
}
const page = () => <KnowledgeAccess><AskTendsoScreen /></KnowledgeAccess>;
const source = () => <KnowledgeAccess><SourceArticleScreen /></KnowledgeAccess>;
const ask = async (screen: ReturnType<typeof render>, question: string) => {
  await act(() => { fireEvent.changeText(screen.getByLabelText('Type a question'), question); });
  await act(() => { fireEvent.press(screen.getByLabelText('Send')); });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAsk.mockReset();
  mockAuth = { userId: 'alice', sessionId: 'session-a', isLoaded: true, isSignedIn: true };
  mockMobile = { role: null, account: null, isOwner: false, isAuthenticated: true, isOffline: false, isPreview: false, isLoading: false, isBlocked: false };
  mockSource = undefined;
  mockAsk.mockResolvedValue({ answer: 'A sourced answer', sources: [{ slug: 'private-guide', title: 'Guide' }] });
  role('field_agent');
});

it.each(['owner', 'affiliate', 'field_agent', 'admin'] as const)('opens one native bot for %s and lets the server choose the audience', async audience => {
  role(audience);
  const screen = render(page());
  await ask(screen, 'How does it work?');
  expect(mockAsk).toHaveBeenCalledWith({ query: 'How does it work?', source: 'chatbot', history: [] });
  expect(screen.getByText('A sourced answer')).toBeTruthy();
  expect(screen.queryByText('Field wiki')).toBeNull();
  if (audience === 'owner') expect(mockMutation).not.toHaveBeenCalled();
});

it.each(['offline', 'preview', 'blocked', 'wrong subject', 'wrong role'])('does not mount a conversation for %s access', state => {
  if (state === 'offline') mockMobile.isOffline = true;
  if (state === 'preview') mockMobile.isPreview = true;
  if (state === 'blocked') mockViewer.blocked = true;
  if (state === 'wrong subject') mockViewer.clerkId = 'previous-admin';
  if (state === 'wrong role') mockViewer.audience = 'admin';
  const screen = render(page());
  expect(screen.queryByLabelText('Type a question')).toBeNull();
  expect(mockAsk).not.toHaveBeenCalled();
});

it('preserves pending affiliate and agent onboarding route gates', () => {
  role('affiliate'); mockMobile.account!.status = 'pending';
  const screen = render(page());
  expect(screen.getByText('Redirect /(app)/(affiliate-tabs)/')).toBeTruthy();
  role('field_agent'); mockMobile.account!.fieldAgentOnboardingRequired = true;
  screen.rerender(page());
  expect(screen.getByText('Redirect /(app)/agent-onboarding')).toBeTruthy();
  expect(mockAsk).not.toHaveBeenCalled();
});

it('immediately hides an affiliate transcript if its live account is suspended before the viewer query refreshes', async () => {
  role('affiliate');
  const screen = render(page());
  await ask(screen, 'My earnings');
  mockMobile.account!.status = 'suspended'; screen.rerender(page());
  expect(screen.queryByText('A sourced answer')).toBeNull();
  expect(screen.queryByLabelText('Type a question')).toBeNull();
  expect(screen.getByText('Account unavailable')).toBeTruthy();
});

it('drops private answers and an in-flight answer when the verified role changes', async () => {
  role('admin');
  const screen = render(page());
  mockAsk.mockResolvedValueOnce({ answer: 'Private admin answer', sources: [] });
  await ask(screen, 'Admin information');
  expect(screen.getByText('Private admin answer')).toBeTruthy();
  let finish!: (value: AskResult) => void;
  mockAsk.mockImplementationOnce(() => new Promise<AskResult>(resolve => { finish = resolve; }));
  await ask(screen, 'Another admin question');
  role('owner'); screen.rerender(page());
  expect(screen.queryByText('Private admin answer')).toBeNull();
  expect(screen.queryByText('Admin information')).toBeNull();
  await act(async () => { finish({ answer: 'Delayed admin answer', sources: [], grounded: true, escalated: false }); });
  expect(screen.queryByText('Delayed admin answer')).toBeNull();
  await ask(screen, 'Owner question');
  expect(mockAsk).toHaveBeenLastCalledWith({ query: 'Owner question', source: 'chatbot', history: [] });
});

it.each(['actor', 'session'])('clears the transcript synchronously when the Clerk %s changes', async change => {
  const screen = render(page());
  await ask(screen, 'My private question');
  fireEvent.changeText(screen.getByLabelText('Type a question'), 'Unsent private text');
  if (change === 'actor') { mockAuth.userId = 'bob'; role('field_agent'); }
  else mockAuth.sessionId = 'new-session';
  screen.rerender(page());
  expect(screen.queryByText('A sourced answer')).toBeNull();
  expect(screen.queryByText('My private question')).toBeNull();
  expect(screen.getByLabelText('Type a question').props.value).toBe('');
});

it('blocks duplicate sends and opens citations in the common authorized article route', async () => {
  const screen = render(page());
  await act(async () => {
    const suggestion = screen.getByLabelText('How much do I keep per site?');
    fireEvent.press(suggestion); fireEvent.press(suggestion);
  });
  expect(mockAsk).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByLabelText('Source: Guide'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(knowledge)/article/[slug]', params: { slug: 'private-guide' } });
});

it('never displays retained private article content for a different role or subject', () => {
  role('owner');
  mockSource = { viewer: { ...mockViewer, audience: 'admin' }, article: { _id: 'a', title: 'Private admin article', body: [] } };
  const screen = render(source());
  expect(screen.queryByText('Private admin article')).toBeNull();
  mockSource = { viewer: { ...mockViewer, clerkId: 'previous-admin' }, article: mockSource.article };
  screen.rerender(source());
  expect(screen.queryByText('Private admin article')).toBeNull();
  mockSource = { viewer: mockViewer, article: null }; screen.rerender(source());
  expect(screen.getByText('Article unavailable')).toBeTruthy();
});
