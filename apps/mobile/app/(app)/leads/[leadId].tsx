import React, { useCallback, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import type { Id } from '@tendso/convex-client';
import { colors, radius, shadow, space } from '../../../theme/v2';
import { openDirections, canOpenDirections, openExternalUrl } from '../../../services/links';
import {
  Avatar,
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
  leadStatus,
  submissionStatus,
} from '../../../components/v2';

// Real backend statuses, in pipeline order. The words come from leadStatus():
// New, Contacted, Visiting (qualified), Live (converted), Lost.
const STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;

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

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip',
  );

  const data = useQuery(
    api.leads.getDetailForMobileCRM,
    leadId ? { id: leadId as Id<'leads'> } : 'skip',
  );

  // businessName + scraped location (address/coords/placeId) live on the
  // already-deployed list query, NOT on getDetailForMobileCRM. Read them from
  // there so this screen needs ZERO Convex change — the backend is shared and
  // deployed from the web repo. This query is already cached/reactive when you
  // arrive from the leads list.
  // Gated on Convex auth: listForMobileCRM calls requireAuth(), which THROWS
  // "Not authenticated" if the query runs before Clerk's token is attached to
  // the Convex client (or after it expires). An unguarded call surfaces as a
  // generic "Server Error" and trips the app error boundary.
  const { isAuthenticated } = useConvexAuth();
  const crm = useQuery(
    api.leads.listForMobileCRM,
    isAuthenticated ? { statusFilter: 'all' } : 'skip',
  );

  const updateStatus = useMutation(api.leads.updateStatus);
  const addNote = useMutation(api.leadNotes.create);

  const [noteContent, setNoteContent] = useState('');
  const [postingNote, setPostingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        router.replace('/(app)/leads');
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [router]),
  );

  const goBack = () => router.replace('/(app)/leads');

  if (data === undefined) {
    return <Loading />;
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

  const { lead, business, interviewers, notes, submittedBy, isMine, adminContent } = data as any;
  const crmLead: any =
    crm?.leads?.find((l: any) => String(l._id) === String(lead._id)) ?? null;

  // The number / email to reach: the lead's own, else the owner on the submission.
  const phone: string | null = lead.phone || business?.ownerPhone || null;
  const email: string | null = lead.email || business?.ownerEmail || null;

  const handleCall = () => {
    if (!phone) return;
    Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
  };
  const handleEmail = () => {
    if (!email) return;
    Linking.openURL(`mailto:${email}`);
  };
  const isProspect = lead.source === 'outscraper';

  /**
   * Open step 1 with this business already filled in.
   *
   * businessType on the CRM row is either a submission's already-canonical type
   * or the raw scraped category, and mapCategoryToBusinessType handles both —
   * "Law Office" and "Personal injury attorney" both land on "Law Office".
   */
  const startInterview = () => {
    router.push({
      pathname: '/(app)/submit/info',
      params: {
        prospectLeadId: String(lead._id),
        businessName: crmLead?.businessName ?? lead.name ?? '',
        phone: crmLead?.phone ?? lead.phone ?? '',
        address: crmLead?.businessAddress ?? '',
        city: crmLead?.businessCity ?? '',
        category: crmLead?.businessType ?? '',
      },
    } as any);
  };
  // Maps target: prefer the submission address, else the scraped lead's own
  // location — coords + place id (most precise), then address, then name + city.
  const mapsTarget = business?.address
    ? {
        label: business.businessName ?? null,
        address: `${business.address}${business.city ? `, ${business.city}` : ''}`,
      }
    : {
        latitude: crmLead?.businessLatitude ?? null,
        longitude: crmLead?.businessLongitude ?? null,
        placeId: crmLead?.businessGooglePlaceId ?? null,
        address: crmLead?.businessAddress
          ? `${crmLead.businessAddress}${crmLead.businessCity ? `, ${crmLead.businessCity}` : ''}`
          : null,
        label:
          crmLead?.businessName && crmLead.businessName !== '(business unavailable)'
            ? crmLead.businessCity
              ? `${crmLead.businessName} ${crmLead.businessCity}`
              : crmLead.businessName
            : null,
      };
  const hasDirections = canOpenDirections(mapsTarget);
  const handleDirections = () => {
    void openDirections(mapsTarget);
  };

  const handleStatusChange = async (newStatus: typeof STATUS_OPTIONS[number]) => {
    if (newStatus === lead.status) return;
    setUpdatingStatus(true);
    try {
      await updateStatus({ id: lead._id, status: newStatus });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddNote = async () => {
    const content = noteContent.trim();
    if (!content || !creator?._id) return;
    setPostingNote(true);
    try {
      await addNote({ leadId: lead._id, creatorId: creator._id, content });
      setNoteContent('');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not save note');
    } finally {
      setPostingNote(false);
    }
  };

  const shopName: string = lead.name || crmLead?.businessName || 'Shop';
  const address: string | null = business?.address
    ? `${business.address}${business.city ? `, ${business.city}` : ''}`
    : crmLead?.businessAddress
      ? `${crmLead.businessAddress}${crmLead.businessCity ? `, ${crmLead.businessCity}` : ''}`
      : null;
  const heroUri: string | null = adminContent?.previewImageUrl || business?.photos?.[0] || null;
  const status = leadStatus(lead.status);
  const ownerName: string = business?.ownerName || lead.name || crmLead?.businessName || '?';
  const roleLabel = business ? 'Owner' : isProspect ? 'Business' : 'Customer';
  const canSave = noteContent.trim().length > 0 && !postingNote;
  const hasContact = !!(phone || email || hasDirections);
  const needsInterview = isProspect && !business;

  return (
    <ScreenShell
      onBack={goBack}
      footer={
        needsInterview ? (
          // Only for a scraped prospect nobody has interviewed yet: once `business`
          // exists there is a submission, and re-interviewing would file a second,
          // unlinked entry. lead._id is a `leads` id, which is exactly what
          // prospectLeadId wants, so the interview attaches to THIS record and the
          // scraped details ride along as params.
          <Button title="I'll interview this" onPress={startInterview} />
        ) : undefined
      }
      contentStyle={styles.body}
    >
      {/* Hero: photo, or a tinted tile, with the status chip */}
      <View style={styles.hero}>
        {heroUri ? (
          <Image source={{ uri: heroUri }} style={styles.heroImg} resizeMode="cover" accessibilityLabel={`${shopName} photo`} />
        ) : (
          <View style={styles.heroTile}>
            <Ionicons name="storefront-outline" size={64} color={colors.ink} />
          </View>
        )}
        <Chip label={status.label} tone={status.tone} style={styles.heroChip} />
      </View>

      {/* Name + address */}
      <View style={styles.nameBlock}>
        <Text variant="title" accessibilityRole="header">
          {shopName}
        </Text>
        {address ? (
          <Text variant="body" tone="ink2">
            {address}
          </Text>
        ) : null}
        <Text variant="label" tone="muted" weight="medium">
          {`${isProspect ? 'Found nearby' : `Inquired via ${lead.source}`} · ${timeAgo(lead.createdAt)}`}
        </Text>
      </View>

      {/* Who spotted it */}
      {submittedBy ? (
        <Card style={styles.row}>
          <Avatar uri={submittedBy.profileImage} name={submittedBy.displayName ?? '?'} size={44} />
          <View style={styles.flex1}>
            <Text variant="body" weight="bold" numberOfLines={1}>
              {submittedBy.displayName}
            </Text>
            <Text variant="label" tone="muted" weight="medium">
              Spotted this shop
            </Text>
          </View>
          {isMine ? <Chip label="You" tone="ok" /> : null}
        </Card>
      ) : null}

      {/* Contact: owner, phone, round message + call */}
      <Card style={styles.contactCard}>
        <View style={styles.row}>
          <Avatar name={ownerName} size={48} />
          <View style={styles.flex1}>
            <Text variant="body" weight="bold" numberOfLines={1}>
              {ownerName}
            </Text>
            <Text variant="label" tone="muted" weight="medium" numberOfLines={1}>
              {phone ? `${roleLabel} · ${phone}` : `${roleLabel} · no phone yet`}
            </Text>
            {email ? (
              <Text variant="label" tone="muted" weight="medium" numberOfLines={1}>
                {email}
              </Text>
            ) : null}
          </View>
          {email ? (
            <Pressable
              onPress={handleEmail}
              accessibilityRole="button"
              accessibilityLabel="Email"
              style={styles.roundSoft}
            >
              <Ionicons name="mail-outline" size={22} color={colors.ink} />
            </Pressable>
          ) : null}
          {phone ? (
            <Pressable
              onPress={handleCall}
              accessibilityRole="button"
              accessibilityLabel="Call"
              style={styles.roundInk}
            >
              <Ionicons name="call" size={22} color={colors.onDark} />
            </Pressable>
          ) : null}
        </View>
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
        {!hasContact ? (
          <Text variant="label" tone="muted" weight="medium">
            No contact info yet.
          </Text>
        ) : null}
      </Card>

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
          {business.photos && business.photos.length > 0 ? (
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

      {/* Status */}
      <View style={styles.section}>
        <SectionLabel>Status</SectionLabel>
        <View style={styles.pills}>
          {STATUS_OPTIONS.map((key) => {
            const label = leadStatus(key).label;
            const isActive = key === lead.status;
            const disabled = updatingStatus || !isMine;
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
        {!isMine ? (
          <Text variant="label" tone="muted" weight="medium">
            Only the agent who spotted it can change this.
          </Text>
        ) : null}
      </View>

      {/* Notes: add one, then the timeline */}
      <View style={styles.section}>
        <SectionLabel>{`Notes (${notes.length})`}</SectionLabel>
        <Field
          label="Add a note"
          icon="create-outline"
          value={noteContent}
          onChangeText={setNoteContent}
          placeholder="Best time to visit, who to ask for"
          multiline
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
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  stack: { gap: space.md },
  section: { gap: space.sm },

  hero: { height: 196, borderRadius: radius.cardLg, overflow: 'hidden', backgroundColor: colors.accentSoft },
  heroImg: { width: '100%', height: '100%' },
  heroTile: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  heroChip: { position: 'absolute', top: space.md, left: space.md },
  nameBlock: { gap: space.xs },

  contactCard: { gap: space.md },
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
    width: 44,
    height: 44,
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
