import React from 'react';
import { Image, ImageStyle, StyleProp, View } from 'react-native';
import { hasImageUri } from '@app/utilities/imageUri';

type Props = {
  // The image URL. May be '' or undefined — that is the case this component exists for.
  uri?: string | null;
  // The same style you would have given the <Image>; the placeholder reuses it so the
  // surrounding row keeps exactly the same height and spacing when there is no image.
  style?: StyleProp<ImageStyle>;
};

export const RemoteImage = ({ uri, style }: Props) =>
  hasImageUri(uri) ? (
    <Image source={{ uri }} style={style} />
  ) : (
    <View style={style} />
  );
