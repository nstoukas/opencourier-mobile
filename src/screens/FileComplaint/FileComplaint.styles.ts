import { StyleSheet } from 'react-native';
import { color, radius, typeScale } from '@app/styles/theme';

// Slice 2 (spec 0052): the photo part of the complaint form. The rest of the form shares the review
// request screen's styles.
export const photoStyles = StyleSheet.create({
  photoArea: {
    marginBottom: 12,
    gap: 8,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: color.muted,
  },
  photoActions: {
    flex: 1,
    gap: 4,
  },
  // A text button with a 44 pt tall touch area.
  photoAction: {
    minHeight: 44,
    justifyContent: 'center',
  },
  photoActionText: {
    fontSize: typeScale.body.fontSize,
    color: color.foreground,
    textDecorationLine: 'underline',
  },
  hint: {
    fontSize: typeScale.caption.fontSize,
    color: color['muted-foreground'],
  },
});
