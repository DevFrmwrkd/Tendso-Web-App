import { capturePhotoReviewFor, needsCapturePhotoReview } from '../services/capturePhotoReview';

const marker = { submissionId: 'my-capture', previousBusinessType: 'Barber/Salon', businessType: 'Law Office', requiredAt: 100 };

it('requires confirmation of the retained photos for the new business type', () => {
  expect(needsCapturePhotoReview(marker, 'my-capture', 'Law Office')).toBe(true);
  expect(needsCapturePhotoReview({ ...marker, confirmedAt: 99 }, 'my-capture', 'Law Office')).toBe(true);
  expect(needsCapturePhotoReview({ ...marker, confirmedAt: 100 }, 'my-capture', 'Law Office')).toBe(false);
});

it('reopens photo review when the current category no longer matches the confirmed category', () => {
  const confirmed = { ...marker, confirmedAt: 120 };
  expect(needsCapturePhotoReview(confirmed, 'my-capture', 'Clinic')).toBe(true);
  expect(needsCapturePhotoReview(confirmed, 'my-capture', 'Barber/Salon')).toBe(true);
});

it('treats equivalent scraped category names as the same canonical business type', () => {
  expect(capturePhotoReviewFor({ ...marker, previousBusinessType: 'Hair salon', businessType: 'Legal services' }, 'my-capture'))
    .toMatchObject({ previousBusinessType: 'Barber/Salon', businessType: 'Law Office' });
  expect(needsCapturePhotoReview({ ...marker, confirmedAt: 100 }, 'my-capture', 'Legal services')).toBe(false);
});

it('does not borrow another capture’s review requirement or block unchanged legacy captures', () => {
  for (const value of [null, undefined, [], {}, marker])
    expect(needsCapturePhotoReview(value, 'other-capture', 'Law Office')).toBe(false);
});

it.each([NaN, Infinity, -1, '100'])('rejects an invalid required timestamp %s', requiredAt => {
  expect(capturePhotoReviewFor({ ...marker, requiredAt }, 'my-capture')).toBeNull();
});

it.each([NaN, Infinity, -1, '200'])('does not accept a malformed confirmation timestamp %s', confirmedAt => {
  expect(needsCapturePhotoReview({ ...marker, confirmedAt }, 'my-capture', 'Law Office')).toBe(true);
});
