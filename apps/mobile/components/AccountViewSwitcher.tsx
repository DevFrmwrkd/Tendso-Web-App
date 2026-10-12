import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMobileAccount } from '../hooks/useMobileAccount';
import { mobileHome, type MobileView } from '../services/accountAccess';
import { colors, fonts, radius } from '../theme/tokens';

export function AccountViewSwitcher() {
  const { isAdmin, isPreview, view, setView } = useMobileAccount();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  if (!isAdmin) return null;
  return (
    <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: colors.paper3, borderBottomWidth: 1, borderBottomColor: colors.rule }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 6 }}>
        {(['admin', 'affiliate', 'creator'] as MobileView[]).map((item) => (
          <TouchableOpacity key={item} accessibilityRole="button" accessibilityLabel={`${item} view`}
            accessibilityState={{ selected: view === item }} onPress={() => { setView(item); router.replace(mobileHome(item) as never); }}
            style={{ borderRadius: radius.pill, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: view === item ? colors.ink : colors.paper2 }}>
            <Text style={{ fontFamily: fonts.sansBold, color: view === item ? colors.paper : colors.ink, textTransform: 'capitalize' }}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {isPreview && <Text accessibilityRole="text" style={{ fontFamily: fonts.sans, color: colors.ink2, marginTop: 8 }}>Preview only · sample data. Your admin account stays unchanged.</Text>}
    </View>
  );
}
