import type { ReactNode } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { useMobileAccount } from '../hooks/useMobileAccount';
import { colors, fonts, radius } from '../theme/tokens';

function Preview({ title, children }: { title: string; children: ReactNode }) {
  return <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={{ padding: 24, gap: 20 }}>
    <Text style={{ fontFamily: fonts.serif, fontSize: 36, color: colors.ink }}>{title}</Text>
    <Text style={{ fontFamily: fonts.sans, color: colors.ink2 }}>Sample account · read-only preview</Text>
    {children}
  </ScrollView>;
}
function Tile({ label, value }: { label: string; value: string }) {
  return <View style={{ padding: 20, gap: 8, backgroundColor: colors.paper3, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.rule }}>
    <Text style={{ fontFamily: fonts.sans, color: colors.ink2 }}>{label}</Text>
    <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: colors.ink }}>{value}</Text>
  </View>;
}
export function PreviewWallet() {
  return <Preview title="Wallet"><Tile label="Available balance" value="₱0.00" /><Tile label="Total earned" value="₱0.00" />
    <Text style={{ fontFamily: fonts.sans, color: colors.ink2 }}>Earnings, Wise payout setup and withdrawal history appear here. Withdrawing is disabled in preview.</Text>
  </Preview>;
}
export function PreviewProfile() {
  const { view } = useMobileAccount();
  return <Preview title="Profile"><Tile label="Account type" value={view === 'affiliate' ? 'Affiliate' : 'Creator'} /><Tile label="Name" value="Sample account" />
    <Text style={{ fontFamily: fonts.sans, color: colors.ink2 }}>Personal details and account settings appear here. Use Admin view to manage real accounts.</Text>
  </Preview>;
}
export function CreatorDashboardPreview() {
  return <Preview title="Creator dashboard"><Tile label="Submissions" value="0" /><Tile label="Available balance" value="₱0.00" />
    <Text style={{ fontFamily: fonts.sans, color: colors.ink2 }}>Creators complete training, visit businesses, take photos and record interviews. Their submissions and leads appear here.</Text>
  </Preview>;
}
