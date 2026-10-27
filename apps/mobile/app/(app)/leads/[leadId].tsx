import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Pressable,
  ScrollView,
  ActivityIndicator,
  BackHandler,
  Linking,
  Alert,
  Image,
  StyleSheet,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation, useConvexAuth } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { useWorkAreaLocation } from '../../../hooks/useWorkAreaLocation';
import { useNetwork } from '../../../providers/NetworkProvider';
import { Ionicons } from '@expo/vector-icons';
import type { Id } from '@tendso/convex-client';
import { colors, radius, shadow, space } from '../../../theme/v2';
import { openDirections, canOpenDirections, openExternalUrl } from '../../../services/links';
import { mapDistanceLabel, validMapCoordinate } from '../../../services/workArea';
import { distanceKm } from '../../../services/fieldAgentMap';
import {
  Avatar,
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Loading,
  Pill,
  ScreenShell,
  SectionLabel,
  Text,
  submissionStatus,
} from '../../../components/v2';

// CRM qualification/conversion do not prove a visit or a published website.
const STATUS_OPTIONS = [
  { key: 'new', label: 'New', tone: 'info' },
  { key: 'contacted', label: 'Contacted', tone: 'warn' },
  { key: 'qualified', label: 'Qualified', tone: 'warn' },
  { key: 'converted', label: 'Converted', tone: 'ok' },
  { key: 'lost', label: 'Lost', tone: 'muted' },
] as const;
type LeadStatus = typeof STATUS_OPTIONS[number]['key'];

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function LeadDetailScreen() {
  const router = useGuardedRouter();
  const { leadId } = useLocalSearchParams<{ leadId: string }>();
  const { user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const { isConnected } = useNetwork();
  const { area } = useWorkAreaLocation();

  const creator = useQuery(
    api.creators.getByClerkId,
    user && isAuthenticated ? { clerkId: user.id } : 'skip',
  );

  const data = useQuery(
    api.leads.getDetailForMobileCRM,
    leadId && isAuthenticated ? { id: leadId as Id<'leads'> } : 'skip',
  );

  // The cached list also supplies location/prefill fields on older deployments.
  // Keep every CRM query behind Convex auth while Clerk attaches its token.
  const crm = useQuery(
    api.leads.listForMobileCRM,
    isAuthenticated ? { statusFilter: 'all' } : 'skip',
  );

  const updateStatus = useMutation(api.leads.updateStatus);
  const addNote = useMutation(api.leadNotes.create);
  const visitCommunityFind = useMutation(api.leads.visitCommunityFind);

  const [noteContent, setNoteContent] = useState('');
  const [postingNote, setPostingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [startingCapture, setStartingCapture] = useState(false);
  const [, refreshClaim] = useState(0);
  const noteInFlight = useRef(false);
  const statusInFlight = useRef(false);
  const captureInFlight = useRef(false);
  const mounted = useRef(true);
  const currentRoute = useRef({ userId: user?.id, leadId, isAuthenticated });
  currentRoute.current = { userId: user?.id, leadId, isAuthenticated };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const claimExpiresAt = data?.claimExpiresAt;
  useEffect(() => {
    if (typeof claimExpiresAt !== 'number' || !Number.isFinite(claimExpiresAt)) return;
    const remaining = claimExpiresAt - Date.now();
    if (remaining < 0) return;
    const timer = setTimeout(() => refreshClaim((value) => value + 1), remaining + 1);
    return () => clearTimeout(timer);
  }, [claimExpiresAt]);

  const goBack = useCallback(() => {
    if (router.canGoBack?.()) router.back();
    else router.replace('/(app)/(tabs)/finds');
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        goBack();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [goBack]),
  );

  if (data === undefined && isConnected === false) {
    return (
      <ScreenShell onBack={goBack}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Reconnect to load this shop"
          body="Your saved drafts are still available. Connect to see the latest shop details."
          actionLabel="Back to leads"
          onAction={goBack}
        />
      </ScreenShell>
    );
  }

  if (data === undefined) {
    return <ScreenShell onBack={goBack}><Loading fill={false} /></ScreenShell>;
  }

  if (data === null) {
    return (
      <ScreenShell onBack={goBack}>
        <EmptyState
          icon="alert-circle-outline"
          title="Lead not found"
          body="It may have been removed, or you don't have access."
          actionLabel="Back to leads"
          onAction={goBack}
        />
      </ScreenShell>
    );
  }

  const detail = data as any;
  const { lead, business, interviewers, notes, submittedBy, isMine, adminContent } = detail;
  const canManageStatus = detail.canUpdateStatus ?? isMine;
  const canMarkConverted = detail.canMarkConverted !== false;
  const crmLead: any =
    crm?.leads?.find((l: any) => String(l._id) === String(lead._id)) ?? null;
  const detailPoint = { latitude: detail.businessLatitude, longitude: detail.businessLongitude };
  const crmPoint = { latitude: crmLead?.businessLatitude, longitude: crmLead?.businessLongitude };
  const point = validMapCoordinate(detailPoint) ? detailPoint : validMapCoordinate(crmPoint) ? crmPoint : null;
  const distanceLabel = area && point ? mapDistanceLabel(distanceKm(area, point), area) : null;

  // The number / email to reach: the lead's own, else the owner on the submission.
  const phone: string | null = lead.phone?.trim() || business?.ownerPhone?.trim()
    || crmLead?.ownerPhone?.trim() || crmLead?.phone?.trim() || null;
  const email: string | null = lead.email?.trim() || business?.ownerEmail?.trim() || crmLead?.email?.trim() || null;

  const handleCall = () => {
    if (!phone) return;
    void Linking.openURL(`tel:${phone.replace(/\s/g, '')}`).catch(() => {
      Alert.alert('Could not open the phone app', 'You can call the number shown on this page.');
    });
  };
  const handleMessage = () => {
    if (!phone) return;
    void Linking.openURL(`sms:${phone.replace(/\s/g, '')}`).catch(() => {
      Alert.alert('Could not open messages', 'You can message the number shown on this page.');
    });
  };
  const handleEmail = () => {
    if (!email) return;
    void Linking.openURL(`mailto:${email}`).catch(() => {
      Alert.alert('Could not open email', 'You can use the email address shown on this page.');
    });
  };
  const isProspect = lead.source === 'outscraper';
  const isCommunityFind = lead.source === 'community';
  const activeClaim = detail.claimedBy && detail.claimExpiresAt > Date.now() ? detail.claimedBy : null;
  const claimedByAnotherAgent = !!activeClaim && !activeClaim.isMine;

  /**
   * Open step 1 with this business already filled in.
   *
   * businessType on the CRM row is either a submission's already-canonical type
   * or the raw scraped category, and mapCategoryToBusinessType handles both —
   * "Law Office" and "Personal injury attorney" both land on "Law Office".
   */
  const startInterview = async () => {
    if (!isAuthenticated || isConnected === false || crm === undefined || claimedByAnotherAgent || captureInFlight.current) return;
    captureInFlight.current = true;
    setStartingCapture(true);
    const captureActor = { userId: user?.id, leadId };
    try {
      if (isCommunityFind) await visitCommunityFind({ leadId: lead._id });
      if (!mounted.current || !currentRoute.current.isAuthenticated
        || currentRoute.current.userId !== captureActor.userId
        || currentRoute.current.leadId !== captureActor.leadId) return;
      router.push({
        pathname: '/(app)/submit/info',
        params: {
          prospectLeadId: String(lead._id),
          businessName: lead.businessName ?? (crmLead?.businessName === '(business unavailable)' ? null : crmLead?.businessName) ?? lead.name ?? '',
          phone: crmLead?.phone ?? lead.phone ?? '',
          address: lead.businessAddress ?? crmLead?.businessAddress ?? '',
          city: lead.businessCity ?? crmLead?.businessCity ?? '',
          category: lead.businessCategory ?? crmLead?.businessType ?? '',
          ...(point ? { latitude: String(point.latitude), longitude: String(point.longitude) } : {}),
        },
      } as any);
    } catch (err: any) {
      if (mounted.current && currentRoute.current.userId === captureActor.userId
        && currentRoute.current.leadId === captureActor.leadId) {
        Alert.alert('Could not start the capture', err?.message || 'Please try again.');
      }
    } finally {
      captureInFlight.current = false;
      if (mounted.current) setStartingCapture(false);
    }
  };
  // Maps target: prefer the submission address, else the scraped lead's own
  // location — coords + place id (most precise), then address, then name + city.
  const mapsTarget = business?.address
    ? {
        label: business.businessName ?? null,
        address: `${business.address}${business.city ? `, ${business.city}` : ''}`,
      }
    : {
        latitude: detail.businessLatitude ?? crmLead?.businessLatitude ?? null,
        longitude: detail.businessLongitude ?? crmLead?.businessLongitude ?? null,
        placeId: crmLead?.businessGooglePlaceId ?? null,
        address: (lead.businessAddress ?? crmLead?.businessAddress)
          ? `${lead.businessAddress ?? crmLead.businessAddress}${(lead.businessCity ?? crmLead?.businessCity) ? `, ${lead.businessCity ?? crmLead.businessCity}` : ''}`
          : null,
        label:
          (lead.businessName ?? crmLead?.businessName) && (lead.businessName ?? crmLead?.businessName) !== '(business unavailable)'
            ? `${lead.businessName ?? crmLead.businessName}${(lead.businessCity ?? crmLead?.businessCity) ? ` ${lead.businessCity ?? crmLead.businessCity}` : ''}`
            : null,
      };
  const hasDirections = canOpenDirections(mapsTarget);
  const handleDirections = () => {
    void openDirections(mapsTarget);
  };

  const canUpdate = isAuthenticated && isConnected !== false;
  const handleStatusChange = async (newStatus: LeadStatus) => {
    if (newStatus === lead.status || !canManageStatus || !canUpdate || statusInFlight.current
      || (newStatus === 'converted' && !canMarkConverted)) return;
    statusInFlight.current = true;
    setUpdatingStatus(true);
    try {
      await updateStatus({ id: lead._id, status: newStatus });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not update status');
    } finally {
      statusInFlight.current = false;
      setUpdatingStatus(false);
    }
  };

  const handleAddNote = async () => {
    const content = noteContent.trim();
    if (!content || !creator?._id || !canUpdate || noteInFlight.current) return;
    noteInFlight.current = true;
    setPostingNote(true);
    try {
      await addNote({ leadId: lead._id, creatorId: creator._id, content });
      setNoteContent('');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not save note');
    } finally {
      noteInFlight.current = false;
      setPostingNote(false);
    }
  };

  const listedBusinessName = crmLead?.businessName === '(business unavailable)' ? null : crmLead?.businessName;
  const shopName: string = business?.businessName || lead.businessName || listedBusinessName || lead.name || 'Shop';
  const street: string | null = business?.address?.trim() || lead.businessAddress?.trim() || crmLead?.businessAddress?.trim() || null;
  const city: string | null = business?.city?.trim() || lead.businessCity?.trim() || crmLead?.businessCity?.trim() || null;
  const address = street ? `${street}${city ? `, ${city}` : ''}` : city || 'Address not added';
  const canViewCaptureMedia = detail.canViewCaptureMedia === true;
  const heroUri: string | null = detail.photoUrl || adminContent?.previewImageUrl
    || (canViewCaptureMedia ? business?.photos?.[0] : null) || null;
  const status = STATUS_OPTIONS.find((option) => option.key === lead.status)
    ?? { label: 'Status unavailable', tone: 'muted' as const };
  const hasLiveWebsite = typeof detail.hasLiveWebsite === 'boolean' ? detail.hasLiveWebsite
    : !!business?.websiteUrl && ['deployed', 'paid', 'completed'].includes(business.status);
  const heroLabel = hasLiveWebsite ? 'Live' : detail.needsWebsite === true ? 'Needs a site' : status.label;
  const confirmedOwnerName: string | null = business?.ownerName?.trim() || crmLead?.ownerName?.trim() || null;
  const contactName: string | null = confirmedOwnerName || (!isProspect && !isCommunityFind ? lead.name?.trim() : null) || null;
  const ownerName = contactName || 'Business contact';
  const showContactCard = !isCommunityFind || !!(contactName || phone || email);
  const roleLabel = confirmedOwnerName ? 'Owner' : 'Contact';
  const canSave = noteContent.trim().length > 0 && !postingNote && !!creator?._id && canUpdate;
  const hasContact = !!(phone || email || hasDirections);
  const needsInterview = (isProspect || isCommunityFind) && !business && !hasLiveWebsite && lead.status !== 'lost'
    && !(isCommunityFind && lead.status === 'converted');
  const spotter = detail.spottedBy ?? submittedBy;
  const spottedAt = [detail.spottedAt, lead.createdAt, lead._creationTime]
    .find((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const shopActions = <>
    {hasDirections ? (
      <Button
        title="Directions"
        variant="ghost"
        size="md"
        icon="navigate"
        onPress={handleDirections}
        accessibilityLabel="Show directions"
      />
    ) : null}
    {!business && (detail.websiteUrl || detail.businessWebsite) ? (
      <Button
        title={hasLiveWebsite ? 'View website' : 'View existing website'}
        variant="ghost"
        size="md"
        icon="globe-outline"
        onPress={() => void openExternalUrl(detail.websiteUrl || detail.businessWebsite)}
      />
    ) : null}
  </>;

  return (
    <ScreenShell
      onBack={goBack}
      footer={
        needsInterview ? (
          // Only for a find nobody has interviewed yet: once `business`
          // exists there is a submission, and re-interviewing would file a second,
          // unlinked entry. lead._id is a `leads` id, which is exactly what
          // prospectLeadId wants, so the interview attaches to THIS record and the
          // scraped details ride along as params.
          <Button
            title="Start the capture"
            onPress={startInterview}
            loading={startingCapture}
            disabled={!canUpdate || crm === undefined || claimedByAnotherAgent || startingCapture}
          />
        ) : undefined
      }
      contentStyle={styles.body}
    >
      {isConnected === false ? (
        <Banner tone="warn" icon="cloud-offline-outline" title="You're offline" body="Reconnect to save notes or change this shop's status." />
      ) : null}
      {/* Hero: photo, or a tinted tile, with the status chip */}
      <View style={styles.hero}>
        {heroUri ? (
          <Image source={{ uri: heroUri }} style={styles.heroImg} resizeMode="cover" accessibilityLabel={`${shopName} photo`} />
        ) : (
          <View style={styles.heroTile}>
            <Ionicons name="storefront-outline" size={56} color={colors.ink2} />
            <Text variant="label" tone="muted" weight="medium">Shop photo not added</Text>
          </View>
        )}
        <Chip label={heroLabel} tone={hasLiveWebsite || detail.needsWebsite === true ? 'ok' : status.tone} style={styles.heroChip} />
      </View>

      {/* Name + address */}
      <View style={styles.nameBlock}>
        <Text variant="title" accessibilityRole="header">
          {shopName}
        </Text>
        <Text variant="body" tone="ink2">
          {distanceLabel ? `${distanceLabel} · ${address}` : address}
        </Text>
      </View>

      {activeClaim ? (
        <Banner
          tone={activeClaim.isMine ? 'ok' : 'neutral'}
          icon="flag-outline"
          title={activeClaim.isMine ? 'Reserved for your visit' : `Reserved by ${activeClaim.displayName}`}
          body={activeClaim.isMine ? 'Start the capture when you are ready at the shop.' : 'Another field agent is visiting this shop. You can still read its notes.'}
        />
      ) : null}

      {/* Contact actions stay on a separate row so names remain readable. */}
      {showContactCard ? <Card style={styles.contactCard}>
        <View style={styles.row}>
          <Avatar name={ownerName} size={48} />
          <View style={styles.flex1}>
            <Text variant="body" weight="bold">
              {ownerName}
            </Text>
            {phone || !isCommunityFind ? <Text variant="label" tone="muted" weight="medium">
              {phone ? `${roleLabel} · ${phone}` : 'Phone not added'}
            </Text> : null}
            {email ? (
              <Text variant="label" tone="muted" weight="medium">
                {email}
              </Text>
            ) : null}
          </View>
        </View>
        {phone || email ? (
          <View style={styles.contactActions}>
            {phone ? (
              <>
                <Pressable
                  onPress={handleMessage}
                  accessibilityRole="button"
                  accessibilityLabel={`Message ${ownerName}`}
                  style={styles.contactAction}
                >
                  <View style={styles.roundSoft}><Ionicons name="chatbubble-outline" size={22} color={colors.ink} /></View>
                  <Text variant="label" weight="semibold">Message</Text>
                </Pressable>
                <Pressable
                  onPress={handleCall}
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${ownerName}`}
                  style={styles.contactAction}
                >
                  <View style={styles.roundInk}><Ionicons name="call" size={22} color={colors.onDark} /></View>
                  <Text variant="label" weight="semibold">Call</Text>
                </Pressable>
              </>
            ) : null}
            {email ? (
              <Pressable
                onPress={handleEmail}
                accessibilityRole="button"
                accessibilityLabel={`Email ${ownerName}`}
                style={styles.contactAction}
              >
                <View style={styles.roundSoft}><Ionicons name="mail-outline" size={22} color={colors.ink} /></View>
                <Text variant="label" weight="semibold">Email</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {shopActions}
        {!hasContact && !isCommunityFind ? (
          <Text variant="label" tone="muted" weight="medium">
            No contact info yet.
          </Text>
        ) : null}
      </Card> : shopActions}

      {/* Notes and their actual timestamps, without invented author metadata. */}
      <View style={styles.section}>
        <SectionLabel>{`Notes (${notes.length})`}</SectionLabel>
        <Field
          label="Add a note"
          icon="create-outline"
          value={noteContent}
          onChangeText={setNoteContent}
          placeholder="Best time to visit, who to ask for"
          multiline
          editable={canUpdate && !postingNote}
          accessibilityLabel="Add a note about this lead"
          right={
            <Pressable
              onPress={handleAddNote}
              disabled={!canSave}
              accessibilityRole="button"
              accessibilityLabel="Save note"
              accessibilityState={{ disabled: !canSave, busy: postingNote }}
              style={[styles.send, canSave ? styles.sendOn : null]}
            >
              {postingNote ? (
                <ActivityIndicator size="small" color={colors.onDark} />
              ) : (
                <Ionicons name="arrow-up" size={22} color={canSave ? colors.onDark : colors.ink3} />
              )}
            </Pressable>
          }
        />
        {notes.length === 0 ? (
          <Text variant="label" tone="muted" weight="medium">
            No notes yet.
          </Text>
        ) : (
          <Card style={styles.timeline}>
            {notes.map((note: any, i: number) => (
              <View key={note._id} style={styles.tlRow}>
                <View style={styles.tlRail}>
                  <View style={styles.tlDot} />
                  {i < notes.length - 1 ? <View style={styles.tlLine} /> : null}
                </View>
                <View style={[styles.tlBody, i < notes.length - 1 ? styles.tlGap : null]}>
                  <Text variant="body" tone="ink2">
                    {note.content}
                  </Text>
                  <Text variant="label" tone="muted" weight="medium">
                    {timeAgo(note.createdAt)}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        )}
      </View>

      {/* Status */}
      <View style={styles.section}>
        <View style={styles.between}>
          <SectionLabel>Status</SectionLabel>
          {updatingStatus ? <ActivityIndicator size="small" color={colors.ink} accessibilityLabel="Updating status" /> : null}
        </View>
        <View style={styles.pills}>
          {STATUS_OPTIONS.map(({ key, label }) => {
            const isActive = key === lead.status;
            const disabled = updatingStatus || !canManageStatus || !canUpdate || (key === 'converted' && !canMarkConverted);
            return (
              <Pill
                key={key}
                label={label}
                selected={isActive}
                onPress={disabled ? undefined : () => handleStatusChange(key)}
                accessibilityLabel={`Set status to ${label}`}
                style={[
                  !isActive ? styles.pillOff : null,
                  disabled && !isActive ? styles.dim : null,
                ]}
              />
            );
          })}
        </View>
        {!canManageStatus ? (
          <Text variant="label" tone="muted" weight="medium">
            {isCommunityFind ? 'Status is managed by the field agent visiting this shop.' : 'Only the agent who submitted this lead can change this.'}
          </Text>
        ) : null}
        {!canMarkConverted ? (
          <Text variant="label" tone="muted" weight="medium">Converted is set when the capture is submitted.</Text>
        ) : null}
      </View>

      {spotter ? (
        <Card style={styles.row}>
          <Avatar uri={spotter.profileImage} name={spotter.displayName ?? '?'} size={48} />
          <View style={styles.flex1}>
            <Text variant="body" weight="bold">{spotter.displayName}</Text>
            <Text variant="label" tone="muted" weight="medium">
              {`${isProspect || isCommunityFind ? 'Spotted this shop' : 'Submitted the shop'}${spottedAt !== undefined ? ` · ${timeAgo(spottedAt)}` : ''}`}
            </Text>
          </View>
          {String(spotter.creatorId) === String(creator?._id) ? <Chip label="You" tone="ok" /> : null}
        </Card>
      ) : null}

      {/* The shop on the submission, if it has been interviewed */}
      {business ? (
        <Card style={styles.stack}>
          <SectionLabel>The shop</SectionLabel>
          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text variant="heading">{business.businessName}</Text>
              <Text variant="label" tone="muted" weight="medium">
                {business.businessType}
              </Text>
            </View>
          </View>
          {canViewCaptureMedia && business.photos && business.photos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
              {business.photos.map((photo: string, idx: number) => (
                <Image key={idx} source={{ uri: photo }} style={styles.photo} accessibilityLabel={`Shop photo ${idx + 1}`} />
              ))}
            </ScrollView>
          ) : null}
          {business.websiteUrl ? (
            <Button
              title="View website"
              variant="ghost"
              size="md"
              icon="globe-outline"
              onPress={() => void openExternalUrl(business.websiteUrl!)}
              accessibilityLabel="Open business website"
            />
          ) : null}
        </Card>
      ) : null}

      {/* Live preview the team prepared for this shop */}
      {adminContent?.hasEnrichedContent && (adminContent.description || adminContent.externalPreviewUrl) ? (
        <Card style={styles.stack}>
          <SectionLabel>Preview</SectionLabel>
          {adminContent.description ? (
            <Text variant="body" tone="ink2">
              {adminContent.description}
            </Text>
          ) : null}
          {adminContent.externalPreviewUrl ? (
            <Button
              title="See the live preview"
              variant="ghost"
              size="md"
              icon="open-outline"
              onPress={() => void openExternalUrl(adminContent.externalPreviewUrl!)}
              accessibilityLabel="Open live preview"
            />
          ) : null}
        </Card>
      ) : null}

      {/* Everyone who interviewed this shop */}
      <Card style={styles.stack}>
        <View style={styles.between}>
          <SectionLabel>Interviewed by</SectionLabel>
          <Chip label={`${interviewers.length} field agent${interviewers.length === 1 ? '' : 's'}`} tone="muted" />
        </View>
        {interviewers.length === 0 ? (
          <Text variant="label" tone="muted" weight="medium">
            No one has interviewed this shop yet.
          </Text>
        ) : (
          <View style={styles.stack}>
            {interviewers.map((interviewer: any) => {
              const isRejected = interviewer.submissionStatus === 'rejected';
              const st = submissionStatus(interviewer.submissionStatus);
              return (
                <View
                  key={interviewer.submissionId}
                  style={[styles.row, styles.interviewer, interviewer.isMine ? styles.interviewerMine : null, isRejected && !interviewer.isMine ? styles.dim : null]}
                >
                  <Avatar uri={interviewer.creatorProfileImage} name={interviewer.creatorName ?? '?'} size={40} />
                  <View style={styles.flex1}>
                    <Text variant="body" weight="bold" numberOfLines={1}>
                      {interviewer.isMine ? `${interviewer.creatorName} (you)` : interviewer.creatorName}
                    </Text>
                    <Text variant="label" tone="muted" weight="medium">
                      {timeAgo(interviewer.interviewedAt)}
                    </Text>
                  </View>
                  <Chip label={st.label} tone={st.tone} />
                </View>
              );
            })}
          </View>
        )}
      </Card>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, minWidth: 0 },
  body: { gap: space.lg, paddingTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  between: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  stack: { gap: space.md },
  section: { gap: space.sm },

  hero: { height: 196, borderRadius: radius.cardLg, overflow: 'hidden', backgroundColor: colors.accentSoft },
  heroImg: { width: '100%', height: '100%' },
  heroTile: { flex: 1, gap: space.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  heroChip: { position: 'absolute', top: space.md, left: space.md },
  nameBlock: { gap: space.xs },

  contactCard: { gap: space.md },
  contactActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  contactAction: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48 },
  roundSoft: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundInk: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },

  photoRow: { gap: space.sm },
  photo: { width: 104, height: 104, borderRadius: radius.field },

  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pillOff: { backgroundColor: colors.card, ...shadow.soft },
  dim: { opacity: 0.5 },

  send: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOn: { backgroundColor: colors.ink },

  timeline: { gap: 0 },
  tlRow: { flexDirection: 'row', gap: space.md },
  tlRail: { width: 14, alignItems: 'center' },
  tlDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.ink, marginTop: 6 },
  tlLine: { flex: 1, width: 2, backgroundColor: colors.rule, marginTop: 4 },
  tlBody: { flex: 1, gap: space.xs },
  tlGap: { paddingBottom: space.lg },

  interviewer: { padding: space.sm, borderRadius: radius.field },
  interviewerMine: { backgroundColor: colors.accentSoft },
});
