import React, { forwardRef } from 'react';

/** Preserve public-page markup while leaving navigation to the read-only document guard. */
export default forwardRef(function PreviewLink({ href, prefetch: _prefetch, replace: _replace,
  scroll: _scroll, locale: _locale, ...props }, ref) {
  const destination = typeof href === 'string' ? href : href?.pathname || '#';
  return <a {...props} ref={ref} href={destination} />;
});
