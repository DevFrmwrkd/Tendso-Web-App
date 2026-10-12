import React, { useState } from 'react';
import { Text } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { api, type Doc } from '@tendso/convex-client';
import { useMobileAccount } from '../../../hooks/useMobileAccount';
import { canUseAdminTools } from '../../../components/admin/access';
import { ActionFeedback, AdminButton, AdminCard, AdminField, AdminLoading, AdminScreen, AdminTabs, AdminText, fullName, useAdminAction, WebAdminLink } from '../../../components/admin/AdminUI';
import { colors, fonts, radius } from '../../../theme/tokens';

export default function NativeAdminAccounts() {
  const session = useMobileAccount();
  const allowed = canUseAdminTools(session);
  const [tab, setTab] = useState<'creator' | 'affiliate'>('creator');
  const [search, setSearch] = useState('');
  const creators = useQuery(api.creators.getAll, allowed && tab === 'creator' ? {} : 'skip');
  const affiliates = useQuery(api.affiliates.list, allowed && tab === 'affiliate' ? {} : 'skip');
  if (!allowed) return <AdminLoading />;
  const source = tab === 'creator' ? creators : affiliates;
  const q = search.trim().toLowerCase();
  const rows = source?.filter(person => !person.isDeleted && person.status !== 'deleted' && (tab === 'affiliate' ? person.role === 'affiliate' : !person.role || person.role === 'creator') &&
    `${fullName(person)} ${person.email} ${person.phone ?? ''} ${person.affiliateHandle ?? ''}`.toLowerCase().includes(q))
    .sort((a, b) => tab === 'affiliate' ? Number(b.status === 'pending') - Number(a.status === 'pending') : 0);
  return <AdminScreen title="Accounts"><AdminTabs<'creator' | 'affiliate'> items={[{ value: 'creator', label: 'Creators' }, { value: 'affiliate', label: 'Affiliates' }]} value={tab} onChange={setTab} />
    <AdminField label="Search name, email, mobile or handle" value={search} onChangeText={setSearch} maxLength={150} />
    {rows === undefined ? <AdminLoading /> : !rows.length ? <AdminText>No matching accounts.</AdminText> : rows.map(person =>
      <AccountCard key={person._id} person={person} allowed={allowed} actor={session.account?.clerkId} />)}
    <WebAdminLink path={tab === 'affiliate' ? '/affiliates' : '/creators'} label="More account tools in web admin" />
  </AdminScreen>;
}

function AccountCard({ person, allowed, actor }: { person: Doc<'creators'>; allowed: boolean; actor?: string }) {
  const updateStatus = useMutation(api.creators.updateStatus);
  // Changing the target status or signed-in admin invalidates an open confirmation.
  const action = useAdminAction(allowed, `${actor}:${person._id}:${person.status}`);
  const affiliate = person.role === 'affiliate';
  const pending = affiliate && person.status === 'pending';
  const suspended = person.status === 'suspended';
  const canChangeStatus = !affiliate || pending || suspended || person.status === 'active';
  const verb = pending ? 'Approve' : suspended ? 'Reactivate' : 'Suspend';
  return <AdminCard title={fullName(person)}>
    <AdminText>{affiliate ? 'Affiliate' : 'Creator'} · {person.status || 'Status not set'}</AdminText>
    {pending ? <Text style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: radius.pill, backgroundColor: colors.accentBg, color: colors.accentInk,
      fontFamily: fonts.sansMed, fontSize: 13 }}>Awaiting approval</Text> : null}
    <AdminText>{person.email}</AdminText><AdminText>{person.phone || 'No mobile number'}</AdminText>
    {person.affiliateHandle && <AdminText>Page: /a/{person.affiliateHandle}</AdminText>}
    {!affiliate && <AdminText>{person.certifiedAt ? 'Certified creator' : 'Not yet certified'}</AdminText>}
    <ActionFeedback {...action} />
    {canChangeStatus ? <AdminButton label={`${verb} ${fullName(person)}`} danger={!pending && !suspended} disabled={action.busy}
      onPress={() => action.confirm(pending ? 'Approve affiliate?' : `${verb} account?`,
        pending ? `${fullName(person)} will be able to share their affiliate page and earn commissions.`
          : suspended ? 'Restore this account’s access. Certification requirements still apply to creators.'
          : 'Stop this account’s activity. Nothing is deleted; existing records remain.', verb,
        () => updateStatus({ id: person._id, status: pending || suspended ? 'active' : 'suspended' }),
        pending ? 'Affiliate approved.' : suspended ? 'Account reactivated.' : 'Account suspended.', !pending && !suspended)} /> : null}
  </AdminCard>;
}
