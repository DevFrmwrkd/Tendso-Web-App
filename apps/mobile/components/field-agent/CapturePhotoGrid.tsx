import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Keyboard, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../v2/Button';
import { Field } from '../v2/Field';
import { Text } from '../v2/Text';
import { SwipeSheet } from '../ui/SwipeSheet';
import { colors, hit, radius, space } from '../../theme/v2';

export type CapturePhotoGridItem = { id: string; uri: string | null; label: string; missing?: boolean };
export type CapturePhotoGridProps = {
  items: CapturePhotoGridItem[];
  disabled?: boolean;
  suggestedLabels?: readonly string[];
  onPreview: (id: string) => void;
  onRetake: (id: string) => void;
  onReplace: (id: string) => void;
  onRename: (id: string, label: string) => void;
  onRemove: (ids: string[]) => void;
  onImageError?: (id: string, uri: string) => void;
};
type PhotoSheet = { id: string; mode: 'actions' | 'label' };
const labelText = (value: string) => value.replace(/\s+/g, ' ').trim().slice(0, 60);

/** Callback-only gallery. The capture screen owns media, persistence and account scope. */
export function CapturePhotoGrid(props: CapturePhotoGridProps) {
  const { items, disabled = false, suggestedLabels = [] } = props;
  const { height } = useWindowDimensions();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [sheet, setSheet] = useState<PhotoSheet | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [failedThumbnails, setFailedThumbnails] = useState<ReadonlySet<string>>(() => new Set());
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const mounted = useRef(true);
  const live = useRef(props);
  live.current = props;
  const itemIds = JSON.stringify(items.map(item => item.id));
  const itemFor = (id: string) => live.current.items.find(item => item.id === id);
  const available = (id: string) => mounted.current && !live.current.disabled && !!itemFor(id);
  const currentSelection = selected.filter(id => items.some(item => item.id === id));
  const activeItem = sheet ? items.find(item => item.id === sheet.id) : undefined;
  const activeIndex = activeItem ? items.findIndex(item => item.id === activeItem.id) : -1;
  const presets = [...new Set(suggestedLabels.map(labelText).filter(Boolean))].slice(0, 10);
  const maxSheetHeight = Math.max(160, Math.min(height * 0.74, height - keyboardHeight - 130));

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const validIds = new Set(items.map(item => item.id));
    setSelected(previous => previous.filter(id => validIds.has(id)));
    setSheet(previous => disabled || previous && !validIds.has(previous.id) ? null : previous);
    if (disabled || !items.length) { setSelecting(false); setSelected([]); }
  }, [itemIds, disabled]); // Labels/URLs may change without changing the selected photo's identity.
  useEffect(() => {
    const shown = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow', event => {
      setKeyboardHeight(Math.max(0, Math.min(height, event.endCoordinates.height)));
    });
    const hidden = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardHeight(0));
    return () => { shown.remove(); hidden.remove(); };
  }, [height]);

  const toggle = (id: string) => {
    if (!available(id)) return;
    setSelected(previous => previous.includes(id) ? previous.filter(candidate => candidate !== id) : [...previous, id]);
  };
  const openActions = (id: string) => { if (available(id)) setSheet({ id, mode: 'actions' }); };
  const editLabel = (id: string) => {
    if (!available(id)) return;
    setDraftLabel(itemFor(id)!.label.slice(0, 60));
    setSheet({ id, mode: 'label' });
  };
  const run = (id: string, action: 'onRetake' | 'onReplace') => {
    if (!available(id)) return;
    setSheet(null);
    live.current[action](id);
  };
  const remove = (ids: string[]) => {
    if (!mounted.current || live.current.disabled) return;
    const requested = [...new Set(ids)].filter(id => !!itemFor(id));
    if (!requested.length) return;
    const count = requested.length;
    Alert.alert(`Remove ${count === 1 ? 'this photo' : `${count} photos`}?`,
      'These photos will be removed from this capture. You can add them again before sending.', [
        { text: 'Cancel', style: 'cancel' },
        { text: count === 1 ? 'Remove photo' : `Remove ${count} photos`, style: 'destructive', onPress: () => {
          if (!mounted.current || live.current.disabled) return;
          const currentIds = requested.filter(id => !!itemFor(id));
          if (!currentIds.length) return;
          setSheet(null); setSelected([]); setSelecting(false);
          live.current.onRemove(currentIds);
        } },
      ]);
  };
  const saveLabel = () => {
    const value = labelText(draftLabel);
    if (!sheet || !value || !available(sheet.id)) return;
    live.current.onRename(sheet.id, value);
    setSheet(null);
  };
  const imageFailed = (id: string, uri: string) => {
    if (!mounted.current || itemFor(id)?.uri !== uri) return;
    setFailedThumbnails(previous => new Set([...previous, `${id}:${uri}`]));
    live.current.onImageError?.(id, uri);
  };
  const actionRows: { title: string; description: string; icon: React.ComponentProps<typeof Ionicons>['name']; action: () => void; danger?: boolean }[] = activeItem ? [
    { title: 'Retake photo', description: 'Take a new photo in its place', icon: 'camera-outline', action: () => run(activeItem.id, 'onRetake') },
    { title: 'Replace from library', description: 'Choose a photo from your device', icon: 'images-outline', action: () => run(activeItem.id, 'onReplace') },
    { title: 'Edit label', description: 'Describe what this photo shows', icon: 'create-outline', action: () => editLabel(activeItem.id) },
    { title: 'Remove photo', description: 'Remove it from this capture', icon: 'trash-outline', danger: true, action: () => remove([activeItem.id]) },
  ] : [];

  return <View style={styles.section} testID="capture-photo-grid">
    <View style={styles.headingRow}>
      <View style={styles.flex}><Text variant="heading" accessibilityRole="header">Your photos</Text>
        <Text variant="label" tone="muted">{items.length} {items.length === 1 ? 'photo' : 'photos'} added</Text></View>
      {!!items.length && <Pressable accessibilityRole="button" accessibilityLabel={selecting ? 'Done selecting photos' : 'Select photos'}
        disabled={disabled} accessibilityState={{ disabled }} onPress={() => {
          if (!mounted.current || live.current.disabled) return;
          setSelecting(value => !value); setSelected([]);
        }} style={[styles.textAction, disabled && styles.disabled]}><Text variant="label" weight="bold">{selecting ? 'Done' : 'Select'}</Text></Pressable>}
    </View>
    {selecting && <View style={styles.selectionBar} testID="capture-photo-selection-bar">
      <Text variant="label" weight="bold" style={styles.flex} accessibilityLiveRegion="polite">{currentSelection.length} selected</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={currentSelection.length === items.length ? 'Clear selection' : 'Select all photos'}
        accessibilityState={{ disabled }} disabled={disabled} style={styles.textAction} onPress={() => {
          if (!mounted.current || live.current.disabled) return;
          setSelected(currentSelection.length === live.current.items.length ? [] : live.current.items.map(item => item.id));
        }}><Text variant="label" weight="bold">{currentSelection.length === items.length ? 'Clear' : 'Select all'}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${currentSelection.length} selected photos`}
        accessibilityState={{ disabled: disabled || !currentSelection.length }} disabled={disabled || !currentSelection.length}
        onPress={() => remove(currentSelection)} style={[styles.removeSelection, (disabled || !currentSelection.length) && styles.disabled]}>
        <Ionicons name="trash-outline" size={22} color={colors.danger} />
      </Pressable>
    </View>}
    <View style={styles.grid}>
      {items.map((item, index) => {
        const chosen = currentSelection.includes(item.id);
        const failedKey = `${item.id}:${item.uri}`;
        const showImage = !!item.uri && !item.missing && !failedThumbnails.has(failedKey);
        return <View key={item.id} style={[styles.tile, chosen && styles.selectedTile]}>
          <View style={styles.photoFrame}>
            <Pressable accessibilityRole={selecting ? 'checkbox' : 'button'}
              accessibilityLabel={selecting ? `Select photo ${index + 1}: ${item.label}` : `View photo ${index + 1}: ${item.label}`}
              accessibilityHint={selecting ? 'Adds or removes this photo from the selection' : 'Opens the photo full screen'}
              accessibilityState={{ disabled, ...(selecting ? { checked: chosen } : {}) }} disabled={disabled}
              onPress={() => { if (!available(item.id)) return; if (selecting) toggle(item.id); else live.current.onPreview(item.id); }}
              onLongPress={() => { if (!available(item.id)) return; setSelecting(true); setSelected(previous => previous.includes(item.id) ? previous : [...previous, item.id]); }}
              style={styles.photoTarget}>
              {showImage ? <Image testID={`capture-photo-thumbnail-${item.id}`} source={{ uri: item.uri! }} style={StyleSheet.absoluteFill} resizeMode="cover" accessible={false}
                onError={() => imageFailed(item.id, item.uri!)} />
                : <View style={styles.unavailable}><Ionicons name="image-outline" size={30} color={colors.ink3Text} />
                  <Text variant="label" tone="muted" align="center">{item.missing ? 'Unavailable' : 'Tap to view'}</Text></View>}
              {selecting && <View style={[styles.selectionTick, chosen && styles.checked]} pointerEvents="none">
                {chosen && <Ionicons name="checkmark" size={20} color={colors.onAccent} />}
              </View>}
            </Pressable>
            {!selecting && <Pressable accessibilityRole="button" accessibilityLabel={`Photo ${index + 1} options`} accessibilityState={{ disabled }}
              disabled={disabled} onPress={() => openActions(item.id)} style={[styles.options, disabled && styles.disabled]}>
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.ink} />
            </Pressable>}
          </View>
          <View style={styles.caption}><Text variant="label" weight="bold">Photo {index + 1}</Text>
            <Text variant="label" tone="muted">{item.label || 'Added photo'}</Text></View>
        </View>;
      })}
    </View>
    {sheet && activeItem && <SwipeSheet visible onClose={() => setSheet(null)} testID="capture-photo-actions-sheet">
      <ScrollView style={{ maxHeight: maxSheetHeight }} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.sheetHeader}>
          <View style={styles.flex}><Text variant="title" accessibilityRole="header">{sheet.mode === 'label' ? 'Edit photo label' : `Photo ${activeIndex + 1}`}</Text>
            <Text tone="muted">{sheet.mode === 'label' ? `Photo ${activeIndex + 1} · Make it easy to recognise` : activeItem.label}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={sheet.mode === 'label' ? 'Cancel label editing' : 'Close photo options'}
            style={styles.close} onPress={() => setSheet(null)}><Ionicons name="close" size={23} color={colors.ink} /></Pressable>
        </View>
        {sheet.mode === 'label' ? <>
          {!!activeItem.uri && !activeItem.missing && !failedThumbnails.has(`${activeItem.id}:${activeItem.uri}`) && <Image source={{ uri: activeItem.uri }} style={styles.renamePreview} resizeMode="cover"
            accessibilityLabel={`Label preview for photo ${activeIndex + 1}`} onError={() => imageFailed(activeItem.id, activeItem.uri!)} />}
          <Field label="Photo label" value={draftLabel} onChangeText={setDraftLabel} maxLength={60} editable={!disabled}
            placeholder="For example, the shop entrance" helper={`${draftLabel.length}/60 characters`} returnKeyType="done" onSubmitEditing={saveLabel} />
          {!!presets.length && <View style={styles.presetSection}><Text variant="label" tone="muted">Or use a suggestion</Text><View style={styles.presets}>
            {presets.map(label => <Pressable key={label} accessibilityRole="button" accessibilityLabel={`Use label: ${label}`} disabled={disabled}
              accessibilityState={{ disabled, selected: labelText(draftLabel) === label }} onPress={() => { if (available(activeItem.id)) setDraftLabel(label); }}
              style={[styles.preset, labelText(draftLabel) === label && styles.presetSelected]}><Text variant="label" style={styles.presetText}>{label}</Text></Pressable>)}
          </View></View>}
          <Button title="Save label" onPress={saveLabel} disabled={disabled || !labelText(draftLabel)} />
        </> : <View style={styles.actionList}>{actionRows.map((row, index) => <Pressable key={row.title} accessibilityRole="button" accessibilityLabel={row.title}
          disabled={disabled} accessibilityState={{ disabled }} onPress={row.action} style={[styles.actionRow, index === actionRows.length - 1 && styles.lastAction]}>
          <View style={[styles.actionIcon, row.danger && styles.dangerIcon]}><Ionicons name={row.icon} size={23} color={row.danger ? colors.danger : colors.ink} /></View>
          <View style={styles.flex}><Text weight="bold" tone={row.danger ? 'danger' : 'ink'}>{row.title}</Text><Text variant="label" tone="muted">{row.description}</Text></View>
          {!row.danger && <Ionicons name="chevron-forward" size={19} color={colors.ink3Text} />}
        </Pressable>)}</View>}
      </ScrollView>
    </SwipeSheet>}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: space.lg }, flex: { flex: 1, minWidth: 0 }, headingRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  textAction: { minHeight: hit.min, justifyContent: 'center', paddingHorizontal: space.md }, disabled: { opacity: 0.45 },
  selectionBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, paddingLeft: space.lg, backgroundColor: colors.accentSoft, borderRadius: radius.field },
  removeSelection: { width: hit.min, height: hit.min, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.card },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, alignItems: 'stretch' },
  tile: { width: '48%', flexGrow: 1, flexBasis: '45%', maxWidth: '49%', borderRadius: radius.field, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 2, borderColor: 'transparent' },
  selectedTile: { borderColor: colors.ink }, photoFrame: { aspectRatio: 4 / 3, backgroundColor: colors.bg2, position: 'relative' },
  photoTarget: { flex: 1, overflow: 'hidden' }, unavailable: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xs, padding: space.sm },
  options: { position: 'absolute', right: space.xs, top: space.xs, width: hit.min, height: hit.min, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  selectionTick: { position: 'absolute', right: space.sm, top: space.sm, width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: colors.card, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: colors.accent, borderColor: colors.ink }, caption: { gap: space.xs, padding: space.md, flexGrow: 1 },
  sheetContent: { gap: space.lg, paddingBottom: space.sm }, sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  close: { width: hit.min, height: hit.min, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg2 },
  actionList: { backgroundColor: colors.card, borderRadius: radius.card, paddingHorizontal: space.md },
  actionRow: { flexDirection: 'row', gap: space.md, alignItems: 'center', paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: colors.rule }, lastAction: { borderBottomWidth: 0 },
  actionIcon: { width: hit.min, height: hit.min, borderRadius: radius.field, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg2 }, dangerIcon: { backgroundColor: colors.dangerBg },
  renamePreview: { width: '100%', height: 116, borderRadius: radius.field, backgroundColor: colors.bg2 },
  presetSection: { gap: space.sm }, presets: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  preset: { minHeight: hit.min, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.ruleStrong, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: colors.card },
  presetSelected: { borderColor: colors.ink, backgroundColor: colors.accentSoft },
  presetText: { flexShrink: 1 },
});
