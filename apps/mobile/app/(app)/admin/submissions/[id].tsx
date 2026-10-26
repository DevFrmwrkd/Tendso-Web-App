import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api, type Id } from '@tendso/convex-client';
import { useMobileAccount } from '../../../../hooks/useMobileAccount';
import { canUseAdminTools } from '../../../../components/admin/access';
import { ActionFeedback, AdminButton, AdminCard, AdminEmptyState, AdminField, AdminLoading, AdminNotice, AdminScreen, AdminText, date, fullName, useAdminAction, WebAdminLink } from '../../../../components/admin/AdminUI';
import { Avatar } from '../../../../components/v2/Avatar';
import { Chip } from '../../../../components/v2/Chip';
import { Text } from '../../../../components/v2/Text';
import { submissionStatus } from '../../../../components/v2/status';
import { colors } from '../../../../theme/v2';

function EvidencePhoto({ url, label }: { url: string; label: string }) {
  const [failed, setFailed] = useState(false);
  // Media is displayed as an image, never opened as an arbitrary deep link.
  return <View style={styles.evidence}>
    <Text variant="label" tone="muted">{label}</Text>
    {/^https:\/\//i.test(url) && !failed ? <Image source={{ uri: url }} accessibilityLabel={label} onError={() => setFailed(true)} resizeMode="contain" style={styles.photo} /> : <AdminNotice>This image needs full web review.</AdminNotice>}
  </View>;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={styles.detail}>
    <Text variant="label" tone="muted">{label}</Text>
    <AdminText>{children}</AdminText>
  </View>;
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
  if (!submission) return <AdminScreen title="Submission unavailable" section="reviews" backHref="/(app)/admin/reviews" backLabel="Back to reviews"><AdminEmptyState icon="document-outline" title="This submission could not be found" body="Return to Reviews to check the current queue." /></AdminScreen>;
  const status = submissionStatus(submission.status);
  const creatorName = submission.creator ? fullName(submission.creator) : undefined;
  const creatorType = submission.creator?.role === 'affiliate' ? 'Affiliate' : submission.contentSource === 'owner_intake' ? 'Owner submitted' : 'Field agent';
  return <AdminScreen title={submission.businessName} subtitle="Submission review" section="reviews" backHref="/(app)/admin/reviews" backLabel="Back to reviews">
    <View style={styles.statusRow}>
      <Chip label={submission.status === 'submitted' ? 'Submitted' : status.label} tone={status.tone} />
      {submission.giveawayApplication && <Chip label="OTR giveaway" tone="muted" />}
    </View>
    <Text variant="label" tone="muted">Submitted {date(submission._creationTime)}</Text>
    <ActionFeedback {...action} />

    <AdminCard title="Business details" subtitle={submission.businessType}>
      <Detail label="Shop location">{[submission.address, submission.city].filter(Boolean).join(', ') || 'No location provided'}</Detail>
      <View style={styles.divider} />
      <Detail label="Business owner">{submission.ownerName || 'No owner name provided'}</Detail>
      <Detail label="Mobile">{submission.ownerPhone || 'No mobile number'}</Detail>
      {submission.ownerEmail && <Detail label="Email">{submission.ownerEmail}</Detail>}
    </AdminCard>

    {submission.creator && <AdminCard title="Submitted through">
      <View style={styles.accountRow}>
        <Avatar name={creatorName} size={48} />
        <View style={styles.accountCopy}>
          <Text variant="bodyLg" weight="bold">{creatorName}</Text>
          <Text variant="label" tone="muted">{creatorType}</Text>
        </View>
      </View>
      {submission.creator.email && <AdminText muted>{submission.creator.email}</AdminText>}
      {submission.creator.role === 'affiliate' && submission.creator.affiliateHandle && <AdminText muted>tendso.com/a/{submission.creator.affiliateHandle}</AdminText>}
    </AdminCard>}

    {submission.giveawayApplication && <AdminCard title="Giveaway evidence" subtitle="Off the Record community giveaway">
      <AdminNotice>Check the Off the Record poster and shop location. Approval accepts the review; publish and Give free from web admin.</AdminNotice>
      {submission.giveawayPosterPhoto ? <EvidencePhoto url={submission.giveawayPosterPhoto} label="Giveaway poster evidence" /> : <AdminText muted>No poster evidence. Check the full review before deciding.</AdminText>}
    </AdminCard>}

    <AdminCard title="Business photos" right={<Chip label={`${submission.photos?.length ?? 0} photos`} tone="muted" />}>
      {submission.photos?.length ? submission.photos.map((url, index) => <EvidencePhoto key={`${index}-${url}`} url={url} label={`Business photo ${index + 1}`} />) : <View style={styles.missing}>
        <Ionicons name="images-outline" size={28} color={colors.ink3Text} accessibilityElementsHidden importantForAccessibility="no" />
        <AdminText muted>No photos provided. Check the full review before deciding.</AdminText>
      </View>}
    </AdminCard>

    <AdminCard title="Interview" subtitle="Read the owner’s story before deciding.">
      <AdminText>{submission.transcript || 'No transcript available. Review recordings in web admin before deciding.'}</AdminText>
      {submission.interviewQa?.map((qa, index) => <View key={index} style={styles.question}>
        <Text variant="body" weight="bold">{qa.q}</Text>
        <AdminText>{qa.a}</AdminText>
      </View>)}
    </AdminCard>

    {canReview ? <AdminCard title="Your decision" subtitle="Check the details, photos and interview above.">
      <AdminButton label="Approve submission" icon="checkmark-outline" disabled={action.busy} onPress={() => action.confirm('Approve submission?', 'Confirm that you reviewed the photos, business details and interview. Approval notifies the account and starts its Drive sync; it does not publish a website.', 'Approve', () => approve({ submissionId: submission._id, adminId: session.account!.clerkId }), 'Submission approved.')} />
      <View style={styles.rejection}>
        <Text variant="label">Needs changes?</Text>
        <AdminText muted>Explain the problem so they know what to correct.</AdminText>
        <AdminField label="Rejection reason" value={reason} onChangeText={setReason} maxLength={2000} multiline />
        <AdminButton label="Reject submission" variant="secondary" icon="close-outline" danger disabled={action.busy || !reason.trim()} onPress={() => action.confirm('Reject submission?', submission.giveawayApplication ? 'The owner receives this reason and their held giveaway slot is released.' : 'The account will be notified with this reason.', 'Reject', () => reject({ submissionId: submission._id, adminId: session.account!.clerkId, reason: reason.trim() }), 'Submission rejected.', true)} />
      </View>
    </AdminCard> : <AdminCard title="Review recorded">
      {submission.reviewedByName && <Detail label="Reviewed by">{submission.reviewedByName}{submission.giveawayReviewSource === 'otr' ? ' · Off the Record' : ''}</Detail>}
      {!!submission.reviewedAt && <Detail label="Reviewed on">{date(submission.reviewedAt)}</Detail>}
      {submission.rejectionReason && <Detail label="Rejection reason">{submission.rejectionReason}</Detail>}
      <AdminNotice>This submission has already left the review queue. Use web admin for later steps.</AdminNotice>
    </AdminCard>}
    <WebAdminLink path={`/submissions/${encodeURIComponent(submission._id)}`} label="Open full review in web admin" />
  </AdminScreen>;
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detail: { gap: 4 },
  divider: { height: 1, backgroundColor: colors.rule, marginVertical: 2 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountCopy: { flex: 1, gap: 4 },
  evidence: { gap: 8 },
  photo: { width: '100%', height: 230, borderRadius: 16, backgroundColor: colors.bg2 },
  missing: { alignItems: 'center', gap: 12, paddingVertical: 16 },
  question: { borderTopWidth: 1, borderTopColor: colors.rule, paddingTop: 16, gap: 8 },
  rejection: { borderTopWidth: 1, borderTopColor: colors.rule, marginTop: 4, paddingTop: 16, gap: 12 },
});
