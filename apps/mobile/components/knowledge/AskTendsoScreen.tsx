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
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { useAsk, type ChatTurn, type KnowledgeAudience } from '../../services/knowledge/api';
import { useKnowledgeViewer } from './KnowledgeAccess';
import { ScreenShell, TendsoMark, Text } from '../v2';
import { colors, fonts, hit, radius, shadow, space, type as typeScale } from '../../theme/v2';

type Msg = { role: 'bot' | 'user'; text: string; sources?: { slug: string; title: string }[] };

const GREETINGS: Msg[] = [
  { role: 'bot', text: "Hi, I'm Tendso. How can I help? I'll use the guides for your account." },
];

const SUGGESTIONS: Record<KnowledgeAudience, string[]> = {
  everyone: ['How does Tendso work?', 'How fast is a site built?'],
  owner: ['How do I continue my draft?', 'How do I pay for my website?', 'How do I ask for a change?'],
  affiliate: ['How does my creator code work?', 'When do I earn commission?', 'How do I invite a field agent?'],
  field_agent: ['How much do I keep per site?', 'How do I resend a rejected submission?', 'Where do payouts go?'],
  admin: ['How do I review a submission?', 'How do I assign a shop visit?', 'How are payments verified?'],
};

export default function AskTendso() {
  const router = useGuardedRouter();
  const { viewer, scope, home } = useKnowledgeViewer();
  const ask = useAsk();

  const [messages, setMessages] = useState<Msg[]>(GREETINGS);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const active = useRef(true);
  const pending = useRef(false);
  const liveScope = useRef(scope);
  liveScope.current = scope;
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, busy]);

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || pending.current || !active.current) return;
    const requestScope = scope;
    const current = () => active.current && liveScope.current === requestScope;
    pending.current = true;
    const history: ChatTurn[] = messages
      .slice(GREETINGS.length)
      .map((m): ChatTurn => ({ role: m.role === 'bot' ? 'assistant' : 'user', text: m.text }))
      .slice(-6);
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const res = await ask({ query: q, source: 'chatbot', history });
      if (current()) setMessages((m) => [...m, { role: 'bot', text: res.answer, sources: res.sources }]);
    } catch {
      if (current()) setMessages((m) => [
        ...m,
        { role: 'bot', text: "I couldn't reach the knowledge base just now — try again in a moment." },
      ]);
    } finally {
      if (current()) { pending.current = false; setBusy(false); }
    }
  };

  const openSource = (slug: string) => {
    router.push({ pathname: '/(knowledge)/article/[slug]', params: { slug } } as never);
  };

  const canSend = !!input.trim() && !busy;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenShell
        title="Ask Tendso"
        onBack={() => router.canGoBack() ? router.back() : router.replace(home as never)}
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
              placeholder="Ask about Tendso…"
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
              {SUGGESTIONS[viewer.audience].map((s) => (
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
