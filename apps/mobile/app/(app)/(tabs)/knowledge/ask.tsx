import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '../../../../hooks/useGuardedRouter';
import { useKnowledge } from '../../../../services/knowledge/KnowledgeProvider';
import { useAsk, type ChatTurn } from '../../../../services/knowledge/api';
import { ScreenShell, TendsoMark, Text } from '../../../../components/v2';
import { colors, fonts, hit, radius, shadow, space, type as typeScale } from '../../../../theme/v2';

const KB = '/(app)/(tabs)/knowledge';

type Msg = { role: 'bot' | 'user'; text: string; sources?: { slug: string; title: string }[] };

const GREETINGS: Msg[] = [
  { role: 'bot', text: "Hi, I'm Tendso. Ask me anything about the field, money or the app." },
  { role: 'bot', text: 'Try: “How much do I keep per site?”' },
];

const SUGGESTIONS = ['How much do I keep per site?', 'How fast is a site built?', 'Where do payouts go?', 'Do I need experience?'];

export default function AskTendso() {
  const router = useGuardedRouter();
  const { workspace, articles } = useKnowledge();
  const ask = useAsk();

  const [messages, setMessages] = useState<Msg[]>(GREETINGS);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, busy]);

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    const history: ChatTurn[] = messages
      .filter((m, i) => !(m.role === 'bot' && i < 2))
      .map((m): ChatTurn => ({ role: m.role === 'bot' ? 'assistant' : 'user', text: m.text }))
      .slice(-6);
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const res = await ask({ query: q, workspace, source: 'chatbot', history });
      setMessages((m) => [...m, { role: 'bot', text: res.answer, sources: res.sources }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'bot', text: "I couldn't reach the knowledge base just now — try again in a moment." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const openSource = (slug: string) => {
    const a = articles.find((x) => x.slug === slug);
    router.push(`${KB}/article/${a ? a.slug : slug}` as any);
  };

  const canSend = !!input.trim() && !busy;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenShell
        title="Ask Tendso"
        onBack={() => router.back()}
        insetBottom={false}
        scroll={false}
        contentStyle={styles.shellBody}
        footer={
          <View style={[styles.inputBar, shadow.soft]}>
            <TextInput
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => send()}
              returnKeyType="send"
              placeholder="Ask about the field, money, the app…"
              placeholderTextColor={colors.ink3}
              accessibilityLabel="Type a question"
              style={styles.input}
            />
            <Pressable
              onPress={() => send()}
              disabled={!canSend}
              accessibilityLabel="Send"
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSend }}
              style={[styles.send, { opacity: canSend ? 1 : 0.4 }]}
            >
              <Ionicons name="arrow-up" size={22} color={colors.onAccent} />
            </Pressable>
          </View>
        }
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.chat}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <View key={i} style={styles.me}>
                <Text variant="body" tone="onDark" weight="semibold" style={styles.meText}>
                  {m.text}
                </Text>
              </View>
            ) : (
              <View key={i} style={styles.botRow}>
                <TendsoMark size={36} />
                <View style={[styles.bot, shadow.soft]}>
                  <Text variant="body" style={styles.botText}>
                    {m.text}
                  </Text>
                  {m.sources && m.sources.length > 0 && (
                    <View style={styles.sources}>
                      <Text variant="label" weight="bold" tone="muted">
                        Sources
                      </Text>
                      {m.sources.map((s) => (
                        <Pressable
                          key={s.slug}
                          onPress={() => openSource(s.slug)}
                          accessibilityRole="button"
                          accessibilityLabel={`Source: ${s.title}`}
                          style={styles.source}
                        >
                          <Ionicons name="document-text-outline" size={20} color={colors.ink3} />
                          <Text variant="label" weight="bold" numberOfLines={2} style={styles.flex}>
                            {s.title}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ),
          )}
          {busy && (
            <View style={styles.typing}>
              <ActivityIndicator size="small" color={colors.ink} />
              <Text variant="label" weight="medium" tone="muted">
                Typing…
              </Text>
            </View>
          )}

          {/* Suggestions */}
          {messages.length <= GREETINGS.length && (
            <View style={styles.sugg}>
              {SUGGESTIONS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => send(s)}
                  accessibilityRole="button"
                  accessibilityLabel={s}
                  style={styles.suggPill}
                >
                  <Text variant="chip">{s}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </ScreenShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shellBody: { paddingTop: space.md, paddingBottom: 0 },
  // Bleed the chat to the screen edges while the title above keeps the 24pt gutter.
  scroll: { flex: 1, marginHorizontal: -space.gutter },
  chat: { paddingHorizontal: space.gutter, paddingBottom: space.lg, gap: space.md },
  me: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    backgroundColor: colors.ink,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 6,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  meText: { lineHeight: 24 },
  botRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md - 2, paddingRight: space.xl },
  bot: {
    flexShrink: 1,
    gap: space.md,
    backgroundColor: colors.card,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 2,
  },
  botText: { lineHeight: 26 },
  sources: { gap: space.sm, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rule },
  source: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: hit.min },
  typing: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: 48 },
  sugg: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingLeft: 48 },
  suggPill: {
    minHeight: hit.min,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    ...shadow.soft,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 60,
    paddingLeft: space.lg + 2,
    paddingRight: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    minHeight: hit.primary,
    fontFamily: fonts.medium,
    fontSize: typeScale.body.fontSize,
    color: colors.ink,
  },
  send: {
    width: hit.min,
    height: hit.min,
    borderRadius: hit.min / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
