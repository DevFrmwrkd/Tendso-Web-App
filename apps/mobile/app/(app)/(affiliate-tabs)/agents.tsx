import { useLocalSearchParams } from 'expo-router';
import { AffiliateAgentsScreen } from '../../../components/affiliate/Agents';
export default function AffiliateAgentsRoute() {
  const { month } = useLocalSearchParams<{ month?: string | string[] }>();
  return <AffiliateAgentsScreen month={typeof month === 'string' ? month : undefined} />;
}
