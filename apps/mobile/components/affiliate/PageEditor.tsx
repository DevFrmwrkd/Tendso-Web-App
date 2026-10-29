import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAction, useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { api } from '@tendso/convex-client';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { BASE_PRICE, PRICE_CEILING, COMMISSION_RATE, WEBSITE_PRICE, clampSellPrice, commissionFor, formatPHP } from '../../../../packages/shared/pricing';
import { AFFILIATE_MESSAGE_MAX_LENGTH, AFFILIATE_SOCIAL_LABELS, AFFILIATE_SOCIAL_PLATFORMS, affiliatePhotoError, type AffiliateSocialLinks, type AffiliateSocialPlatform } from '../../../../lib/affiliates';
import { Avatar, Button, Card, Field, SectionLabel, Text, ToggleRow } from '../v2';
import { colors, radius, space } from '../../theme/v2';
import { PriceSlider } from '../PriceSlider';
import { AffiliateAccess, Notice, type AffiliateAccessProps } from './Screen';
import { AffiliateToolFrame } from './AffiliateToolFrame';
import { affiliateDraft, affiliateName, affiliatePagePayload, type AffiliateDraft } from './model';
import { OfferPreview } from './Offer';
import { ShareTools } from './ShareTools';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
type PagePayload = ReturnType<typeof affiliatePagePayload>;
type EditorMode = 'all' | 'page';
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
  }} onPhoto={uploadPhoto} />;
}

export function PageEditorContent({ account, isPreview, isOffline, onSave, onPhoto, mode = 'all' }: AffiliateAccessProps & { onSave?: (payload: PagePayload) => Promise<unknown>; onPhoto?: () => Promise<string | undefined>; mode?: EditorMode }) {
  const incoming = affiliateDraft(account);
  const incomingKey = JSON.stringify(incoming);
  const [seen, setSeen] = useState(incomingKey);
  const [draft, setDraft] = useState<AffiliateDraft>(() => incoming);
  const [baseline, setBaseline] = useState<AffiliateDraft>(() => incoming);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  // "What shows" switches: a field is shown when it has a value or its switch was turned on. Turning a switch off
  // clears the field (the value is kept here, so turning it back on restores it).
  const [switchedOn, setSwitchedOn] = useState({ photo: false, message: false, socialLinks: false });
  const stash = useRef({ photo: '', message: '' });
  const socialStash = useRef<AffiliateSocialLinks>({});
  const priceInput = useRef(draft.price);
  priceInput.current = draft.price;
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  // Refresh clean settings from a subscription without erasing an in-progress edit.
  if (seen !== incomingKey) {
    setSeen(incomingKey); setBaseline(incoming);
    if (!dirty) setDraft(incoming);
  }
  const disabled = isPreview || isOffline || account.status !== 'active' || !onSave;
  const locked = disabled || saving || uploading;
  const price = draft.price.trim() && Number.isFinite(Number(draft.price)) ? clampSellPrice(Number(draft.price)) : Number(baseline.price);
  const defaultName = [account.firstName, account.lastName].filter(Boolean).join(' ') || 'Your Tendso creator';
  const changePrice = useCallback((value: number) => {
    if (priceInput.current === String(value)) return;
    priceInput.current = String(value);
    setDraft((current) => current.price === String(value) ? current : { ...current, price: String(value) });
    setSaved(false); setError('');
  }, []);
  function change(patch: Partial<AffiliateDraft>) { setDraft((current) => ({ ...current, ...patch })); setSaved(false); setError(''); }
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
    try { payload = affiliatePagePayload(draft); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Check your page details.'); return; }
    setSaving(true); setError('');
    try {
      await onSave(payload);
      const next = { ...payload, price: String(payload.price) };
      setDraft(next); setBaseline(next); setSaved(true);
    } catch (problem) {
      setError(problem instanceof ConvexError && typeof problem.data === 'string' ? problem.data : 'Your page was not saved. Please try again.');
    } finally { setSaving(false); }
  }
  const keep = commissionFor(price);
  const saves = Math.max(0, WEBSITE_PRICE - price);
  const status = saved && !dirty ? (mode === 'page' ? 'Page saved.' : 'Page and price saved.') : dirty ? 'Unsaved changes. Sharing still uses your saved offer.' : '';
  const previewName = draft.displayName.trim() || defaultName;
  return <AffiliateToolFrame avoidKeyboard
    title={mode === 'page' ? 'Edit your page' : 'My page'}
    preview={isPreview}
    suspended={account.status !== 'active'}
    offline={isOffline}
    footer={<>
      {status ? <Text testID="affiliate-save-status" variant="label" tone="muted" align="center">{status}</Text> : null}
      <Button title={mode === 'page' ? 'Save page' : 'Save page and price'} disabled={locked || !dirty} loading={saving} onPress={save} />
    </>}
  >
    {mode === 'page' ? <Text variant="title" accessibilityRole="header">Make it yours.</Text> : <SectionLabel>What shows on your page</SectionLabel>}
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

    {mode === 'all' ? <><SectionLabel>Your website price</SectionLabel>
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
    </Card></> : null}

    {error ? <Notice error>{error}</Notice> : null}

    {mode === 'all' ? <><SectionLabel>{dirty ? 'What shop owners see · Unsaved changes' : 'What shop owners see'}</SectionLabel>
    <OfferPreview photo={shows('photo') ? draft.photo : undefined} displayName={previewName} message={shows('message') ? draft.message.trim() : undefined} socialLinks={showsSocialLinks ? draft.socialLinks : {}} socialDisabled={isPreview || account.status !== 'active'} price={price} code={account.referralCode} />

    {account.affiliateHandle ? <ShareTools handle={account.affiliateHandle} displayName={baseline.displayName.trim() || affiliateName(account)} price={Number(baseline.price)} disabled={isPreview || account.status !== 'active'} /> : <Notice tone="warn">Your page handle is unavailable. Contact Tendso support for help.</Notice>}</> : null}
  </AffiliateToolFrame>;
}

const styles = StyleSheet.create({
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  photoButton: { flex: 1 },
  handle: { paddingHorizontal: space.xs },
  socialFields: { gap: space.lg },
  priceCard: { gap: space.lg },
  tiles: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, minWidth: 0, borderRadius: radius.field, padding: space.md, backgroundColor: colors.bg },
  tileKeep: { backgroundColor: colors.accentSoft },
});
