import React, { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { Image as NativeImage, StyleSheet, View } from 'react-native';
import Svg, { ClipPath, Defs, Image as SvgImage, Rect, Text as SvgText } from 'react-native-svg';
import { boldOfferPosterScene, POSTER_PAGE, type AffiliatePosterModel, type PosterNode } from '../../../../lib/affiliatePoster';
import { fonts } from '../../theme/v2';
import { QrCode } from '../v2/QrCode';
import { svgPosterPng } from './posterExport';

const BRAND = require('../../assets/brand/mark-ink-256.png');
export const POSTER_IMAGE_TIMEOUT_MS = 8000;
const FONT_FAMILY = { 400: fonts.regular, 500: fonts.medium, 600: fonts.semibold, 700: fonts.bold } as const;
export type BoldOfferPosterHandle = { exportPng: () => Promise<string> };
export type BoldOfferPosterProps = { model: AffiliatePosterModel };
type ArtworkState = { brandReady: boolean; photoReady: boolean; photoFallback: boolean; error: boolean };
type Waiter = { resolve: () => void; reject: (reason: Error) => void };

const PreparedPoster = forwardRef<BoldOfferPosterHandle, BoldOfferPosterProps>(function PreparedPoster({ model }, ref) {
  const svg = useRef<Svg>(null);
  const mounted = useRef(true);
  const status = useRef<ArtworkState>({ brandReady: false, photoReady: !model.photo, photoFallback: !model.photo, error: false });
  const waiters = useRef(new Set<Waiter>());
  const [photoFallback, setPhotoFallback] = useState(!model.photo);
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const scene = boldOfferPosterScene(photoFallback ? { ...model, photo: null } : model);

  function settle(patch: Partial<ArtworkState>) {
    if (!mounted.current) return;
    status.current = { ...status.current, ...patch };
    if (patch.photoFallback !== undefined) setPhotoFallback(patch.photoFallback);
    const next = status.current;
    if (!next.error && !(next.brandReady && next.photoReady)) return;
    for (const waiter of waiters.current) {
      if (next.error) waiter.reject(new Error('The poster artwork could not load.'));
      else waiter.resolve();
    }
    waiters.current.clear();
  }
  function usePhotoFallback() {
    if (!status.current.photoReady) settle({ photoReady: true, photoFallback: true });
  }
  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(() => {
      usePhotoFallback();
      if (!status.current.brandReady) settle({ error: true });
    }, POSTER_IMAGE_TIMEOUT_MS);
    try {
      const brand = NativeImage.resolveAssetSource(BRAND);
      if (brand?.uri) NativeImage.getSize(brand.uri, () => {}, () => {
        if (!status.current.brandReady) settle({ error: true });
      });
    } catch { if (!status.current.brandReady) settle({ error: true }); }
    if (model.photo) {
      try { NativeImage.getSize(model.photo, () => {}, usePhotoFallback); }
      catch { usePhotoFallback(); }
    }
    return () => {
      mounted.current = false;
      clearTimeout(timer);
      for (const waiter of waiters.current) waiter.reject(new Error('The poster was closed.'));
      waiters.current.clear();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    async exportPng() {
      if (!mounted.current) throw new Error('The poster was closed.');
      const current = status.current;
      if (current.error) throw new Error('The poster artwork could not load.');
      if (!current.brandReady || !current.photoReady) await new Promise<void>((resolve, reject) => { waiters.current.add({ resolve, reject }); });
      // Let an initials fallback reach the native SVG scene before requesting the PNG.
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('The poster is not ready to export.')), 1500);
        requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(timer); resolve(); }));
      });
      if (!mounted.current || !svg.current) throw new Error('The poster was closed.');
      const result = await svgPosterPng(svg.current);
      if (!mounted.current) throw new Error('The poster was closed.');
      return result;
    },
  }), []);

  function renderNode(node: PosterNode) {
    if (node.kind === 'rect') return <Rect key={node.id} x={node.x} y={node.y} width={node.width} height={node.height}
      rx={node.radius} fill={node.fill} stroke={node.stroke} strokeWidth={node.strokeWidth} testID={`affiliate-poster-${node.id}`} />;
    if (node.kind === 'text') return <SvgText key={node.id} x={node.x} y={node.y} fontSize={node.fontSize}
      fontFamily={FONT_FAMILY[node.weight]} fill={node.fill} textAnchor={node.anchor ?? 'start'} testID={`affiliate-poster-${node.id}`}>{node.text}</SvgText>;
    if (node.kind === 'qr') return <Svg key={node.id} x={node.x} y={node.y} width={node.size} height={node.size}
      viewBox={`0 0 ${node.size} ${node.size}`} testID="affiliate-poster-qr"><QrCode value={node.value} size={node.size} accessibilityLabel="QR code for your saved creator shop page" /></Svg>;
    const clip = `${id}-${node.id}`;
    return <React.Fragment key={node.id}>
      {node.radius ? <Defs><ClipPath id={clip}><Rect x={node.x} y={node.y} width={node.width} height={node.height} rx={node.radius} /></ClipPath></Defs> : null}
      <SvgImage x={node.x} y={node.y} width={node.width} height={node.height} href={node.id === 'brand' ? BRAND : { uri: node.href }}
        preserveAspectRatio="xMidYMid slice" clipPath={node.radius ? `url(#${clip})` : undefined}
        testID={`affiliate-poster-${node.id}`} onLoad={() => {
          if (node.id === 'brand') settle({ brandReady: true, error: false });
          else if (!status.current.photoFallback) settle({ photoReady: true });
        }} />
    </React.Fragment>;
  }

  return <View style={styles.page} testID={photoFallback && model.photo ? 'affiliate-poster-photo-fallback' : 'affiliate-poster-artwork'}>
    <Svg ref={svg} width="100%" height="100%" viewBox={`0 0 ${POSTER_PAGE.width} ${POSTER_PAGE.height}`}
      accessibilityRole="image" accessibilityLabel={`Printable Tendso poster shared by ${model.name}`} testID="affiliate-bold-offer-poster">
      {scene.map(renderNode)}
    </Svg>
  </View>;
});

/** A changed saved offer remounts preparation so a previous photo can never enter the next export. */
export const BoldOfferPoster = forwardRef<BoldOfferPosterHandle, BoldOfferPosterProps>(function BoldOfferPoster(props, ref) {
  return <PreparedPoster {...props} key={JSON.stringify(props.model)} ref={ref} />;
});

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 320, aspectRatio: POSTER_PAGE.width / POSTER_PAGE.height, alignSelf: 'center', backgroundColor: '#FFFFFF' },
});
