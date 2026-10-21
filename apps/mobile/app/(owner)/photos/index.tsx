/** Photos start (mock `shotList`, SIMPLE-FLOWS C3): "10 photos. We show you what to take." */
import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, ScreenShell, Text } from '../../../components/v2';
import { Buddy } from '../../../components/v2/owner/OwnerUI';
import { STEP_ROUTE } from '../../../lib/v2/ownerFlow';
import { MAX_EXTRAS, pickFromLibrary, useSaveOwnerPhoto } from '../../../lib/v2/ownerPhotos';
import { useOwnerSite } from '../../../lib/v2/useOwnerSite';
import { useOwnerSubmission } from '../../../lib/v2/ownerData';
import { space } from '../../../theme/v2';

export default function PhotosIntro() {
  const router = useRouter();
  const { id } = useOwnerSite();
  const sub = useOwnerSubmission(id);
  const save = useSaveOwnerPhoto();

  const fromPhone = async () => {
    if (!id) return;
    const used = new Set((sub?.shots ?? []).filter((s) => s.extra).map((s) => s.index));
    const free = Array.from({ length: MAX_EXTRAS }, (_, i) => i).filter((i) => !used.has(i));
    const uris = await pickFromLibrary(free.length);
    uris.forEach((uri, k) => save(id, uri, { index: free[k], extra: true, label: 'Your photo' }));
    if (uris.length) router.push(STEP_ROUTE['photos-done'] as never);
  };

  return (
    <ScreenShell
      onBack={() => router.back()}
      scroll={false}
      footer={
        <>
          <Button title="Start" onPress={() => router.push(STEP_ROUTE.photos as never)} />
          <Pressable onPress={fromPhone} accessibilityRole="button" hitSlop={8} style={{ minHeight: 48, justifyContent: 'center' }}>
            <Text weight="bold" align="center">Add from my phone</Text>
          </Pressable>
        </>
      }
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
        <Buddy size={168} />
        <Text variant="display" align="center" accessibilityRole="header">10 photos.</Text>
        <Text variant="bodyLg" tone="ink2" align="center">We show you what to take.</Text>
      </View>
    </ScreenShell>
  );
}
