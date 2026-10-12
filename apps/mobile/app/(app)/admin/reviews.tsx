import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '@tendso/convex-client';
import { useMobileAccount } from '../../../hooks/useMobileAccount';
import { canUseAdminTools } from '../../../components/admin/access';
import { ActionFeedback, AdminButton, AdminCard, AdminField, AdminLink, AdminLoading, AdminNotice, AdminScreen, AdminTabs, AdminText, date, fullName, useAdminAction, WebAdminLink } from '../../../components/admin/AdminUI';

export default function NativeAdminReviews() {
  const session = useMobileAccount();
  const allowed = canUseAdminTools(session);
  const [tab, setTab] = useState<'submissions' | 'creators'>('submissions');
  const submitted = useQuery(api.submissions.getByStatus, allowed && tab === 'submissions' ? { status: 'submitted' } : 'skip');
  const reviewing = useQuery(api.submissions.getByStatus, allowed && tab === 'submissions' ? { status: 'in_review' } : 'skip');
  const creators = useQuery(api.creators.listPendingApproval, allowed && tab === 'creators' ? {} : 'skip');
  if (!allowed) return <AdminLoading />;
  const rows = submitted && reviewing ? [...submitted, ...reviewing].sort((a, b) => a._creationTime - b._creationTime) : undefined;
  return <AdminScreen title="Reviews">
    <AdminTabs<'submissions' | 'creators'> items={[{ value: 'submissions', label: 'Submissions' }, { value: 'creators', label: 'Creator verification' }]} value={tab} onChange={setTab} />
    {tab === 'submissions' ? <>
      <AdminNotice>Check business details, photos and interview before approving. Publishing and Give free remain in web admin.</AdminNotice>
      {rows === undefined ? <AdminLoading /> : !rows.length ? <AdminText>No submissions waiting for review.</AdminText> : rows.map(row => <AdminCard key={row._id} title={row.businessName}>
        <AdminText>{row.status === 'in_review' ? 'In review' : 'Submitted'} · {date(row._creationTime)}</AdminText>
        {row.giveawayApplication && <AdminText>Giveaway application · check poster and location</AdminText>}
        <AdminLink label={`Review ${row.businessName}`} href={{ pathname: '/(app)/admin/submissions/[id]', params: { id: row._id } }} />
      </AdminCard>)}
    </> : <>
      {creators === undefined ? <AdminLoading /> : !creators.length ? <AdminText>No creators waiting for verification.</AdminText> : creators.map(person => <CreatorReview key={person._id} person={person} allowed={allowed} actor={session.account?.clerkId} />)}
      <WebAdminLink path="/creators" label="More creator details in web admin" />
    </>}
  </AdminScreen>;
}

function CreatorReview({ person, allowed, actor }: { person: FunctionReturnType<typeof api.creators.listPendingApproval>[number]; allowed: boolean; actor?: string }) {
  const [reason, setReason] = useState('');
  const approve = useMutation(api.creators.approveCreator);
  const reject = useMutation(api.creators.rejectCreator);
  const action = useAdminAction(allowed, actor);
  return <AdminCard title={fullName(person)}>
    <AdminText>{person.email}</AdminText><AdminText>{person.phone || 'No mobile number'}</AdminText><AdminText>Quiz passed {date(person.quizPassedAt)}</AdminText>
    {person.referredByName && <AdminText>Referred by {person.referredByName}</AdminText>}
    <ActionFeedback {...action} />
    <AdminButton label={`Approve ${fullName(person)}`} disabled={action.busy} onPress={() => action.confirm('Approve creator?', `${fullName(person)} will be certified and able to submit businesses.`, 'Approve', () => approve({ id: person._id }), 'Creator approved.')} />
    <AdminField label={`Rejection reason for ${fullName(person)} (optional)`} value={reason} onChangeText={setReason} maxLength={500} multiline />
    <AdminButton label={`Reject ${fullName(person)}`} danger disabled={action.busy} onPress={() => action.confirm('Reject creator?', 'They will be notified and can request another attempt at training.', 'Reject', () => reject({ id: person._id, ...(reason.trim() ? { reason: reason.trim() } : {}) }), 'Creator rejected.', true)} />
  </AdminCard>;
}
