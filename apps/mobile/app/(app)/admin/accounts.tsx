import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useMobileAccount } from '../../../hooks/useMobileAccount';
import { canUseAdminTools } from '../../../components/admin/access';
import { ActionFeedback, AdminButton, AdminCard, AdminField, AdminLoading, AdminScreen, AdminTabs, AdminText, fullName, useAdminAction, WebAdminLink } from '../../../components/admin/AdminUI';

export default function NativeAdminAccounts() {
  const session = useMobileAccount();
  const allowed = canUseAdminTools(session);
  const [tab, setTab] = useState<'creator' | 'affiliate'>('creator');
  const [search, setSearch] = useState('');
  const creators = useQuery(api.creators.getAll, allowed && tab === 'creator' ? {} : 'skip');
  const affiliates = useQuery(api.affiliates.list, allowed && tab === 'affiliate' ? {} : 'skip');
  const updateStatus = useMutation(api.creators.updateStatus);
  const action = useAdminAction(allowed, session.account?.clerkId);
  if (!allowed) return <AdminLoading />;
  const source = tab === 'creator' ? creators : affiliates;
  const q = search.trim().toLowerCase();
  const rows = source?.filter(person => !person.isDeleted && person.status !== 'deleted' && (tab === 'affiliate' ? person.role === 'affiliate' : !person.role || person.role === 'creator') &&
    `${fullName(person)} ${person.email} ${person.phone ?? ''} ${person.affiliateHandle ?? ''}`.toLowerCase().includes(q));
  return <AdminScreen title="Accounts"><AdminTabs<'creator' | 'affiliate'> items={[{ value: 'creator', label: 'Creators' }, { value: 'affiliate', label: 'Affiliates' }]} value={tab} onChange={setTab} />
    <AdminField label="Search name, email, mobile or handle" value={search} onChangeText={setSearch} maxLength={150} />
    <ActionFeedback {...action} />
    {rows === undefined ? <AdminLoading /> : !rows.length ? <AdminText>No matching accounts.</AdminText> : rows.map(person => <AdminCard key={person._id} title={fullName(person)}>
      <AdminText>{tab === 'affiliate' ? 'Affiliate' : 'Creator'} · {person.status || 'Status not set'}</AdminText><AdminText>{person.email}</AdminText><AdminText>{person.phone || 'No mobile number'}</AdminText>
      {person.affiliateHandle && <AdminText>Page: /a/{person.affiliateHandle}</AdminText>}
      {tab === 'creator' && <AdminText>{person.certifiedAt ? 'Certified creator' : 'Not yet certified'}</AdminText>}
      <AdminButton label={`${person.status === 'suspended' ? 'Reactivate' : 'Suspend'} ${fullName(person)}`} danger={person.status !== 'suspended'} disabled={action.busy}
        onPress={() => {
          const suspended = person.status === 'suspended';
          action.confirm(`${suspended ? 'Reactivate' : 'Suspend'} account?`, suspended ? 'Restore this account’s access. Certification requirements still apply to creators.' : 'Stop this account’s activity. Nothing is deleted; existing records remain.', suspended ? 'Reactivate' : 'Suspend',
            () => updateStatus({ id: person._id, status: suspended ? 'active' : 'suspended' }), suspended ? 'Account reactivated.' : 'Account suspended.', !suspended);
        }} />
    </AdminCard>)}
    <WebAdminLink path={tab === 'affiliate' ? '/affiliates' : '/creators'} label="More account tools in web admin" />
  </AdminScreen>;
}
