import React from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { Card, ListRow } from '..';
import { isOwnerPaymentSimulatorBuild, useOwnerPaymentSimulation } from '../../../lib/v2/ownerPaymentSimulator';
import type { SubmissionId } from '../../../lib/v2/ownerTypes';

/** The name is just a query hint. Only the server can grant access. */
export function OwnerPaymentSimulatorEntry({ submissionId, businessName, ownerId }: {
  submissionId: SubmissionId | null; businessName: string; ownerId: string | undefined;
}) {
  if (!isOwnerPaymentSimulatorBuild() || !submissionId || !/^\[TEST\]/i.test(businessName.trim())) return null;
  return <EligibleEntry key={`${ownerId ?? ''}:${submissionId}`} submissionId={submissionId} ownerId={ownerId} />;
}

function EligibleEntry({ submissionId, ownerId }: { submissionId: SubmissionId; ownerId: string | undefined }) {
  const router = useRouter();
  const { userId } = useAuth();
  const simulation = useOwnerPaymentSimulation(submissionId);
  if (!simulation?.simulationOnly || simulation.withdrawable !== false || simulation.actorClerkId !== userId
    || simulation.submissionId !== submissionId || simulation.ownerId !== ownerId) return null;
  return <Card style={{ paddingVertical: 4 }}>
    <ListRow title="PHP payment simulator" subtitle="Test panel · No real money" icon="flask-outline"
      onPress={() => router.push('/(owner)/payment-simulator' as never)} />
  </Card>;
}
