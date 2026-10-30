import React, { useCallback, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { useAction, useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { api } from '@tendso/convex-client';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { BASE_PRICE, PRICE_CEILING, COMMISSION_RATE, WEBSITE_PRICE, clampSellPrice, commissionFor, formatPHP } from '../../../../packages/shared/pricing';
import { AFFILIATE_MESSAGE_MAX_LENGTH, AFFILIATE_SOCIAL_LABELS, AFFILIATE_SOCIAL_PLATFORMS, affiliatePhotoError, type AffiliateSocialLinks, type AffiliateSocialPlatform } from '../../../../lib/affiliates';
import { createCreatorPageCard, creatorPageDraftsEqual } from '../../../../lib/v2/creatorPageEditor';
import { Avatar, Button, Card, Field, SectionLabel, Text, ToggleRow } from '../v2';
import { colors, radius, space } from '../../theme/v2';
import { PriceSlider } from '../PriceSlider';
import { AffiliateAccess, Notice, type AffiliateAccessProps } from './Screen';
import { AffiliateToolFrame } from './AffiliateToolFrame';
import { affiliateDraft, affiliateName, affiliatePagePayload, type AffiliateDraft } from './model';
import { ShareTools } from './ShareTools';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
type PagePayload = ReturnType<typeof affiliatePagePayload>;
type EditorMode = 'all' | 'page';
type EditorSection = 'page' | 'offer' | 'sharing';
const SOCIAL_PLACEHOLDERS: Record<AffiliateSocialPlatform, string> = {
  messenger: 'https://m.me/yourname',
  facebook: 'https://www.facebook.com/yourname',
  instagram: 'https://www.instagram.com/yourname',
  tiktok: 'https://www.tiktok.com/@yourname',
  youtube: 'https://www.youtube.com/@yourname',
};

/** Kept for existing imports; pushed page routes use the focused editor below. */
export function AffiliatePageScreen() {
  return <EditorScreen mode="all" />;
}

export function AffiliatePageEditorScreen() {
  return <EditorScreen mode="page" />;
}

function EditorScreen({ mode }: { mode: EditorMode }) {
  return <AffiliateAccess>{(props) => props.isPreview || props.account.status !== 'active' || !props.isAuthenticated
    ? <PageEditorContent {...props} mode={mode} /> : <LivePageEditor {...props} mode={mode} />}</AffiliateAccess>;
}

function LivePageEditor(props: AffiliateAccessProps & { mode: EditorMode }) {
  const save = useMutation(api.affiliates.updatePage);
  const generateUploadUrl = useAction(api.r2.generateUploadUrl);
  async function uploadPhoto(): Promise<string | undefined> {
    if (props.isOffline || props.account.status !== 'active') return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error('Allow access to your photos to choose a page photo.');
    const selection = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (selection.canceled || !selection.assets[0]) return;
    const asset = selection.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_PHOTO_BYTES) throw new Error('Choose a photo up to 5 MB.');
    // Re-encode HEIC and cropped images as actual JPEG bytes for the public page.
    const image = await ImageManipulator.manipulate(asset.uri).resize({ width: 768 }).renderAsync();
    const output = await image.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
    const imageResponse = await fetch(output.uri);
    const blob = await imageResponse.blob();
    if (!blob.size || blob.size > MAX_PHOTO_BYTES) throw new Error('Choose a photo up to 5 MB that contains an image.');
    const { uploadUrl, publicUrl } = await generateUploadUrl({ fileName: `affiliate-${props.account._id}.jpg`, fileType: 'image/jpeg', mediaType: 'avatar' });
    const upload = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
    if (!upload.ok || affiliatePhotoError(publicUrl)) throw new Error('Your photo did not upload. Please try again.');
    return publicUrl;
  }
  return <PageEditorContent {...props} onSave={(payload) => {
    // Page edits never overwrite a separately saved price.
    const { price, ...page } = payload;
    return save(props.mode === 'page' ? page : payload);
  }} onSavePrice={price => save({ price })} onPhoto={uploadPhoto} />;
}

export function PageEditorContent({ account, isPreview, isOffline, onSave, onSavePrice, onPhoto, mode = 'all' }: AffiliateAccessProps & { onSave?: (payload: PagePayload) => Promise<unknown>; onSavePrice?: (price: number) => Promise<unknown>; onPhoto?: () => Promise<string | undefined>; mode?: EditorMode }) {
  const incoming = affiliateDraft(account);
  const incomingKey = JSON.stringify(incoming);
  const [seen, setSeen] = useState(incomingKey);
  const [draft, setDraft] = useState<AffiliateDraft>(() => incoming);
  const [baseline, setBaseline] = useState<AffiliateDraft>(() => incoming);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [priceError, setPriceError] = useState('');
  const [saved, setSaved] = useState(false);
  const [priceSaved, setPriceSaved] = useState(false);
  const [section, setSection] = useState<EditorSection>('page');
  const [editorView, setEditorView] = useState<'edit' | 'preview'>('edit');
  // "What shows" switches: a field is shown when it has a value or its switch was turned on. Turning a switch off
  // clears the field (the value is kept here, so turning it back on restores it).
  const [switchedOn, setSwitchedOn] = useState({ photo: false, message: false, socialLinks: false });
  const stash = useRef({ photo: '', message: '' });
  const socialStash = useRef<AffiliateSocialLinks>({});
  const priceInput = useRef(draft.price);
  priceInput.current = draft.price;
  const pageDirty = !creatorPageDraftsEqual(draft, baseline);
  const priceDirty = draft.price !== baseline.price;
  const dirty = mode === 'all' ? pageDirty || priceDirty : section === 'offer' ? priceDirty : pageDirty;
  // Refresh clean settings from a subscription without erasing an in-progress edit.
  if (seen !== incomingKey) {
    setSeen(incomingKey); setBaseline(incoming);
    if (mode === 'page') setDraft(current => ({ ...(pageDirty ? current : incoming), price: priceDirty ? current.price : incoming.price }));
    else if (!dirty) setDraft(incoming);
  }
  const disabled = isPreview || isOffline || account.status !== 'active' || !onSave;
  const locked = disabled || saving || uploading;
  const price = draft.price.trim() && Number.isFinite(Number(draft.price)) ? clampSellPrice(Number(draft.price)) : Number(baseline.price);
  const defaultName = [account.firstName, account.lastName].filter(Boolean).join(' ').trim() || (account.affiliateHandle ? `@${account.affiliateHandle}` : 'Tendso creator');
  const changePrice = useCallback((value: number) => {
    if (priceInput.current === String(value)) return;
    priceInput.current = String(value);
    setDraft((current) => current.price === String(value) ? current : { ...current, price: String(value) });
    setPriceSaved(false); setPriceError(''); if (mode === 'all') setError('');
  }, []);
  function change(patch: Partial<AffiliateDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    if (patch.price !== undefined) { setPriceSaved(false); setPriceError(''); if (mode === 'all') setError(''); }
    else { setSaved(false); setError(''); }
  }
  const shows = (key: 'photo' | 'message') => switchedOn[key] || !!draft[key];
  const showsSocialLinks = switchedOn.socialLinks || Object.values(draft.socialLinks).some(Boolean);
  function toggle(key: 'photo' | 'message', on: boolean) {
    setSwitchedOn((current) => ({ ...current, [key]: on }));
    if (on) { if (!draft[key] && stash.current[key]) change({ [key]: stash.current[key] } as Partial<AffiliateDraft>); }
    else { stash.current[key] = draft[key] || stash.current[key]; if (draft[key]) change({ [key]: '' } as Partial<AffiliateDraft>); }
  }
  function toggleSocialLinks(on: boolean) {
    setSwitchedOn(current => ({ ...current, socialLinks: on }));
    if (on) {
      if (!Object.values(draft.socialLinks).some(Boolean) && Object.keys(socialStash.current).length) change({ socialLinks: { ...socialStash.current } });
    } else {
      socialStash.current = { ...draft.socialLinks };
      if (Object.keys(draft.socialLinks).length) change({ socialLinks: {} });
    }
  }
  function changeSocialLink(platform: AffiliateSocialPlatform, value: string) {
    change({ socialLinks: { ...draft.socialLinks, [platform]: value } });
  }
  async function choosePhoto() {
    if (locked || !onPhoto) return;
    setUploading(true); setError('');
    try { const photo = await onPhoto(); if (photo) change({ photo }); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Your photo did not upload. Please try again.'); }
    finally { setUploading(false); }
  }
  async function save() {
    if (locked || !dirty || !onSave) return;
    let payload: PagePayload;
    try { payload = affiliatePagePayload(mode === 'page' ? { ...draft, price: baseline.price } : draft); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Check your page details.'); return; }
    setSaving(true); setError('');
    try {
      await onSave(payload);
      if (mode === 'page') {
        const { price: _price, ...page } = payload;
        setDraft(current => ({ ...current, ...page })); setBaseline(current => ({ ...current, ...page }));
      } else {
        const next = { ...payload, price: String(payload.price) };
        setDraft(next); setBaseline(next);
      }
      setSaved(true);
    } catch (problem) {
      setError(problem instanceof ConvexError && typeof problem.data === 'string' ? problem.data : 'Your page was not saved. Please try again.');
    } finally { setSaving(false); }
  }
  async function savePrice() {
    if (locked || !priceDirty || !onSavePrice) return;
    if (!draft.price.trim() || !Number.isFinite(Number(draft.price))) { setPriceError('Enter your website price in whole pesos.'); return; }
    setSaving(true); setPriceError('');
    try {
      await onSavePrice(price);
      setDraft(current => ({ ...current, price: String(price) })); setBaseline(current => ({ ...current, price: String(price) })); setPriceSaved(true);
    } catch (problem) {
      setPriceError(problem instanceof ConvexError && typeof problem.data === 'string' ? problem.data : 'Your price was not saved. Please try again.');
    } finally { setSaving(false); }
  }
  const keep = commissionFor(price);
  const saves = Math.max(0, WEBSITE_PRICE - price);
  const savingOffer = mode === 'page' && section === 'offer';
  const displayedError = savingOffer ? priceError : error;
  const status = savingOffer ? priceSaved && !priceDirty ? 'Price saved.' : priceDirty ? 'Unsaved price change.' : ''
    : saved && !pageDirty && (mode === 'page' || !priceDirty) ? (mode === 'page' ? 'Page saved.' : 'Page and price saved.') : dirty ? 'Unsaved changes.' : '';
  const previewName = draft.displayName.trim() || defaultName;
  const card = createCreatorPageCard(account, draft, price);
  // Keep the form's initial render light; the native WebView loads when Preview is opened.
  const PublicPreview = editorView === 'preview' ? require('./PublicPagePreview').AffiliatePublicPagePreview : null;
  function switchView(next: 'edit' | 'preview') { Keyboard.dismiss(); setEditorView(next); }
  const showPage = mode === 'all' || section === 'page';
  const showOffer = mode === 'all' || section === 'offer';
  return <AffiliateToolFrame avoidKeyboard
    title={mode === 'page' ? 'Edit your page' : 'My page'}
    preview={isPreview}
    suspended={account.status !== 'active'}
    offline={isOffline}
    floatingFooter={false}
    scroll={editorView !== 'preview'}
    footer={mode === 'page' && section === 'sharing' && editorView === 'edit' ? undefined : <View style={styles.saveSection}>
      {displayedError || status ? <Text testID="affiliate-save-status" variant="label" tone={displayedError ? 'danger' : 'muted'} align="center" accessibilityRole={displayedError ? 'alert' : undefined} accessibilityLiveRegion="polite">{displayedError || status}</Text> : null}
      <View style={styles.footerActions}>
        <Button title={editorView === 'preview' ? 'Edit' : 'Preview'} icon={editorView === 'preview' ? 'create-outline' : 'eye-outline'} variant="ghost" fullWidth={false} style={styles.footerAction} onPress={() => switchView(editorView === 'preview' ? 'edit' : 'preview')} />
        <Button title={savingOffer ? 'Save price' : mode === 'page' ? 'Save page' : 'Save page and price'} fullWidth={false} style={styles.footerAction} disabled={locked || !dirty || (savingOffer && !onSavePrice)} loading={saving} onPress={savingOffer ? savePrice : save} />
      </View>
    </View>}
  >
    <View style={styles.viewSwitch} accessibilityRole="tablist" accessibilityLabel="Page editor view">
      {(['edit', 'preview'] as const).map(view => <Pressable key={view} accessibilityRole="tab" accessibilityLabel={view === 'edit' ? 'Edit page details' : 'Preview public page'} accessibilityState={{ selected: editorView === view }} onPress={() => switchView(view)} style={[styles.viewTab, editorView === view && styles.viewTabSelected]}><Text variant="label" weight="bold" tone={editorView === view ? 'onDark' : 'ink'}>{view === 'edit' ? 'Edit' : 'Preview'}</Text></Pressable>)}
    </View>
    {editorView === 'preview' && PublicPreview ? <PublicPreview key={account._id} card={card} dirty={pageDirty || priceDirty} paused={account.status !== 'active'} offline={isOffline} sample={isPreview} /> : <>
    {mode === 'page' ? <><Text variant="body" tone="muted">Edit the page shop owners open from your link.</Text><View style={styles.sectionTabs} accessibilityRole="tablist" accessibilityLabel="Page settings">
      {([{ id: 'page', label: 'Page details' }, { id: 'offer', label: 'Your offer' }, { id: 'sharing', label: 'Sharing' }] as const).map(item => <Pressable key={item.id} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: section === item.id }} onPress={() => { Keyboard.dismiss(); setSection(item.id); }} style={[styles.sectionTab, section === item.id && styles.sectionTabSelected]}><Text variant="label" weight="semibold">{item.label}</Text></Pressable>)}
    </View></> : <SectionLabel>What shows on your page</SectionLabel>}
    <View style={[styles.panel, !showPage && styles.hidden]} accessibilityElementsHidden={!showPage} importantForAccessibility={showPage ? 'auto' : 'no-hide-descendants'}>
    <Field label="Display name" icon="person-outline" value={draft.displayName} placeholder={defaultName} maxLength={100} editable={!locked} helper="The name shown on your public page." onChangeText={(displayName) => change({ displayName })} />
    <ToggleRow title="Show my photo" subtitle={draft.photo ? 'Tap below to change it' : 'Add a photo of yourself'} value={shows('photo')} disabled={locked} onValueChange={(on) => toggle('photo', on)} />
    {shows('photo') ? <Card style={styles.photoRow}>
      <Avatar uri={draft.photo || undefined} name={previewName} size={64} />
      <View style={styles.photoButton}>
        <Button title={draft.photo ? 'Change page photo' : 'Choose page photo'} variant="ghost" size="md" disabled={locked || !onPhoto} loading={uploading} onPress={choosePhoto} />
      </View>
    </Card> : null}
    <ToggleRow title="Show a message" subtitle="Introduce yourself to visitors" value={shows('message')} disabled={locked} onValueChange={(on) => toggle('message', on)} />
    {shows('message') ? <Field label="Short message" multiline value={draft.message} placeholder="A short introduction or invitation" maxLength={AFFILIATE_MESSAGE_MAX_LENGTH} editable={!locked} helper={`${draft.message.length} / ${AFFILIATE_MESSAGE_MAX_LENGTH} characters`} onChangeText={(message) => change({ message })} /> : null}
    <ToggleRow title="Show social links" subtitle="Add the profiles you want visitors to find" value={showsSocialLinks} disabled={locked} onValueChange={toggleSocialLinks} />
    {showsSocialLinks ? <View style={styles.socialFields}>
      <Text variant="label" tone="muted">Choose any of these platforms. Leave the others blank.</Text>
      {AFFILIATE_SOCIAL_PLATFORMS.map(platform => <Field key={platform} label={`${AFFILIATE_SOCIAL_LABELS[platform]} link`} icon="link-outline" value={draft.socialLinks[platform] ?? ''} placeholder={SOCIAL_PLACEHOLDERS[platform]} autoCapitalize="none" autoCorrect={false} keyboardType="url" maxLength={2048} editable={!locked} helper="Optional · Starts with https://" onChangeText={value => changeSocialLink(platform, value)} />)}
    </View> : null}
    <Text variant="label" tone="muted" style={styles.handle}>Your page handle is @{account.affiliateHandle || 'unavailable'}. It stays the same.</Text>
    </View>

    <View style={[styles.panel, !showOffer && styles.hidden]} accessibilityElementsHidden={!showOffer} importantForAccessibility={showOffer ? 'auto' : 'no-hide-descendants'}><SectionLabel>Your website price</SectionLabel>
    <Card variant="lg" style={styles.priceCard}>
      <Field label="Website price in pesos" prefix="₱" value={draft.price} keyboardType="number-pad" maxLength={9} editable={!locked} helper={`Between ${formatPHP(BASE_PRICE)} and ${formatPHP(PRICE_CEILING)}. Applies to future orders.`} onChangeText={(priceValue) => change({ price: priceValue })} onBlur={() => { if (draft.price.trim() && Number.isFinite(Number(draft.price))) change({ price: String(clampSellPrice(Number(draft.price))) }); }} />
      <PriceSlider floor={BASE_PRICE} ceiling={PRICE_CEILING} anchor={WEBSITE_PRICE} commissionRate={COMMISSION_RATE} step={1} initialValue={price} disabled={locked} onChange={changePrice} showEarnings={false} />
      <View style={styles.tiles}>
        <View style={[styles.tile, styles.tileKeep]}>
          <Text variant="title" tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{formatPHP(keep)}</Text>
          <Text variant="label" tone="ink2">you keep</Text>
        </View>
        <View style={styles.tile}>
          <Text variant="title" tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{formatPHP(saves)}</Text>
          <Text variant="label" tone="ink2">the shop saves</Text>
        </View>
      </View>
    </Card></View>

    <View style={[styles.panel, mode === 'page' && section !== 'sharing' && styles.hidden]} accessibilityElementsHidden={mode === 'page' && section !== 'sharing'} importantForAccessibility={mode === 'page' && section !== 'sharing' ? 'no-hide-descendants' : 'auto'}>
    {pageDirty || priceDirty ? <Text variant="label" tone="muted">Sharing uses your saved page and price. Save each section before sharing new materials.</Text> : null}
    {account.affiliateHandle ? <ShareTools handle={account.affiliateHandle} displayName={baseline.displayName.trim() || affiliateName(account)} photo={baseline.photo} referralCode={account.referralCode} price={Number(baseline.price)} disabled={isPreview || isOffline || account.status !== 'active'} /> : <Notice tone="warn">Your page handle is unavailable. Contact Tendso support for help.</Notice>}
    </View>
    </>}
  </AffiliateToolFrame>;
}

const styles = StyleSheet.create({
  panel: { gap: space.lg },
  hidden: { display: 'none' },
  viewSwitch: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: radius.pill, backgroundColor: colors.card },
  viewTab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: space.md },
  viewTabSelected: { backgroundColor: colors.ink },
  sectionTabs: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: radius.field, backgroundColor: colors.card },
  sectionTab: { flex: 1, minHeight: 48, padding: space.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radius.field },
  sectionTabSelected: { backgroundColor: colors.bg2 },
  footerActions: { flexDirection: 'row', gap: space.sm },
  footerAction: { flex: 1 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  photoButton: { flex: 1 },
  handle: { paddingHorizontal: space.xs },
  socialFields: { gap: space.lg },
  saveSection: { gap: space.sm },
  priceCard: { gap: space.lg },
  tiles: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, minWidth: 0, borderRadius: radius.field, padding: space.md, backgroundColor: colors.bg },
  tileKeep: { backgroundColor: colors.accentSoft },
});
