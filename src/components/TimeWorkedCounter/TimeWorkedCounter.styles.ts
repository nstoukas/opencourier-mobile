import { StyleSheet } from 'react-native';
import { color, radius, shadow, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    alignItems: 'flex-start',
  },
  // A small pill rather than a full width card: it is read at a glance and takes one line.
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: color.card,
    ...shadow.sm,
  },
  text: {
    marginLeft: 6,
    fontSize: typeScale.caption.fontSize,
    fontWeight: '700',
    color: color.foreground,
  },
});
