import React from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { BASE_PRICE, PRICE_CEILING, commissionFor } from '../../../../lib/pricing';
import { Card, Text } from '../v2';
import { colors, radius, space } from '../../theme/v2';
import { walletPeso } from './WalletActivity';

const PRICE_CHOICES = [BASE_PRICE, 1999, 2999, 3999, PRICE_CEILING];

export function FieldAgentPriceCard({ price, loaded, saving, disabled, error, onChange }: {
  price: number; loaded: boolean; saving: boolean; disabled: boolean; error?: string;
  onChange: (price: number) => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const wrap = width < 360 || fontScale > 1.15;
  return <Card testID="field-agent-price-card" style={styles.card}>
    <View style={styles.heading}>
      <Text variant="bodyLg" weight="bold" accessibilityRole="header">Your price</Text>
      <Text variant="label" weight="medium" tone="muted">Lower price · easier yes</Text>
    </View>
    {loaded ? <>
      <View style={[styles.choices, wrap && styles.wrap]} accessibilityRole="radiogroup" accessibilityLabel="Default price for new sites">
        {PRICE_CHOICES.map(value => <Pressable key={value} onPress={() => onChange(value)} disabled={disabled || saving}
          accessibilityRole="radio" accessibilityLabel={`New site price ${walletPeso(value)}`}
          accessibilityHint="Sets the starting price for future new sites. Existing drafts keep their prices."
          accessibilityState={{ checked: price === value, disabled: disabled || saving, busy: saving }}
          cssInterop={false} style={({ pressed }) => [styles.choiceTarget, wrap && styles.choiceWrapped, pressed && styles.pressed]}>
          <View style={[styles.choice, price === value && styles.selected]}>
            <Text variant="label" weight="bold" tabular>{value.toLocaleString('en-PH')}</Text>
          </View>
        </Pressable>)}
      </View>
      <View style={[styles.totals, fontScale > 1.3 && styles.totalsStacked]}>
        <View style={[styles.tile, fontScale > 1.3 && styles.tileStacked, styles.keep]}>
          <Text variant="heading" tabular>{walletPeso(commissionFor(price))}</Text>
          <Text variant="label" weight="medium">you keep per site</Text>
        </View>
        <View style={[styles.tile, fontScale > 1.3 && styles.tileStacked]}>
          <Text variant="heading" tabular>{walletPeso(PRICE_CEILING - price)}</Text>
          <Text variant="label" weight="medium">the shop saves</Text>
        </View>
      </View>
    </> : <Text tone="muted">Loading your price…</Text>}
    {error ? <Text variant="label" tone="danger" accessibilityLiveRegion="polite">{error}</Text> : null}
  </Card>;
}

const styles = StyleSheet.create({
  card: { padding: space.md, gap: space.sm },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, flexWrap: 'wrap' },
  choices: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wrap: { flexWrap: 'wrap' },
  choiceTarget: { flex: 1, minWidth: 0, minHeight: 48, justifyContent: 'center' },
  choiceWrapped: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', minWidth: 76 },
  choice: { minHeight: 40, paddingHorizontal: 4, borderRadius: radius.pill, backgroundColor: colors.bg2,
    borderWidth: 1.5, borderColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  selected: { backgroundColor: colors.accent, borderColor: colors.ink },
  pressed: { opacity: 0.7 },
  totals: { flexDirection: 'row', alignItems: 'stretch', gap: space.sm },
  totalsStacked: { flexDirection: 'column' },
  tile: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, backgroundColor: colors.bg2, borderRadius: radius.field,
    padding: space.md, gap: space.xs },
  tileStacked: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  keep: { backgroundColor: colors.accentSoft },
});
