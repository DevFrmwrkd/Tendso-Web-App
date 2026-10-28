/**
 * Small owner-app building blocks on top of components/v2 (mock app-kit.css + app/owner.css):
 * photo option rows, the two "how" cards, text fields, the buddy, an agent face, a site frame.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView, type WebViewProps } from 'react-native-webview';
import { colors, fonts, radius, shadow, space } from '../../../theme/v2';
import { Text } from '../Text';

// Fix the public generic WebView's props before NativeWind's JSX inference.
const SiteWebView: React.ComponentType<WebViewProps> = WebView;

/** Sample previews may scroll and follow section anchors, but never leave the document. */
export function isSamplePreviewNavigationAllowed(documentUri: string, requestedUri: string): boolean {
  try {
    const document = new URL(documentUri);
    const requested = new URL(requestedUri, documentUri);
    return /^https?:$/.test(document.protocol) && requested.origin === document.origin
      && requested.pathname === document.pathname && requested.search === document.search;
  } catch { return false; }
}

const SAMPLE_PREVIEW_SCRIPT = `
(function () {
  if (window.__tendsoSampleReadOnly) return;
  window.__tendsoSampleReadOnly = true;
  function block(event) { event.preventDefault(); event.stopImmediatePropagation(); }
  document.addEventListener('submit', block, true);
  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('a,button,input,select,textarea,[role="button"],[role="tab"]') : null;
    if (!target) return;
    if (target.tagName === 'A') {
      try {
        var next = new URL(target.getAttribute('href') || '', location.href);
        if (next.origin === location.origin && next.pathname === location.pathname && next.search === location.search && next.hash) return;
      } catch (_) {}
    }
    if (target.matches('button,[role="button"],[role="tab"]') && !target.closest('form') && !target.hasAttribute('form')
      && !target.hasAttribute('formaction') && target.getAttribute('type') !== 'submit') {
      var controlled = target.getAttribute('aria-controls');
      var disclosure = controlled && document.getElementById(controlled)
        && (target.hasAttribute('aria-expanded') || target.getAttribute('role') === 'tab');
      if (disclosure || target.matches('.nav-toggle,.nav-burger') || target.closest('.car-dots')) return;
    }
    block(event);
  }, true);
  window.open = function () { return null; };
  if (window.HTMLFormElement) {
    HTMLFormElement.prototype.submit = function () {};
    HTMLFormElement.prototype.requestSubmit = function () {};
  }
})(); true;
`;

export function Tick({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.tick, style]} accessibilityElementsHidden>
      <Ionicons name="checkmark" size={16} color={colors.onAccent} />
    </View>
  );
}

