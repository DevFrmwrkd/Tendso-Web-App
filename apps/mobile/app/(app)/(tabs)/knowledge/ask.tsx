import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '../../../../hooks/useGuardedRouter';
import { useKnowledge } from '../../../../services/knowledge/KnowledgeProvider';
import { useAsk, type ChatTurn } from '../../../../services/knowledge/api';
import { colors, fonts, radius } from '../../../../theme/tokens';

const KB = '/(app)/(tabs)/knowledge';

type Msg = { role: 'bot' | 'user'; text: string; sources?: { slug: string; title: string }[] };

const GREETINGS: Msg[] = [
  { role: 'bot', text: "Hi — I'm trained on the Tendso knowledge base. Ask me anything." },
  { role: 'bot', text: 'Try: “How much do I earn?” or “How fast can I get a site?”' },
];

const SUGGESTIONS = ['How much does a site cost?', 'How fast can I get one?', 'Where do payouts go?', 'Do I need experience?'];

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Back"
          accessibilityRole="button"
          style={headerBtn}
        >
          <Ionicons name="arrow-back" size={18} color={colors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.serifIt, fontSize: 22, color: colors.ink }}>Ask Tendso</Text>
          <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.6, color: colors.ink3 }}>
            POWERED BY THE KNOWLEDGE BASE
          </Text>
        </View>
        <Ionicons name="sparkles" size={18} color={colors.accent} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {messages.map((m, i) => {
            const isUser = m.role === 'user';
            return (
              <View
                key={i}
                style={{
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: '86%',
                  backgroundColor: isUser ? colors.ink : colors.paper3,
                  borderColor: isUser ? colors.ink : colors.rule,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  borderBottomRightRadius: isUser ? 4 : radius.md,
                  borderBottomLeftRadius: isUser ? radius.md : 4,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 14,
                    lineHeight: 21,
                    color: isUser ? colors.paper3 : colors.ink2,
                  }}
                >
                  {m.text}
                </Text>
                {!isUser && m.sources && m.sources.length > 0 && (
                  <View style={{ marginTop: 8, gap: 4 }}>
                    {m.sources.map((s) => (
                      <TouchableOpacity
                        key={s.slug}
                        onPress={() => openSource(s.slug)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      >
                        <Ionicons name="arrow-forward" size={12} color={colors.accent} />
                        <Text style={{ fontFamily: fonts.sansMed, fontSize: 12, color: colors.accent }} numberOfLines={1}>
                          {s.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
          {busy && (
            <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6 }}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.ink3 }}>typing…</Text>
            </View>
          )}
        </ScrollView>

        {/* Suggestions */}
        {messages.length <= GREETINGS.length && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingBottom: 6 }}>
            {SUGGESTIONS.map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => send(s)}
                style={{
                  backgroundColor: colors.paper3,
                  borderColor: colors.ruleStrong,
                  borderWidth: 1,
                  borderRadius: radius.pill,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.ink2 }}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Input */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: 12,
            borderTopWidth: 1,
            borderTopColor: colors.rule,
            backgroundColor: colors.paper,
          }}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send()}
            returnKeyType="send"
            placeholder="Type a question…"
            placeholderTextColor={colors.ink3}
            style={{
              flex: 1,
              backgroundColor: colors.paper3,
              borderColor: colors.rule,
              borderWidth: 1,
              borderRadius: radius.pill,
              paddingHorizontal: 16,
              height: 44,
              fontFamily: fonts.sans,
              fontSize: 15,
              color: colors.ink,
            }}
          />
          <TouchableOpacity
            onPress={() => send()}
            disabled={!input.trim() || busy}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.ink,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: !input.trim() || busy ? 0.4 : 1,
            }}
            accessibilityLabel="Send"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-up" size={18} color={colors.paper3} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const headerBtn = {
  width: 40,
  height: 40,
  borderRadius: radius.pill,
  backgroundColor: colors.paper3,
  borderWidth: 1,
  borderColor: colors.rule,
  alignItems: 'center',
  justifyContent: 'center',
} as const;
