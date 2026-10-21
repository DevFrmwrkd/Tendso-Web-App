/**
 * Agents near you + "Book a visit". A visit is a request the team assigns (a lead), not a
 * calendar booking (FEATURES-QUESTIONS Q19). The list is SAMPLE until the backend lists agents.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Chip, ScreenShell, Text } from '../../../components/v2';
import { Face, Tick } from '../../../components/v2/owner/OwnerUI';
import { useAgentsNear } from '../../../lib/v2/ownerData';
import { colors, shadow, space } from '../../../theme/v2';

export default function Agents() {
  const router = useRouter();
  const agents = useAgentsNear();
  const [pick, setPick] = useState(agents[0]?.id);
  const chosen = agents.find((a) => a.id === pick);

  return (
    <ScreenShell
      title="Agents near you"
      footer={
        <Button
          title="Book a visit"
          onPress={() => router.push({ pathname: '/(owner)/agents/book', params: chosen ? { agent: chosen.name } : {} } as never)}
        />
      }
    >
      <Chip label="Sample" tone="muted" style={{ marginBottom: space.md }} />
      <View style={{ gap: space.md }} accessibilityRole="radiogroup">
        {agents.map((a) => {
          const on = a.id === pick;
          return (
            <Pressable
              key={a.id}
              onPress={() => setPick(a.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${a.name}, ${a.distance}, ${a.note}`}
              style={[styles.row, shadow.soft, on && styles.rowOn]}
            >
              <Face source={a.face.source} aspect={a.face.aspect} fx={a.face.fx} fy={a.face.fy} zoom={a.face.zoom} size={56} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text weight="bold" numberOfLines={1}>{a.name}</Text>
                <Text variant="label" tone="muted" numberOfLines={1}>{a.distance}</Text>
              </View>
              {on ? <Tick /> : null}
            </Pressable>
          );
        })}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 80, padding: space.md, borderRadius: 22, backgroundColor: colors.card, borderWidth: 2, borderColor: 'transparent' },
  rowOn: { borderColor: colors.ink },
});
