export interface ImageCropPosition {
  /** Alignment of the cropped overflow: 0 is left/top, 1 is right/bottom. */
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

function alignment(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
}

/** Fill a frame without distortion, then align its overflow around the subject. */
export function getCoverImageLayout(source: Size, frame: Size, position?: ImageCropPosition) {
  if (![source.width, source.height, frame.width, frame.height].every((value) => Number.isFinite(value) && value > 0)) return null;

  const scale = Math.max(frame.width / source.width, frame.height / source.height);
  const width = source.width * scale;
  const height = source.height * scale;
  return {
    width,
    height,
    left: (frame.width - width) * alignment(position?.x),
    top: (frame.height - height) * alignment(position?.y),
  };
}
