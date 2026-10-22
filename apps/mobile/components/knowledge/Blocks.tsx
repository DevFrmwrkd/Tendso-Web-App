import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Block } from '../../services/knowledge/api';
import { Banner, CheckRow, Text } from '../v2';
import { colors, fonts, radius, space } from '../../theme/v2';

/** Body paragraph: 17px on a 26px line (long-form reading size). */
const PARA = { lineHeight: 26 } as const;

/** Short items read as a checklist (mock `.a-check`); longer sentences stay as plain bullets. */
const CHECK_MAX_CHARS = 80;

function Bullets({ items }: { items: string[] }) {
  const asChecks = items.every((it) => it.length <= CHECK_MAX_CHARS);
  if (asChecks) {
    return (
      <View style={styles.checks}>
        {items.map((it, i) => (
          <CheckRow key={i} title={it} state="todo" />
        ))}
      </View>
    );
  }
  return (
    <View style={styles.list}>
      {items.map((it, i) => (
        <View key={i} style={styles.itemRow}>
          <View style={styles.dot} />
          <Text variant="body" tone="ink2" style={[PARA, styles.flex]}>
            {it}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <View style={styles.list}>
      {items.map((it, i) => (
        <View key={i} style={styles.itemRow}>
          <View style={styles.num}>
            <Text variant="label" weight="bold" tone="onAccent">
              {i + 1}
            </Text>
          </View>
          <Text variant="body" tone="ink2" style={[PARA, styles.flex]}>
            {it}
          </Text>
        </View>
      ))}
    </View>
  );
}

function CodeBlock({ text }: { text: string }) {
  return (
    <View style={styles.code}>
      <Text variant="body" tone="onDark" style={PARA}>
        {text}
      </Text>
    </View>
  );
}

function Quote({ text, who }: { text: string; who: string }) {
  return (
    <View style={styles.quote}>
      <Text variant="bodyLg" weight="semibold">
        {text}
      </Text>
      {!!who && (
        <Text variant="label" tone="muted" style={{ marginTop: space.sm }}>
          {`— ${who}`}
        </Text>
      )}
    </View>
  );
}

/** Renders a single article body block. */
export function BlockView({ block }: { block: Block }) {
  switch (block.t) {
    case 'p':
      return (
        <Text variant="body" tone="ink2" style={[PARA, styles.p]}>
          {block.text}
        </Text>
      );
    case 'h2':
      return (
        <Text variant="heading" accessibilityRole="header" style={styles.h2}>
          {block.text}
        </Text>
      );
    case 'ul':
      return <Bullets items={block.items} />;
    case 'ol':
      return <Steps items={block.items} />;
    case 'callout':
      return <Banner tone={block.kind === 'warn' ? 'warn' : 'ok'} body={block.text} style={styles.callout} />;
    case 'code':
      return <CodeBlock text={block.text} />;
    case 'quote':
      return <Quote text={block.text} who={block.who} />;
    case 'image':
      // The backend only sends a caption (no photo URL), so there is nothing to draw but the caption.
      return block.caption ? (
        <Text variant="label" tone="muted" style={styles.caption}>
          {block.caption}
        </Text>
      ) : null;
    default:
      return null;
  }
}

/** Renders a full article body. */
export function ArticleBody({ body }: { body: Block[] }) {
  return (
    <View style={styles.body}>
      {body.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  flex: { flex: 1 },
  p: { marginVertical: 0 },
  h2: { marginTop: space.md },
  checks: { gap: space.sm },
  list: { gap: space.md },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ink, marginTop: 9, marginHorizontal: 5 },
  num: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },
  callout: { marginVertical: 0 },
  code: { backgroundColor: colors.ink, borderRadius: radius.field, padding: space.lg },
  quote: { borderLeftWidth: 3, borderLeftColor: colors.ruleStrong, paddingLeft: space.lg },
  caption: { textAlign: 'center', fontFamily: fonts.medium },
});
