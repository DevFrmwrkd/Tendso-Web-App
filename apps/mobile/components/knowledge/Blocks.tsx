import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Block } from '../../services/knowledge/api';
import { colors, fonts, radius } from '../../theme/tokens';

const P = { fontFamily: fonts.sans, fontSize: 15, lineHeight: 24, color: colors.ink2 } as const;

function Bullet({ items, ordered }: { items: string[]; ordered?: boolean }) {
  return (
    <View style={{ gap: 8, marginVertical: 4 }}>
      {items.map((it, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Text
            style={{
              fontFamily: ordered ? fonts.monoMed : fonts.sans,
              fontSize: ordered ? 13 : 15,
              lineHeight: 24,
              color: ordered ? colors.accentInk : colors.accent,
              width: 22,
            }}
          >
            {ordered ? `${i + 1}.` : '•'}
          </Text>
          <Text style={[P, { flex: 1 }]}>{it}</Text>
        </View>
      ))}
    </View>
  );
}

function Callout({ kind, text }: { kind: string; text: string }) {
  const warn = kind === 'warn';
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 10,
        backgroundColor: warn ? colors.warnBg : colors.accentBg,
        borderLeftWidth: 3,
        borderLeftColor: warn ? colors.warn : colors.accent,
        borderRadius: radius.sm,
        padding: 14,
        marginVertical: 6,
      }}
    >
      <Ionicons
        name={warn ? 'warning-outline' : 'information-circle-outline'}
        size={18}
        color={warn ? colors.warn : colors.accentInk}
        style={{ marginTop: 1 }}
      />
      <Text style={[P, { flex: 1, color: warn ? '#7A5300' : colors.accentInk }]}>{text}</Text>
    </View>
  );
}

function CodeBlock({ text }: { text: string }) {
  return (
    <View
      style={{
        backgroundColor: colors.ink,
        borderRadius: radius.sm,
        padding: 14,
        marginVertical: 6,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.mono,
          fontSize: 12.5,
          lineHeight: 20,
          color: colors.paper3,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function Quote({ text, who }: { text: string; who: string }) {
  return (
    <View
      style={{
        borderLeftWidth: 3,
        borderLeftColor: colors.ruleStrong,
        paddingLeft: 14,
        marginVertical: 6,
      }}
    >
      <Text style={{ fontFamily: fonts.serifIt, fontSize: 18, lineHeight: 26, color: colors.ink }}>
        {text}
      </Text>
      {!!who && (
        <Text style={{ fontFamily: fonts.monoMed, fontSize: 11, letterSpacing: 1, color: colors.ink3, marginTop: 6 }}>
          — {who.toUpperCase()}
        </Text>
      )}
    </View>
  );
}

function ImagePlaceholder({ caption }: { caption: string }) {
  return (
    <View style={{ marginVertical: 6 }}>
      <View
        style={{
          height: 140,
          backgroundColor: colors.paper2,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: colors.rule,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="image-outline" size={28} color={colors.ink3} />
      </View>
      {!!caption && (
        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 12,
            color: colors.ink3,
            textAlign: 'center',
            marginTop: 6,
          }}
        >
          {caption}
        </Text>
      )}
    </View>
  );
}

/** Renders a single article body block. */
export function BlockView({ block }: { block: Block }) {
  switch (block.t) {
    case 'p':
      return <Text style={[P, { marginVertical: 6 }]}>{block.text}</Text>;
    case 'h2':
      return (
        <Text
          style={{
            fontFamily: fonts.serif,
            fontSize: 22,
            lineHeight: 28,
            color: colors.ink,
            marginTop: 18,
            marginBottom: 4,
          }}
        >
          {block.text}
        </Text>
      );
    case 'ul':
      return <Bullet items={block.items} />;
    case 'ol':
      return <Bullet items={block.items} ordered />;
    case 'callout':
      return <Callout kind={block.kind} text={block.text} />;
    case 'code':
      return <CodeBlock text={block.text} />;
    case 'quote':
      return <Quote text={block.text} who={block.who} />;
    case 'image':
      return <ImagePlaceholder caption={block.caption} />;
    default:
      return null;
  }
}

/** Renders a full article body. */
export function ArticleBody({ body }: { body: Block[] }) {
  return (
    <View>
      {body.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </View>
  );
}
