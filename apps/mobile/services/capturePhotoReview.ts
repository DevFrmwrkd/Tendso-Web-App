import { normalizeCaptureBusinessType } from '../../../lib/captureDesign';

/** Retained photos need a new review when the shop's category changes. */
export type CapturePhotoReview = {
  submissionId: string;
  previousBusinessType: string;
  businessType: string;
  requiredAt: number;
  confirmedAt?: number;
};

export function capturePhotoReviewFor(value: unknown, submissionId: string): CapturePhotoReview | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const marker = value as Record<string, unknown>;
  if (!submissionId || marker.submissionId !== submissionId
    || typeof marker.previousBusinessType !== 'string' || !marker.previousBusinessType.trim()
    || typeof marker.businessType !== 'string' || !marker.businessType.trim()
    || typeof marker.requiredAt !== 'number' || !Number.isFinite(marker.requiredAt) || marker.requiredAt < 0) return null;
  const confirmedAt = typeof marker.confirmedAt === 'number' && Number.isFinite(marker.confirmedAt) && marker.confirmedAt >= 0
    ? marker.confirmedAt : undefined;
  return { submissionId, previousBusinessType: normalizeCaptureBusinessType(marker.previousBusinessType),
    businessType: normalizeCaptureBusinessType(marker.businessType), requiredAt: marker.requiredAt,
    ...(confirmedAt !== undefined ? { confirmedAt } : {}) };
}

export function needsCapturePhotoReview(value: unknown, submissionId: string, businessType: unknown): boolean {
  const marker = capturePhotoReviewFor(value, submissionId);
  return !!marker && (marker.confirmedAt === undefined || marker.confirmedAt < marker.requiredAt
    || marker.businessType !== normalizeCaptureBusinessType(businessType));
}
