import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMobileAccount } from '../../../hooks/useMobileAccount';
import { mobileHome } from '../../../services/accountAccess';
import { colors } from '../../../theme/tokens';

export default function AffiliateTabsLayout() {
  const { view, isLoading } = useMobileAccount();
  if (isLoading) return null;
  if (view !== 'affiliate') return <Redirect href={mobileHome(view) as never} />;
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.ink, tabBarInactiveTintColor: colors.ink3,
      tabBarStyle: { backgroundColor: colors.paper3, borderTopColor: colors.rule },
      tabBarIcon: ({ focused, color, size }) => <Ionicons name={focused ? 'ellipse' : 'ellipse-outline'} color={color} size={size} /> }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({color,size}) => <Ionicons name="home-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="page" options={{ title: 'My page', tabBarIcon: ({color,size}) => <Ionicons name="globe-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="sales" options={{ title: 'Sales', tabBarIcon: ({color,size}) => <Ionicons name="receipt-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="wallet" options={{ title: 'Wallet', tabBarIcon: ({color,size}) => <Ionicons name="wallet-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({color,size}) => <Ionicons name="person-outline" color={color} size={size} /> }} />
    </Tabs>
  );
}
