import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ConvexError } from 'convex/values';
import { Avatar, Button, Card, Field, Text, TextLink } from '..';
import { peso } from '../../../lib/v2/ownerContent';
import { useApplyOwnerCreatorCode } from '../../../lib/v2/ownerData';
import type { OwnerCreatorCodeState, SubmissionId } from '../../../lib/v2/ownerTypes';
import { space } from '../../../theme/v2';

export function OwnerCreatorCode({ id, state, isCurrent, onBusyChange }: {
  id: SubmissionId; state: OwnerCreatorCodeState | undefined; isCurrent: () => boolean; onBusyChange: (busy: boolean) => void;
}) {
  const apply = useApplyOwnerCreatorCode();
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const current = () => mounted.current && isCurrent();
  const save = async (value: string | null) => {
    if (saving.current || !state?.editable || !current() || (value !== null && !value.trim())) return;
    saving.current = true; setBusy(true); setError(''); onBusyChange(true);
    try {
      await apply({ submissionId: id, code: value?.trim().toUpperCase() ?? null });
      if (current()) { setEditing(false); setCode(''); }
    } catch (cause) {
      if (current()) setError(cause instanceof ConvexError && typeof cause.data === 'string' ? cause.data : 'Could not apply this code. Please check it and try again.');
    } finally {
      saving.current = false;
      if (current()) { setBusy(false); onBusyChange(false); }
    }
  };
  return <Card style={styles.card}>
    {state === undefined ? <Text tone="muted">Checking creator code…</Text> : <>
      <View style={styles.row}>
        {state.applied ? <Avatar name={state.applied.name} uri={state.applied.photo ?? undefined} size={52} /> : null}
        <View style={styles.flex}>
          <Text weight="bold">{state.applied ? `${state.applied.name}’s code` : 'Have a creator code?'}</Text>
          {state.applied ? <Text variant="label" tone="muted">{state.applied.code ?? state.applied.handle} · {state.applied.saving > 0 ? `You save ${peso(state.applied.saving)}` : 'Code applied'}</Text> : null}
        </View>
        {state.editable && !editing ? <TextLink label={state.applied ? 'Change code' : 'Add code'} disabled={busy}
          onPress={() => { setCode(state.applied?.code ?? ''); setEditing(true); setError(''); }} /> : null}
      </View>
      {editing && state.editable ? <>
        <Field label="Creator code" value={code} onChangeText={value => { setCode(value); setError(''); }}
          placeholder="Enter their code" autoCapitalize="characters" autoCorrect={false} maxLength={32} editable={!busy} />
        <Button title="Apply code" size="md" onPress={() => { void save(code); }} loading={busy} disabled={!code.trim()} />
        <View style={styles.actions}>
          {state.applied ? <TextLink label="Remove code" disabled={busy} onPress={() => { void save(null); }} /> : null}
          <TextLink label="Cancel" disabled={busy} onPress={() => { setEditing(false); setError(''); }} />
        </View>
      </> : null}
      {!state.editable && state.reason ? <Text variant="label" tone="muted">{state.reason}</Text> : null}
      {error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
    </>}
  </Card>;
}
const styles = StyleSheet.create({
  card: { gap: space.md, marginTop: space.lg }, row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, minWidth: 0, gap: space.xs }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xl },
});
