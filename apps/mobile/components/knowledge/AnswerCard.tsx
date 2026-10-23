import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, SectionLabel, Text, TendsoMark } from '../v2';
import { useAsk, type Article, type AskResult, type Workspace } from '../../services/knowledge/api';
import { colors, radius, space } from '../../theme/v2';

/**
 * Grounded Tendso answer — calls the deployed knowledgeAI.ask RAG action
 * and shows the answer + tappable source articles (resolved from the loaded set).
 */
export function AnswerCard({
  query,
  workspace,
  articles,
  onOpenArticle,
}: {
  query: string;
  workspace: Workspace;
  articles: Article[];
  onOpenArticle: (a: Article) => void;
}) {
  const ask = useAsk();
  const [phase, setPhase] = useState<'thinking' | 'done' | 'error'>('thinking');
  const [result, setResult] = useState<AskResult | null>(null);
  const [err, setErr] = useState('');

  const bySlug = useMemo(() => new Map(articles.map((a) => [a.slug, a])), [articles]);

  useEffect(() => {
    let cancelled = false;
    setPhase('thinking');
    setResult(null);
    setErr('');
    ask({ query, workspace, source: 'web' })
      .then((res) => {
        if (!cancelled) {
          setResult(res);
          setPhase('done');
        }
      })
      .catch((e: any) => {
        if (!cancelled) {
          setErr(e?.message || 'Something went wrong.');
          setPhase('error');
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, workspace]);

  const paras = (result?.answer || '').split('\n\n').filter(Boolean);

  return (
    <Card variant="lg" style={styles.card}>
      <View style={styles.head}>
        <TendsoMark size={36} />
        <Text variant="bodyLg" weight="bold">
          Tendso
        </Text>
      </View>

      {phase === 'thinking' ? (
        <View style={styles.thinking}>
          <ActivityIndicator size="small" color={colors.ink} />
          <Text variant="body" tone="muted">
            Searching {workspace === 'help' ? 'the help center' : 'the wiki'}…
          </Text>
        </View>
      ) : phase === 'error' ? (
        <Text variant="body" tone="ink2" style={styles.para}>
          I couldn&apos;t generate an answer right now. {err}
        </Text>
      ) : (
        <View style={styles.answer}>
          {paras.map((p, i) => (
            <Text key={i} variant="body" tone="ink2" style={styles.para}>
              {p}
            </Text>
          ))}

          {result && result.sources.length > 0 && (
            <View style={styles.sources}>
              <SectionLabel>Sources</SectionLabel>
              {result.sources.map((s) => {
                const article = bySlug.get(s.slug);
                return (
                  <Pressable
                    key={s.slug}
                    disabled={!article}
                    onPress={() => article && onOpenArticle(article)}
                    accessibilityRole="button"
                    accessibilityLabel={`Source: ${s.title}`}
                    cssInterop={false}
                    style={({ pressed }) => [styles.source, { opacity: article ? (pressed ? 0.7 : 1) : 0.5 }]}
                  >
                    <Ionicons name="document-text-outline" size={20} color={colors.ink} />
                    <Text variant="label" weight="bold" numberOfLines={2} style={styles.sourceText}>
                      {s.title}
                    </Text>
                    {!!article && <Ionicons name="arrow-forward" size={18} color={colors.ink3} />}
                  </Pressable>
                );
              })}
              <Text variant="label" weight="medium" tone="muted">
                Generated from Tendso&apos;s published content. Always check the source.
              </Text>
            </View>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs },
  answer: { gap: space.md },
  para: { lineHeight: 26 },
  sources: { gap: space.sm, marginTop: space.xs },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 48,
    backgroundColor: colors.bg2,
    borderRadius: radius.field,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  sourceText: { flex: 1 },
});
