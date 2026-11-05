import React from 'react';
import { previewAsset } from 'creator-preview:inline-assets';

/** next/image's fill geometry, using the exact same local image bytes without a web server. */
export default function PreviewImage({ src, alt, fill, style, priority: _priority,
  quality: _quality, loader: _loader, unoptimized: _unoptimized, placeholder: _placeholder,
  blurDataURL: _blurDataURL, ...props }) {
  const source = typeof src === 'string' ? src : src?.src;
  return <img {...props} alt={alt || ''} src={previewAsset(source)}
    style={fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', ...style } : style} />;
}
