import { Colors } from './colors';
import { color, colors, withAlpha } from './theme';

describe('AC-1 and AC-2: theme and colors', () => {
  it("computes withAlpha('#ffffff', 0.4) as 'rgba(255, 255, 255, 0.4)'", () => {
    expect(withAlpha('#ffffff', 0.4)).toBe('rgba(255, 255, 255, 0.4)');
    expect(withAlpha('#000000', 0)).toBe('rgba(0, 0, 0, 0)');
    expect(withAlpha('#393938', 1)).toBe('rgba(57, 57, 56, 1)');
  });

  it('exports color shortcut equal to colors.light', () => {
    expect(color).toBe(colors.light);
  });

  // The spec's color table mapping old color names to design system tokens
  const colorTableEntries: [string, unknown][] = [
    // background
    ['white', color.background],
    ['white2', color.background],
    ['gray20', color.background],
    ['yellow4', color.background],
    // muted
    ['white3', color.muted],
    ['gray6', color.muted],
    ['gray10', color.muted],
    ['gray14', color.muted],
    ['gray24', color.muted],
    // foreground
    ['black', color.foreground],
    ['black1', color.foreground],
    ['black2', color.foreground],
    ['black3', color.foreground],
    ['black5', color.foreground],
    ['black6', color.foreground],
    ['black7', color.foreground],
    ['black8', color.foreground],
    ['gray11', color.foreground],
    // primary
    ['black4', color.primary],
    // muted-foreground (including blackAlpha05 which is only ever a text color)
    ['blackAlpha05', color['muted-foreground']],
    ['gray2', color['muted-foreground']],
    ['gray3', color['muted-foreground']],
    ['gray5', color['muted-foreground']],
    ['gray13', color['muted-foreground']],
    ['gray15', color['muted-foreground']],
    ['gray16', color['muted-foreground']],
    ['gray19', color['muted-foreground']],
    ['gray21', color['muted-foreground']],
    ['gray23', color['muted-foreground']],
    // border
    ['gray1', color.border],
    // input (gray4, gray7, gray9, gray12)
    ['gray4', color.input],
    ['gray7', color.input],
    ['gray9', color.input],
    ['gray12', color.input],
    // secondary
    ['gray8', color.secondary],
    ['gray22', color.secondary],
    // route
    ['blue1', color.route],
    // info
    ['blue3', color.info],
    ['blue4', color.info],
    ['blue6', color.info],
    ['blue7', color.info],
    // info-soft
    ['blue2', color['info-soft']],
    ['blue5', color['info-soft']],
    // destructive
    ['red1', color.destructive],
    ['red4', color.destructive],
    ['red7', color.destructive],
    // destructive-soft
    ['red5', color['destructive-soft']],
    ['red6', color['destructive-soft']],
    // success
    ['green1', color.success],
    ['green2', color.success],
    ['green6', color.success],
    ['green8', color.success],
    // success-soft
    ['green3', color['success-soft']],
    ['green5', color['success-soft']],
    ['green7', color['success-soft']],
    // warning
    ['yellow1', color.warning],
    ['yellow2', color.warning],
    // warning-soft
    ['yellow3', color['warning-soft']],
    ['yellow5', color['warning-soft']],
    // chart-4 (the system's amber; the connecting dot)
    ['orange1', color['chart-4']],
    // overlay
    ['transparentModalBackground', color.overlay],
    // transparent
    ['transparent', 'transparent'],
    // light stripes of Accept and Decline buttons at alpha 0.4
    ['green4', withAlpha(color['success-foreground'], 0.4)],
    ['red3', withAlpha(color['destructive-foreground'], 0.4)],
    // gradients
    [
      'onlineGradientArray',
      [
        color['online-tint'],
        withAlpha(color['online-tint'], 0.8),
        withAlpha(color['online-tint'], 0.45),
        withAlpha(color['online-tint'], 0),
      ],
    ],
    [
      'offlineGradientArray',
      [
        color['offline-tint'],
        withAlpha(color['offline-tint'], 0.7),
        withAlpha(color['offline-tint'], 0.25),
        withAlpha(color['offline-tint'], 0),
      ],
    ],
    [
      'swipeButtonGradientArray',
      [color.background, withAlpha(color.background, 0.5)],
    ],
  ];

  describe('table driven test over the entire color table', () => {
    test.each(colorTableEntries)(
      'Colors.%s equals the expected token or alpha color',
      (name, expectedToken) => {
        expect((Colors as Record<string, unknown>)[name]).toEqual(
          expectedToken,
        );
      },
    );

    it('covers every entry in Colors without omission', () => {
      const definedKeys = Object.keys(Colors).sort();
      const testedKeys = colorTableEntries.map(([name]) => name).sort();
      expect(definedKeys).toEqual(testedKeys);
    });
  });

  it('does not contain any of the eight deleted color names', () => {
    const deletedNames = [
      'black9',
      'gray17',
      'gray18',
      'red2',
      'yellow6',
      'blackOpacity1',
      'blackOpacity2',
      'blackOpacity3',
    ];
    for (const deletedName of deletedNames) {
      expect(Colors).not.toHaveProperty(deletedName);
    }
  });
});
