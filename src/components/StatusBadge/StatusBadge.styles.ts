import { StyleSheet } from 'react-native';
import { radius, space, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  // At least 24 px tall: a label, not a control (spec 0007).
  container: {
    minHeight: 24,
    paddingHorizontal: space['2'],
    borderRadius: radius.full,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  text: {
    fontSize: typeScale.caption.fontSize,
    lineHeight: typeScale.caption.lineHeight,
    fontWeight: '600',
  },
});
