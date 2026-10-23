/** Today: hello, your site, and the ONE next thing to do (mock owner board "home"). */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, ScreenShell, Text } from '../../../components/v2';
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
  const step =
    phase === 'draft'
      ? resumeStep('draft', draft ? {
          businessName: draft.businessName,
          businessType: draft.businessType,
          answered: draft.interview.filter((a) => a.mediaUrl || a.answerText?.trim()).map((a) => a.index),
          photos: draft.shots.length,
          templateId: draft.templateId,
        } : null)
      : action.step === 'home'
        ? null
        : action.step;
  const go = () => {
    if (phase === 'in_review' || phase === 'rejected' || phase === 'offline') router.push('/(owner)/(tabs)/agents' as never);
    else if (step) router.push(STEP_ROUTE[step] as never);
  };
  const siteUri = preview?.publishedUrl ?? (preview?.ready ? preview.htmlUrl : null);

  return (
    <ScreenShell
      title={name ? `${greeting()}, ${name}` : greeting()}
      footer={<Button title={action.label} onPress={go} />}
    >
      {site ? (
        <Pressable onPress={() => router.push('/(owner)/(tabs)/site' as never)} accessibilityRole="button" accessibilityLabel={`${site.businessName}, ${phaseLine(phase)}`} style={[styles.card, shadow.soft]}>
          <View style={styles.thumb}>
            {siteUri || preview?.inlineHtml ? (
              <SiteFrame uri={siteUri} html={preview?.inlineHtml} interactive={false} scale={96 / 390} width={96} height={128} style={{ borderRadius: 14 }} />
            ) : (
              <Buddy size={72} />
            )}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={styles.status}>
              <View style={[styles.dot, phase === 'live' && { backgroundColor: colors.accent }]} />
              <Text variant="label" weight="bold">{phaseLine(phase)}</Text>
            </View>
            <Text variant="heading" numberOfLines={2}>{site.businessName}</Text>
            {site.publishedUrl ? <Text variant="label" tone="muted" numberOfLines={1}>{hostOf(site.publishedUrl)}</Text> : null}
          </View>
        </Pressable>
      ) : (
        <View style={styles.empty}>
          <Buddy size={140} />
          <Text variant="bodyLg" tone="ink2" align="center">Your website, made from your phone.</Text>
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: 24, backgroundColor: colors.card },
  thumb: { width: 96, height: 128, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink3, borderWidth: 1.5, borderColor: colors.ink },
  empty: { alignItems: 'center', gap: space.lg, marginTop: space.xxl },
});
