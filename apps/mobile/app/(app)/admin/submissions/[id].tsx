import React, { useState } from 'react';
import { Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api, type Id } from '@tendso/convex-client';
import { useMobileAccount } from '../../../../hooks/useMobileAccount';
import { canUseAdminTools } from '../../../../components/admin/access';
import { ActionFeedback, AdminButton, AdminCard, AdminField, AdminLoading, AdminNotice, AdminScreen, AdminText, fullName, useAdminAction, WebAdminLink } from '../../../../components/admin/AdminUI';

function EvidencePhoto({ url, label }: { url: string; label: string }) {
  const [failed, setFailed] = useState(false);
  // Media is displayed as an image, never opened as an arbitrary deep link.
  return /^https:\/\//i.test(url) && !failed ? <Image source={{ uri: url }} accessibilityLabel={label} onError={() => setFailed(true)} resizeMode="contain" style={{ width: '100%', height: 230, borderRadius: 12 }} /> : <AdminNotice>This image needs full web review.</AdminNotice>;
}
export default function NativeSubmissionReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useMobileAccount();
  const allowed = canUseAdminTools(session);
  const submissionId = typeof id === 'string' && id ? id as Id<'submissions'> : undefined;
  const submission = useQuery(api.submissions.getByIdWithCreator, allowed && submissionId ? { id: submissionId } : 'skip');
  const approve = useMutation(api.admin.approveSubmission);
  const reject = useMutation(api.admin.rejectSubmission);
  const [reason, setReason] = useState('');
  const canReview = submission?.status === 'submitted' || submission?.status === 'in_review';
  const action = useAdminAction(allowed && canReview, `${session.account?.clerkId}:${submissionId}`);
  if (!allowed || (submissionId && submission === undefined)) return <AdminLoading />;
  if (!submission) return <AdminScreen title="Submission unavailable"><AdminText>This submission could not be found.</AdminText></AdminScreen>;
  return <AdminScreen title={submission.businessName}>
    <ActionFeedback {...action} />
    <AdminCard title="Business"><AdminText>Status: {submission.status.replace(/_/g, ' ')}</AdminText><AdminText>{submission.address} · {submission.city}</AdminText><AdminText>{submission.ownerName} · {submission.ownerPhone}</AdminText>
      {submission.creator && <AdminText>{submission.creator.role === 'affiliate' ? 'Affiliate' : submission.contentSource === 'owner_intake' ? 'Owner submitted' : 'Creator'}: {fullName(submission.creator)}</AdminText>}
    </AdminCard>
    {submission.giveawayApplication && <AdminCard title="Giveaway evidence"><AdminNotice>Check the Tendso poster and shop location. Approval accepts the review; publish and Give free from web admin.</AdminNotice>{submission.giveawayPosterPhoto ? <EvidencePhoto url={submission.giveawayPosterPhoto} label="Giveaway poster evidence" /> : <AdminText>No poster evidence.</AdminText>}</AdminCard>}
    <AdminCard title="Photos">{submission.photos?.length ? submission.photos.map((url, index) => <EvidencePhoto key={`${index}-${url}`} url={url} label={`Business photo ${index + 1}`} />) : <AdminText>No photos.</AdminText>}</AdminCard>
    <AdminCard title="Interview"><AdminText>{submission.transcript || 'No transcript available. Review recordings in web admin before deciding.'}</AdminText>{submission.interviewQa?.map((qa, index) => <AdminText key={index}>{qa.q}{'\n'}{qa.a}</AdminText>)}</AdminCard>
    {canReview ? <>
      <AdminButton label="Approve submission" disabled={action.busy} onPress={() => action.confirm('Approve submission?', 'Confirm that you reviewed the photos, business details and interview. Approval notifies the account and starts its Drive sync; it does not publish a website.', 'Approve', () => approve({ submissionId: submission._id, adminId: session.account!.clerkId }), 'Submission approved.')} />
      <AdminField label="Rejection reason" value={reason} onChangeText={setReason} maxLength={2000} multiline />
      <AdminButton label="Reject submission" danger disabled={action.busy || !reason.trim()} onPress={() => action.confirm('Reject submission?', submission.giveawayApplication ? 'The owner receives this reason and their held giveaway slot is released.' : 'The account will be notified with this reason.', 'Reject', () => reject({ submissionId: submission._id, adminId: session.account!.clerkId, reason: reason.trim() }), 'Submission rejected.', true)} />
    </> : <AdminNotice>This submission has already left the review queue. Use web admin for later steps.</AdminNotice>}
    <WebAdminLink path={`/submissions/${encodeURIComponent(submission._id)}`} label="Open full review in web admin" />
  </AdminScreen>;
}
