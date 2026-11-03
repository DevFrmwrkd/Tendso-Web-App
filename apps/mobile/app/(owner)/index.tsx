/** Where an owner lands: resume the flow, or their home once they have a site. */
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useOwnerSubmission } from '../../lib/v2/ownerData';
import { ownerDraftSnapshot, resumeStep, STEP_ROUTE } from '../../lib/v2/ownerFlow';
import { useOwnerIntake } from '../../lib/v2/ownerIntake';
import { useOwnerSite } from '../../lib/v2/useOwnerSite';
import { colors } from '../../theme/v2';
import { sellKind } from '../../lib/v2/ownerContent';

export default function OwnerIndex() {
  const { me, site, isNewBusiness } = useOwnerSite();
  const intake = useOwnerIntake();
  const draft = useOwnerSubmission(!isNewBusiness && site?.phase === 'draft' ? site.submissionId : null);

  if (me === undefined || (!isNewBusiness && site?.phase === 'draft' && draft === undefined)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  if (isNewBusiness) return <Redirect href={(sellKind(intake.kind) ? STEP_ROUTE.place : STEP_ROUTE.sell) as never} />;

  const step = resumeStep(site?.phase ?? null, ownerDraftSnapshot(site?.submissionId ?? null, draft, intake));
  return <Redirect href={STEP_ROUTE[step] as never} />;
}
