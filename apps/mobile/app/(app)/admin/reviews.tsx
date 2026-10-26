import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '@tendso/convex-client';
import { useMobileAccount } from '../../../hooks/useMobileAccount';
import { canUseAdminTools } from '../../../components/admin/access';
import { ActionFeedback, AdminButton, AdminCard, AdminEmptyState, AdminField, AdminLink, AdminLoading, AdminNotice, AdminScreen, AdminTabs, AdminText, date, fullName, useAdminAction, WebAdminLink } from '../../../components/admin/AdminUI';
import { Avatar } from '../../../components/v2/Avatar';
import { Chip } from '../../../components/v2/Chip';
import { Text } from '../../../components/v2/Text';
import { colors } from '../../../theme/v2';

export default function NativeAdminReviews() {
  const session = useMobileAccount();
  const allowed = canUseAdminTools(session);
  const [tab, setTab] = useState<'submissions' | 'creators'>('submissions');
  const submitted = useQuery(api.submissions.getByStatus, allowed && tab === 'submissions' ? { status: 'submitted' } : 'skip');
  const reviewing = useQuery(api.submissions.getByStatus, allowed && tab === 'submissions' ? { status: 'in_review' } : 'skip');
  const creators = useQuery(api.creators.listPendingApproval, allowed && tab === 'creators' ? {} : 'skip');
  if (!allowed) return <AdminLoading />;
  const rows = submitted && reviewing ? [...submitted, ...reviewing].sort((a, b) => a._creationTime - b._creationTime) : undefined;
  const count = tab === 'submissions' ? rows?.length : creators?.length;
  return <AdminScreen title="Reviews" subtitle="A clear next step for every business and field agent." section="reviews">
    <AdminTabs<'submissions' | 'creators'> items={[{ value: 'submissions', label: 'Submissions' }, { value: 'creators', label: 'Field agents' }]} value={tab} onChange={setTab} />
    <View style={styles.queueHeading}>
      <View style={styles.queueCopy}>
        <Text variant="heading">{tab === 'submissions' ? 'Business submissions' : 'Field agent verification'}</Text>
        <Text variant="label" tone="muted">Oldest waiting first</Text>
      </View>
      {count !== undefined && <Chip label={`${count} waiting`} tone={count ? 'warn' : 'ok'} />}
    </View>
    {tab === 'submissions' ? <>
      <AdminNotice>Check business details, photos and interview before approving. Publishing and Give free remain in web admin.</AdminNotice>
      {rows === undefined ? <AdminLoading inline /> : !rows.length ? <AdminEmptyState icon="checkmark-done-outline" title="You’re all caught up" body="New business submissions will appear here when they are ready for review." /> : rows.map(row => <AdminCard key={row._id} title={row.businessName} subtitle={[row.businessType, row.city].filter(Boolean).join(' · ')}>
        <View style={styles.statusRow}>
          <Chip label={row.status === 'in_review' ? 'In review' : 'Submitted'} tone={row.status === 'in_review' ? 'info' : 'warn'} />
          {row.giveawayApplication && <Chip label="OTR giveaway" tone="muted" />}
        </View>
        <ReviewDetail icon="person-outline">{row.ownerName || 'Owner name not provided'}</ReviewDetail>
        <ReviewDetail icon="time-outline">Submitted {date(row._creationTime)}</ReviewDetail>
        {row.giveawayApplication && <AdminText muted>Check the Off the Record poster and shop location.</AdminText>}
        <AdminLink label={`Review ${row.businessName}`} subtitle="Details, photos and interview" icon="arrow-forward-outline" href={{ pathname: '/(app)/admin/submissions/[id]', params: { id: row._id } }} />
      </AdminCard>)}
    </> : <>
      {creators === undefined ? <AdminLoading inline /> : !creators.length ? <AdminEmptyState icon="people-outline" title="No profiles waiting" body="Field agents appear here after passing their quiz and submitting their profile for review." /> : creators.map(person => <CreatorReview key={person._id} person={person} allowed={allowed} actor={session.account?.clerkId} />)}
      <WebAdminLink path="/creators" label="More creator details in web admin" />
    </>}
  </AdminScreen>;
}

function ReviewDetail({ icon, children }: { icon: React.ComponentProps<typeof Ionicons>['name']; children: React.ReactNode }) {
  return <View style={styles.detailRow}>
    <Ionicons name={icon} size={20} color={colors.ink3Text} accessibilityElementsHidden importantForAccessibility="no" />
    <View style={styles.detailCopy}><AdminText muted>{children}</AdminText></View>
  </View>;
}

function CreatorReview({ person, allowed, actor }: { person: FunctionReturnType<typeof api.creators.listPendingApproval>[number]; allowed: boolean; actor?: string }) {
  const [reason, setReason] = useState('');
  const approve = useMutation(api.creators.approveCreator);
  const reject = useMutation(api.creators.rejectCreator);
  const action = useAdminAction(allowed, actor);
  const name = fullName(person);
  return <AdminCard>
    <View style={styles.personHeader}>
      <Avatar uri={person.profileImage} name={name} size={56} />
      <View style={styles.personCopy}>
        <Text variant="heading">{name}</Text>
        <Text variant="label" tone="muted">Field agent</Text>
      </View>
    </View>
    <Chip label="Waiting for approval" tone="warn" />
    <ReviewDetail icon="mail-outline">{person.email}</ReviewDetail>
    <ReviewDetail icon="call-outline">{person.phone || 'No mobile number'}</ReviewDetail>
    <ReviewDetail icon="school-outline">Quiz passed {date(person.quizPassedAt)}</ReviewDetail>
    {person.referredByName && <ReviewDetail icon="people-outline">Referred by {person.referredByName}</ReviewDetail>}
    <ActionFeedback {...action} />
    <AdminButton label={`Approve ${name}`} icon="checkmark-outline" disabled={action.busy} onPress={() => action.confirm('Approve field agent?', `${name} will be certified and able to submit businesses.`, 'Approve', () => approve({ id: person._id }), 'Field agent approved.')} />
    <View style={styles.rejection}>
      <Text variant="label">Need a correction?</Text>
      <AdminText muted>Tell them what to fix. Their passed quiz stays saved.</AdminText>
      <AdminField label={`Rejection reason for ${name} (optional)`} value={reason} onChangeText={setReason} maxLength={500} multiline />
      <AdminButton label={`Reject ${name}`} variant="secondary" icon="close-outline" danger disabled={action.busy} onPress={() => action.confirm('Reject field agent?', 'They will be notified and can correct their profile and resubmit. Their passed quiz stays saved.', 'Reject', () => reject({ id: person._id, ...(reason.trim() ? { reason: reason.trim() } : {}) }), 'Field agent rejected.', true)} />
    </View>
  </AdminCard>;
}

const styles = StyleSheet.create({
  queueHeading: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  queueCopy: { flexGrow: 1, flexShrink: 1, gap: 4 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  detailCopy: { flex: 1 },
  personHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  personCopy: { flex: 1, gap: 4 },
  rejection: { borderTopWidth: 1, borderTopColor: colors.rule, marginTop: 4, paddingTop: 16, gap: 12 },
});
