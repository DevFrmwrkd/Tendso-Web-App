import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  BackHandler,
  Linking,
  Alert,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation, useConvexAuth } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { Ionicons } from '@expo/vector-icons';
import type { Id } from '@tendso/convex-client';
import { colors, fonts, radius } from '../../../theme/tokens';
import { openDirections, canOpenDirections, openExternalUrl } from '../../../services/links';
import { Display, Body, Label, Card, Rule, Avatar, Door } from '../../../components/ui/primitives';

const STATUS_OPTIONS = [
  { key: 'new',       label: 'New',       bg: colors.businessBg, ink: colors.business },
  { key: 'contacted', label: 'Contacted', bg: colors.warnBg,     ink: colors.warn },
  { key: 'qualified', label: 'Qualified', bg: '#EDE9FE',         ink: '#6D28D9' },
  { key: 'converted', label: 'Converted', bg: colors.accentBg,   ink: colors.accentInk },
  { key: 'lost',      label: 'Lost',      bg: colors.dangerBg,   ink: colors.danger },
] as const;

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

  if (data === undefined) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (data === null) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, paddingHorizontal: 24 }}>
        <Ionicons name="alert-circle-outline" size={44} color={colors.ink3} />
        <View style={{ marginTop: 12, alignItems: 'center' }}>
          <Display size="sm">Lead not</Display>
          <Display size="sm" italic color={colors.accent}>found.</Display>
        </View>
        <Body size="sm" color={colors.ink3} style={{ textAlign: 'center', marginTop: 6, maxWidth: 280 }}>
          This lead may have been deleted, or you don't have access to it.
        </Body>
        <TouchableOpacity
          onPress={() => router.replace('/(app)/leads')}
          style={{
            marginTop: 18,
            paddingHorizontal: 18,
            paddingVertical: 10,
            backgroundColor: colors.ink,
            borderRadius: radius.pill,
          }}
          accessibilityLabel="Back to leads"
          accessibilityRole="button"
        >
          <Text style={{ fontFamily: fonts.sansMed, color: colors.paper3, fontSize: 14 }}>
            Back to leads
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const { lead, business, interviewers, notes, submittedBy, isMine, adminContent } = data as any;
  const crmLead: any =
    crm?.leads?.find((l: any) => String(l._id) === String(lead._id)) ?? null;

  const handleCall = () => {
    if (!lead.phone) return;
    Linking.openURL(`tel:${lead.phone.replace(/\s/g, '')}`);
  };
  const handleEmail = () => {
    if (!lead.email) return;
    Linking.openURL(`mailto:${lead.email}`);
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

  const handleStatusChange = async (newStatus: typeof STATUS_OPTIONS[number]['key']) => {
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 12,
        gap: 12,
      }}>
        <TouchableOpacity
          onPress={() => router.replace('/(app)/leads')}
          style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: colors.paper3,
            borderWidth: 1, borderColor: colors.rule,
            alignItems: 'center', justifyContent: 'center',
          }}
          accessibilityLabel="Back to leads"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={18} color={colors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Label tracking={1.6}>LEAD DETAIL</Label>
          <Body size="md" weight="bold" color={colors.ink} numberOfLines={1}>{lead.name || crmLead?.businessName}</Body>
          <Text style={{
            fontFamily: fonts.mono,
            fontSize: 10, color: colors.ink3, letterSpacing: 0.5,
            textTransform: 'uppercase',
          }} numberOfLines={1}>
            {lead.source === 'outscraper'
              ? lead.status === 'new'
                ? 'Found nearby · not yet contacted'
                : 'Found nearby'
              : `Inquired via ${lead.source}`} · {timeAgo(lead.createdAt)}
          </Text>
        </View>
      </View>

      <Rule />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32, paddingTop: 14 }}>
        {/* Submitted-by banner */}
        {submittedBy && (
          <Card padded={false} style={{
            marginHorizontal: 20,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
            {submittedBy.profileImage ? (
              <Image
                source={{ uri: submittedBy.profileImage }}
                style={{ width: 38, height: 38, borderRadius: 19 }}
              />
            ) : (
              <Avatar name={submittedBy.displayName ?? '?'} size={38} bg={colors.accentBg} fg={colors.accentInk} />
            )}
            <View style={{ marginLeft: 12, flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Body size="sm" weight="bold" color={colors.ink}>{submittedBy.displayName}</Body>
                {isMine && (
                  <View style={{
                    backgroundColor: colors.ink,
                    borderRadius: radius.pill,
                    paddingHorizontal: 6, paddingVertical: 1,
                  }}>
                    <Text style={{ fontFamily: fonts.monoMed, fontSize: 9, letterSpacing: 1.0, color: colors.paper3 }}>
                      YOU
                    </Text>
                  </View>
                )}
              </View>
              <Text style={{
                fontFamily: fonts.mono,
                fontSize: 10, color: colors.ink3,
                marginTop: 2, letterSpacing: 0.5,
              }}>
                submitted this lead
              </Text>
            </View>
          </Card>
        )}

        {/* Admin-curated content hero */}
        {adminContent?.hasEnrichedContent && (
          <Card padded={false} large style={{
            marginHorizontal: 20,
            marginTop: 12,
            overflow: 'hidden',
          }}>
            {adminContent.previewImageUrl && (
              <View style={{ width: '100%', backgroundColor: colors.paper2, aspectRatio: 16 / 9 }}>
                <Image
                  source={{ uri: adminContent.previewImageUrl }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              </View>
            )}
            {adminContent.description && (
              <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
                <Body size="sm" color={colors.ink}>{adminContent.description}</Body>
              </View>
            )}
            {adminContent.externalPreviewUrl && (
              <TouchableOpacity
                onPress={() => void openExternalUrl(adminContent.externalPreviewUrl!)}
                activeOpacity={0.7}
                style={{
                  marginHorizontal: 16, marginTop: 12, marginBottom: 14,
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: colors.paper2,
                  borderRadius: radius.sm,
                  borderWidth: 1, borderColor: colors.rule,
                  paddingHorizontal: 12, paddingVertical: 10,
                }}
              >
                <Ionicons name="link" size={14} color={colors.accent} />
                <Text style={{
                  flex: 1, marginLeft: 8,
                  fontFamily: fonts.sansMed,
                  fontSize: 12, color: colors.accent,
                }} numberOfLines={1}>
                  {adminContent.externalPreviewUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </Text>
                <Ionicons name="open-outline" size={14} color={colors.accent} />
              </TouchableOpacity>
            )}
            {!adminContent.externalPreviewUrl && <View style={{ height: 14 }} />}
          </Card>
        )}

        {/* Contact — the customer for real inquiries, the business itself for scraped prospects */}
        <Card large style={{ marginHorizontal: 20, marginTop: 12, padding: 16 }}>
          <Label tracking={1.6} style={{ marginBottom: 10 }}>{isProspect ? 'BUSINESS' : 'CUSTOMER'}</Label>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Avatar name={lead.name || crmLead?.businessName || '?'} size={48} bg={colors.accentBg} fg={colors.accentInk} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Display size="sm">{lead.name || crmLead?.businessName}</Display>
              {lead.phone ? (
                <Body size="sm" color={colors.ink2}>{lead.phone}</Body>
              ) : (
                <Body size="sm" color={colors.ink3} style={{ fontStyle: 'italic' }}>
                  {isProspect ? 'No phone number scraped' : 'No phone on file'}
                </Body>
              )}
              {lead.email && <Body size="sm" color={colors.ink2}>{lead.email}</Body>}
              {isProspect && crmLead?.businessAddress && (
                <Body size="sm" color={colors.ink2} style={{ marginTop: 2 }} numberOfLines={2}>
                  {crmLead.businessAddress}{crmLead.businessCity ? `, ${crmLead.businessCity}` : ''}
                </Body>
              )}
            </View>
          </View>

          {lead.phone || lead.email || (isProspect && hasDirections) ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {lead.phone && (
                <TouchableOpacity
                  onPress={handleCall}
                  style={{
                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: colors.accentSolid,
                    borderRadius: radius.sm,
                    paddingVertical: 11,
                  }}
                  accessibilityLabel="Call"
                  accessibilityRole="button"
                >
                  <Ionicons name="call" size={16} color="#fff" />
                  <Text style={{ marginLeft: 8, fontFamily: fonts.sansMed, fontSize: 14, color: '#fff' }}>Call</Text>
                </TouchableOpacity>
              )}
              {lead.email && (
                <TouchableOpacity
                  onPress={handleEmail}
                  style={{
                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: colors.business,
                    borderRadius: radius.sm,
                    paddingVertical: 11,
                  }}
                  accessibilityLabel="Email"
                  accessibilityRole="button"
                >
                  <Ionicons name="mail" size={16} color="#fff" />
                  <Text style={{ marginLeft: 8, fontFamily: fonts.sansMed, fontSize: 14, color: '#fff' }}>Email</Text>
                </TouchableOpacity>
              )}
              {isProspect && hasDirections && (
                <TouchableOpacity
                  onPress={handleDirections}
                  style={{
                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: colors.paper2,
                    borderWidth: 1, borderColor: colors.rule,
                    borderRadius: radius.sm,
                    paddingVertical: 11,
                  }}
                  accessibilityLabel="Show directions"
                  accessibilityRole="button"
                >
                  <Ionicons name="navigate" size={16} color={colors.ink} />
                  <Text style={{ marginLeft: 8, fontFamily: fonts.sansMed, fontSize: 14, color: colors.ink }}>Directions</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <Body size="sm" color={colors.ink3} style={{ fontStyle: 'italic' }}>
              No contact info available for this business.
            </Body>
          )}
        </Card>

        {/* Interview this business. Shown only for a scraped prospect nobody has
            interviewed yet — once `business` exists there is a submission, and
            re-interviewing would file a second, unlinked entry.

            lead._id is a `leads` id, which is exactly what prospectLeadId wants,
            so an interview started here attaches to THIS record instead of
            creating a duplicate. The scraped details ride along as params so the
            creator isn't retyping them in front of the owner. */}
        {isProspect && !business && (
          <View style={{ marginHorizontal: 20, marginTop: 12 }}>
            <Door
              caption="INTERVIEW"
              label="I'll interview this"
              variant="accent"
              onPress={startInterview}
              rightIcon={<Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 8 }} />}
            />
          </View>
        )}

        {/* Status pipeline */}
        <Card large style={{ marginHorizontal: 20, marginTop: 12, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Label tracking={1.6}>STATUS</Label>
            {!isMine && (
              <Text style={{ fontFamily: fonts.serifIt, fontSize: 12, color: colors.ink3 }}>
                read-only
              </Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {STATUS_OPTIONS.map((opt) => {
              const isActive = opt.key === lead.status;
              const disabled = updatingStatus || !isMine;
              return (
                <TouchableOpacity
                  key={opt.key}
                  disabled={disabled}
                  onPress={() => handleStatusChange(opt.key)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6,
                    borderRadius: radius.pill,
                    backgroundColor: isActive ? opt.bg : colors.paper3,
                    borderWidth: 1,
                    borderColor: isActive ? opt.ink : colors.ruleStrong,
                    opacity: disabled && !isActive ? 0.5 : 1,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Set status to ${opt.label}`}
                >
                  <Text style={{
                    fontFamily: fonts.monoMed,
                    fontSize: 11,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    color: isActive ? opt.ink : colors.ink2,
                  }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Business */}
        {business && (
          <Card large style={{ marginHorizontal: 20, marginTop: 12, padding: 16 }}>
            <Label tracking={1.6} style={{ marginBottom: 10 }}>BUSINESS</Label>
            <Display size="sm">{business.businessName}</Display>
            <Body size="xs" color={colors.ink3} style={{ marginTop: 2 }}>{business.businessType}</Body>

            <View style={{ marginTop: 12, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="person-outline" size={14} color={colors.ink3} />
                <Body size="sm" color={colors.ink2} style={{ marginLeft: 8 }}>{business.ownerName}</Body>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="call-outline" size={14} color={colors.ink3} />
                <Body size="sm" color={colors.ink2} style={{ marginLeft: 8 }}>{business.ownerPhone}</Body>
              </View>
              {business.ownerEmail && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="mail-outline" size={14} color={colors.ink3} />
                  <Body size="sm" color={colors.ink2} style={{ marginLeft: 8 }}>{business.ownerEmail}</Body>
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Ionicons name="location-outline" size={14} color={colors.ink3} style={{ marginTop: 3 }} />
                <Body size="sm" color={colors.ink2} style={{ marginLeft: 8, flex: 1 }}>
                  {business.address}
                  {business.city ? `, ${business.city}` : ''}
                  {business.province ? `, ${business.province}` : ''}
                </Body>
              </View>
            </View>

            {business.photos && business.photos.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, marginTop: 14 }}
              >
                {business.photos.map((photo: string, idx: number) => (
                  <Image
                    key={idx}
                    source={{ uri: photo }}
                    style={{ width: 104, height: 104, borderRadius: radius.sm }}
                  />
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              onPress={handleDirections}
              style={{
                marginTop: 12,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                backgroundColor: colors.paper2,
                borderWidth: 1, borderColor: colors.rule,
                borderRadius: radius.sm,
                paddingVertical: 11,
              }}
              accessibilityLabel="Open in Maps"
              accessibilityRole="button"
            >
              <Ionicons name="map-outline" size={16} color={colors.ink} />
              <Text style={{ marginLeft: 8, fontFamily: fonts.sansMed, fontSize: 14, color: colors.ink }}>
                Directions
              </Text>
            </TouchableOpacity>

            {business.websiteUrl && (
              <TouchableOpacity
                onPress={() => void openExternalUrl(business.websiteUrl!)}
                style={{
                  marginTop: 8,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'transparent',
                  borderWidth: 1, borderColor: colors.accent,
                  borderRadius: radius.sm,
                  paddingVertical: 11,
                }}
                accessibilityLabel="Open business website"
                accessibilityRole="button"
              >
                <Ionicons name="globe-outline" size={16} color={colors.accent} />
                <Text style={{ marginLeft: 8, fontFamily: fonts.sansMed, fontSize: 14, color: colors.accent }}>
                  View website
                </Text>
              </TouchableOpacity>
            )}
          </Card>
        )}

        {/* Interviewers */}
        <Card large style={{ marginHorizontal: 20, marginTop: 12, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Label tracking={1.6}>INTERVIEWED BY</Label>
            <View style={{
              backgroundColor: colors.paper2,
              borderRadius: radius.pill,
              paddingHorizontal: 8, paddingVertical: 2,
            }}>
              <Text style={{
                fontFamily: fonts.monoMed,
                fontSize: 10, letterSpacing: 1.0,
                color: colors.ink2,
                textTransform: 'uppercase',
              }}>
                {interviewers.length} {interviewers.length === 1 ? 'creator' : 'creators'}
              </Text>
            </View>
          </View>

          {interviewers.length === 0 ? (
            <Text style={{ fontFamily: fonts.serifIt, fontSize: 14, color: colors.ink3 }}>
              No interview history found for this business.
            </Text>
          ) : (
            <View style={{ gap: 10 }}>
              {interviewers.map((interviewer: any) => {
                const isRejected = interviewer.submissionStatus === 'rejected';
                return (
                  <View
                    key={interviewer.submissionId}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      backgroundColor: interviewer.isMine ? colors.accentBg : colors.paper2,
                      borderRadius: radius.sm,
                      padding: 10,
                      borderLeftWidth: interviewer.isMine ? 3 : 0,
                      borderLeftColor: colors.accent,
                      opacity: isRejected && !interviewer.isMine ? 0.6 : 1,
                    }}
                  >
                    {interviewer.creatorProfileImage ? (
                      <Image
                        source={{ uri: interviewer.creatorProfileImage }}
                        style={{ width: 36, height: 36, borderRadius: 18 }}
                      />
                    ) : (
                      <Avatar
                        name={interviewer.creatorName ?? '?'}
                        size={36}
                        bg={interviewer.isMine ? colors.accent : colors.ink3}
                        fg={colors.paper3}
                      />
                    )}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Body size="sm" weight="bold" color={colors.ink}>{interviewer.creatorName}</Body>
                        {interviewer.isMine && (
                          <View style={{
                            backgroundColor: colors.ink,
                            borderRadius: radius.pill,
                            paddingHorizontal: 6, paddingVertical: 1,
                          }}>
                            <Text style={{ fontFamily: fonts.monoMed, fontSize: 9, letterSpacing: 1.0, color: colors.paper3 }}>
                              YOU
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={{
                        fontFamily: fonts.mono,
                        fontSize: 10, color: colors.ink3,
                        marginTop: 2, letterSpacing: 0.4,
                      }}>
                        {timeAgo(interviewer.interviewedAt)} ·{' '}
                        <Text style={{ color: isRejected ? colors.danger : colors.ink2 }}>
                          {interviewer.submissionStatus}
                        </Text>
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Card>

        {/* Notes */}
        <Card large style={{ marginHorizontal: 20, marginTop: 12, padding: 16 }}>
          <Label tracking={1.6} style={{ marginBottom: 12 }}>NOTES ({notes.length})</Label>

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 14 }}>
            <View style={{
              flex: 1,
              backgroundColor: colors.paper3,
              borderColor: colors.rule, borderWidth: 1,
              borderRadius: radius.sm,
              paddingHorizontal: 12,
            }}>
              <TextInput
                value={noteContent}
                onChangeText={setNoteContent}
                placeholder="Add a note about this lead…"
                placeholderTextColor={colors.ink3}
                multiline
                style={{
                  paddingVertical: 10,
                  fontFamily: fonts.sans,
                  fontSize: 14, color: colors.ink,
                  minHeight: 42, maxHeight: 100,
                }}
              />
            </View>
            <TouchableOpacity
              onPress={handleAddNote}
              disabled={!noteContent.trim() || postingNote}
              style={{
                width: 42, height: 42, borderRadius: radius.sm,
                backgroundColor: noteContent.trim() ? colors.ink : colors.paper2,
                alignItems: 'center', justifyContent: 'center',
              }}
              accessibilityLabel="Save note"
              accessibilityRole="button"
            >
              {postingNote ? (
                <ActivityIndicator size="small" color={colors.paper3} />
              ) : (
                <Ionicons name="arrow-up" size={18} color={noteContent.trim() ? colors.paper3 : colors.ink3} />
              )}
            </TouchableOpacity>
          </View>

          {notes.length === 0 ? (
            <Text style={{ fontFamily: fonts.serifIt, fontSize: 14, color: colors.ink3 }}>
              No notes yet.
            </Text>
          ) : (
            <View style={{ gap: 8 }}>
              {notes.map((note: any) => (
                <View key={note._id} style={{
                  backgroundColor: colors.paper2,
                  borderRadius: radius.sm,
                  padding: 12,
                }}>
                  <Body size="sm" color={colors.ink}>{note.content}</Body>
                  <Text style={{
                    fontFamily: fonts.mono,
                    fontSize: 10, color: colors.ink3,
                    marginTop: 6, letterSpacing: 0.4,
                  }}>
                    {timeAgo(note.createdAt)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
