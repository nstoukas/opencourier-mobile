import { Insets } from 'react-native';
import { control } from '@app/styles/theme';

// The touch area every control needs, however small it draws: 48 x 48 (spec 0007, AC-5).
// For an icon button drawn smaller, `hitSlop` adds the missing room on each side:
// a 32 px button gets 8 more on every side. `maxSide` caps the left and right room for
// buttons that sit side by side, so their touch areas do not overlap.
export function hitSlopFor(
  width: number,
  height: number = width,
  maxSide?: number,
): Insets {
  const vertical = Math.max(0, (control.xl - height) / 2);
  const side = Math.max(0, (control.xl - width) / 2);
  const horizontal = maxSide === undefined ? side : Math.min(side, maxSide);
  return {
    top: vertical,
    bottom: vertical,
    left: horizontal,
    right: horizontal,
  };
}

// For a pressable row or text button that sets no size of its own: at least 48 px tall, with its
// content centered, so the touch area is never smaller than the control (spec 0007, AC-5).
export const touchRow = {
  minHeight: control.xl,
  justifyContent: 'center',
} as const;
