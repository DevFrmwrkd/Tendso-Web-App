import { Tabs, useRouter } from 'expo-router';
import { TouchableOpacity, View, Text, StyleSheet, Pressable, AccessibilityInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, fonts, radius } from '../../../theme/tokens';
import { useGuardedPress } from '../../../hooks/useGuardedPress';

type TabItem = {
  routeName: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
};

const LEFT_TABS: TabItem[] = [
  { routeName: 'index',     label: 'Home',    icon: 'home-outline', activeIcon: 'home' },
  { routeName: 'knowledge', label: 'Learn',   icon: 'book-outline', activeIcon: 'book' },
];

const RIGHT_TABS: TabItem[] = [
  { routeName: 'wallet',    label: 'Wallet',  icon: 'wallet-outline', activeIcon: 'wallet' },
  { routeName: 'profile',   label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
];

function SubmitCenter({
  onPress,
  reduceMotion,
}: {
  onPress: () => void;
  reduceMotion: boolean;
}) {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    if (reduceMotion) return;
    scale.value = withSpring(0.94, { damping: 14, stiffness: 220 });
  };
  const handlePressOut = () => {
    if (reduceMotion) return;
    scale.value = withSpring(1.0, { damping: 10, stiffness: 180 });
  };
  const handlePress = () => {
    if (!reduceMotion) {
      scale.value = withTiming(0.96, { duration: 80, easing: Easing.out(Easing.cubic) }, () => {
        scale.value = withSpring(1.0, { damping: 10, stiffness: 180 });
      });
      setTimeout(onPress, 90);
    } else {
      onPress();
    }
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.centerSlot}>
      <Animated.View style={[styles.centerDoor, animStyle]}>
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.centerPressable}
          accessibilityLabel="Submit new business"
          accessibilityRole="button"
        >
          <Ionicons name="add" size={26} color={colors.paper3} />
          <Text style={styles.centerLabel}>SUBMIT</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function CustomTabBar({ state, navigation }: any) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  // Only the SUBMIT push needs a spam guard (it stacks a new screen). Tab
  // switching is idempotent — navigate() to the active tab is a no-op and the
  // isFocused check below already blocks re-nav — so guarding it would only
  // throttle legitimate quick tab-to-tab taps.
  const goSubmit = useGuardedPress(() => router.push('/(app)/submit/info' as any));

  const routeIndexMap: Record<string, number> = {};
  state.routes.forEach((r: any, i: number) => { routeIndexMap[r.name] = i; });

  const handleTabPress = (routeName: string) => {
    const routeIdx = routeIndexMap[routeName];
    if (routeIdx === undefined) return;
    const isFocused = state.index === routeIdx;
    if (!isFocused) navigation.navigate(routeName);
  };

  const renderTab = (item: TabItem) => {
    const routeIdx = routeIndexMap[item.routeName] ?? -1;
    const isFocused = state.index === routeIdx;
    return (
      <TouchableOpacity
        key={item.routeName}
        style={styles.tab}
        onPress={() => handleTabPress(item.routeName)}
        activeOpacity={0.7}
        accessibilityLabel={`${item.label} tab`}
        accessibilityRole="button"
      >
        <Ionicons
          name={isFocused ? item.activeIcon : item.icon}
          size={22}
          color={isFocused ? colors.ink : colors.ink3}
        />
        <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
          {item.label.toUpperCase()}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.tabRow}>
        {LEFT_TABS.map(renderTab)}
        <SubmitCenter
          reduceMotion={reduceMotion}
          onPress={goSubmit}
        />
        {RIGHT_TABS.map(renderTab)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.paper3,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 8,
  },
  tabRow: {
    flexDirection: 'row',
    height: 84,
    alignItems: 'stretch',
    paddingTop: 6,
    paddingHorizontal: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 4,
  },
  tabLabel: {
    fontFamily: fonts.monoMed,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.ink3,
    marginTop: 1,
  },
  tabLabelActive: {
    color: colors.ink,
  },
  centerSlot: {
    flex: 1,
    paddingHorizontal: 6,
    paddingBottom: 4,
    paddingTop: 0,
  },
  centerDoor: {
    flex: 1,
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  centerPressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  centerLabel: {
    fontFamily: fonts.monoMed,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.paper3,
  },
});

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="knowledge" />
      <Tabs.Screen name="wallet" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
