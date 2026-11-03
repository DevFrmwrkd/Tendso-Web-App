import React, { useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { Text } from '../Text';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { ownerIntake } from '../../../lib/v2/ownerIntake';
import { STEP_ROUTE } from '../../../lib/v2/ownerFlow';
import { useOwnerScope } from '../../../lib/v2/useOwnerScope';
import { colors, hit, space } from '../../../theme/v2';

type Props = {
  title?: string;
  disabled?: boolean;
  /** Recheck synchronous capture/submit locks before and after saving. */
  canExit?: () => boolean;
  /** Commit a screen's pending choice without advancing or submitting it. */
  beforeSave?: () => void;
};

/** Save the local journal before leaving; uploads never hold navigation open. */
export function OwnerSaveExit(props: Props) {
  const scope = useOwnerScope();
  return <ExitAction key={scope.scopeKey} {...props} scope={scope} />;
}

function ExitAction({ title = 'Save & exit', disabled = false, canExit, beforeSave, scope }: Props & {
  scope: ReturnType<typeof useOwnerScope>;
}) {
  const router = useGuardedRouter();
  const navigation = useContext(NavigationContext);
  const [busy, setBusy] = useState(false);
  const saving = useRef<{ visit: number } | null>(null);
  const focused = useRef(navigation?.isFocused() ?? true);
  const visit = useRef(0);
  const mounted = useRef(true);
  const live = useRef({ disabled, canExit, beforeSave });
  live.current = { disabled, canExit, beforeSave };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const changeFocus = (value: boolean) => {
      focused.current = value;
      visit.current += 1;
      saving.current = null;
      if (mounted.current) setBusy(false);
    };
    changeFocus(navigation?.isFocused() ?? true);
    const onFocus = navigation?.addListener('focus', () => changeFocus(true));
    const onBlur = navigation?.addListener('blur', () => changeFocus(false));
    return () => { onFocus?.(); onBlur?.(); focused.current = false; visit.current += 1; saving.current = null; };
  }, [navigation]);
  const eligible = () => mounted.current && focused.current && scope.isCurrent()
    && !live.current.disabled && (live.current.canExit?.() ?? true);
  const exit = async () => {
    if (saving.current || !eligible()) return;
    const action = { visit: visit.current };
    saving.current = action;
    const current = () => mounted.current && focused.current && scope.isCurrent()
      && visit.current === action.visit && saving.current === action;
    const allowed = () => current() && !live.current.disabled && (live.current.canExit?.() ?? true);
    setBusy(true);
    Keyboard.dismiss();
    try {
      live.current.beforeSave?.();
      if (!allowed()) return;
      // Checkpoint also retries a previously failed disk write, without clearing
      // answers, photos, the upload journal or the new-business workspace.
      ownerIntake.set({});
      await ownerIntake.flush();
      if (allowed()) router.dismissTo(STEP_ROUTE.home);
    } catch {
      if (current()) Alert.alert('Could not save your progress', 'Your progress is still here. Please try again.');
    } finally {
      if (saving.current === action) {
        saving.current = null;
        if (mounted.current) setBusy(false);
      }
    }
  };
  return <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={title}
    accessibilityHint="Keep your progress and return to Today to switch businesses"
    accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy}
    onPress={() => { void exit(); }}
    style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && styles.pressed]}>
    <View style={styles.content}>
      {busy ? <ActivityIndicator size="small" color={colors.ink} /> : null}
      <Text variant="label" weight="bold" numberOfLines={1}>{busy ? 'Saving…' : title}</Text>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { minHeight: hit.icon, paddingHorizontal: space.md, borderRadius: 999, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  content: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.45 },
});
