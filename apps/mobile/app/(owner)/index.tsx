/** Where an owner lands: resume the flow, or their home once they have a site. */
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useOwnerSubmission } from '../../lib/v2/ownerData';
import { resumeStep, STEP_ROUTE } from '../../lib/v2/ownerFlow';
import { useOwnerSite } from '../../lib/v2/useOwnerSite';
import { colors } from '../../theme/v2';

export default function OwnerIndex() {
  const { me, site } = useOwnerSite();
  const draft = useOwnerSubmission(site?.phase === 'draft' ? site.submissionId : null);

  if (me === undefined || (site?.phase === 'draft' && draft === undefined)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  const step = resumeStep(site?.phase ?? null, draft ? {
    businessName: draft.businessName,
    businessType: draft.businessType,
    answered: draft.interview.filter((a) => a.mediaUrl || a.answerText).length,
    photos: draft.shots.length,
    templateId: draft.templateId,
  } : null);
  return <Redirect href={STEP_ROUTE[step] as never} />;
}
