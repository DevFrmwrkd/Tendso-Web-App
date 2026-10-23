import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadow, space } from '../../theme/v2';
import { Text } from './Text';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface TabBarItem {
  /** The route name registered in <Tabs>. */
  routeName: string;
  label: string;
  icon: IconName;
  activeIcon: IconName;
}

export interface TabBarCenter {
  label: string;
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export interface V2TabBarProps {
  /** From expo-router's `tabBar` render prop. */
  state: { index: number; routes: { name: string }[] };
  navigation: { navigate: (name: string) => void };
  items: TabBarItem[];
  /** The big accent pill (Submit). Rendered after `items[centerAfter - 1]`. Omit for no centre button. */
  center?: TabBarCenter;
  /** How many `items` sit to the left of the centre button (default 2). */
  centerAfter?: number;
}

/**
 * Tab bar for the field-agent and creator apps (mock `.a-tabbar`): white, hairline on top,
 * 22pt icon + 16pt label. The active tab puts its icon on a small accent pill (a fill; the glyph stays ink).
 * The centre action is a full accent pill with ink text.
 */
export function V2TabBar({ state, navigation, items, center, centerAfter = 2 }: V2TabBarProps) {
  const insets = useSafeAreaInsets();
  const routeIndex: Record<string, number> = {};
  state.routes.forEach((r, i) => {
    routeIndex[r.name] = i;
  });

  const renderItem = (item: TabBarItem) => {
    const focused = state.index === (routeIndex[item.routeName] ?? -1);
    return (
      <Pressable
        key={item.routeName}
        onPress={() => {
          if (!focused && routeIndex[item.routeName] !== undefined) navigation.navigate(item.routeName);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${item.label} tab`}
        accessibilityState={{ selected: focused }}
        style={styles.tab}
      >
        <View style={[styles.iconPill, focused ? styles.iconPillOn : null]}>
          <Ionicons name={focused ? item.activeIcon : item.icon} size={22} color={focused ? colors.onAccent : colors.ink3} />
        </View>
        <Text variant="label" weight={focused ? 'bold' : 'semibold'} tone={focused ? 'ink' : 'muted'} numberOfLines={1}>
          {item.label}
        </Text>
      </Pressable>
    );
  };

  const left = items.slice(0, centerAfter);
  const right = items.slice(centerAfter);

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.row}>
        {left.map(renderItem)}
        {center ? (
          <View style={styles.centerSlot}>
            <Pressable
              onPress={center.onPress}
              disabled={center.disabled}
              accessibilityRole="button"
              accessibilityLabel={center.accessibilityLabel ?? center.label}
              accessibilityState={{ disabled: !!center.disabled }}
              cssInterop={false}
              style={({ pressed }) => [
                styles.centerBtn,
                shadow.press,
                center.disabled ? { opacity: 0.5 } : null,
                pressed ? { transform: [{ scale: 0.96 }] } : null,
              ]}
            >
              <Ionicons name={center.icon} size={24} color={colors.onAccent} />
              <Text variant="label" weight="bold" tone="onAccent" numberOfLines={1}>
                {center.label}
              </Text>
            </Pressable>
          </View>
        ) : null}
        {right.map(renderItem)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.rule,
  },
  row: { flexDirection: 'row', alignItems: 'stretch', minHeight: 84, paddingTop: space.sm - 2, paddingHorizontal: space.xs },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: space.xs },
  iconPill: { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  iconPillOn: { backgroundColor: colors.accent },
  centerSlot: { flex: 1.1, paddingHorizontal: space.xs, paddingVertical: 2 },
  centerBtn: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
});
