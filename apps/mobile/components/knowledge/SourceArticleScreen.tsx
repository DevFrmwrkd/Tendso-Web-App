import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { useRecordFeedback, type Article, type KnowledgeViewer } from '../../services/knowledge/api';
import { useKnowledgeViewer } from './KnowledgeAccess';
import { ArticleBody } from './Blocks';
import { Button, Card, EmptyState, Loading, ScreenShell, Text } from '../v2';
import { space } from '../../theme/v2';

/** Citations resolve by slug under the same trusted actor as the conversation. */
export default function SourceArticleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { viewer, home } = useKnowledgeViewer();
  const router = useGuardedRouter();
  const result = useQuery(api.knowledge.articleForViewer, typeof slug === 'string' ? { slug } : 'skip') as
    { viewer: KnowledgeViewer; article: Article | null } | undefined;
  const back = () => router.canGoBack() ? router.back() : router.replace(home as never);
  // Article and access context arrive in one query response, never a stale
  // admin article combined with a newly resolved owner/affiliate identity.
  const own = result && result.viewer.clerkId === viewer.clerkId && result.viewer.audience === viewer.audience
    && result.viewer.authenticated && !result.viewer.blocked && result.viewer.canAccessWiki === viewer.canAccessWiki;
  if (result === undefined || (result && !own)) return <Loading />;
  if (!own || !result.article) return <ScreenShell title="Source" onBack={back}>
    <EmptyState icon="document-outline" title="Article unavailable" body="This source is no longer available to your account." />
  </ScreenShell>;
  return <SourceArticle key={result.article._id} article={result.article} onBack={back} />;
}

function SourceArticle({ article, onBack }: { article: Article; onBack: () => void }) {
  const recordFeedback = useRecordFeedback();
  const [voted, setVoted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function vote(helpful: boolean) {
    if (busy || voted) return;
    setBusy(true); setFailed(false);
    try { await recordFeedback({ slug: article.slug, helpful }); setVoted(true); }
    catch { setFailed(true); }
    finally { setBusy(false); }
  }
  return <ScreenShell onBack={onBack} contentStyle={styles.content}>
    <Text variant="display" accessibilityRole="header">{article.title}</Text>
    <Text variant="label" tone="muted">{article.author} · {article.readMin} min read</Text>
    <ArticleBody body={article.body} />
    <Card style={styles.helpful}>
      <Text variant="heading" align="center">{voted ? 'Thanks for the feedback.' : 'Was this helpful?'}</Text>
      {!voted ? <View style={styles.buttons}>
        <Button title="Yes" variant="ghost" disabled={busy} onPress={() => { void vote(true); }} style={styles.flex} />
        <Button title="No" variant="ghost" disabled={busy} onPress={() => { void vote(false); }} style={styles.flex} />
      </View> : null}
      {failed ? <Text tone="danger">Could not send feedback. Please try again.</Text> : null}
    </Card>
  </ScreenShell>;
}

const styles = StyleSheet.create({
  content: { gap: space.md, paddingTop: space.md, paddingBottom: space.xxl },
  helpful: { gap: space.md, marginTop: space.lg },
  buttons: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
});
