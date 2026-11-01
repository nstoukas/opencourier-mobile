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
  stopped: {
    backgroundColor: color['destructive-soft'],
  },
  soon: {
    backgroundColor: color.muted,
  },
  textBox: {
    flex: 1,
    marginLeft: 8,
  },
  title: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '700',
    color: color.foreground,
  },
  text: {
    fontSize: typeScale.caption.fontSize,
    color: color.foreground,
  },
});
