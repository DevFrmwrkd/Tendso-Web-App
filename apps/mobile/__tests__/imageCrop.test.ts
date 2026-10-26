import { getCoverImageLayout } from '../lib/imageCrop';
import { TRAINING_LESSONS } from '../lib/trainingLessons';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

describe('cover image layout', () => {
  it.each([
    [{ width: 600, height: 800 }, { width: 353, height: 190 }],
    [{ width: 1000, height: 600 }, { width: 353, height: 190 }],
    [{ width: 1800, height: 400 }, { width: 100, height: 140 }],
  ])('covers the whole frame without stretching the source', (source, frame) => {
    const layout = getCoverImageLayout(source, frame, { x: 0.5, y: 0.25 })!;
    expect(layout).not.toBeNull();
    expect(layout.width / layout.height).toBeCloseTo(source.width / source.height);
    expect(layout.left).toBeLessThanOrEqual(0);
    expect(layout.top).toBeLessThanOrEqual(0);
    expect(layout.left + layout.width).toBeGreaterThanOrEqual(frame.width - 0.001);
    expect(layout.top + layout.height).toBeGreaterThanOrEqual(frame.height - 0.001);
  });

  it('clamps crop positions at the image edges so they cannot expose an empty strip', () => {
    const source = { width: 600, height: 800 };
    const frame = { width: 353, height: 190 };
    expect(getCoverImageLayout(source, frame, { x: -5, y: -5 }))
      .toEqual(getCoverImageLayout(source, frame, { x: 0, y: 0 }));
    expect(getCoverImageLayout(source, frame, { x: 5, y: 5 }))
      .toEqual(getCoverImageLayout(source, frame, { x: 1, y: 1 }));
  });

  it.each([
    [{ width: 0, height: 800 }, { width: 353, height: 190 }],
    [{ width: 600, height: -1 }, { width: 353, height: 190 }],
    [{ width: 600, height: 800 }, { width: 0, height: 190 }],
    [{ width: 600, height: 800 }, { width: 353, height: Number.NaN }],
  ])('waits for valid source and frame measurements', (source, frame) => {
    expect(getCoverImageLayout(source, frame)).toBeNull();
  });
});

// These source-pixel bounds identify faces in the bundled photos. They catch
// a centered cover crop cutting off a head even when the frame itself is full.
const lessonFaces = [
  { id: 1, width: 896, height: 1120, hair: 140, chin: 450 },
  { id: 2, width: 1402, height: 1122, hair: 185, chin: 475 },
  { id: 3, width: 1100, height: 1366, hair: 260, chin: 600 },
  { id: 4, width: 1120, height: 896, hair: 140, chin: 340 },
];

describe('training subject framing', () => {
  it.each(lessonFaces)('keeps the complete face visible in lesson $id at phone banner widths', (subject) => {
    const lesson = TRAINING_LESSONS.find(({ id }) => id === subject.id)!;
    for (const width of [320, 353, 382]) {
      const frame = { width, height: 190 };
      const layout = getCoverImageLayout(subject, frame, lesson.cropPosition)!;
      const scale = layout.height / subject.height;
      expect(layout.top + subject.hair * scale).toBeGreaterThanOrEqual(0);
      expect(layout.top + subject.chin * scale).toBeLessThanOrEqual(frame.height);
      if (subject.id === 2) {
        // Keep the lit phone, including its recording timer and stop control,
        // visible alongside the speaker at every tested banner width.
        expect(layout.left + 890 * scale).toBeGreaterThanOrEqual(0);
        expect(layout.left + 1000 * scale).toBeLessThanOrEqual(frame.width);
        expect(layout.top + 280 * scale).toBeGreaterThanOrEqual(0);
        expect(layout.top + 520 * scale).toBeLessThanOrEqual(frame.height);
      }
    }
  });

  it.each([
    { id: 'portrait', left: 200, right: 600, top: 190, bottom: 800 },
    { id: 'shop-front', left: 230, right: 650, top: 230, bottom: 720 },
    { id: 'craft', left: 100, right: 750, top: 110, bottom: 650 },
  ])('keeps the $id example subject visible in the smaller cards', (subject) => {
    const example = TRAINING_LESSONS[4].examples!.find(({ id }) => id === subject.id)!;
    const source = { width: 880, height: 1168 };
    for (const width of [100, 119]) {
      const frame = { width, height: 140 };
      const layout = getCoverImageLayout(source, frame, example.cropPosition)!;
      const scale = layout.width / source.width;
      expect(layout.left + subject.left * scale).toBeGreaterThanOrEqual(0);
      expect(layout.left + subject.right * scale).toBeLessThanOrEqual(frame.width);
      expect(layout.top + subject.top * scale).toBeGreaterThanOrEqual(0);
      expect(layout.top + subject.bottom * scale).toBeLessThanOrEqual(frame.height);
    }
  });
});
