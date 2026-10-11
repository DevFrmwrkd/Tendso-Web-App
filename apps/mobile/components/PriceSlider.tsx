/**
 * PriceSlider — pure React Native draggable slider with live discount + earnings readouts.
 *
 * Phase 2 of the Owner Portal & Pricing Plan (OWNER-PORTAL-PRICING-PLAN.md §2.2a).
 * The creator drags to set their sale price within [floor, ceiling]; the live readouts
 * teach the trade-off — drop the price to discount harder, hold the price to earn more.
 *
 * Implementation note: built with View + PanResponder so it works against the existing
 * `gradlew bundleRelease` flow without adding a native dep (no @react-native-community/slider).
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  PanResponder,
  LayoutChangeEvent,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../theme/tokens';

interface PriceSliderProps {
  floor: number;        // BASE_PRICE — ₱999
  ceiling: number;      // creator's priceCeiling — ₱4,999 once unlocked, ₱999 while locked
  anchor: number;       // listPrice marketing anchor — ₱4,999
  commissionRate: number; // 0.5 — what fraction the creator keeps
  step?: number;        // ₱100 default
  initialValue?: number;
  onChange: (value: number) => void;
}

export function PriceSlider({
  floor,
  ceiling,
  anchor,
  commissionRate,
  step = 100,
  initialValue,
  onChange,
}: PriceSliderProps) {
  // Default to ceiling so the creator consciously *chooses* to discount rather than
  // defaulting low (per §2.2a UX rationale).
  const [value, setValue] = useState(initialValue ?? ceiling);
  const [trackWidth, setTrackWidth] = useState(0);
  const [showTypedInput, setShowTypedInput] = useState(false);
  const [typedInputValue, setTypedInputValue] = useState(String(value));
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    onChange(value);
  }, [value]);

  const snapToStep = (raw: number) => {
    const clamped = Math.max(floor, Math.min(ceiling, raw));
    return Math.round(clamped / step) * step;
  };

  // ───── PanResponder: drag thumb left/right ─────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {},
      onPanResponderMove: (_, gesture) => {
        if (trackWidth === 0) return;
        // gesture.moveX is absolute screen X — we need it relative to track.
        // Easier: use dx + current pos. Compute fraction from drag delta.
        // For simplicity here, we drive value from gesture.moveX minus the track's
        // x offset, which we approximate via locationX in onResponderMove.
        // Using gesture.x0 + dx is more reliable than tracking layout positions.
        const fraction = Math.max(0, Math.min(1, gesture.moveX / trackWidth));
        // Wrong — moveX is screen-absolute, not track-relative. We need locationX.
        // PanResponder doesn't give locationX cleanly across native impls. Use dx
        // from current value instead — incremental delta.
        const incrementalFraction = gesture.dx / trackWidth;
        const range = ceiling - floor;
        const newValue = snapToStep(valueRef.current + incrementalFraction * range);
        if (newValue !== valueRef.current) {
          setValue(newValue);
          valueRef.current = newValue;
        }
      },
      onPanResponderRelease: () => {},
    }),
  ).current;

  // Thumb position as fraction of track width
  const fraction = (value - floor) / Math.max(1, ceiling - floor);
  const thumbX = fraction * trackWidth;
  const filledWidth = thumbX;

  const onTrackLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  // Live derived values
  const discountPct = Math.round(((anchor - value) / anchor) * 100);
  const earnings = Math.round(commissionRate * value);

  // Slider is no-op if floor === ceiling (locked intro state)
  const isLocked = floor >= ceiling;

  const openTypedInput = () => {
    setTypedInputValue(String(value));
    setShowTypedInput(true);
  };

  const commitTypedInput = () => {
    const parsed = parseInt(typedInputValue, 10);
    if (!isNaN(parsed)) {
      const clamped = snapToStep(parsed);
      setValue(clamped);
      valueRef.current = clamped;
    }
    setShowTypedInput(false);
  };

  return (
    <View style={{
      backgroundColor: colors.paper3,
      borderRadius: radius.lg,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.rule,
    }}>
      <Text style={{
        fontFamily: fonts.mono, fontSize: 10, color: colors.ink3,
        letterSpacing: 1.4, marginBottom: 12,
      }}>
        SET YOUR PRICE
      </Text>

      {/* Current value — large, tappable for direct input */}
      <TouchableOpacity onPress={openTypedInput} accessibilityRole="button" accessibilityLabel={`Current price ₱${value}. Tap to type exact amount.`}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={{
            fontFamily: fonts.serif, fontSize: 40, color: colors.ink,
            letterSpacing: -1.2, lineHeight: 44,
          }}>
            ₱{value.toLocaleString()}
          </Text>
          <Ionicons name="create-outline" size={14} color={colors.ink3} />
        </View>
      </TouchableOpacity>

      {/* Anchor + discount badge */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 18 }}>
        <Text style={{
          fontFamily: fonts.sans, fontSize: 13, color: colors.ink3,
          textDecorationLine: 'line-through',
        }}>
          ₱{anchor.toLocaleString()}
        </Text>
        {discountPct > 0 && (
          <View style={{
            backgroundColor: colors.accentBg,
            borderRadius: radius.pill,
            paddingHorizontal: 10, paddingVertical: 3,
          }}>
            <Text style={{
              fontFamily: fonts.sansBold, fontSize: 11,
              color: colors.accentInk, letterSpacing: 0.4,
            }}>
              {discountPct}% OFF
            </Text>
          </View>
        )}
      </View>

      {/* The slider itself */}
      {!isLocked ? (
        <>
          <View
            onLayout={onTrackLayout}
            style={{
              height: 36, justifyContent: 'center',
              marginBottom: 8,
            }}
            {...panResponder.panHandlers}
          >
            {/* Track */}
            <View style={{
              height: 4, backgroundColor: colors.rule,
              borderRadius: 2,
            }} />
            {/* Filled portion */}
            <View style={{
              position: 'absolute',
              left: 0, top: 16,
              height: 4, width: filledWidth,
              backgroundColor: colors.accentSolid,
              borderRadius: 2,
            }} />
            {/* Thumb */}
            <View style={{
              position: 'absolute',
              left: Math.max(0, thumbX - 14),
              top: 4,
              width: 28, height: 28, borderRadius: 14,
              backgroundColor: colors.accentSolid,
              borderWidth: 3, borderColor: colors.paper,
              shadowColor: '#000', shadowOpacity: 0.15,
              shadowOffset: { width: 0, height: 2 }, shadowRadius: 4,
              elevation: 3,
            }} />
          </View>

          {/* Floor / ceiling labels */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 }}>
            <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.ink3 }}>
              ₱{floor.toLocaleString()}
            </Text>
            <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.ink3 }}>
              ₱{ceiling.toLocaleString()}
            </Text>
          </View>
        </>
      ) : (
        <View style={{
          backgroundColor: colors.accentBg,
          borderRadius: radius.sm,
          padding: 12,
          marginBottom: 14,
        }}>
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 13, color: colors.accentInk, marginBottom: 2 }}>
            Launch price ₱{floor.toLocaleString()}
          </Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.accentInk, lineHeight: 17 }}>
            Locked while you complete your first 5 submissions. You'll set your own price after that.
          </Text>
        </View>
      )}

      {/* Live "You earn" — the psychological work happens here */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: colors.accentBg,
        borderRadius: radius.sm,
        padding: 12,
      }}>
        <View style={{
          width: 32, height: 32, borderRadius: 16,
          backgroundColor: colors.accentSolid,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name="cash" size={16} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 15, color: colors.accentInk }}>
            You earn ₱{earnings.toLocaleString()}
          </Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.accentInk, opacity: 0.75 }}>
            {Math.round(commissionRate * 100)}% of ₱{value.toLocaleString()} · paid when the business pays
          </Text>
        </View>
      </View>

      {/* Typed-amount modal — fallback for creators who know the exact number */}
      <Modal visible={showTypedInput} transparent animationType="fade" onRequestClose={() => setShowTypedInput(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <View style={{
            width: '85%', maxWidth: 320,
            backgroundColor: colors.paper,
            borderRadius: radius.lg,
            padding: 22,
          }}>
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 16, color: colors.ink, marginBottom: 4 }}>
              Type your price
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.ink3, marginBottom: 14 }}>
              Between ₱{floor.toLocaleString()} and ₱{ceiling.toLocaleString()}
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              borderWidth: 1, borderColor: colors.rule, borderRadius: radius.sm,
              paddingHorizontal: 14, height: 50, marginBottom: 16,
            }}>
              <Text style={{ fontFamily: fonts.serif, fontSize: 22, color: colors.ink }}>₱</Text>
              <TextInput
                value={typedInputValue}
                onChangeText={setTypedInputValue}
                keyboardType="number-pad"
                autoFocus
                style={{ flex: 1, fontFamily: fonts.serif, fontSize: 22, color: colors.ink }}
                onSubmitEditing={commitTypedInput}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setShowTypedInput(false)}
                style={{
                  flex: 1, height: 44, borderRadius: radius.sm,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: colors.paper3, borderWidth: 1, borderColor: colors.rule,
                }}
              >
                <Text style={{ fontFamily: fonts.sansMed, fontSize: 14, color: colors.ink2 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={commitTypedInput}
                style={{
                  flex: 1, height: 44, borderRadius: radius.sm,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: colors.accentSolid,
                }}
              >
                <Text style={{ fontFamily: fonts.sansMed, fontSize: 14, color: '#fff' }}>Set price</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
