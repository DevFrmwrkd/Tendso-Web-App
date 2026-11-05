import { BASE_PRICE, PRICE_CEILING } from '@tendso/shared/pricing';

/** Validate a price already saved with a capture or its final queued quote. */
export function validCapturePrice(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)
    && value >= BASE_PRICE && value <= PRICE_CEILING ? value : null;
}
