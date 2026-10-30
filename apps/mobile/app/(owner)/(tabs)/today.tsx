import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, ListRow, ScreenShell, Text } from '../../../components/v2';
import { Buddy, SiteFrame } from '../../../components/v2/owner/OwnerUI';
import { useOwnerSubmission, usePreview } from '../../../lib/v2/ownerData';
import { phaseLine, resumeStep, STEP_ROUTE, todayAction } from '../../../lib/v2/ownerFlow';
import { firstName, greeting, useOwnerSite } from '../../../lib/v2/useOwnerSite';
import { hostOf } from '../../../lib/v2/ownerContent';
import { colors, shadow, space } from '../../../theme/v2';

export default function Today() {
  const router = useRouter();
  const { me, site, id } = useOwnerSite();
  const preview = usePreview(site && site.phase !== 'draft' && site.phase !== 'building' ? id : null);
  const draft = useOwnerSubmission(site?.phase === 'draft' ? id : null);
  const name = firstName(me);
  const phase = site?.phase ?? null;
  const action = todayAction(phase, site);
  const step = phase === 'draft' ? resumeStep('draft', draft ? {
    businessName: draft.businessName, businessType: draft.businessType,
    answered: draft.interview.filter(answer => answer.mediaUrl || answer.answerText?.trim()).map(answer => answer.index),
    photos: draft.shots.length, templateId: draft.templateId,
  } : null) : action.step === 'home' ? null : action.step;
  const go = () => {
    if (phase === 'in_review' || phase === 'rejected' || phase === 'offline') router.push('/(owner)/(tabs)/agents' as never);
    else if (step) router.push(STEP_ROUTE[step] as never);
  };
  const siteUri = preview?.publishedUrl ?? (preview?.ready ? preview.htmlUrl : null);
  const live = phase === 'live';
  const hasAddress = !!(preview?.publishedUrl || site?.publishedUrl);
  const draftTasks = [
    { label: 'Name and place', complete: !!draft?.businessName && !!draft.address, route: STEP_ROUTE.place },
    { label: 'Answer 10 questions', complete: (draft?.interview.filter(answer => answer.index < 10 && (answer.mediaUrl || answer.answerText?.trim())).length ?? 0) >= 10, route: STEP_ROUTE['talk-intro'] },
    { label: 'Add shop photos', complete: (draft?.shots.length ?? 0) >= 3, route: STEP_ROUTE['photos-intro'] },
    { label: 'Choose a design', complete: !!draft?.templateId, route: STEP_ROUTE.design },
  ];
  return <ScreenShell title={name ? `${greeting()}, ${name}` : greeting()} insetBottom={false} contentStyle={styles.content}
    headerRight={<Pressable onPress={() => router.push('/(owner)/me/inbox' as never)} accessibilityRole="button" accessibilityLabel="Open owner inbox" style={styles.bell}>
      <Ionicons name="notifications-outline" size={24} color={colors.ink} /></Pressable>}
    footer={<Button title={action.label} onPress={go} />}>
    {site ? <>
      <Pressable onPress={() => router.push('/(owner)/(tabs)/site' as never)} accessibilityRole="button"
        accessibilityLabel={`${site.businessName}, ${phaseLine(phase)}`} style={[styles.card, shadow.soft]}>
        <View style={styles.thumb}>{siteUri || preview?.inlineHtml ? <SiteFrame uri={siteUri} html={preview?.inlineHtml} interactive={false}
          scale={96 / 390} width={96} height={128} style={{ borderRadius: 14 }} /> : <Buddy size={72} />}</View>
        <View style={styles.flex}><View style={styles.status}><View style={[styles.dot, live && styles.dotLive]} /><Text variant="label" weight="bold">{phaseLine(phase)}</Text></View>
          <Text variant="heading">{site.businessName}</Text>
          {site.publishedUrl ? <Text variant="label" tone="muted">{hostOf(site.publishedUrl)}</Text> : null}</View>
      </Pressable>
      {phase === 'draft' ? <><Text variant="heading">Finish your site</Text><Card style={styles.list}>{draftTasks.map((task, index) =>
        <ListRow key={task.label} title={task.label} divider={index < draftTasks.length - 1} onPress={() => router.push(task.route as never)}
          leading={<View style={[styles.check, task.complete && styles.checked]}>{task.complete ? <Ionicons name="checkmark" size={20} color={colors.ink} /> : null}</View>} />)}</Card></> : null}
      {live ? <><Text variant="heading">Make it better</Text><Card style={styles.list}>
        <ListRow title="Publish your site" subtitle="Your website is live" leading={<View style={[styles.check, styles.checked]}><Ionicons name="checkmark" size={20} color={colors.ink} /></View>} divider />
        <ListRow title="Share your site" subtitle="Link and counter QR" icon="share-social-outline" divider onPress={() => router.push(STEP_ROUTE.live as never)} />
        <ListRow title="Ask for a change" icon="create-outline" divider onPress={() => router.push(STEP_ROUTE.change as never)} />
        {hasAddress ? <ListRow title="Get a custom web address" subtitle="Optional · the team sets it up" icon="globe-outline" onPress={() => router.push(STEP_ROUTE.live as never)} /> : null}
      </Card></> : null}
      <Text variant="heading">Your site</Text><Card style={styles.list}>
        <ListRow title="View your website" icon="phone-portrait-outline" divider onPress={() => router.push('/(owner)/(tabs)/site' as never)} />
        <ListRow title={site.paidInFull ? 'Paid in full' : site.balanceDue > 0 ? 'Payment remaining' : 'Payment details'}
          subtitle={site.paidInFull ? 'Website and hosting included' : 'See your payment details'} icon="wallet-outline"
          onPress={site.balanceDue > 0 ? () => router.push(STEP_ROUTE.pay as never) : undefined} />
      </Card>
    </> : <View style={styles.empty}><Buddy size={140} /><Text variant="bodyLg" tone="ink2" align="center">Your website, made from your phone.</Text></View>}
  </ScreenShell>;
}
const styles = StyleSheet.create({ content: { gap: space.lg }, flex: { flex: 1, minWidth: 0, gap: 6 },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: 24, backgroundColor: colors.card },
  thumb: { width: 96, height: 128, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 }, dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink3, borderWidth: 1.5, borderColor: colors.ink },
  dotLive: { backgroundColor: colors.accent }, empty: { alignItems: 'center', gap: space.lg, marginTop: space.xxl }, list: { paddingVertical: space.xs },
  check: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: colors.rule, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: colors.accent, borderColor: colors.accent }, bell: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' } });
