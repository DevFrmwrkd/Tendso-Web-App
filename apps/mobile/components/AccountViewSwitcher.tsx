import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMobileAccount } from '../hooks/useMobileAccount';
import { mobileHome, type MobileView } from '../services/accountAccess';
import { Text } from './v2';
import { colors, hit, radius, space } from '../theme/v2';

/** Words the admin sees. The code roles stay `affiliate` / `creator`; only the labels changed. */
const VIEWS: { view: MobileView; label: string }[] = [
  { view: 'admin', label: 'Admin' },
  { view: 'affiliate', label: 'Creator' },
  { view: 'creator', label: 'Field agent' },
];

/** Admin-only pills on top of the app: Admin / Creator / Field agent. Selected = ink fill. */
export function AccountViewSwitcher() {
  const { isAdmin, isPreview, view, setView } = useMobileAccount();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  if (!isAdmin) return null;
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.row}>
        {VIEWS.map((item) => {
          const active = view === item.view;
          return (
            <Pressable
              key={item.view}
              accessibilityRole="button"
              accessibilityLabel={`${item.label} view`}
              accessibilityState={{ selected: active }}
              hitSlop={4}
              onPress={() => {
                setView(item.view);
                router.replace(mobileHome(item.view) as never);
              }}
              style={[styles.pill, active ? styles.pillOn : styles.pillOff]}
            >
              <Text variant="chip" tone={active ? 'onDark' : 'ink'} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {isPreview ? (
        <Text variant="label" tone="muted" accessibilityRole="text" style={styles.note}>
          Preview only. Sample data. Your admin account stays unchanged.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.gutter, paddingBottom: space.md, backgroundColor: colors.bg },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: {
    minHeight: hit.min,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillOn: { backgroundColor: colors.ink },
  pillOff: { backgroundColor: colors.card },
  note: { marginTop: space.sm },
});
