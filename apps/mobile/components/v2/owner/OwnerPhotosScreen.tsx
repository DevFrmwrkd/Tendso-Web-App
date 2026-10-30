import React, { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, ScreenShell, Text } from '..';
import { OwnerMediaPreview } from './OwnerMediaPreview';
import { shotList } from '../../../lib/v2/captureContent';
import { sellKind, sellKindFromServer } from '../../../lib/v2/ownerContent';
import { useOwnerSubmission } from '../../../lib/v2/ownerData';
import { useOwnerIntake } from '../../../lib/v2/ownerIntake';
import { ownerPhotosFor, type OwnerPhotoItem } from '../../../lib/v2/ownerMedia';
import { MIN_PHOTOS_TO_SEND, STEP_ROUTE } from '../../../lib/v2/ownerFlow';
import { MAX_EXTRAS, pickFromLibrary, useSaveOwnerPhoto } from '../../../lib/v2/ownerPhotos';
import { useUploadQueue } from '../../../lib/v2/uploadQueue';
import { useOwnerScope } from '../../../lib/v2/useOwnerScope';
import { colors, radius, space } from '../../../theme/v2';

export function OwnerPhotosScreen({ summary = false }: { summary?: boolean }) {
  const scope = useOwnerScope();
  return <Photos key={scope.scopeKey} scope={scope} summary={summary} />;
}
function Photos({ scope, summary }: { scope: ReturnType<typeof useOwnerScope>; summary: boolean }) {
  const router = useRouter();
  const intake = useOwnerIntake();
  const sub = useOwnerSubmission(scope.id);
  const save = useSaveOwnerPhoto();
  const queue = useUploadQueue();
  const photos = ownerPhotosFor(scope.id, sub, intake);
  const kind = sellKind(intake.kind) ?? sellKindFromServer(sub?.businessType, sub?.shotListKey);
  const tasks = shotList(kind.shots);
  const extras = photos.filter(photo => photo.extra);
  const enough = photos.length >= MIN_PHOTOS_TO_SEND;
  const readOnly = !!scope.site && scope.site.phase !== 'draft';
  const [preview, setPreview] = useState<OwnerPhotoItem | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pickingNow = useRef(false);
  const shoot = (index?: number) => {
    if (!scope.id || !scope.isCurrent() || pickingNow.current || readOnly) return;
    setPreview(null);
    router.push(index === undefined ? STEP_ROUTE.photos as never
      : { pathname: '/(owner)/photos/shoot', params: { shot: String(index) } } as never);
  };
  const addOwn = async () => {
    if (!scope.id || !scope.isCurrent() || pickingNow.current || readOnly) return;
    const free = Array.from({ length: MAX_EXTRAS }, (_, index) => index).filter(index => !extras.some(photo => photo.index === index));
    if (!free.length) return;
    pickingNow.current = true; setPicking(true); setError(null);
    try {
      const uris = await pickFromLibrary(free.length);
      if (!scope.isDraftCurrent()) return;
      uris.slice(0, free.length).forEach((uri, index) => save(scope.id!, uri, { index: free[index], extra: true, label: 'Your photo' }));
    } catch { if (scope.isCurrent()) setError('Could not open your photos. Please try again.'); }
    finally { pickingNow.current = false; if (scope.isCurrent()) setPicking(false); }
  };
  const next = () => {
    if (!scope.isCurrent() || pickingNow.current) return;
    if (readOnly) router.replace('/(owner)/(tabs)/site' as never);
    else if (summary && enough) router.push(STEP_ROUTE.design as never);
    else if (!summary && photos.length) router.push(STEP_ROUTE['photos-done'] as never);
    else shoot();
  };
  return <ScreenShell title={summary ? 'Your photos' : 'Show us your shop'}
    subtitle={summary ? `${photos.length} photos · tap a photo to see it` : '10 photo ideas for your shop. Add at least 3.'}
    progress={0.5} onBack={() => { if (!pickingNow.current) summary ? router.replace(STEP_ROUTE['photos-intro'] as never) : router.back(); }}
    contentStyle={styles.content} footer={<>
      <Button title={readOnly ? 'Back to my site' : summary && enough ? 'Next: pick a design' : !summary && photos.length ? 'Review photos' : 'Start'} onPress={next} disabled={!scope.id || picking} />
      {!readOnly ? <Button title="Add from my phone" variant="ghost" onPress={() => { void addOwn(); }} loading={picking} disabled={!scope.id || extras.length >= MAX_EXTRAS} /> : null}
    </>}>
    {queue.pending > 0 ? <Text variant="label" tone="muted">Saving your photos…</Text> : null}
    {queue.failed > 0 ? <Text tone="danger">Some photos have not uploaded. We retry before sending your site.</Text> : null}
    {error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
    {summary ? <View style={styles.grid}>{photos.map(photo => <PhotoTile key={photo.key} photo={photo} onPress={() => setPreview(photo)} />)}</View> : null}
    <Card style={styles.taskList}>
      {tasks.map((task, index) => {
        const photo = photos.find(item => !item.extra && item.index === index);
        return <View key={task.t} style={[styles.task, index > 0 && styles.rule]}>
          <Pressable accessibilityRole="button" accessibilityLabel={photo ? `View ${task.t} photo` : `Take ${task.t} photo`}
            onPress={() => photo ? setPreview({ ...photo, label: task.t }) : shoot(index)} disabled={picking || (readOnly && !photo)} style={styles.taskMain}>
            {photo ? <Image source={{ uri: photo.uri }} style={styles.thumb} />
              : <View style={styles.number}><Text weight="bold">{index + 1}</Text></View>}
            <View style={styles.flex}><Text weight="bold">{task.t}</Text><Text tone="muted">{task.h}</Text></View>
            {!photo ? <Ionicons name="camera-outline" size={22} color={colors.ink} /> : null}
          </Pressable>
          {photo && !readOnly ? <Pressable accessibilityRole="button" accessibilityLabel={`Retake ${task.t}`} onPress={() => shoot(index)} disabled={picking} style={styles.retake}>
            <Ionicons name="refresh-outline" size={20} color={colors.ink} /></Pressable> : null}
        </View>;
      })}
    </Card>
    {!summary && extras.length ? <><Text variant="heading">Your own photos</Text><View style={styles.grid}>
      {extras.map(photo => <PhotoTile key={photo.key} photo={photo} onPress={() => setPreview(photo)} />)}</View></> : null}
    {preview ? <OwnerMediaPreview key={`${preview.key}:${preview.uri}`} uri={preview.uri} kind="image" label={preview.label} onClose={() => setPreview(null)} /> : null}
  </ScreenShell>;
}
function PhotoTile({ photo, onPress }: { photo: OwnerPhotoItem; onPress: () => void }) {
  const [failed, setFailed] = useState(false);
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`View ${photo.label}`} style={styles.tile}>
    {failed ? <View style={styles.fallback}><Ionicons name="image-outline" size={28} color={colors.ink3Text} /></View>
      : <Image source={{ uri: photo.uri }} onError={() => setFailed(true)} style={StyleSheet.absoluteFill} resizeMode="cover" />}
  </Pressable>;
}
const styles = StyleSheet.create({ content: { gap: space.md }, flex: { flex: 1, minWidth: 0 }, taskList: { paddingVertical: 0 },
  task: { flexDirection: 'row', alignItems: 'center' }, taskMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minHeight: 80 },
  rule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rule },
  number: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.bg2, justifyContent: 'center', alignItems: 'center' },
  thumb: { width: 48, height: 64, borderRadius: 12, backgroundColor: colors.bg2 }, retake: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }, tile: { width: '30%', aspectRatio: 1, borderRadius: radius.field, overflow: 'hidden', backgroundColor: colors.bg2 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
