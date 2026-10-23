/**
 * Tendso design v2 — kit preview.
 *
 * Reachable by deep link only (negosyodigital://v2-kit); not linked from any tab.
 * Shows every token and every component in components/v2. No auth, no data.
 * Even this dev screen keeps the floor: nothing under 16px.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BigNumber,
  Button,
  Card,
  Chip,
  EmptyState,
  ListRow,
  Pill,
  ProgressBar,
  ProgressSteps,
  ScreenShell,
  StatCard,
  Text,
} from '../components/v2';
import { useOtaUpdate } from '../hooks/useOtaUpdate';
import {
  colors,
  duration,
  ease,
  fonts,
  hit,
  MIN_FONT_SIZE,
  radius,
  shadow,
  space,
  type as typeScale,
  type TypeVariant,
} from '../theme/v2';

const swatches: { group: string; items: [string, string][] }[] = [
  {
    group: 'Accent (fill only)',
    items: [
      ['accent', colors.accent],
      ['accentSoft', colors.accentSoft],
      ['onAccent', colors.onAccent],
    ],
  },
  {
    group: 'Surfaces',
    items: [
      ['bg', colors.bg],
      ['bg2', colors.bg2],
      ['card', colors.card],
      ['dark', colors.dark],
    ],
  },
  {
    group: 'Ink',
    items: [
      ['ink', colors.ink],
      ['ink2', colors.ink2],
      ['ink3', colors.ink3],
      ['ink3Text', colors.ink3Text],
    ],
  },
  {
    group: 'Lines',
    items: [
      ['rule', colors.rule],
      ['ruleStrong', colors.ruleStrong],
    ],
  },
  {
    group: 'Status',
    items: [
      ['info', colors.info],
      ['infoBg', colors.infoBg],
      ['warn', colors.warn],
      ['warnBg', colors.warnBg],
      ['danger', colors.danger],
      ['dangerBg', colors.dangerBg],
      ['rec', colors.rec],
    ],
  },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

export default function V2KitScreen() {
  const router = useRouter();
  const [step, setStep] = useState(4);
  const [selected, setSelected] = useState('Barber');
  const [busy, setBusy] = useState(false);
  const ota = useOtaUpdate();

  return (
    <ScreenShell
      title="Tendso kit"
      subtitle="Design v2 tokens and components."
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      progress={step / 10}
      footer={
        <Button
          title={busy ? 'Saving' : 'Primary action'}
          loading={busy}
          onPress={() => {
            setBusy(true);
            setTimeout(() => setBusy(false), 900);
          }}
        />
      }
    >
      <Section title="Colour">
        {swatches.map((g) => (
          <View key={g.group} style={styles.group}>
            <Text variant="label" tone="muted">
              {g.group}
            </Text>
            <View style={styles.swatchRow}>
              {g.items.map(([name, hex]) => (
                <View key={name} style={styles.swatchWrap}>
                  <View style={[styles.swatch, { backgroundColor: hex }]} />
                  <Text variant="label" weight="semibold">
                    {name}
                  </Text>
                  <Text variant="label" weight="medium" tone="muted">
                    {hex}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
        <Card>
          <View style={styles.accentRule}>
            <View style={[styles.accentDot, { backgroundColor: colors.accent }]} />
            <Text variant="body" tone="ink2" style={styles.flex}>
              Accent is always a fill with ink text on it. Never yellow text on light.
            </Text>
          </View>
        </Card>
      </Section>

      <Section title="Type (Onest)">
        {(Object.keys(typeScale) as TypeVariant[]).map((v) => (
          <View key={v} style={styles.typeRow}>
            <Text variant="label" tone="muted">
              {`${v} · ${typeScale[v].fontSize}/${typeScale[v].lineHeight}`}
            </Text>
            <Text variant={v} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
              {v === 'number' || v === 'numberLg' ? '₱4,999' : 'Your site is live'}
            </Text>
          </View>
        ))}
        <Text variant="label" tone="muted">
          {`Floor: ${MIN_FONT_SIZE}px. Weights: ${Object.values(fonts)
            .map((f) => f.replace('Onest_', ''))
            .join(', ')}`}
        </Text>
      </Section>

      <Section title="Radius, space, shadow">
        <View style={styles.swatchRow}>
          {Object.entries(radius).map(([name, r]) => (
            <View key={name} style={styles.swatchWrap}>
              <View style={[styles.radiusBox, { borderRadius: Math.min(r, 32) }]} />
              <Text variant="label" weight="semibold">{`${name} ${r}`}</Text>
            </View>
          ))}
        </View>
        <View style={styles.swatchRow}>
          {Object.entries(space).map(([name, s]) => (
            <View key={name} style={styles.spaceItem}>
              <View style={{ width: s, height: 16, backgroundColor: colors.ink, borderRadius: 2 }} />
              <Text variant="label" weight="medium">{`${name} ${s}`}</Text>
            </View>
          ))}
        </View>
        <View style={styles.swatchRow}>
          {(Object.keys(shadow) as (keyof typeof shadow)[]).map((name) => (
            <View key={name} style={styles.swatchWrap}>
              <View style={[styles.shadowBox, shadow[name]]} />
              <Text variant="label" weight="semibold">{name}</Text>
            </View>
          ))}
        </View>
        <Text variant="label" tone="muted">
          {`Hit targets: min ${hit.min}, primary ${hit.primary}, large ${hit.large}`}
        </Text>
      </Section>

      <Section title="Motion">
        <Text variant="body" tone="ink2">
          {`ui ${duration.ui}ms · reveal ${duration.reveal}ms · settle ${duration.settle}ms. Ease out ${ease.out.join(', ')}. No bounce.`}
        </Text>
      </Section>

      <Section title="Buttons">
        <Button title="Primary, accent fill" />
        <Button title="Dark" variant="dark" />
        <Button title="Ghost" variant="ghost" />
        <Button title="With icon" icon="camera-outline" variant="dark" size="md" />
        <Button title="Disabled" disabled />
      </Section>

      <Section title="Pills and chips">
        <View style={styles.wrapRow}>
          {['Barber', 'Salon', 'Food', 'Repair'].map((p) => (
            <Pill key={p} label={p} selected={selected === p} onPress={() => setSelected(p)} />
          ))}
        </View>
        <View style={styles.wrapRow}>
          <Pill label="Neutral" />
          <Pill label="Ink" tone="ink" />
          <Pill label="Accent" tone="accent" />
        </View>
        <View style={styles.wrapRow}>
          <Chip label="Live" tone="ok" />
          <Chip label="Info" tone="info" />
          <Chip label="In review" tone="warn" />
          <Chip label="Rejected" tone="danger" />
          <Chip label="Draft" tone="muted" />
        </View>
      </Section>

      <Section title="Cards">
        <Card>
          <Text variant="bodyLg" weight="semibold">Default card</Text>
          <Text variant="body" tone="ink2">Soft shadow, radius 20.</Text>
        </Card>
        <Card variant="lg" onPress={() => undefined} accessibilityLabel="Large pressable card">
          <Text variant="bodyLg" weight="semibold">Large, pressable</Text>
          <Text variant="body" tone="ink2">Radius 24.</Text>
        </Card>
        <Card variant="dark">
          <Text variant="bodyLg" weight="semibold" tone="onDark">Dark card</Text>
          <ProgressSteps total={10} current={step} tone="dark" style={styles.darkSteps} />
        </Card>
        <Card variant="tint">
          <Text variant="bodyLg" weight="semibold">Tint card</Text>
        </Card>
      </Section>

      <Section title="Progress">
        <ProgressSteps current={step} label="Question" />
        <ProgressBar value={step / 10} tone="accent" />
        <View style={styles.wrapRow}>
          <Button title="Back" variant="ghost" size="md" fullWidth={false} onPress={() => setStep((s) => Math.max(1, s - 1))} />
          <Button title="Next" variant="dark" size="md" fullWidth={false} onPress={() => setStep((s) => Math.min(10, s + 1))} />
        </View>
      </Section>

      <Section title="Numbers">
        <StatCard value="₱4,999" label="One time" chip={{ label: 'Live', tone: 'ok' }} />
        <Card>
          <BigNumber value="12" label="Sites made" size="lg" />
        </Card>
      </Section>

      <Section title="List rows">
        <Card>
          <ListRow icon="cafe-outline" title="Lola's Carinderia" subtitle="Marikina" trailing={<Chip label="Live" tone="ok" />} divider />
          <ListRow icon="cut-outline" title="Kalan Barber" subtitle="Manila" onPress={() => undefined} divider />
          <ListRow icon="construct-outline" title="Domingo Repair" subtitle="In review" onPress={() => undefined} />
        </Card>
      </Section>

      <Section title="Empty state">
        <Card variant="lg">
          <EmptyState
            title="Nothing here yet"
            body="Your first shop shows up here."
            icon="storefront-outline"
            actionLabel="Add a shop"
            onAction={() => undefined}
          />
        </Card>
      </Section>

      <Section title="Updates">
        <Text variant="body" tone="ink2">
          {`Status: ${ota.status}. A downloaded update applies on the next launch.`}
        </Text>
      </Section>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: space.lg, marginBottom: space.huge },
  group: { gap: space.sm },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  swatchWrap: { width: 104, gap: 2 },
  swatch: {
    height: 56,
    borderRadius: radius.field,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ruleStrong,
    marginBottom: space.xs,
  },
  accentRule: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  accentDot: { width: 28, height: 28, borderRadius: radius.pill },
  typeRow: { gap: 2 },
  radiusBox: { width: 56, height: 56, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.ruleStrong },
  spaceItem: { gap: space.xs },
  shadowBox: { width: 88, height: 56, borderRadius: radius.card, backgroundColor: colors.card, marginBottom: space.sm },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  darkSteps: { marginTop: space.lg },
});
