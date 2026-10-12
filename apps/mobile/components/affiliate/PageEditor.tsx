import React, { useCallback, useRef, useState } from 'react';
import { Image, TextInput, View } from 'react-native';
import { useAction, useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { api } from '@tendso/convex-client';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { BASE_PRICE, PRICE_CEILING, COMMISSION_RATE, WEBSITE_PRICE, clampSellPrice, formatPHP } from '../../../../packages/shared/pricing';
import { AFFILIATE_MESSAGE_MAX_LENGTH, affiliatePhotoError } from '../../../../lib/affiliates';
import { Body, Card, Display, Door, Label } from '../ui/primitives';
import { PriceSlider } from '../PriceSlider';
import { AffiliateAccess, AffiliateFrame, Notice, type AffiliateAccessProps, styles } from './Screen';
import { affiliateDraft, affiliateName, affiliatePagePayload, type AffiliateDraft } from './model';
import { OfferPreview } from './Offer';
import { ShareTools } from './ShareTools';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
type PagePayload = ReturnType<typeof affiliatePagePayload>;

export function AffiliatePageScreen() {
  return <AffiliateAccess>{(props) => props.isPreview || props.account.status !== 'active' || !props.isAuthenticated
    ? <PageEditorContent {...props} /> : <LivePageEditor {...props} />}</AffiliateAccess>;
}

function LivePageEditor(props: AffiliateAccessProps) {
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
  return <PageEditorContent {...props} onSave={(payload) => save(payload)} onPhoto={uploadPhoto} />;
}

export function PageEditorContent({ account, isPreview, isOffline, onSave, onPhoto }: AffiliateAccessProps & { onSave?: (payload: PagePayload) => Promise<unknown>; onPhoto?: () => Promise<string | undefined> }) {
  const incoming = affiliateDraft(account);
  const incomingKey = JSON.stringify(incoming);
  const [seen, setSeen] = useState(incomingKey);
  const [draft, setDraft] = useState<AffiliateDraft>(() => incoming);
  const [baseline, setBaseline] = useState<AffiliateDraft>(() => incoming);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
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
  const defaultName = [account.firstName, account.lastName].filter(Boolean).join(' ') || 'Your Tendso affiliate';
  const changePrice = useCallback((value: number) => {
    if (priceInput.current === String(value)) return;
    priceInput.current = String(value);
    setDraft((current) => current.price === String(value) ? current : { ...current, price: String(value) });
    setSaved(false); setError('');
  }, []);
  function change(patch: Partial<AffiliateDraft>) { setDraft((current) => ({ ...current, ...patch })); setSaved(false); setError(''); }
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
  return <AffiliateFrame title="My page" sub="Personalize your page, choose your price, and share your offer." preview={isPreview} suspended={account.status !== 'active'} offline={isOffline}>
    <Card style={{ gap: 16 }}>
      <Display size="sm">Your page details</Display>
      {draft.photo ? <Image source={{ uri: draft.photo }} accessibilityLabel="Your page photo" style={{ width: 80, height: 80, borderRadius: 40 }} /> : null}
      <Door label={draft.photo ? 'Change page photo' : 'Choose page photo'} variant="ghost" disabled={locked || !onPhoto} loading={uploading} onPress={choosePhoto} />
      {draft.photo ? <Door label="Remove page photo" variant="ghost" disabled={locked} onPress={() => change({ photo: '' })} /> : null}
      <Label>Display name</Label><TextInput accessibilityLabel="Display name" value={draft.displayName} placeholder={defaultName} maxLength={100} editable={!locked} style={styles.input} onChangeText={(displayName) => change({ displayName })} />
      <Label>Short message</Label><TextInput accessibilityLabel="Short message" value={draft.message} placeholder="A personal message for shop owners" maxLength={AFFILIATE_MESSAGE_MAX_LENGTH} multiline editable={!locked} style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]} onChangeText={(message) => change({ message })} />
      <Body size="xs">{draft.message.length}/{AFFILIATE_MESSAGE_MAX_LENGTH} characters</Body>
      <Label>Facebook or Messenger link</Label><TextInput accessibilityLabel="Facebook or Messenger link" value={draft.socialLink} placeholder="https://m.me/yourname" autoCapitalize="none" autoCorrect={false} keyboardType="url" maxLength={2048} editable={!locked} style={styles.input} onChangeText={(socialLink) => change({ socialLink })} />
      <Body size="sm">Optional. Use a Facebook, Messenger, or m.me link starting with https://.</Body>
      <Body size="sm">Page handle: @{account.affiliateHandle || 'unavailable'}. Your handle stays the same.</Body>
    </Card>
    <Card style={{ gap: 14 }}><Display size="sm">Your website price</Display><Body size="sm">Choose {formatPHP(BASE_PRICE)}–{formatPHP(PRICE_CEILING)}. Changes apply to future orders.</Body>
      <TextInput accessibilityLabel="Website price in pesos" value={draft.price} keyboardType="number-pad" maxLength={9} editable={!locked} style={styles.input} onChangeText={(priceValue) => change({ price: priceValue })} onBlur={() => { if (draft.price.trim() && Number.isFinite(Number(draft.price))) change({ price: String(clampSellPrice(Number(draft.price))) }); }} />
      <PriceSlider floor={BASE_PRICE} ceiling={PRICE_CEILING} anchor={WEBSITE_PRICE} commissionRate={COMMISSION_RATE} step={1} initialValue={price} disabled={locked} onChange={changePrice} />
    </Card>
    {error ? <Notice error>{error}</Notice> : null}
    <Door label="Save page and price" disabled={locked || !dirty} loading={saving} onPress={save} />
    <Body testID="affiliate-save-status" size="sm">{saved && !dirty ? 'Page and price saved.' : dirty ? 'Unsaved changes. Sharing still uses your saved offer.' : ''}</Body>
    <View style={{ gap: 10 }}><Label>Page preview{dirty ? ' · Unsaved changes' : ''}</Label><OfferPreview photo={draft.photo} displayName={draft.displayName.trim() || defaultName} message={draft.message.trim()} socialLink={draft.socialLink} price={price} commission /></View>
    {account.affiliateHandle ? <ShareTools handle={account.affiliateHandle} displayName={baseline.displayName.trim() || affiliateName(account)} price={Number(baseline.price)} disabled={isPreview || account.status !== 'active'} /> : <Notice>Your page handle is unavailable. Contact Tendso support for help.</Notice>}
  </AffiliateFrame>;
}
