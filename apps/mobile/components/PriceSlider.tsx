/**
 * PriceSlider — pure React Native draggable slider with live discount + earnings readouts.
 *
 * Design v2 skin: Onest, accent fill thumb with an ink ring, big peso value, "You keep" readout.
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
import { colors, fonts, radius, shadow } from '../theme/v2';
import { snapPrice } from '../services/priceSlider';
import { creatorDiscount } from '../../../packages/shared/pricing';

interface PriceSliderProps {
  floor: number;        // BASE_PRICE — ₱999
  ceiling: number;      // creator's priceCeiling — ₱4,999 once unlocked, ₱999 while locked
  anchor: number;       // listPrice marketing anchor — ₱4,999
  commissionRate: number; // 0.5 — what fraction the creator keeps
  step?: number;        // ₱100 default
  initialValue?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  /** Show the "You keep" readout under the slider (default). Screens that print their own tiles turn it off. */
  showEarnings?: boolean;
}

const THUMB = 36;
const DRAG_THRESHOLD = 4;

export function PriceSlider({
  floor,
  ceiling,
  anchor,
  commissionRate,
  step = 100,
  initialValue,
  disabled = false,
  onChange,
  showEarnings = true,
}: PriceSliderProps) {
  // Default to ceiling so the creator consciously *chooses* to discount rather than
  // defaulting low (per §2.2a UX rationale).
  const [value, setValue] = useState(Math.max(floor, Math.min(ceiling, initialValue ?? ceiling)));
  const [trackWidth, setTrackWidth] = useState(0);
  const [showTypedInput, setShowTypedInput] = useState(false);
  const [typedInputValue, setTypedInputValue] = useState(String(value));
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const bounds = useRef({ floor, ceiling, step, trackWidth, disabled });
  bounds.current = { floor, ceiling, step, trackWidth, disabled };
  const drag = useRef<{ value: number; floor: number; ceiling: number; step: number; travel: number } | null>(null);

  // Notify for actual edits, rather than every parent callback identity change.
  // In particular, an echoed initialValue must never restart a running drag.
  const changeValue = (next: number) => {
    if (next === valueRef.current) return;
    valueRef.current = next;
    setValue(next);
    onChangeRef.current(next);
  };

  useEffect(() => {
    const active = drag.current;
    if (active && (disabled || active.floor !== floor || active.ceiling !== ceiling || active.step !== step)) {
      drag.current = null;
    }
    // The finger owns the value until release. Parent echoes (including delayed
    // ones) must not pull the thumb back between move events.
    if (drag.current) return;
    const next = Math.max(floor, Math.min(ceiling, initialValue ?? ceiling));
    if (next !== valueRef.current) {
      valueRef.current = next;
      setValue(next);
      if (initialValue === undefined || next !== initialValue) onChangeRef.current(next);
    }
  }, [initialValue, floor, ceiling, step, disabled]);

  useEffect(() => {
    onChangeRef.current(valueRef.current);
  }, []);

  const snapToStep = (raw: number) => {
    return snapPrice(raw, floor, ceiling, step);
  };

  // ───── PanResponder: drag thumb left/right ─────
  const panResponder = useRef<ReturnType<typeof PanResponder.create> | null>(null);
  if (!panResponder.current) {
    const wantsHorizontalDrag = (_: unknown, gesture: { dx: number; dy: number }) => {
      const current = bounds.current;
      return !current.disabled && current.ceiling > current.floor && current.trackWidth > THUMB
        && Math.abs(gesture.dx) > DRAG_THRESHOLD && Math.abs(gesture.dx) > Math.abs(gesture.dy);
    };
    panResponder.current = PanResponder.create({
      // Leave vertical movement to the enclosing screen's ScrollView.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: wantsHorizontalDrag,
      onMoveShouldSetPanResponderCapture: wantsHorizontalDrag,
      onPanResponderGrant: () => {
        const current = bounds.current;
        const travel = current.trackWidth - THUMB;
        drag.current = !current.disabled && current.ceiling > current.floor && travel > 0
          ? { value: valueRef.current, floor: current.floor, ceiling: current.ceiling, step: current.step, travel }
          : null;
      },
      onPanResponderMove: (_, gesture) => {
        const current = bounds.current;
        const active = drag.current;
        if (!active || current.disabled || active.floor !== current.floor || active.ceiling !== current.ceiling
          || active.step !== current.step || active.travel !== current.trackWidth - THUMB) {
          drag.current = null;
          return;
        }
        if (!Number.isFinite(gesture.dx)) return;
        const raw = active.value + gesture.dx / active.travel * (active.ceiling - active.floor);
        changeValue(snapPrice(raw, active.floor, active.ceiling, active.step));
      },
      // A horizontal drag keeps ownership even if the finger drifts vertically.
      onPanResponderTerminationRequest: () => !drag.current,
      onShouldBlockNativeResponder: () => !!drag.current,
      onPanResponderRelease: () => { drag.current = null; },
      onPanResponderTerminate: () => { drag.current = null; },
    });
  }

  // Both thumb centers sit on the rail ends; the entire thumb stays inside.
  const fraction = Math.max(0, Math.min(1, (value - floor) / Math.max(1, ceiling - floor)));
  const travel = Math.max(0, trackWidth - THUMB);
  const thumbX = fraction * travel;

  const onTrackLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (!Number.isFinite(width) || width <= 0) return;
    if (width !== bounds.current.trackWidth) drag.current = null;
    setTrackWidth(width);
  };

  // Live derived values
  const discount = creatorDiscount(value, anchor);
  const earnings = Math.round(commissionRate * value);

  // Slider is no-op if floor === ceiling (locked intro state)
  const isLocked = floor >= ceiling;

  const openTypedInput = () => {
    if (disabled) return;
    setTypedInputValue(String(value));
    setShowTypedInput(true);
  };

  const commitTypedInput = () => {
    const parsed = parseInt(typedInputValue, 10);
    if (!disabled && !isNaN(parsed)) changeValue(snapToStep(parsed));
    setShowTypedInput(false);
  };

  return (
    <View>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20, color: colors.ink3Text, marginBottom: 6 }}>
        Set your price
      </Text>

      {/* Current value — big, tappable for direct input */}
      <TouchableOpacity disabled={disabled} onPress={openTypedInput} accessibilityRole="button" accessibilityLabel={`Current price ₱${value}. Tap to type exact amount.`} style={{ minHeight: 56, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{
            fontFamily: fonts.extrabold, fontSize: 48, color: colors.ink,
            letterSpacing: -1.8, lineHeight: 54,
          }}>
            ₱{value.toLocaleString()}
          </Text>
          <Ionicons name="create-outline" size={22} color={colors.ink3} />
        </View>
      </TouchableOpacity>

      {/* Anchor + discount badge */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2, marginBottom: 12, minHeight: 28 }}>
        {discount && <Text style={{
          fontFamily: fonts.semibold, fontSize: 18, color: colors.ink3Text,
          textDecorationLine: 'line-through',
        }}>
          ₱{anchor.toLocaleString()}
        </Text>}
        {discount && (
          <View style={{
            backgroundColor: colors.accentSoft,
            borderRadius: radius.pill,
            paddingHorizontal: 12, paddingVertical: 4,
          }}>
            <Text style={{
              fontFamily: fonts.bold, fontSize: 16, lineHeight: 20,
              color: colors.ink,
            }}>
              {discount.percentOff}% OFF
            </Text>
          </View>
        )}
      </View>

      {/* The slider itself */}
      {!isLocked ? (
        <>
          <View
            testID="price-slider-track"
            accessibilityRole="adjustable"
            accessibilityLabel="Website price"
            accessibilityState={{ disabled }}
            accessibilityValue={{ min: floor, max: ceiling, now: value }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(event) => {
              const action = event.nativeEvent.actionName;
              if (!disabled && (action === 'increment' || action === 'decrement')) {
                changeValue(snapToStep(valueRef.current + (action === 'increment' ? step : -step)));
              }
            }}
            onLayout={onTrackLayout}
            style={{
              height: 48, minWidth: THUMB, justifyContent: 'center',
              marginBottom: 4,
              opacity: disabled ? 0.5 : 1,
            }}
            {...panResponder.current.panHandlers}
          >
            {/* Track */}
            <View style={{
              height: 10, backgroundColor: colors.bg2,
              marginHorizontal: THUMB / 2,
              borderRadius: 5,
            }} />
            {/* Filled portion */}
            <View style={{
              position: 'absolute',
              left: THUMB / 2, top: 19,
              height: 10, width: thumbX,
              backgroundColor: colors.accent,
              borderRadius: 5,
            }} />
            {/* Thumb: accent fill, ink ring */}
            <View testID="price-slider-thumb" pointerEvents="none" style={{
              position: 'absolute',
              left: thumbX,
              top: (48 - THUMB) / 2,
              width: THUMB, height: THUMB, borderRadius: THUMB / 2,
              backgroundColor: colors.accent,
              borderWidth: 3, borderColor: colors.ink,
              ...shadow.soft,
            }} />
          </View>

          {/* Floor / ceiling labels */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: showEarnings ? 16 : 0 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink3Text }}>
              ₱{floor.toLocaleString()}
            </Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink3Text }}>
              ₱{ceiling.toLocaleString()}
            </Text>
          </View>
        </>
      ) : (
        <View style={{
          backgroundColor: colors.bg2,
          borderRadius: radius.field,
          padding: 14,
          marginBottom: 14,
        }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.ink }}>
            Price is set at ₱{floor.toLocaleString()}
          </Text>
        </View>
      )}

      {/* Live "You keep" — the psychological work happens here */}
      {showEarnings ? (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 12,
          backgroundColor: colors.accentSoft,
          borderRadius: radius.field,
          padding: 14,
        }}>
          <View style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: colors.accent,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="cash-outline" size={24} color={colors.onAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: colors.ink }}>
              You keep ₱{earnings.toLocaleString()}
            </Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, color: colors.ink2 }}>
              {Math.round(commissionRate * 100)}% of ₱{value.toLocaleString()} · paid when the business pays
            </Text>
          </View>
        </View>
      ) : null}

      {/* Typed-amount modal — fallback for creators who know the exact number */}
      <Modal visible={showTypedInput} transparent animationType="fade" onRequestClose={() => setShowTypedInput(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.scrim }}
        >
          <View style={{
            width: '88%', maxWidth: 360,
            backgroundColor: colors.card,
            borderRadius: radius.cardLg,
            padding: 24,
          }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, color: colors.ink, marginBottom: 4 }}>
              Type your price
            </Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, color: colors.ink3Text, marginBottom: 16 }}>
              Between ₱{floor.toLocaleString()} and ₱{ceiling.toLocaleString()}
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: colors.bg, borderRadius: radius.field,
              paddingHorizontal: 16, height: 60, marginBottom: 18,
            }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: colors.ink }}>₱</Text>
              <TextInput
                value={typedInputValue}
                onChangeText={setTypedInputValue}
                keyboardType="number-pad"
                autoFocus
                accessibilityLabel="Price in pesos"
                selectionColor={colors.ink}
                style={{ flex: 1, fontFamily: fonts.bold, fontSize: 24, color: colors.ink }}
                onSubmitEditing={commitTypedInput}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setShowTypedInput(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={{
                  flex: 1, minHeight: 56, borderRadius: radius.pill,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: colors.bg2,
                }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.ink }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={commitTypedInput}
                accessibilityRole="button"
                accessibilityLabel="Set price"
                style={{
                  flex: 1, minHeight: 56, borderRadius: radius.pill,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: colors.accent,
                }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.onAccent }}>Set price</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
