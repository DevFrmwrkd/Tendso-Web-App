import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { ConvexError } from 'convex/values';
import { api, type Id } from '@tendso/convex-client';
import { Button, Card, Field, Text } from '../v2';
import { space } from '../../theme/v2';
import { creatorCodeError, normalizeCreatorCode } from '../../../../lib/creatorCodes';
import { CreatorCodeConfirmation } from './CreatorCodeConfirmation';

type SetupProps = { accountId: Id<'creators'>; savedCode?: string; offline: boolean };

/** A code lookup failure leaves the rest of the profile editor available. */
export function CreatorCodeEditor(props: SetupProps) {
  return <CodeSetupBoundary key={props.accountId} offline={props.offline}><CodeSetupReader {...props} /></CodeSetupBoundary>;
}

class CodeSetupBoundary extends React.Component<{ children: React.ReactNode; offline: boolean }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <Card variant="lg" style={styles.card}>
      <Text variant="heading">Your creator code</Text>
      <Text variant="body" tone="muted">Could not load your code setup. Try again when connected.</Text>
      <Button title="Retry code setup" variant="ghost" size="md" disabled={this.props.offline} onPress={() => this.setState({ failed: false })} />
    </Card> : this.props.children;
  }
}

/** Setup eligibility comes from the server; a chosen code never mounts editable controls. */
function CodeSetupReader({ accountId, savedCode, offline }: SetupProps) {
  const setup = useQuery(api.creatorProgram.codeSetup, {});
  const [confirmed, setConfirmed] = useState<{ accountId: Id<'creators'>; code: string } | null>(null);
  if (confirmed?.accountId === accountId) return <LockedCode code={confirmed.code} />;
  if (setup?.creatorId !== accountId) return <Card variant="lg" style={styles.card}>
    <Text variant="heading">Your creator code</Text>
    <Text variant="body" tone="muted">{offline ? 'Connect to finish setting up your code.' : 'Loading code setup…'}</Text>
  </Card>;
  if (!setup.canChoose) return <LockedCode code={setup.code ?? savedCode} />;
  return <ChooseCode key={accountId} savedCode={setup.code ?? savedCode} offline={offline} onChosen={code => setConfirmed({ accountId, code })} />;
}

function LockedCode({ code }: { code?: string }) {
  return <Card variant="lg" style={styles.card}>
    <Text variant="heading" accessibilityRole="header">Your creator code</Text>
    <Text variant="title" selectable>{code || 'Not set'}</Text>
    <Text variant="body" tone="muted">Your code is set. It can’t be changed.</Text>
    <Text variant="label" tone="muted">Shop owners get 30% off with this code. Previously shared codes still work.</Text>
  </Card>;
}

function ChooseCode({ savedCode, offline, onChosen }: { savedCode?: string; offline: boolean; onChosen: (code: string) => void }) {
  const [draft, setDraft] = useState(savedCode ?? '');
  const [baseline, setBaseline] = useState(savedCode ?? '');
  const [seen, setSeen] = useState(savedCode);
  const [checkedValue, setCheckedValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [choice, setChoice] = useState<{ code: string } | null>(null);
  const activeChoice = useRef<typeof choice>(null);
  const pendingCode = choice?.code;
  const inFlight = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; activeChoice.current = null; }; }, []);
  if (seen !== savedCode) {
    setSeen(savedCode);
    activeChoice.current = null;
    setBaseline(savedCode ?? '');
    if (draft.trim() === baseline) setDraft(savedCode ?? '');
  }
  const candidate = normalizeCreatorCode(draft);
  const localError = creatorCodeError(candidate);
  const valid = !localError;
  useEffect(() => {
    const timer = setTimeout(() => setCheckedValue(candidate), 350);
    return () => clearTimeout(timer);
  }, [candidate]);
  const availability = useQuery(api.creatorProgram.checkCodeAvailability,
    !offline && valid && checkedValue === candidate ? { code: candidate } : 'skip');
  const update = useMutation(api.creatorProgram.updateCode);
  const confirmed = !offline && valid && checkedValue === candidate && availability?.value === candidate;
  const available = confirmed && availability.available;
  const currentChoice = useRef({ candidate, available });
  currentChoice.current = { candidate, available };
  const formatError = candidate && localError ? localError : '';
  const availabilityError = confirmed && !availability.available ? availability.error || 'That code is already taken. Choose another one.' : '';
  const status = error || formatError || availabilityError || (valid ? offline ? 'Connect to check availability.' : available ? 'Available' : 'Checking availability…' : '');
  const failed = !!(error || formatError || availabilityError);

  function requestConfirmation() {
    if (!alive.current || inFlight.current || saving || !currentChoice.current.available) return;
    Keyboard.dismiss();
    const next = { code: candidate };
    activeChoice.current = next;
    setError(''); setChoice(next);
  }

  async function save() {
    const chosen = pendingCode;
    if (!alive.current || inFlight.current || saving || !choice || activeChoice.current !== choice || !chosen || chosen !== currentChoice.current.candidate || !currentChoice.current.available) return;
    inFlight.current = true;
    setSaving(true); setError('');
    try {
      const result = await update({ code: chosen });
      if (!alive.current) return;
      onChosen(result.code);
    } catch (problem) {
      if (alive.current) setError(problem instanceof ConvexError && typeof problem.data === 'string'
        ? problem.data : 'Your code was not set. Check availability and try again.');
    } finally { inFlight.current = false; if (alive.current) setSaving(false); }
  }

  return <><Card variant="lg" style={styles.card}>
    <View style={styles.heading}>
      <Text variant="heading" accessibilityRole="header">Choose your creator code</Text>
      <Text variant="body" tone="muted">Make it easy to remember, like MIKA30. Every creator code gives the same 30% off.</Text>
      <Text variant="label" weight="bold">Choose carefully. You can’t change this code after confirming.</Text>
    </View>
    <Text variant="label" tone="muted">Current code: {savedCode || 'Not set'}</Text>
    <Field label="Creator code" value={draft} placeholder="MIKA30" autoCapitalize="characters" autoCorrect={false}
      maxLength={16} editable={!saving && !offline} returnKeyType="done" onSubmitEditing={requestConfirmation}
      onChangeText={value => { activeChoice.current = null; setDraft(value.toUpperCase()); setError(''); }}
      helper="4–16 letters and numbers. Each code belongs to one creator." />
    {status ? <Text testID="creator-code-status" variant="label" tone={failed ? 'danger' : 'muted'} accessibilityRole={failed ? 'alert' : undefined} accessibilityLiveRegion="polite">{status}</Text> : null}
    <Button title="Set my code" variant="dark" size="md" disabled={saving || !available} loading={saving} onPress={requestConfirmation} />
    <Text variant="label" tone="muted">This is a one-time setup. Previously shared codes still work. Your page link, past sales and commissions stay the same.</Text>
  </Card><CreatorCodeConfirmation visible={!!pendingCode} code={pendingCode ?? ''} busy={saving}
    disabled={!available || pendingCode !== candidate} error={error || (pendingCode !== candidate ? 'Your code changed. Keep editing and review the new code.' : availabilityError || (offline ? 'Connect before confirming your code.' : undefined))}
    onConfirm={save} onCancel={() => { if (!inFlight.current) { activeChoice.current = null; setChoice(null); } }} /></>;
}

const styles = StyleSheet.create({ card: { gap: space.lg }, heading: { gap: space.sm } });
