import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { ConvexError } from 'convex/values';
import { api } from '@tendso/convex-client';
import { Button, Card, Field, Text } from '../v2';
import { space } from '../../theme/v2';
import { creatorCodeError, normalizeCreatorCode } from '../../../../lib/creatorCodes';

/** Mounted only for a verified, active creator. Saved account data drives previews and posters. */
export function CreatorCodeEditor({ savedCode, offline }: { savedCode?: string; offline: boolean }) {
  const [draft, setDraft] = useState(savedCode ?? '');
  const [baseline, setBaseline] = useState(savedCode ?? '');
  const [seen, setSeen] = useState(savedCode);
  const [checkedValue, setCheckedValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  if (seen !== savedCode) {
    setSeen(savedCode);
    setBaseline(savedCode ?? '');
    if (draft.trim() === baseline) setDraft(savedCode ?? '');
  }
  const candidate = normalizeCreatorCode(draft);
  const dirty = candidate !== baseline;
  const localError = creatorCodeError(candidate);
  const valid = !localError;
  useEffect(() => {
    const timer = setTimeout(() => setCheckedValue(candidate), 350);
    return () => clearTimeout(timer);
  }, [candidate]);
  const availability = useQuery(api.creatorProgram.checkCodeAvailability,
    !offline && dirty && valid && checkedValue === candidate ? { code: candidate } : 'skip');
  const update = useMutation(api.creatorProgram.updateCode);
  const confirmed = !offline && dirty && valid && checkedValue === candidate && availability?.value === candidate;
  const available = confirmed && availability.available;
  const formatError = dirty && localError ? localError : '';
  const availabilityError = confirmed && !availability.available ? availability.error || 'That code is already taken. Choose another one.' : '';
  const status = error || formatError || availabilityError || (saved && !dirty ? 'Code saved.'
    : dirty && valid ? offline ? 'Connect to check availability.' : available ? 'Available' : 'Checking availability…' : '');
  const failed = !!(error || formatError || availabilityError);

  async function save() {
    if (saving || !available) return;
    Keyboard.dismiss();
    setSaving(true); setError(''); setSaved(false);
    try {
      const result = await update({ code: candidate });
      if (!alive.current) return;
      setDraft(result.code); setBaseline(result.code); setSaved(true);
    } catch (problem) {
      if (alive.current) setError(problem instanceof ConvexError && typeof problem.data === 'string'
        ? problem.data : 'Your code was not saved. Check availability and try again.');
    } finally { if (alive.current) setSaving(false); }
  }

  return <Card variant="lg" style={styles.card}>
    <View style={styles.heading}>
      <Text variant="heading" accessibilityRole="header">Choose your creator code</Text>
      <Text variant="body" tone="muted">Make it easy to remember, like MIKA30. Every creator code gives the same 30% off.</Text>
    </View>
    <Text variant="label" tone="muted">Current code: {savedCode || 'Not set'}</Text>
    <Field label="Creator code" value={draft} placeholder="MIKA30" autoCapitalize="characters" autoCorrect={false}
      maxLength={16} editable={!saving && !offline} returnKeyType="done" onSubmitEditing={save}
      onChangeText={value => { setDraft(value.toUpperCase()); setError(''); setSaved(false); }}
      helper="4–16 letters and numbers. Each code belongs to one creator." />
    {status ? <Text testID="creator-code-status" variant="label" tone={failed ? 'danger' : 'muted'} accessibilityRole={failed ? 'alert' : undefined} accessibilityLiveRegion="polite">{status}</Text> : null}
    <Button title="Save code" variant="dark" size="md" disabled={saving || !available} loading={saving} onPress={save} />
    <Text variant="label" tone="muted">Previously shared codes still work. Your page link, past sales and commissions stay the same.</Text>
  </Card>;
}

const styles = StyleSheet.create({ card: { gap: space.lg }, heading: { gap: space.sm } });
