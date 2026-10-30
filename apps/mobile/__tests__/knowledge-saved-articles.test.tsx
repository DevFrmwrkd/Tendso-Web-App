import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KnowledgeProvider } from '../services/knowledge/KnowledgeProvider';
import { knowledgeBookmarkKey } from '../services/knowledge/bookmarks';
import ArticleScreen from '../app/(app)/(tabs)/knowledge/article/[slug]';
import KnowledgeHome from '../app/(app)/(tabs)/knowledge';
import { BlockView } from '../components/knowledge/Blocks';

const mockRouter = { push: jest.fn(), back: jest.fn() };
let mockSubject: string | null;
let mockSlug: string;
let mockStorage: Record<string, string>;
let mockArticles: any[];

jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ userId: mockSubject, isLoaded: true, isSignedIn: !!mockSubject }) }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ slug: mockSlug }) }));
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(), setItem: jest.fn() } }));
jest.mock('@tendso/convex-client', () => ({ api: {
  knowledge: { canAccessWiki: 'access', listCategories: 'categories', listArticles: 'articles', listFaqs: 'faqs', recordFeedback: 'feedback' },
  knowledgeAI: { ask: 'ask' },
} }));
jest.mock('convex/react', () => ({
  useQuery: (name: string, args: any) => name === 'access' ? true : name === 'categories' ? [{ _id: 'topic', slug: 'photos', title: 'Photos', hue: 'green', workspace: args.workspace }]
    : name === 'articles' ? mockArticles.filter(article => article.workspace === args.workspace) : [],
  useMutation: () => jest.fn(), useAction: () => jest.fn(),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path', Defs: 'Defs', LinearGradient: 'Gradient', Rect: 'Rect', Stop: 'Stop', Circle: 'Circle', G: 'G' }));

const article = (id: string, workspace = 'help') => ({ _id: id, slug: id, title: `Article ${id}`, author: 'Tendso',
  readMin: 2, workspace, categoryId: 'topic', body: [{ t: 'p', text: 'Real article text.' }], keywords: [] });
const page = () => <KnowledgeProvider><ArticleScreen /></KnowledgeProvider>;
const home = () => <KnowledgeProvider><KnowledgeHome /></KnowledgeProvider>;
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

beforeEach(() => {
  jest.clearAllMocks(); mockSubject = 'clerk-alice'; mockSlug = 'first'; mockArticles = [article('first'), article('second'), article('wiki-only', 'wiki')];
  mockStorage = { [knowledgeBookmarkKey('clerk-alice')]: JSON.stringify(['first', 'deleted-article', 'wiki-only']) };
  jest.mocked(AsyncStorage.getItem).mockReset().mockImplementation(async key => mockStorage[key] ?? null);
  jest.mocked(AsyncStorage.setItem).mockReset().mockImplementation(async (key, value) => { mockStorage[key] = value; });
});

it('restores bookmarks for this identity and removes the article through its header action', async () => {
  const screen = render(page());
  await waitFor(() => expect(screen.getByRole('button', { name: 'Remove saved article' })).toBeEnabled());
  fireEvent.press(screen.getByRole('button', { name: 'Remove saved article' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save article' })).toBeEnabled());
  expect(JSON.parse(mockStorage[knowledgeBookmarkKey('clerk-alice')])).toEqual(['deleted-article', 'wiki-only']);
});

it('offers the saved-articles view from home and shows only currently readable articles', async () => {
  const screen = render(home());
  await waitFor(() => expect(screen.getByText('Saved articles (1)')).toBeTruthy());
  fireEvent.press(screen.getByText('Saved articles (1)'));
  expect(screen.getByText('Article first')).toBeTruthy();
  expect(screen.queryByText('Article second')).toBeNull();
  expect(screen.queryByText('Article wiki-only')).toBeNull();
  fireEvent.press(screen.getByText('Article first'));
  expect(mockRouter.push).toHaveBeenCalledWith('/(app)/(tabs)/knowledge/article/first');
});

it('immediately drops the previous identity’s saved state during an account change', async () => {
  const screen = render(page());
  await waitFor(() => expect(screen.getByRole('button', { name: 'Remove saved article' })).toBeEnabled());
  mockSubject = 'clerk-bob'; screen.rerender(page());
  expect(screen.queryByRole('button', { name: 'Remove saved article' })).toBeNull();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save article' })).toBeEnabled());
  fireEvent.press(screen.getByRole('button', { name: 'Save article' }));
  await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledWith(knowledgeBookmarkKey('clerk-bob'), JSON.stringify(['first'])));
  expect(JSON.parse(mockStorage[knowledgeBookmarkKey('clerk-alice')])).toContain('first');
});

it('ignores a delayed old-account read after the subject changes', async () => {
  let finish!: (value: string) => void;
  jest.mocked(AsyncStorage.getItem).mockImplementation(key => key === knowledgeBookmarkKey('clerk-alice')
    ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(null));
  const screen = render(page());
  mockSubject = 'clerk-bob'; screen.rerender(page());
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save article' })).toBeEnabled());
  await act(async () => { finish(JSON.stringify(['first'])); await flush(); });
  expect(screen.queryByRole('button', { name: 'Remove saved article' })).toBeNull();
});

it('keeps an in-flight write on its original account and blocks duplicate taps', async () => {
  let finish!: () => void;
  jest.mocked(AsyncStorage.setItem).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  mockStorage = {};
  const screen = render(page());
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save article' })).toBeEnabled());
  const save = screen.getByRole('button', { name: 'Save article' });
  fireEvent.press(save); fireEvent.press(save);
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  mockSubject = 'clerk-bob'; screen.rerender(page());
  await act(async () => { finish(); await flush(); });
  expect(screen.queryByRole('button', { name: 'Remove saved article' })).toBeNull();
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(knowledgeBookmarkKey('clerk-alice'), JSON.stringify(['first']));
});

it('does not claim a failed save and lets the same action retry', async () => {
  mockStorage = {};
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('Full device'));
  const screen = render(page());
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save article' })).toBeEnabled());
  fireEvent.press(screen.getByRole('button', { name: 'Save article' }));
  await waitFor(() => expect(screen.getByText('Could not save this bookmark. Please try again.')).toBeTruthy());
  fireEvent.press(screen.getByRole('button', { name: 'Save article' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Remove saved article' })).toBeTruthy());
});

it('renders the actual HTTPS article photo and falls back safely on URL failure', () => {
  const screen = render(<BlockView block={{ t: 'image', url: 'https://media.example.com/real-photo.jpg', alt: 'The shop owner', caption: 'At the shop' }} />);
  const image = screen.getByLabelText('The shop owner');
  expect(image.props.source.uri).toBe('https://media.example.com/real-photo.jpg');
  fireEvent(image, 'error');
  expect(screen.getByText('Image unavailable')).toBeTruthy();
  expect(screen.getByText('At the shop')).toBeTruthy();
  screen.rerender(<BlockView block={{ t: 'image', url: 'https://media.example.com/replaced.jpg', alt: 'Replacement photo', caption: 'At the shop' }} />);
  expect(screen.getByLabelText('Replacement photo')).toBeTruthy();
});

it('never gives an executable/local URL to Image and preserves legacy captions', () => {
  const screen = render(<BlockView block={{ t: 'image', url: 'javascript:alert(1)', caption: 'Real caption' }} />);
  expect(screen.getByText('Image unavailable')).toBeTruthy();
  screen.rerender(<BlockView block={{ t: 'image', caption: 'Legacy caption without a photo' }} />);
  expect(screen.getByText('Legacy caption without a photo')).toBeTruthy();
  expect(screen.queryByText('Image unavailable')).toBeNull();
});
