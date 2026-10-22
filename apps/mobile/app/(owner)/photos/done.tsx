/** Photos taken: a calm grid, add your own extras, then pick a design. */
import React from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, ScreenShell, Text } from '../../../components/v2';
import { useOwnerSubmission } from '../../../lib/v2/ownerData';
import { useOwnerIntake } from '../../../lib/v2/ownerIntake';
import { MIN_PHOTOS_TO_SEND, STEP_ROUTE } from '../../../lib/v2/ownerFlow';
import { MAX_EXTRAS, pickFromLibrary, useSaveOwnerPhoto } from '../../../lib/v2/ownerPhotos';
import { useUploadQueue } from '../../../lib/v2/uploadQueue';
import { useOwnerSite } from '../../../lib/v2/useOwnerSite';
import { colors, space } from '../../../theme/v2';

export default function PhotosDone() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const intake = useOwnerIntake();
  const { id } = useOwnerSite();
  const sub = useOwnerSubmission(id);
  const save = useSaveOwnerPhoto();
  const q = useUploadQueue();

  // What to show: local photos (instant) merged with what the server has.
  const guided = new Map<number, string>();
  sub?.shots.filter((s) => !s.extra).forEach((s) => guided.set(s.index, s.url));
  intake.shots?.forEach((uri, i) => { if (uri) guided.set(i, uri); });
  const extras = (sub?.shots ?? []).filter((s) => s.extra).sort((a, b) => a.index - b.index).map((s) => s.url);
  const photos = [...[...guided.entries()].sort((a, b) => a[0] - b[0]).map(([, u]) => u), ...extras];
  const enough = photos.length >= MIN_PHOTOS_TO_SEND;

  const tile = (width - space.gutter * 2 - space.sm * 2) / 3;

  const addOwn = async () => {
    if (!id) return;
    const used = new Set((sub?.shots ?? []).filter((s) => s.extra).map((s) => s.index));
    const free = Array.from({ length: MAX_EXTRAS }, (_, i) => i).filter((i) => !used.has(i));
    const uris = await pickFromLibrary(free.length);
    uris.forEach((uri, k) => save(id, uri, { index: free[k], extra: true, label: 'Your photo' }));
  };

  return (
    <ScreenShell
      title={enough ? 'Nice photos.' : 'A few more photos.'}
      subtitle={q.pending > 0 ? 'Saving…' : `${photos.length} saved`}
      onBack={() => router.replace(STEP_ROUTE['photos-intro'] as never)}
      footer={
        <>
          <Button title="Next: pick a design" disabled={!enough} onPress={() => router.push(STEP_ROUTE.design as never)} />
          <Button title="Add your own photos" variant="ghost" onPress={addOwn} />
        </>
      }
    >
      <View style={styles.grid}>
        {photos.map((uri, i) => (
          <Image key={`${uri}-${i}`} source={{ uri }} style={{ width: tile, height: tile, borderRadius: 16, backgroundColor: colors.bg2 }} />
        ))}
      </View>
      {!enough ? (
        <Button title="Take more photos" variant="dark" style={{ marginTop: space.xl }} onPress={() => router.push(STEP_ROUTE.photos as never)} />
      ) : null}
      {q.failed > 0 ? <Text tone="danger" style={{ marginTop: space.lg }}>Some photos did not save. We try again when you go on.</Text> : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
