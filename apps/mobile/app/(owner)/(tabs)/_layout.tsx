/** Owner tabs (FEATURES-QUESTIONS Q21): Today · My site · Agents · Me (Help + Inbox inside Me). */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Text } from '../../../components/v2';
import { colors } from '../../../theme/v2';

const TABS: { name: string; label: string; icon: React.ComponentProps<typeof Ionicons>['name']; on: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { name: 'today', label: 'Today', icon: 'home-outline', on: 'home' },
  { name: 'site', label: 'My site', icon: 'phone-portrait-outline', on: 'phone-portrait' },
  { name: 'agents', label: 'Agents', icon: 'people-outline', on: 'people' },
  { name: 'me', label: 'Me', icon: 'person-circle-outline', on: 'person-circle' },
];

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]} accessibilityRole="tablist">
      {TABS.map((t) => {
        const index = state.routes.findIndex((r) => r.name === t.name);
        const focused = state.index === index;
        return (
          <Pressable
            key={t.name}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={t.label}
            onPress={() => {
              const route = state.routes[index];
              if (!route) return;
              const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
            }}
            style={styles.tab}
          >
            <View style={[styles.iconPill, focused && { backgroundColor: colors.accent }]}>
              <Ionicons name={focused ? t.on : t.icon} size={22} color={focused ? colors.onAccent : colors.ink3} />
            </View>
            <Text variant="label" weight={focused ? 'bold' : 'semibold'} tone={focused ? 'ink' : 'muted'} numberOfLines={1}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function OwnerTabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(p) => <TabBar {...p} />}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.rule,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 60 },
  iconPill: { width: 56, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
