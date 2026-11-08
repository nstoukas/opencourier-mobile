import { StyleSheet } from 'react-native';
import { color, radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.md,
  },
  onShift: {
    backgroundColor: color.primary,
  },
  free: {
    backgroundColor: color.muted,
  },
  text: {
    flex: 1,
    marginLeft: 8,
    fontSize: typeScale.caption.fontSize,
    fontWeight: '700',
    color: color.foreground,
  },
  onShiftText: {
    color: color['primary-foreground'],
  },
});
