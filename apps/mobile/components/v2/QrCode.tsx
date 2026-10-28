import React, { useMemo } from 'react';
import Svg, { Path } from 'react-native-svg';
import qrcode from 'qrcode-generator';

/** Shared vector QR artwork, with a four-module quiet zone for scanning. */
export function QrCode({ value, size = 192, accessibilityLabel = 'QR code' }: { value: string; size?: number; accessibilityLabel?: string }) {
  const matrix = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value); qr.make();
    const count = qr.getModuleCount();
    const pieces: string[] = [];
    for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) pieces.push(`M${col + 4},${row + 4}h1v1h-1z`);
    }
    return { path: pieces.join(''), count: count + 8 };
  }, [value]);
  return <Svg width={size} height={size} viewBox={`0 0 ${matrix.count} ${matrix.count}`} accessibilityLabel={accessibilityLabel} accessibilityRole="image">
    <Path d={`M0,0h${matrix.count}v${matrix.count}H0z`} fill="#ffffff" /><Path d={matrix.path} fill="#111111" />
  </Svg>;
}
