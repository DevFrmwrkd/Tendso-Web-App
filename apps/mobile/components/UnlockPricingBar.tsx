import React from 'react';
import { View, Text } from 'react-native';
import { useQuery } from 'convex/react';
import { getPricingContext } from '../services/submissionsExtra';
import { Label, Body } from './ui/primitives';
import { colors, fonts } from '../theme/tokens';

/**
 * The unlocked target ceiling (web lib/pricing.ts PRICE_CEILING). The "up to X"
 * in the locked caption is this aspirational max — NOT the creator's CURRENT
 * ceiling, which is the base price (₱999) until they unlock. Using priceCeiling
 * from the query showed "up to ₱999" while locked.
 */
const PRICE_CEILING = 4999;

/** ₱ with thousands separators, e.g. 4999 -> "₱4,999". Mirrors web formatPHP. */
function formatPHP(amount: number): string {
  const n = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `₱${n}`;
}

type Pricing = {
  approvedCount: number;
  priceCeiling: number;
  unlocked: boolean;
  threshold: number;
  basePrice: number;
};

/**
 * "Unlock higher pricing" progress card — the mobile port of the web dashboard's
 * price-tier bar. Approved submissions count toward a threshold that unlocks the
 * higher price ceiling; below it, the creator is capped at the base price.
 *
 * Self-contained: give it the creator's id and it fetches its own data. Renders
 * nothing until the query resolves, so it never flashes an empty card.
 */
export function UnlockPricingBar({ creatorId }: { creatorId: string | undefined }) {
  const pricing = useQuery(
    getPricingContext,
    creatorId ? ({ creatorId } as any) : 'skip',
  ) as Pricing | undefined | null;

  if (!pricing) return null;

  const { approvedCount, threshold, priceCeiling, unlocked } = pricing;

  // Unlocked — a compact confirmation, matching the web's unlocked state.
  if (unlocked) {
    return (
      <View style={cardStyle}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Label tracking={1.6}>Pricing unlocked</Label>
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 13, color: colors.accent }}>
            Set up to {formatPHP(priceCeiling)}
          </Text>
        </View>
      </View>
    );
  }

  const remaining = Math.max(0, threshold - approvedCount);
  const pct = Math.min(100, Math.round((approvedCount / threshold) * 100));

  return (
    <View style={cardStyle}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <Label tracking={1.6}>Unlock higher pricing</Label>
        <Text style={{ fontFamily: fonts.sansBold, fontSize: 13, color: colors.accent }}>
          {approvedCount}/{threshold}
        </Text>
      </View>

      {/* Track + fill */}
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.rule, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${pct}%`, borderRadius: 4, backgroundColor: colors.accent }} />
      </View>

      <Body size="xs" color={colors.ink3} style={{ marginTop: 10 }}>
        {remaining > 0
          ? `${remaining} more approved ${remaining === 1 ? 'submission' : 'submissions'} to set your own price up to ${formatPHP(PRICE_CEILING)}.`
          : `You can now set your own price up to ${formatPHP(PRICE_CEILING)}.`}
      </Body>
    </View>
  );
}

const cardStyle = {
  backgroundColor: colors.paper3,
  borderWidth: 1,
  borderColor: colors.rule,
  borderRadius: 18,
  padding: 16,
};
