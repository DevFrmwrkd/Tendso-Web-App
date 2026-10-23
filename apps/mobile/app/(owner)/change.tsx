/** Ask for a change: one free-text request to the team (ownerApp.requestChange → admin queue). */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, ScreenShell, Text } from '../../components/v2';
import { Field } from '../../components/v2/owner/OwnerUI';
import { useRequestChange } from '../../lib/v2/ownerData';
import { STEP_ROUTE } from '../../lib/v2/ownerFlow';
import { useOwnerSite } from '../../lib/v2/useOwnerSite';
import { space } from '../../theme/v2';

export default function AskChange() {
  const router = useRouter();
  const { id } = useOwnerSite();
  const request = useRequestChange();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await request({ submissionId: id, text: text.trim() });
      router.replace(STEP_ROUTE.building as never);
    } catch (e: any) {
      setError(e?.data ?? e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenShell
        title="What should we change?"
        onBack={() => router.back()}
        footer={<Button title="Send" onPress={send} loading={busy} disabled={!text.trim()} />}
      >
        <View style={{ gap: space.lg }}>
          <Field label="Tell us in your own words" value={text} onChangeText={setText} multiline maxLength={1000} autoFocus />
          {error ? <Text tone="danger">{error}</Text> : null}
        </View>
      </ScreenShell>
    </KeyboardAvoidingView>
  );
}
