import { Tabs, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import { V2TabBar, type TabBarItem } from '../../../components/v2';
import { useGuardedPress } from '../../../hooks/useGuardedPress';
import { useMobileAccount } from '../../../hooks/useMobileAccount';

/**
 * Field-agent workspace: Map · Finds · [Submit] · Earn · Me.
 * Dashboard and Learn remain reachable from Me and existing deep links.
 */
const ITEMS: TabBarItem[] = [
  { routeName: 'index', label: 'Map', icon: 'map-outline', activeIcon: 'map' },
  { routeName: 'finds', label: 'Finds', icon: 'grid-outline', activeIcon: 'grid' },
  { routeName: 'wallet', label: 'Earn', icon: 'wallet-outline', activeIcon: 'wallet' },
  { routeName: 'profile', label: 'Me', icon: 'person-outline', activeIcon: 'person' },
];

function CustomTabBar({ state, navigation }: any) {
  const { isPreview } = useMobileAccount();
  const router = useRouter();
  // Only the SUBMIT push needs a spam guard (it stacks a new screen). Tab switching is idempotent.
  const goSubmit = useGuardedPress(() => router.push('/(app)/submit/info' as any));
  const [keyboardVisible, setKeyboardVisible] = useState(Keyboard.isVisible());
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { shown.remove(); hidden.remove(); };
  }, []);
  if (keyboardVisible) return null;

  return (
    <V2TabBar
      state={state}
      navigation={navigation}
      items={ITEMS}
      centerAfter={2}
      center={{
        label: 'Submit',
        icon: 'add',
        onPress: goSubmit,
        disabled: isPreview,
        accessibilityLabel: 'Submit new business',
      }}
    />
  );
}

export default function TabsLayout() {
  return (
    <Tabs backBehavior="history" tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="finds" />
      <Tabs.Screen name="wallet" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="knowledge" options={{ href: null }} />
      <Tabs.Screen name="dashboard" options={{ href: null }} />
    </Tabs>
  );
}
