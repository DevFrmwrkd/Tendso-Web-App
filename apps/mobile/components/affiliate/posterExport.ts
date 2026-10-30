import * as FileSystem from 'expo-file-system/legacy';
import { PixelRatio, Platform } from 'react-native';
import { POSTER_PAGE } from '../../../../lib/affiliatePoster';

export type PosterSvgExporter = { toDataURL: (callback: (base64: string) => void, options?: object) => void };
export const POSTER_EXPORT_TIMEOUT_MS = 10000;
let fileSequence = 0;

/** iOS SVG bounds are points rendered at the screen scale; Android takes raw pixels. */
export function posterRasterSize(): { width: number; height: number } {
  const scale = Platform.OS === 'ios' ? Math.max(1, PixelRatio.get()) : 1;
  return { width: Math.ceil(POSTER_PAGE.exportWidth / scale), height: Math.ceil(POSTER_PAGE.exportHeight / scale) };
}

/** Rasterize the vector scene at A4 print resolution, independently of the on-screen thumbnail. */
export function svgPosterPng(svg: PosterSvgExporter, timeoutMs = POSTER_EXPORT_TIMEOUT_MS): Promise<string> {
  return new Promise((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => {
      finished = true;
      reject(new Error('The poster export timed out.'));
    }, timeoutMs);
    try {
      svg.toDataURL(value => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        const base64 = typeof value === 'string' ? value.replace(/^data:image\/png;base64,/, '').trim() : '';
        if (!base64) reject(new Error('The poster image is empty.'));
        else resolve(base64);
      }, posterRasterSize());
    } catch (error) {
      if (!finished) { finished = true; clearTimeout(timer); reject(error); }
    }
  });
}

export async function cleanupPosterPng(uri: string | undefined): Promise<void> {
  if (!uri) return;
  try { await FileSystem.deleteAsync(uri, { idempotent: true }); }
  catch { /* A cache file may already have been removed by the OS. */ }
}

/** The share sheet receives a real PNG file, never a base64 URL or a resized screenshot. */
export async function persistPosterPng(base64: string): Promise<string> {
  if (!FileSystem.cacheDirectory) throw new Error('The poster cache is unavailable.');
  const uri = `${FileSystem.cacheDirectory}tendso-creator-poster-${Date.now()}-${++fileSequence}.png`;
  try {
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
    return uri;
  } catch (error) { await cleanupPosterPng(uri); throw error; }
}
