import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
// `import type`: these are TypeScript types only, removed when the app is built.
import type { Icon as PhosphorIcon, IconWeight } from 'phosphor-react-native';
import { color, ColorName } from '@app/styles/theme';

type Props = {
  // The Phosphor glyph itself, imported one module per icon so Metro does not load all of them:
  // import { CaretDown } from 'phosphor-react-native/src/icons/CaretDown'
  icon: PhosphorIcon;
  size?: number;
  weight?: IconWeight;
  // A design system color name, never a hex value (spec 0007).
  tone?: ColorName;
  style?: StyleProp<ViewStyle>;
};

// Every icon in the app goes through here, so its color always comes from the tokens. The style
// (margins, a rotation) goes on a wrapping View: the SVG element itself ignores a transform.
export const Icon = ({
  icon: Glyph,
  size = 24,
  weight = 'regular',
  tone = 'foreground',
  style,
}: Props) => (
  <View style={style}>
    <Glyph size={size} weight={weight} color={color[tone]} />
  </View>
);
