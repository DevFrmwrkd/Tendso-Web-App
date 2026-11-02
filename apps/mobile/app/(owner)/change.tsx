/** Ask for a change: one free-text request to the team (ownerApp.requestChange → admin queue). */
import React, { useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, ScreenShell, Text } from '../../components/v2';
import { Field } from '../../components/v2/owner/OwnerUI';
import { useRequestChange } from '../../lib/v2/ownerData';
import { STEP_ROUTE } from '../../lib/v2/ownerFlow';
import { useOwnerScope } from '../../lib/v2/useOwnerScope';
import { space } from '../../theme/v2';

export default function AskChange() {
  const scope = useOwnerScope();
  return <ChangeForm key={scope.scopeKey} scope={scope} />;
}
function ChangeForm({ scope }: { scope: ReturnType<typeof useOwnerScope> }) {
  const router = useRouter();
  const { id } = scope;
  const request = useRequestChange();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const allowed = !!id && !!scope.site && scope.site.phase !== 'draft' && !scope.isOffline;

  const send = async () => {
    if (!id || !allowed || !text.trim() || inFlight.current || !scope.isCurrent()) return;
    inFlight.current = true;
    Keyboard.dismiss();
    setBusy(true);
    setError(null);
    try {
      await request({ submissionId: id, text: text.trim() });
      if (scope.isCurrent()) router.replace(STEP_ROUTE.building as never);
    } catch (e: any) {
      if (scope.isCurrent()) setError(typeof e?.data === 'string' ? e.data : e?.message ?? 'Please try again.');
    } finally {
      inFlight.current = false;
      if (scope.isCurrent()) setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenShell
        title="What should we change?"
        onBack={() => { if (!inFlight.current) { Keyboard.dismiss(); router.back(); } }}
        footer={<Button title="Send" onPress={send} loading={busy} disabled={!allowed || !text.trim()} />}
      >
        <View style={{ gap: space.lg }}>
          <Field label="Tell us in your own words" value={text} onChangeText={setText} multiline maxLength={1000} autoFocus editable={!busy} />
          {scope.isOffline ? <Text tone="muted">Reconnect to send your change.</Text> : null}
          {error ? <Text tone="danger">{error}</Text> : null}
        </View>
      </ScreenShell>
    </KeyboardAvoidingView>
  );
}