/** One answer with a photo (mock `.a-opt`). Selected = ink border + tick. */
export function OptionRow({
  label,
  photo,
  icon,
  selected,
  onPress,
}: {
  label: string;
  photo?: ImageSourcePropType;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      cssInterop={false}
      style={({ pressed }) => [styles.opt, shadow.soft, selected && styles.optOn, pressed && { transform: [{ scale: 0.99 }] }]}
    >
      {photo ? <Image source={photo} style={styles.optImg} /> : null}
      {!photo && icon ? (
        <View style={styles.optIcon}>
          <Ionicons name={icon} size={24} color={colors.ink} />
        </View>
      ) : null}
      <Text variant="bodyLg" weight="semibold" style={{ flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
      {selected ? <Tick /> : null}
    </Pressable>
  );
}

/** A big choice card with a photo (mock `.ow-way`). */
export function WayCard({
  title,
  meta,
  photo,
  selected,
  onPress,
}: {
  title: string;
  meta: string;
  photo: ImageSourcePropType;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}. ${meta}`}
      cssInterop={false}
      style={({ pressed }) => [styles.way, shadow.soft, selected && styles.optOn, pressed && { transform: [{ scale: 0.99 }] }]}
    >
      <View style={styles.wayImg}>
        <Image source={photo} style={StyleSheet.absoluteFill} resizeMode="cover" />
        {selected ? <Tick style={styles.wayTick} /> : null}
      </View>
      <View style={styles.wayText}>
        <Text variant="heading">{title}</Text>
        <Text variant="label" tone="muted">
          {meta}
        </Text>
      </View>
    </Pressable>
  );
}

/** Labelled text field (mock `.a-field`), 18px text, focus ring in the accent. */
export function Field({
  label,
  icon,
  ...input
}: TextInputProps & { label: string; icon?: React.ComponentProps<typeof Ionicons>['name'] }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <View style={[styles.ring, focus && { backgroundColor: colors.accentSoft }]}>
        <View style={[styles.field, focus && { borderColor: colors.ink }]}>
          {icon ? <Ionicons name={icon} size={22} color={colors.ink3} /> : null}
          <TextInput
            {...input}
            accessibilityLabel={label}
            placeholderTextColor={colors.ink3}
            onFocus={(e) => {
              setFocus(true);
              input.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocus(false);
              input.onBlur?.(e);
            }}
            style={[styles.input, input.multiline && styles.inputMulti, input.style]}
          />
        </View>
      </View>
    </View>
  );
}

export function Buddy({ size = 120, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style} accessibilityElementsHidden>
      <Image source={require('../../../assets/v2/owner/buddy.png')} style={{ width: size, height: size }} resizeMode="contain" />
    </View>
  );
}

/** A face cropped out of a wider photo (the mock's agent crops: fx/fy = point, zoom). */
export function Face({
  source,
  aspect,
  fx,
  fy,
  zoom,
  size = 56,
}: {
  source: number;
  aspect: number;
  fx: number;
  fy: number;
  zoom: number;
  size?: number;
}) {
  const w = size * zoom;
  const h = w / aspect;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: colors.bg2 }}>
      <Image
        source={source}
        style={{ position: 'absolute', width: w, height: h, left: size / 2 - fx * w, top: size / 2 - fy * h }}
      />
    </View>
  );
}

/**
 * A real website inside the app (template preview, private preview or the live site).
 * `scale` renders the page at phone width and shrinks it into a smaller card.
 */
export function SiteFrame({
  uri,
  html,
  interactive = true,
  scale = 1,
  width,
  height,
  style,
  testID,
  samplePreview = false,
  onPreviewError,
}: {
  uri?: string | null;
  html?: string | null;
  interactive?: boolean;
  scale?: number;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Read-only public template document; default owner site behavior stays unchanged. */
  samplePreview?: boolean;
  onPreviewError?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const source = html ? { html } : uri ? { uri } : null;
  const inner = scale !== 1 && width && height ? { width: width / scale, height: height / scale } : null;
  return (
    <View style={[styles.frame, width ? { width } : null, height ? { height } : null, style]} testID={testID} pointerEvents={interactive ? 'auto' : 'none'}>
      {source ? (
        <View
          style={
            inner
              ? {
                  width: inner.width,
                  height: inner.height,
                  transform: [{ translateX: -(inner.width - width!) / 2 }, { translateY: -(inner.height - height!) / 2 }, { scale }],
                }
              : StyleSheet.absoluteFill
          }
        >
          <SiteWebView
            source={source}
            originWhitelist={['*']}
            onLoadEnd={() => setLoading(false)}
            onError={onPreviewError ? () => { setLoading(false); onPreviewError(); } : undefined}
            onHttpError={onPreviewError ? event => {
              if (!uri || isSamplePreviewNavigationAllowed(uri, event.nativeEvent.url)) { setLoading(false); onPreviewError(); }
            } : undefined}
            onShouldStartLoadWithRequest={samplePreview ? request => !!uri && request.navigationType !== 'formsubmit'
              && isSamplePreviewNavigationAllowed(uri, request.url) : undefined}
            injectedJavaScriptBeforeContentLoaded={samplePreview ? SAMPLE_PREVIEW_SCRIPT : undefined}
            injectedJavaScript={samplePreview ? SAMPLE_PREVIEW_SCRIPT : undefined}
            scrollEnabled={interactive}
            showsVerticalScrollIndicator={false}
            setSupportMultipleWindows={false}
            allowsInlineMediaPlayback
            style={{ backgroundColor: colors.card }}
          />
        </View>
      ) : null}
      {loading ? (
        <View style={[StyleSheet.absoluteFill, styles.frameLoading]}>
          <ActivityIndicator color={colors.ink} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tick: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opt: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 16,
  },
  optOn: { borderColor: colors.ink },
  optImg: { width: 52, height: 52, borderRadius: 14 },
  optIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center' },
  way: { backgroundColor: colors.card, borderRadius: 24, borderWidth: 2, borderColor: 'transparent', padding: 8 },
  wayImg: { height: 120, borderRadius: 17, overflow: 'hidden', backgroundColor: colors.bg2 },
  wayTick: { position: 'absolute', top: 10, right: 10 },
  wayText: { paddingHorizontal: 8, paddingTop: 10, paddingBottom: 4, gap: 2 },
  ring: { borderRadius: radius.field + 3, padding: 3, margin: -3 },
  field: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.card,
  },
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 18, lineHeight: 24, color: colors.ink, paddingVertical: 14 },
  inputMulti: { minHeight: 120, textAlignVertical: 'top' },
  frame: { borderRadius: 22, overflow: 'hidden', backgroundColor: colors.card },
  frameLoading: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg2 },
});
