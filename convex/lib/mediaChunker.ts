/**
 * The media chunker lives in lib/services/media-chunker.ts, which the Next.js
 * transcription route uses too. This was a second, identical copy; re-exporting
 * keeps the Convex action and the route splitting files the same way.
 */
export { chunkMediaFile, getFileExtension } from '../../lib/services/media-chunker';
