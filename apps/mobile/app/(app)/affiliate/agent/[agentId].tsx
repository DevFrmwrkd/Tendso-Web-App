import { useLocalSearchParams } from 'expo-router';
import { AffiliateAgentDetailScreen } from '../../../../components/affiliate/AgentDetail';

export default function AgentDetailRoute() {
  const { agentId, month } = useLocalSearchParams<{ agentId?: string | string[]; month?: string | string[] }>();
  return <AffiliateAgentDetailScreen agentId={typeof agentId === 'string' ? agentId : ''} month={typeof month === 'string' ? month : undefined} />;
}
