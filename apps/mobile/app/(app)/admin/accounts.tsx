import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { api, type Doc } from '@tendso/convex-client';
import { useMobileAccount } from '../../../hooks/useMobileAccount';
import { canUseAdminTools } from '../../../components/admin/access';
import { ActionFeedback, AdminButton, AdminCard, AdminEmptyState, AdminField, AdminLoading, AdminScreen, AdminTabs, fullName, useAdminAction, WebAdminLink } from '../../../components/admin/AdminUI';
import { Avatar, Chip, Text } from '../../../components/v2';
import { colors, space } from '../../../theme/v2';

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
  return (
    <AdminScreen title="Accounts" subtitle="Field agents visit shops. Creators share their affiliate links." section="accounts">
      <AdminTabs<'creator' | 'affiliate'>
        items={[{ value: 'creator', label: 'Field agents' }, { value: 'affiliate', label: 'Creators' }]}
        value={tab}
        onChange={setTab}
      />
      <AdminField label="Search name, email, mobile or handle" value={search} onChangeText={setSearch} maxLength={150} />
      {rows === undefined ? <AdminLoading /> : (
        <>
          <View style={styles.listHeader}>
            <Text variant="heading" style={styles.listTitle}>{q ? 'Search results' : tab === 'affiliate' ? 'Creators' : 'Field agents'}</Text>
            <Text variant="label" tone="muted">{rows.length} {rows.length === 1 ? 'account' : 'accounts'}</Text>
          </View>
          {!rows.length ? (
            <AdminEmptyState
              icon="people-outline"
              title={q ? 'No matching accounts' : tab === 'affiliate' ? 'No creators yet' : 'No field agents yet'}
              body={q ? 'Try another name, email, mobile number or page handle.' : 'Accounts will appear here when people sign up.'}
            />
          ) : rows.map(person => (
            <AccountCard key={person._id} person={person} allowed={allowed} actor={session.account?.clerkId} />
          ))}
        </>
      )}
      <WebAdminLink path={tab === 'affiliate' ? '/affiliates' : '/creators'} label="More account tools in web admin" />
    </AdminScreen>
  );
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
  const name = fullName(person);
  const statusLabel = pending ? 'Awaiting approval' : suspended ? 'Suspended' : person.status === 'active' ? 'Active' : person.status || 'Status not set';
  return (
    <AdminCard>
      <View style={styles.identity}>
        <Avatar uri={affiliate ? person.affiliatePhoto || person.profileImage : person.profileImage} name={name} size={52} />
        <View style={styles.identityText}>
          <Text variant="heading" selectable>{name}</Text>
          <Text variant="label" tone="muted">{affiliate ? 'Creator · Affiliate' : 'Field agent'}</Text>
        </View>
      </View>
      <View style={styles.statusRow}>
        <Chip label={statusLabel} tone={pending ? 'warn' : suspended ? 'danger' : person.status === 'active' ? 'ok' : 'muted'} />
      </View>
      <View style={styles.details}>
        <AccountDetail icon="mail-outline" value={person.email} />
        <AccountDetail icon="call-outline" value={person.phone || 'No mobile number'} muted={!person.phone} />
        {person.affiliateHandle ? <AccountDetail icon="link-outline" value={`tendso.com/a/${person.affiliateHandle}`} /> : null}
        {!affiliate ? <AccountDetail icon="ribbon-outline" value={person.certifiedAt ? 'Certified field agent' : 'Not yet certified'} muted={!person.certifiedAt} /> : null}
      </View>
      <ActionFeedback {...action} />
      {canChangeStatus ? (
        <AdminButton
          label={`${verb} ${name}`}
          icon={pending ? 'checkmark-circle-outline' : suspended ? 'refresh-outline' : 'pause-circle-outline'}
          variant={pending || suspended ? 'primary' : 'secondary'}
          danger={!pending && !suspended}
          disabled={action.busy}
          onPress={() => action.confirm(pending ? 'Approve affiliate?' : `${verb} account?`,
            pending ? `${name} will be able to share their affiliate page and earn commissions.`
              : suspended ? 'Restore this account’s access. Certification requirements still apply to field agents.'
              : 'Stop this account’s activity. Nothing is deleted; existing records remain.', verb,
            () => updateStatus({ id: person._id, status: pending || suspended ? 'active' : 'suspended' }),
            pending ? 'Affiliate approved.' : suspended ? 'Account reactivated.' : 'Account suspended.', !pending && !suspended)}
        />
      ) : null}
    </AdminCard>
  );
}

function AccountDetail({ icon, value, muted = false }: { icon: React.ComponentProps<typeof Ionicons>['name']; value: string; muted?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={20} color={colors.ink3Text} style={styles.detailIcon} />
      <Text variant="label" tone={muted ? 'muted' : 'ink2'} selectable style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  listHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  listTitle: { flexGrow: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  identityText: { flex: 1, minWidth: 0, gap: space.xs },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  details: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rule, paddingTop: space.lg, gap: space.md },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  detailIcon: { marginTop: 1 },
  detailValue: { flex: 1, minWidth: 0 },
});
