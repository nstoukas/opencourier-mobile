import { StyleSheet } from 'react-native';
import { color, radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: radius.md,
    backgroundColor: color['destructive-soft'],
  },
  text: {
    flex: 1,
    marginHorizontal: 8,
    fontSize: typeScale.caption.fontSize,
    fontWeight: '600',
    color: color.foreground,
  },
  // At least 48 px tall (touchRow) and wide, as every control (spec 0007).
  closeButton: {
    minWidth: 48,
    alignItems: 'center',
  },
  close: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '700',
    color: color.destructive,
  },
});
