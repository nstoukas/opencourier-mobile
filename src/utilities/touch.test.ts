import { control } from '@app/styles/theme';
import { hitSlopFor, touchRow } from './touch';

describe('AC-5: touch targets and hitSlop (src/utilities/touch.ts)', () => {
  it('hitSlopFor(32) is 8 on every side', () => {
    expect(hitSlopFor(32)).toEqual({
      top: 8,
      bottom: 8,
      left: 8,
      right: 8,
    });
  });

  it('hitSlopFor(40) is 4 on every side', () => {
    expect(hitSlopFor(40)).toEqual({
      top: 4,
      bottom: 4,
      left: 4,
      right: 4,
    });
  });

  it('hitSlopFor(32, 32, 4) caps left and right at 4 and keeps top and bottom 8', () => {
    expect(hitSlopFor(32, 32, 4)).toEqual({
      top: 8,
      bottom: 8,
      left: 4,
      right: 4,
    });
  });

  it('hitSlopFor(60) is 0 on every side (does not produce negative hitSlop)', () => {
    expect(hitSlopFor(60)).toEqual({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    });
  });

  it('hitSlopFor(48) is 0 on every side', () => {
    expect(hitSlopFor(48)).toEqual({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    });
  });

  it('hitSlopFor with differing width and height computes vertical and horizontal room independently', () => {
    // control.xl is 48. width 28 -> (48-28)/2 = 10, height 40 -> (48-40)/2 = 4
    expect(hitSlopFor(28, 40)).toEqual({
      top: 4,
      bottom: 4,
      left: 10,
      right: 10,
    });
  });

  it('touchRow defines minHeight equal to control.xl and centers content', () => {
    expect(touchRow.minHeight).toBe(control.xl);
    expect(touchRow.minHeight).toBe(48);
    expect(touchRow.justifyContent).toBe('center');
  });
});
