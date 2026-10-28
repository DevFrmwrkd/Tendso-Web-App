/**
 * Agents near you + "Book a visit". A visit is a request the team assigns (a lead), not a
 * calendar booking (FEATURES-QUESTIONS Q19). Agents are listed only in sample mode for now;
 * a real owner books a visit and the team picks the agent.
 */
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Chip, ScreenShell, Text } from '../../../components/v2';
import { Ionicons } from '@expo/vector-icons';
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
      subtitle="Get help making your shop’s website."
      insetBottom={false}
      footer={
        <Button
          title="Request a visit"
          onPress={() => router.push({ pathname: '/(owner)/agents/book', params: chosen ? { agent: chosen.name } : {} } as never)}
        />
      }
    >
      {agents.length === 0 ? (
        <Card style={styles.help}>
          <Image source={require('../../../assets/v2/owner/how-friend.jpg')} style={styles.hero} resizeMode="cover" />
          <Text variant="heading">We find a field agent for you</Text>
          <Text tone="ink2">They visit your shop, take photos and record your story with you.</Text>
          <View style={styles.fact}><Ionicons name="time-outline" size={24} color={colors.ink} /><Text style={{ flex: 1 }}>About 30 minutes at your shop</Text></View>
          <View style={styles.fact}><Ionicons name="call-outline" size={24} color={colors.ink} /><Text style={{ flex: 1 }}>The team calls to confirm a time</Text></View>
        </Card>
      ) : (
        <Chip label="Sample" tone="muted" style={{ marginBottom: space.md }} />
      )}
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
  help: { gap: space.md, marginBottom: space.md },
  hero: { width: '100%', height: 180, borderRadius: 16, backgroundColor: colors.bg2 },
  fact: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 80, padding: space.md, borderRadius: 22, backgroundColor: colors.card, borderWidth: 2, borderColor: 'transparent' },
  rowOn: { borderColor: colors.ink },
});
